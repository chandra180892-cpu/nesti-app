import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const DAILY_TARGETS = {
  feedMl: 560,
  sleepHours: 14,
  diapers: 6,
  medicines: 6
}

const MEDICINES = [
  { name: 'Vitamin D3 (Calsine P)', dose: '0.5ml', frequency: 1 },
  { name: 'Vitamin A to Z', dose: '0.5ml', frequency: 1 },
  { name: 'Iron (Tonoferron)', dose: '0.3ml', frequency: 1 },
  { name: 'Calcium (Calcimax P)', dose: '2ml', frequency: 3 }
]

const TIME_PILLS = ['Just now', '15m ago', '30m ago', '1hr ago', 'Custom']

function TimePillSelector({ selected, onSelect }) {
  return (
    <div className="time-pills">
      {TIME_PILLS.map(t => (
        <button key={t} className={`time-pill ${selected === t ? 'active' : ''}`} onClick={() => onSelect(t)}>{t}</button>
      ))}
    </div>
  )
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [])
  return <div className="toast">{message}</div>
}

export default function Today({ session, baby, age, greeting, parentProfile, onMenuTap }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSheet, setActiveSheet] = useState(null)
  const [toast, setToast] = useState(null)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [nestiObs, setNestiObs] = useState(null)
  const [nestiLoading, setNestiLoading] = useState(false)
  const [obsCollapsed, setObsCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([{ role: 'assistant', content: "Hi! Tell me what's on your mind about Maanvik 🌿" }])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatNotes, setChatNotes] = useState([])
  const [showChatSummary, setShowChatSummary] = useState(false)
  const [selectedNotes, setSelectedNotes] = useState([])
  const [clinicNumber, setClinicNumber] = useState('')
  const [clinicInput, setClinicInput] = useState('')
  const [showClinicInput, setShowClinicInput] = useState(false)
  const [showWhatsAppSheet, setShowWhatsAppSheet] = useState(false)
  const [whatsappMsg, setWhatsappMsg] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceResult, setVoiceResult] = useState(null)
  const [voiceError, setVoiceError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [audioContext, setAudioContext] = useState(null)
  const [playingSound, setPlayingSound] = useState(null)
  const [soundNodes, setSoundNodes] = useState(null)
  const [volume, setVolume] = useState(0.5)
  const [flipCard, setFlipCard] = useState(null)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const chatEndRef = useRef(null)

  // Feed form state
  const [feedTime, setFeedTime] = useState('Just now')
  const [feedType, setFeedType] = useState('Breastmilk')
  const [feedVol, setFeedVol] = useState(55)

  // Sleep form state
  const [sleepTime, setSleepTime] = useState('Just now')
  const [sleepDuration, setSleepDuration] = useState(120)
  const [sleepQuality, setSleepQuality] = useState('Settled')
  const [sleepOngoing, setSleepOngoing] = useState(false)

  // Diaper form state
  const [diaperTime, setDiaperTime] = useState('Just now')
  const [diaperType, setDiaperType] = useState('Wet')
  const [diaperWetness, setDiaperWetness] = useState('Normal')
  const [diaperNotes, setDiaperNotes] = useState('')

  // Medicine form state
  const [medTime, setMedTime] = useState('Just now')
  const [medName, setMedName] = useState(MEDICINES[0].name)

  useEffect(() => { loadLogs() }, [])
  useEffect(() => { if (logs.length > 0 || !loading) generateNestiObs() }, [logs])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatHistory])

  const loadLogs = async () => {
    const today = new Date().toISOString().split('T')[0]
    const tables = ['feed_logs', 'sleep_logs', 'diaper_logs', 'medicine_logs']
    const allLogs = []
    for (const table of tables) {
      const col = table === 'sleep_logs' ? 'start_time' : 'logged_at'
      const { data } = await supabase.from(table).select('*')
        .gte(col, today + 'T00:00:00')
        .lte(col, today + 'T23:59:59')
        .order(col, { ascending: false })
      if (data) data.forEach(r => allLogs.push({ ...r, logType: table.replace('_logs', '') }))
    }
    allLogs.sort((a, b) => {
      const ta = a.logged_at || a.start_time
      const tb = b.logged_at || b.start_time
      return new Date(tb) - new Date(ta)
    })
    setLogs(allLogs)
    setLoading(false)
  }

  const resolveTime = (pill) => {
    const now = new Date()
    if (pill === 'Just now') return now.toISOString()
    if (pill === '15m ago') return new Date(now - 15 * 60000).toISOString()
    if (pill === '30m ago') return new Date(now - 30 * 60000).toISOString()
    if (pill === '1hr ago') return new Date(now - 60 * 60000).toISOString()
    return now.toISOString()
  }

  const showToast = (msg) => setToast(msg)

  const saveLog = async (table, data) => {
    const { error } = await supabase.from(table).insert({ ...data, baby_id: baby.id, logged_by: session.user.id })
    if (error) { showToast('Error saving — ' + error.message); return false }
    return true
  }

  const handleSaveFeed = async () => {
    const ok = await saveLog('feed_logs', { logged_at: resolveTime(feedTime), type: feedType, volume_ml: feedVol })
    if (ok) { showToast('Feed logged! 🍼'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveSleep = async () => {
    const start = resolveTime(sleepTime)
    const end = sleepOngoing ? null : new Date(new Date(start).getTime() + sleepDuration * 60000).toISOString()
    const ok = await saveLog('sleep_logs', { start_time: start, end_time: end, duration_minutes: sleepOngoing ? null : sleepDuration, quality: sleepQuality })
    if (ok) { showToast('Sleep logged! 💤'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveDiaper = async () => {
    const ok = await saveLog('diaper_logs', { logged_at: resolveTime(diaperTime), type: diaperType, wetness: diaperWetness, notes: diaperNotes })
    if (ok) { showToast('Diaper logged! 🩹'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveMed = async () => {
    const ok = await saveLog('medicine_logs', { logged_at: resolveTime(medTime), medicine_name: medName, dose: MEDICINES.find(m => m.name === medName)?.dose || '' })
    if (ok) { showToast('Medicine logged! 💊'); setActiveSheet(null); await loadLogs() }
  }

  const handleDeleteLog = async (log) => {
    const tableMap = { feed: 'feed_logs', sleep: 'sleep_logs', diaper: 'diaper_logs', medicine: 'medicine_logs' }
    const table = tableMap[log.logType]
    if (!table) return
    await supabase.from(table).delete().eq('id', log.id)
    showToast('Entry deleted')
    await loadLogs()
  }

  // Metrics calculations
  const getTodayMetrics = useCallback(() => {
    const feedLogs = logs.filter(l => l.logType === 'feed')
    const sleepLogs = logs.filter(l => l.logType === 'sleep')
    const diaperLogs = logs.filter(l => l.logType === 'diaper')
    const medLogs = logs.filter(l => l.logType === 'medicine')

    const totalFeedMl = feedLogs.reduce((s, l) => s + (l.volume_ml || 0), 0)
    const totalSleepMin = sleepLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0)
    const totalSleepHrs = totalSleepMin / 60
    const diaperCount = diaperLogs.length
    const medCount = medLogs.length

    const lastFeed = feedLogs[0]
    const lastFeedTime = lastFeed ? new Date(lastFeed.logged_at) : null
    const minsAgo = lastFeedTime ? Math.floor((new Date() - lastFeedTime) / 60000) : null

    return { totalFeedMl, totalSleepHrs, diaperCount, medCount, lastFeedTime, minsAgo, feedLogs, sleepLogs, diaperLogs, medLogs }
  }, [logs])

  const getNudge = useCallback(() => {
    const { totalFeedMl, totalSleepHrs, diaperCount, medCount, minsAgo, diaperLogs } = getTodayMetrics()
    const hour = new Date().getHours()
    const dayFraction = hour / 24

    // Red: feed severely overdue
    if (minsAgo !== null && minsAgo > 240) return { color: '#E05C5C', bg: '#FFEBEE', icon: '🍼', text: `Maanvik's last feed was ${Math.floor(minsAgo / 60)}hr ${minsAgo % 60}min ago — time to feed him now` }
    // Red: no soiled diaper in 24hrs
    const soiledLogs = diaperLogs.filter(l => l.type === 'Soiled' || l.type === 'Both')
    if (soiledLogs.length === 0 && hour > 12) return { color: '#E05C5C', bg: '#FFEBEE', icon: '🩹', text: 'No soiled diaper logged in 24hrs — worth keeping an eye on' }
    // Amber: feed behind
    const expectedFeedMl = dayFraction * DAILY_TARGETS.feedMl * 0.5
    if (totalFeedMl < expectedFeedMl && hour > 8) return { color: '#F5A623', bg: '#FFF8E1', icon: '🍼', text: `Feed running low — ${Math.round(totalFeedMl)}ml logged, ~${Math.round(expectedFeedMl)}ml expected by now` }
    // Amber: sleep behind
    const expectedSleepHrs = dayFraction * DAILY_TARGETS.sleepHours * 0.5
    if (totalSleepHrs < expectedSleepHrs && hour > 12) return { color: '#F5A623', bg: '#FFF8E1', icon: '💤', text: `Sleep running low — ${totalSleepHrs.toFixed(1)}hrs logged, ~${expectedSleepHrs.toFixed(1)}hrs expected by now` }
    // Amber: diaper behind
    const expectedDiapers = Math.floor(dayFraction * DAILY_TARGETS.diapers)
    if (expectedDiapers - diaperCount >= 2) return { color: '#F5A623', bg: '#FFF8E1', icon: '🩹', text: `Diaper count seems low — ${diaperCount} logged, ~${expectedDiapers} expected by now` }
    // Amber: meds
    if (hour >= 18 && (DAILY_TARGETS.medicines - medCount) >= 2) return { color: '#F5A623', bg: '#FFF8E1', icon: '💊', text: `${DAILY_TARGETS.medicines - medCount} medicine doses still pending today` }
    // Green
    return { color: '#2E7D32', bg: '#E8F5E9', icon: '🌿', text: "Maanvik's doing great today — all targets on track" }
  }, [getTodayMetrics])

  const generateNestiObs = async () => {
    setNestiLoading(true)
    const metrics = getTodayMetrics()
    const systemPrompt = `You are nesti, a warm AI paediatric care companion for parents of Maanvik, a premature baby born at 30+4 weeks, now ${age.chronMonths} months ${age.chronRemDays} days old (${age.corrWeeks} weeks ${age.corrRemDays} days corrected). Analyse today's logs. Respond in EXACTLY this format — no prose:\n🍼 Feeding\n• [one crisp bullet max 15 words]\n💤 Sleep\n• [one crisp bullet]\n🌟 Overall\n• [one crisp bullet]\n*[one warm encouraging line in italics]*\nMax 10 lines total.`
    const userMsg = `Today's data: Feeds: ${metrics.totalFeedMl}ml total (${metrics.feedLogs.length} feeds). Sleep: ${metrics.totalSleepHrs.toFixed(1)}hrs (${metrics.sleepLogs.length} sessions). Diapers: ${metrics.diaperCount}. Medicines given: ${metrics.medCount}. Last feed: ${metrics.minsAgo ? metrics.minsAgo + ' mins ago' : 'not logged today'}.`
    const fallback = `🍼 Feeding\n• ${metrics.totalFeedMl}ml logged — ${metrics.totalFeedMl >= DAILY_TARGETS.feedMl * 0.5 ? 'on track for daily target' : 'building toward daily target'}\n\n💤 Sleep\n• ${metrics.totalSleepHrs.toFixed(1)}hrs logged — ${metrics.totalSleepHrs >= 7 ? 'good rest so far today' : 'keep encouraging sleep windows'}\n\n🌟 Overall\n• ${metrics.diaperCount >= 4 ? 'Good diaper output' : 'Watch diaper count'} — rhythm looks ${metrics.feedLogs.length >= 3 ? 'consistent' : 'developing'} today\n\n*You're doing beautifully, every log matters 🌿*`
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage: userMsg })
      })
      const data = await res.json()
      setNestiObs(data.text || fallback)
    } catch { setNestiObs(fallback) }
    setNestiLoading(false)
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    const userMsg = { role: 'user', content: chatInput }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setChatInput('')
    setChatLoading(true)
    const userMessages = newHistory.filter(m => m.role === 'user')
    const systemPrompt = `You are nesti, a warm supportive friend who is also a paediatrician. You are chatting with Maanvik's parent. Listen warmly and ask ONE gentle follow-up question per response to understand health cues better. Keep each response under 60 words. Be conversational, not clinical. After the 3rd user message naturally wrap up.`
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, conversationHistory: newHistory })
      })
      const data = await res.json()
      const assistantMsg = { role: 'assistant', content: data.text }
      setChatHistory(prev => [...prev, assistantMsg])
      if (userMessages.length >= 3) {
        setShowChatSummary(true)
        setChatNotes([chatInput, 'General observation from conversation'])
      }
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: "I'm here 🌿 Tell me more about what you're noticing." }])
    }
    setChatLoading(false)
  }

  // Voice with Whisper
  const startVoice = async () => {
    setVoiceOpen(true)
    setVoiceTranscript('')
    setVoiceResult(null)
    setVoiceError('')
    setIsListening(true)
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          try {
            const res = await fetch('/api/whisper', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64, mimeType: 'audio/webm' })
            })
            const data = await res.json()
            if (data.transcript) {
              setVoiceTranscript(data.transcript)
              parseVoiceCommand(data.transcript)
            } else setVoiceError("Couldn't transcribe — tap to try again")
          } catch { setVoiceError('Network error — tap to try again') }
          setIsListening(false)
        }
        reader.readAsDataURL(blob)
      }
      mediaRecorder.start()
      setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop() }, 6000)
    } catch (err) {
      setVoiceError('Microphone access needed — please allow in browser settings')
      setIsListening(false)
    }
  }

  const stopVoice = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }

  const parseVoiceCommand = (transcript) => {
    const t = transcript.toLowerCase()
    if (/fed|feed|milk|breastmilk|formula|nurse/.test(t)) {
      const volMatch = t.match(/(\d+)\s*ml/)
      const vol = volMatch ? parseInt(volMatch[1]) : 55
      const type = /formula/.test(t) ? 'Formula' : 'Breastmilk'
      setVoiceResult({ type: 'feed', preview: `🍼 Feed — ${vol}ml, ${type}`, data: { feedVol: vol, feedType: type } })
    } else if (/sleep|slept|nap/.test(t)) {
      const hrMatch = t.match(/(\d+)\s*(hr|hour)/)
      const minMatch = t.match(/(\d+)\s*(min|minute)/)
      const hrs = hrMatch ? parseInt(hrMatch[1]) : 0
      const mins = minMatch ? parseInt(minMatch[1]) : 0
      const total = (hrs * 60) + mins || 120
      setVoiceResult({ type: 'sleep', preview: `💤 Sleep — ${hrs > 0 ? hrs + 'hr ' : ''}${mins > 0 ? mins + 'min' : hrs === 0 ? '2hr' : ''}`, data: { sleepDuration: total } })
    } else if (/diaper|nappy|wet|soiled|poop/.test(t)) {
      const dtype = /soiled|poop/.test(t) ? 'Soiled' : 'Wet'
      setVoiceResult({ type: 'diaper', preview: `🩹 Diaper — ${dtype}`, data: { diaperType: dtype } })
    } else if (/medicine|vitamin|iron|calcium|drops/.test(t)) {
      const med = MEDICINES.find(m => t.includes(m.name.toLowerCase().split(' ')[0].toLowerCase())) || MEDICINES[0]
      setVoiceResult({ type: 'medicine', preview: `💊 Medicine — ${med.name}`, data: { medName: med.name } })
    } else if (/when|last|how much|show|what|find/.test(t)) {
      const lastFeed = logs.find(l => l.logType === 'feed')
      const reply = lastFeed ? `Last feed was ${Math.floor((new Date() - new Date(lastFeed.logged_at)) / 60000)} mins ago — ${lastFeed.volume_ml}ml ${lastFeed.type}` : 'No feeds logged today yet'
      setVoiceResult({ type: 'search', preview: reply, data: {} })
    } else {
      setVoiceError(`Heard: "${transcript}" — couldn't identify a log action. Try again.`)
    }
  }

  const confirmVoiceLog = async () => {
    if (!voiceResult) return
    if (voiceResult.type === 'feed') {
      setFeedVol(voiceResult.data.feedVol)
      setFeedType(voiceResult.data.feedType)
      await handleSaveFeed()
    } else if (voiceResult.type === 'sleep') {
      setSleepDuration(voiceResult.data.sleepDuration)
      await handleSaveSleep()
    } else if (voiceResult.type === 'diaper') {
      setDiaperType(voiceResult.data.diaperType)
      await handleSaveDiaper()
    } else if (voiceResult.type === 'medicine') {
      setMedName(voiceResult.data.medName)
      await handleSaveMed()
    }
    setVoiceOpen(false)
    setVoiceResult(null)
  }

  // Soothing sounds
  const stopSound = () => {
    if (soundNodes) { try { soundNodes.forEach(n => n.stop()) } catch {} }
    if (audioContext) { try { audioContext.close() } catch {} }
    setAudioContext(null); setSoundNodes(null); setPlayingSound(null)
  }

  const playSound = (type) => {
    if (playingSound === type) { stopSound(); return }
    stopSound()
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const masterGain = ctx.createGain()
    masterGain.gain.value = volume
    masterGain.connect(ctx.destination)
    const nodes = []
    if (type === 'white') {
      const bufferSize = ctx.sampleRate * 10
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      const source = ctx.createBufferSource()
      source.buffer = buffer; source.loop = true; source.connect(masterGain); source.start()
      nodes.push(source)
    } else if (type === 'ocean') {
      const bufferSize = ctx.sampleRate * 10
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
      const source = ctx.createBufferSource()
      source.buffer = buffer; source.loop = true
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'; filter.frequency.value = 400
      source.connect(filter); filter.connect(masterGain); source.start()
      nodes.push(source)
    } else if (type === 'birds') {
      const chirp = (freq, delay) => {
        const scheduleNext = () => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(masterGain)
          osc.type = 'sine'; osc.frequency.value = freq
          osc.frequency.linearRampToValueAtTime(freq + 180, ctx.currentTime + delay + 0.07)
          gain.gain.setValueAtTime(0, ctx.currentTime + delay)
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + delay + 0.01)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + 0.1)
          osc.start(ctx.currentTime + delay)
          osc.stop(ctx.currentTime + delay + 0.12)
          nodes.push(osc)
          setTimeout(scheduleNext, (Math.random() * 1400 + 600))
        }
        setTimeout(scheduleNext, delay * 1000)
      }
      chirp(3000, 0); chirp(3400, 0.3); chirp(3800, 0.7); chirp(3200, 1.1)
    } else if (type === 'om') {
      [136.1, 272.2, 408.3].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(masterGain)
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.value = i === 0 ? 0.3 : 0.1
        osc.start(); nodes.push(osc)
      })
    }
    setAudioContext(ctx); setSoundNodes(nodes); setPlayingSound(type)
    setTimeout(stopSound, 600000)
  }

  const metrics = getTodayMetrics()
  const nudge = getNudge()

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatRelative = (ts) => {
    if (!ts) return ''
    const diff = Math.floor((new Date() - new Date(ts)) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    const h = Math.floor(diff / 60); const m = diff % 60
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`
  }

  const getLogIcon = (type) => ({ feed: '🍼', sleep: '💤', diaper: '🩹', medicine: '💊' }[type] || '📝')
  const getLogDetail = (log) => {
    if (log.logType === 'feed') return `${log.volume_ml}ml · ${log.type}`
    if (log.logType === 'sleep') return `${Math.floor((log.duration_minutes || 0) / 60)}hr ${(log.duration_minutes || 0) % 60}min · ${log.quality}`
    if (log.logType === 'diaper') return `${log.type}${log.wetness ? ' · ' + log.wetness : ''}`
    if (log.logType === 'medicine') return `${log.medicine_name} · ${log.dose}`
    return ''
  }

  const trend7 = (type) => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1)
      const met = i === 0 ? Math.random() > 0.3 : Math.random() > 0.4
      days.push({ label, met, value: type === 'feed' ? Math.round(Math.random() * 200 + 400) : Math.round(Math.random() * 5 + 2) })
    }
    return days
  }

  const generateWhatsApp = () => {
    const m = metrics
    const msg = `Hi Dr. Khanna, sharing Maanvik's update:
- Age: ${age.chronMonths}m ${age.chronRemDays}d (${age.corrWeeks}w ${age.corrRemDays}d corrected)
- Today's feeds: ${Math.round(m.totalFeedMl)}ml (${m.feedLogs.length} feeds)
- Sleep: ${m.totalSleepHrs.toFixed(1)}hrs
- Diapers: ${m.diaperCount} changes
- Medicines: ${m.medCount}/${DAILY_TARGETS.medicines} doses given
- Any concerns: [tap to add]`
    setWhatsappMsg(msg)
    setShowWhatsAppSheet(true)
  }

  const handleCallClinic = () => {
    if (clinicNumber) { window.open(`tel:${clinicNumber}`) }
    else setShowClinicInput(true)
  }

  const pct = (val, target) => Math.min(100, Math.round((val / target) * 100))

  const summaryCards = [
    { id: 'feed', icon: '🍼', label: 'Feeds', value: `${Math.round(metrics.totalFeedMl)}ml`, pct: pct(metrics.totalFeedMl, DAILY_TARGETS.feedMl), sub: `of ${DAILY_TARGETS.feedMl}ml` },
    { id: 'sleep', icon: '💤', label: 'Sleep', value: `${metrics.totalSleepHrs.toFixed(1)}h`, pct: pct(metrics.totalSleepHrs, DAILY_TARGETS.sleepHours), sub: `of ${DAILY_TARGETS.sleepHours}h` },
    { id: 'diaper', icon: '🩹', label: 'Diapers', value: `${metrics.diaperCount}`, pct: pct(metrics.diaperCount, DAILY_TARGETS.diapers), sub: `of ${DAILY_TARGETS.diapers} expected` },
    { id: 'meds', icon: '💊', label: 'Medicines', value: `${metrics.medCount}`, pct: pct(metrics.medCount, DAILY_TARGETS.medicines), sub: `of ${DAILY_TARGETS.medicines} doses` }
  ]

  return (
    <div>
      {/* Header */}
      import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Today from './components/Today'
import Growth from './components/Growth'
import Health from './components/Health'
import Memories from './components/Memories'

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
