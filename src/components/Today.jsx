import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

const BABY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

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

const TIME_PILLS = ['Just now', '15m ago', '30m ago', '1hr ago']

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
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', content: "Hi! Tell me what's on your mind about Maanvik 🌿" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChatSummary, setShowChatSummary] = useState(false)
  const [chatNotes, setChatNotes] = useState([])
  const [selectedNotes, setSelectedNotes] = useState([])
  const [clinicNumber, setClinicNumber] = useState('')
  const [clinicInputVal, setClinicInputVal] = useState('')
  const [showClinicInput, setShowClinicInput] = useState(false)
  const [showWhatsAppSheet, setShowWhatsAppSheet] = useState(false)
  const [whatsappMsg, setWhatsappMsg] = useState('')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceResult, setVoiceResult] = useState(null)
  const [voiceError, setVoiceError] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [playingSound, setPlayingSound] = useState(null)
  const [volume, setVolume] = useState(0.5)
  const [flipCard, setFlipCard] = useState(null)
  const [feedTime, setFeedTime] = useState('Just now')
  const [feedType, setFeedType] = useState('Breastmilk')
  const [feedVol, setFeedVol] = useState(55)
  const [sleepTime, setSleepTime] = useState('Just now')
  const [sleepDuration, setSleepDuration] = useState(120)
  const [sleepQuality, setSleepQuality] = useState('Settled')
  const [sleepOngoing, setSleepOngoing] = useState(false)
  const [diaperTime, setDiaperTime] = useState('Just now')
  const [diaperType, setDiaperType] = useState('Wet')
  const [diaperWetness, setDiaperWetness] = useState('Normal')
  const [diaperNotes, setDiaperNotes] = useState('')
  const [medTime, setMedTime] = useState('Just now')
  const [medName, setMedName] = useState(MEDICINES[0].name)
  const audioContextRef = useRef(null)
  const soundNodesRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const chatEndRef = useRef(null)

  useEffect(() => { loadLogs() }, [])

  useEffect(() => {
    if (!loading) generateNestiObs()
  }, [logs, loading])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const loadLogs = async () => {
    const now = new Date()
const istOffset = 5.5 * 60 * 60000
const istNow = new Date(now.getTime() + istOffset)
const today = istNow.toISOString().split('T')[0]
const startOfDay = new Date(today + 'T00:00:00+05:30').toISOString()
const endOfDay = new Date(today + 'T23:59:59+05:30').toISOString()
    const allLogs = []
    const tables = [
      { name: 'feed_logs', timeCol: 'logged_at', type: 'feed' },
      { name: 'sleep_logs', timeCol: 'start_time', type: 'sleep' },
      { name: 'diaper_logs', timeCol: 'logged_at', type: 'diaper' },
      { name: 'medicine_logs', timeCol: 'logged_at', type: 'medicine' }
    ]
    for (const t of tables) {
      const { data } = await supabase.from(t.name).select('*')
        .gte(t.timeCol, startOfDay)
.lte(t.timeCol, endOfDay)
        .order(t.timeCol, { ascending: false })
      if (data) data.forEach(r => allLogs.push({ ...r, logType: t.type }))
    }
    allLogs.sort((a, b) => {
      const ta = new Date(a.logged_at || a.start_time)
      const tb = new Date(b.logged_at || b.start_time)
      return tb - ta
    })
    setLogs(allLogs)
    setLoading(false)
  }

  const resolveTime = (pill) => {
    const now = new Date()
    if (pill === '15m ago') return new Date(now - 15 * 60000).toISOString()
    if (pill === '30m ago') return new Date(now - 30 * 60000).toISOString()
    if (pill === '1hr ago') return new Date(now - 60 * 60000).toISOString()
    return now.toISOString()
  }

  const showToast = (msg) => setToast(msg)

  const saveLog = async (table, data) => {
    const { error } = await supabase.from(table).insert({
      ...data,
      baby_id: BABY_ID,
      logged_by: session.user.id
    })
    if (error) { showToast('Error: ' + error.message); return false }
    return true
  }

  const handleSaveFeed = async () => {
    const ok = await saveLog('feed_logs', {
      logged_at: resolveTime(feedTime),
      type: feedType,
      volume_ml: feedVol
    })
    if (ok) { showToast('Feed logged! 🍼'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveSleep = async () => {
    const start = resolveTime(sleepTime)
    const end = sleepOngoing ? null : new Date(new Date(start).getTime() + sleepDuration * 60000).toISOString()
    const ok = await saveLog('sleep_logs', {
      start_time: start,
      end_time: end,
      duration_minutes: sleepOngoing ? null : sleepDuration,
      quality: sleepQuality
    })
    if (ok) { showToast('Sleep logged! 💤'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveDiaper = async () => {
    const ok = await saveLog('diaper_logs', {
      logged_at: resolveTime(diaperTime),
      type: diaperType,
      wetness: diaperWetness,
      notes: diaperNotes
    })
    if (ok) { showToast('Diaper logged! 🩹'); setActiveSheet(null); await loadLogs() }
  }

  const handleSaveMed = async () => {
    const ok = await saveLog('medicine_logs', {
      logged_at: resolveTime(medTime),
      medicine_name: medName,
      dose: MEDICINES.find(m => m.name === medName)?.dose || ''
    })
    if (ok) { showToast('Medicine logged! 💊'); setActiveSheet(null); await loadLogs() }
  }

  const handleDeleteLog = async (log) => {
    const tableMap = {
      feed: 'feed_logs',
      sleep: 'sleep_logs',
      diaper: 'diaper_logs',
      medicine: 'medicine_logs'
    }
    const table = tableMap[log.logType]
    if (!table) return
    await supabase.from(table).delete().eq('id', log.id)
    showToast('Entry deleted')
    await loadLogs()
  }

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
    if (minsAgo !== null && minsAgo > 240) {
      return { color: '#E05C5C', bg: '#FFEBEE', icon: '🍼', text: `Maanvik's last feed was ${Math.floor(minsAgo / 60)}hr ${minsAgo % 60}min ago — time to feed him now` }
    }
    const soiledLogs = diaperLogs.filter(l => l.type === 'Soiled' || l.type === 'Both')
    if (soiledLogs.length === 0 && hour > 12) {
      return { color: '#E05C5C', bg: '#FFEBEE', icon: '🩹', text: 'No soiled diaper logged in 24hrs — worth keeping an eye on' }
    }
    const expectedFeedMl = dayFraction * DAILY_TARGETS.feedMl * 0.5
    if (totalFeedMl < expectedFeedMl && hour > 8) {
      return { color: '#F5A623', bg: '#FFF8E1', icon: '🍼', text: `Feed running low — ${Math.round(totalFeedMl)}ml logged, ~${Math.round(expectedFeedMl)}ml expected by now` }
    }
    const expectedSleepHrs = dayFraction * DAILY_TARGETS.sleepHours * 0.5
    if (totalSleepHrs < expectedSleepHrs && hour > 12) {
      return { color: '#F5A623', bg: '#FFF8E1', icon: '💤', text: `Sleep running low — ${totalSleepHrs.toFixed(1)}hrs logged, ~${expectedSleepHrs.toFixed(1)}hrs expected` }
    }
    const expectedDiapers = Math.floor(dayFraction * DAILY_TARGETS.diapers)
    if (expectedDiapers - diaperCount >= 2) {
      return { color: '#F5A623', bg: '#FFF8E1', icon: '🩹', text: `Diaper count low — ${diaperCount} logged, ~${expectedDiapers} expected by now` }
    }
    if (hour >= 18 && (DAILY_TARGETS.medicines - medCount) >= 2) {
      return { color: '#F5A623', bg: '#FFF8E1', icon: '💊', text: `${DAILY_TARGETS.medicines - medCount} medicine doses still pending today` }
    }
    return { color: '#2E7D32', bg: '#E8F5E9', icon: '🌿', text: "Maanvik's doing great today — all targets on track" }
  }, [getTodayMetrics])

  const generateNestiObs = async () => {
    setNestiLoading(true)
    const metrics = getTodayMetrics()
    const systemPrompt = `You are nesti, a warm AI paediatric care companion for parents of Maanvik, a premature baby born at 30+4 weeks, now ${age.chronMonths} months ${age.chronRemDays} days old (${age.corrWeeks} weeks corrected). Analyse today's logs. Respond in EXACTLY this format:\n🍼 Feeding\n• [one bullet max 15 words]\n💤 Sleep\n• [one bullet]\n🌟 Overall\n• [one bullet]\n*[one warm encouraging line]*\nMax 10 lines total.`
    const userMsg = `Feeds: ${metrics.totalFeedMl}ml (${metrics.feedLogs.length} feeds). Sleep: ${metrics.totalSleepHrs.toFixed(1)}hrs. Diapers: ${metrics.diaperCount}. Medicines: ${metrics.medCount}. Last feed: ${metrics.minsAgo !== null ? metrics.minsAgo + ' mins ago' : 'none today'}.`
    const fallback = `🍼 Feeding\n• ${Math.round(metrics.totalFeedMl)}ml logged — ${metrics.totalFeedMl >= 280 ? 'on track' : 'building toward'} daily target\n\n💤 Sleep\n• ${metrics.totalSleepHrs.toFixed(1)}hrs logged — keep encouraging sleep windows\n\n🌟 Overall\n• Good rhythm today — feeds and sleep aligning well\n\n*You're doing beautifully. Every log matters. 🌿*`
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage: userMsg })
      })
      const data = await res.json()
      setNestiObs(data.text || fallback)
    } catch {
      setNestiObs(fallback)
    }
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
    const systemPrompt = `You are nesti, a warm supportive friend who is also a paediatrician. Chat with Maanvik's parent. Ask ONE gentle follow-up question per response. Keep responses under 60 words. Be conversational.`
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, conversationHistory: newHistory })
      })
      const data = await res.json()
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.text }])
      if (userMessages.length >= 3) {
        setShowChatSummary(true)
        setChatNotes([chatInput])
      }
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: "I'm here 🌿 Tell me more." }])
    }
    setChatLoading(false)
  }

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
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
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
            } else {
              setVoiceError("Couldn't transcribe — tap to try again")
            }
          } catch {
            setVoiceError('Network error — tap to try again')
          }
          setIsListening(false)
        }
        reader.readAsDataURL(blob)
      }
      mediaRecorder.start()
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      }, 6000)
    } catch {
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
      const hrMatch = t.match(/(\d+)\s*(hr|hrs|hour|hours)/)
const minMatch = t.match(/(\d+)\s*(min|mins|minute|minutes)/)
const hrs = hrMatch ? parseInt(hrMatch[1]) : 0
const mins = minMatch ? parseInt(minMatch[1]) : 0
const total = hrs > 0 || mins > 0 ? (hrs * 60) + mins : 120
const displayHrs = Math.floor(total / 60)
const displayMins = total % 60
const displayText = displayHrs > 0 && displayMins > 0 ? `${displayHrs}hr ${displayMins}min` : displayHrs > 0 ? `${displayHrs}hr` : `${displayMins}min`
setVoiceResult({ type: 'sleep', preview: `💤 Sleep — ${displayText}`, data: { sleepDuration: total } })
    } else if (/diaper|nappy|wet|soiled|poop/.test(t)) {
      const dtype = /soiled|poop/.test(t) ? 'Soiled' : 'Wet'
      setVoiceResult({ type: 'diaper', preview: `🩹 Diaper — ${dtype}`, data: { diaperType: dtype } })
    } else if (/medicine|vitamin|iron|calcium|drops/.test(t)) {
      const med = MEDICINES.find(m => t.includes(m.name.split(' ')[0].toLowerCase())) || MEDICINES[0]
      setVoiceResult({ type: 'medicine', preview: `💊 Medicine — ${med.name}`, data: { medName: med.name } })
    } else {
      setVoiceError(`Heard: "${transcript}" — couldn't identify action. Try again.`)
    }
  }

  const confirmVoiceLog = async () => {
    if (!voiceResult) return
    if (voiceResult.type === 'feed') { setFeedVol(voiceResult.data.feedVol); setFeedType(voiceResult.data.feedType); await handleSaveFeed() }
    else if (voiceResult.type === 'sleep') { setSleepDuration(voiceResult.data.sleepDuration); await handleSaveSleep() }
    else if (voiceResult.type === 'diaper') { setDiaperType(voiceResult.data.diaperType); await handleSaveDiaper() }
    else if (voiceResult.type === 'medicine') { setMedName(voiceResult.data.medName); await handleSaveMed() }
    setVoiceOpen(false)
    setVoiceResult(null)
  }

  const stopSound = () => {
    soundNodesRef.current.forEach(n => { try { n.stop() } catch {} })
    soundNodesRef.current = []
    if (audioContextRef.current) { try { audioContextRef.current.close() } catch {} audioContextRef.current = null }
    setPlayingSound(null)
  }

  const playSound = (type) => {
    if (playingSound === type) { stopSound(); return }
    stopSound()
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioContextRef.current = ctx
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
      const scheduleChirp = (freq, delay) => {
        setTimeout(() => {
          if (!audioContextRef.current) return
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(masterGain)
          osc.type = 'sine'; osc.frequency.value = freq
          gain.gain.setValueAtTime(0, ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
          osc.start(ctx.currentTime)
          osc.stop(ctx.currentTime + 0.12)
          nodes.push(osc)
          scheduleChirp(freq + Math.random() * 400 - 200, Math.random() * 1400 + 600)
        }, delay)
      }
      scheduleChirp(3000, 0); scheduleChirp(3400, 300); scheduleChirp(3800, 700)
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
    soundNodesRef.current = nodes
    setPlayingSound(type)
    setTimeout(stopSound, 600000)
  }

  const generateWhatsApp = () => {
    const m = getTodayMetrics()
    const msg = `Hi Dr. Khanna, sharing Maanvik's update:\n• Age: ${age.chronMonths}m ${age.chronRemDays}d (${age.corrWeeks}w corrected)\n• Feeds today: ${Math.round(m.totalFeedMl)}ml (${m.feedLogs.length} feeds)\n• Sleep: ${m.totalSleepHrs.toFixed(1)}hrs\n• Diapers: ${m.diaperCount} changes\n• Medicines: ${m.medCount}/${DAILY_TARGETS.medicines} doses\n• Concerns: [add here]`
    setWhatsappMsg(msg)
    setShowWhatsAppSheet(true)
  }

  const handleCallClinic = () => {
    if (clinicNumber) { window.open(`tel:${clinicNumber}`) }
    else { setShowClinicInput(true) }
  }

  const pct = (val, target) => Math.min(100, Math.round((val / target) * 100))
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

  const metrics = getTodayMetrics()
  const nudge = getNudge()

  const summaryCards = [
    { id: 'feed', icon: '🍼', label: 'Feeds', value: `${Math.round(metrics.totalFeedMl)}ml`, pct: pct(metrics.totalFeedMl, DAILY_TARGETS.feedMl), sub: `of ${DAILY_TARGETS.feedMl}ml` },
    { id: 'sleep', icon: '💤', label: 'Sleep', value: `${metrics.totalSleepHrs.toFixed(1)}h`, pct: pct(metrics.totalSleepHrs, DAILY_TARGETS.sleepHours), sub: `of ${DAILY_TARGETS.sleepHours}h` },
    { id: 'diaper', icon: '🩹', label: 'Diapers', value: `${metrics.diaperCount}`, pct: pct(metrics.diaperCount, DAILY_TARGETS.diapers), sub: `of ${DAILY_TARGETS.diapers} expected` },
    { id: 'meds', icon: '💊', label: 'Medicines', value: `${metrics.medCount}`, pct: pct(metrics.medCount, DAILY_TARGETS.medicines), sub: `of ${DAILY_TARGETS.medicines} doses` }
  ]

  return (
    <div>
      <div style={{ padding: '16px 16px 10px', background: 'white', borderBottom: '1px solid #EEF0F2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#2C3E50', flex: 1, paddingRight: 8 }}>{greeting}</div>
          <button onClick={onMenuTap} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#E8F5E9', borderRadius: 50, padding: '4px 12px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#2E7D32' }}>
            Maanvik's age: {age.chronMonths}m {age.chronRemDays}d · {age.corrWeeks}w {age.corrRemDays}d corrected
          </span>
        </div>
      </div>

      <div style={{ margin: '12px 16px 0', padding: '12px 16px', background: nudge.bg, borderLeft: `4px solid ${nudge.color}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{nudge.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: nudge.color, flex: 1 }}>{nudge.text}</span>
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>Today's checklist</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
        {summaryCards.map(card => (
          <div key={card.id} onClick={() => setFlipCard(flipCard === card.id ? null : card.id)}
            style={{ background: 'white', borderRadius: 16, padding: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.06)', cursor: 'pointer', minHeight: 110 }}>
            {flipCard === card.id ? (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#8C9BAB', marginBottom: 6 }}>PAST 7 DAYS</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 50 }}>
                  {['M','T','W','T','F','S','S'].map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', background: i === 6 ? '#F5A623' : Math.random() > 0.4 ? '#7C9A7E' : '#E8967A', borderRadius: 3, height: `${30 + Math.random() * 20}px` }} />
                      <span style={{ fontSize: 8, color: '#8C9BAB' }}>{d}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: '#8C9BAB', marginTop: 6 }}>tap to close</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <span style={{ fontSize: 10, color: '#8C9BAB' }}>↗</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2C3E50', marginTop: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#8C9BAB' }}>{card.sub}</div>
                <div style={{ marginTop: 8, height: 4, background: '#EEF0F2', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${card.pct}%`, background: card.pct >= 80 ? '#7C9A7E' : card.pct >= 50 ? '#F5A623' : '#E05C5C', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: card.pct >= 80 ? '#7C9A7E' : card.pct >= 50 ? '#F5A623' : '#E05C5C', marginTop: 4 }}>{card.pct}%</div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>Log it quick</div>
      <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
        {[
          { id: 'feed', icon: '🍼', label: 'Feed' },
          { id: 'sleep', icon: '😴', label: 'Sleep' },
          { id: 'diaper', icon: '🩹', label: 'Diaper' },
          { id: 'med', icon: '💊', label: 'Med' }
        ].map(btn => (
          <button key={btn.id} onClick={() => setActiveSheet(btn.id)} style={{ flex: 1, background: 'white', border: '1.5px solid #EEF0F2', borderRadius: 16, padding: '14px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: 24 }}>{btn.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#2C3E50' }}>{btn.label}</span>
          </button>
        ))}
      </div>

      <div className="section-label" style={{ marginTop: 16 }}>Today's logs</div>
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8C9BAB', padding: 20 }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8C9BAB', padding: 20 }}>No logs yet today 🌿 Tap above to add one</div>
        ) : (
          <>
            {logs.slice(0, 4).map((log, i) => (
              <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < Math.min(3, logs.slice(0,4).length - 1) ? '1px solid #EEF0F2' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{getLogIcon(log.logType)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2C3E50' }}>{getLogDetail(log)}</div>
                  <div style={{ fontSize: 11, color: '#8C9BAB' }}>{formatRelative(log.logged_at || log.start_time)}</div>
                </div>
                <button onClick={() => handleDeleteLog(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8C9BAB' }}>🗑</button>
              </div>
            ))}
            {logs.length > 4 && (
              <button onClick={() => setShowAllLogs(true)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#7C9A7E', fontSize: 13, fontWeight: 600, paddingTop: 10 }}>
                Show all {logs.length} logs →
              </button>
            )}
          </>
        )}
      </div>

      {obsCollapsed ? (
        <div onClick={() => setObsCollapsed(false)} style={{ margin: '0 16px 12px', padding: '12px 16px', border: '1.5px solid #7C9A7E', borderRadius: 12, background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#7C9A7E' }}>🌿 nesti's observations</span>
          <span style={{ fontSize: 12, color: '#8C9BAB' }}>↓ expand</span>
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: 0.8 }}>nesti's observations 🌿</span>
            <button onClick={generateNestiObs} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#7C9A7E', fontWeight: 600 }}>↻ Refresh</button>
          </div>
          {nestiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[80, 60, 90].map((w, i) => <div key={i} style={{ height: 12, background: '#EEF0F2', borderRadius: 6, width: `${w}%` }} />)}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#2C3E50', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{nestiObs}</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => setObsCollapsed(true)} style={{ flex: 1, padding: '10px', borderRadius: 50, background: '#7C9A7E', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Looks good ✓</button>
            <button onClick={() => setChatOpen(true)} style={{ flex: 1, padding: '10px', borderRadius: 50, background: '#E8967A', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>I want to share 💬</button>
          </div>
        </div>
      )}

      <div className="section-label">Soothing sounds 🎵</div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[{ id: 'ocean', label: '🌊 Ocean' }, { id: 'white', label: '🤍 White' }, { id: 'birds', label: '🐦 Birds' }, { id: 'om', label: '🕉 Om' }].map(s => (
            <button key={s.id} onClick={() => playSound(s.id)} style={{ flex: 1, padding: '10px 4px', borderRadius: 12, border: `1.5px solid ${playingSound === s.id ? '#7C9A7E' : '#EEF0F2'}`, background: playingSound === s.id ? '#E8F5E9' : 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: playingSound === s.id ? '#2E7D32' : '#2C3E50' }}>{s.label}</button>
          ))}
        </div>
        <input type="range" min="0" max="1" step="0.1" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#7C9A7E' }} />
      </div>

      <div className="section-label">Maanvik's Doctor 👨‍⚕️</div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2C3E50', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 16 }}>SK</div>
          <div>
            <div style={{ fontWeight: 700, color: '#2C3E50' }}>Dr. Saurabh Khanna</div>
            <div style={{ fontSize: 12, color: '#8C9BAB' }}>Paediatrician</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCallClinic} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#E3F2FD', color: '#1565C0', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📞 Call Clinic</button>
          <button onClick={generateWhatsApp} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#E8F5E9', color: '#2E7D32', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp Doc
          </button>
        </div>
      </div>

      <div style={{ height: 80 }} />

      <button className="fab" onClick={startVoice}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="10" width="3" height="8" rx="1.5" fill="white" opacity="0.6"/>
          <rect x="9" y="6" width="3" height="12" rx="1.5" fill="white"/>
          <rect x="14" y="8" width="3" height="10" rx="1.5" fill="white" opacity="0.8"/>
          <rect x="19" y="11" width="3" height="6" rx="1.5" fill="white" opacity="0.5"/>
        </svg>
      </button>

      {activeSheet === 'feed' && (
        <div className="sheet-overlay" onClick={() => setActiveSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">🍼 Log Feed</span>
              <button className="sheet-close" onClick={() => setActiveSheet(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>WHEN</div>
            <TimePillSelector selected={feedTime} onSelect={setFeedTime} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>TYPE</div>
            <div className="toggle-group">
              <button className={`toggle-option ${feedType === 'Breastmilk' ? 'active' : ''}`} onClick={() => setFeedType('Breastmilk')}>🤱 Breastmilk</button>
              <button className={`toggle-option ${feedType === 'Formula' ? 'active' : ''}`} onClick={() => setFeedType('Formula')}>🍼 Formula</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>VOLUME</div>
            <div className="stepper">
              <button className="stepper-btn" onClick={() => setFeedVol(v => Math.max(5, v - 5))}>−</button>
              <div className="stepper-value">{feedVol}<span className="stepper-unit"> ml</span></div>
              <button className="stepper-btn" onClick={() => setFeedVol(v => v + 5)}>+</button>
            </div>
            <button className="btn-primary" onClick={handleSaveFeed}>Save Feed Log</button>
          </div>
        </div>
      )}

      {activeSheet === 'sleep' && (
        <div className="sheet-overlay" onClick={() => setActiveSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">😴 Log Sleep</span>
              <button className="sheet-close" onClick={() => setActiveSheet(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>STARTED</div>
            <TimePillSelector selected={sleepTime} onSelect={setSleepTime} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '12px 16px', background: '#F8F8F8', borderRadius: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Still sleeping?</span>
              <div onClick={() => setSleepOngoing(!sleepOngoing)} style={{ width: 44, height: 24, borderRadius: 12, background: sleepOngoing ? '#7C9A7E' : '#DDD', cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 2, left: sleepOngoing ? 22 : 2, transition: 'left 0.2s' }} />
              </div>
            </div>
            {!sleepOngoing && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>DURATION</div>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => setSleepDuration(v => Math.max(15, v - 15))}>−</button>
                  <div className="stepper-value">{Math.floor(sleepDuration / 60)}h {sleepDuration % 60}m</div>
                  <button className="stepper-btn" onClick={() => setSleepDuration(v => v + 15)}>+</button>
                </div>
              </>
            )}
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>QUALITY</div>
            <div className="toggle-group">
              <button className={`toggle-option ${sleepQuality === 'Settled' ? 'active' : ''}`} onClick={() => setSleepQuality('Settled')}>😴 Settled</button>
              <button className={`toggle-option ${sleepQuality === 'Unsettled' ? 'active' : ''}`} onClick={() => setSleepQuality('Unsettled')}>😟 Unsettled</button>
            </div>
            <button className="btn-primary" onClick={handleSaveSleep}>Save Sleep Log</button>
          </div>
        </div>
      )}

      {activeSheet === 'diaper' && (
        <div className="sheet-overlay" onClick={() => setActiveSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">🩹 Log Diaper</span>
              <button className="sheet-close" onClick={() => setActiveSheet(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>WHEN</div>
            <TimePillSelector selected={diaperTime} onSelect={setDiaperTime} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>TYPE</div>
            <div className="toggle-group">
              {['Wet', 'Soiled', 'Both'].map(t => (
                <button key={t} className={`toggle-option ${diaperType === t ? 'active' : ''}`} onClick={() => setDiaperType(t)}>
                  {t === 'Wet' ? '💧' : t === 'Soiled' ? '💩' : '💧💩'} {t}
                </button>
              ))}
            </div>
            {(diaperType === 'Wet' || diaperType === 'Both') && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>WETNESS</div>
                <div className="toggle-group">
                  {['Light', 'Normal', 'Heavy'].map(w => (
                    <button key={w} className={`toggle-option ${diaperWetness === w ? 'active' : ''}`} onClick={() => setDiaperWetness(w)}>{w}</button>
                  ))}
                </div>
              </>
            )}
            <input className="input-field" placeholder="Any notes? (optional)" value={diaperNotes} onChange={e => setDiaperNotes(e.target.value)} />
            <button className="btn-primary" onClick={handleSaveDiaper}>Save Diaper Log</button>
          </div>
        </div>
      )}

      {activeSheet === 'med' && (
        <div className="sheet-overlay" onClick={() => setActiveSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">💊 Log Medicine</span>
              <button className="sheet-close" onClick={() => setActiveSheet(null)}>×</button>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>WHEN</div>
            <TimePillSelector selected={medTime} onSelect={setMedTime} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>MEDICINE</div>
            {MEDICINES.map(m => (
              <div key={m.name} onClick={() => setMedName(m.name)} style={{ padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${medName === m.name ? '#7C9A7E' : '#EEF0F2'}`, background: medName === m.name ? '#E8F5E9' : 'white', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#2C3E50' }}>{m.name}</div>
                <div style={{ fontSize: 12, color: '#8C9BAB' }}>{m.dose}</div>
              </div>
            ))}
            <button className="btn-primary" onClick={handleSaveMed}>Save Medicine Log</button>
          </div>
        </div>
      )}

      {showAllLogs && (
        <div className="sheet-overlay" onClick={() => setShowAllLogs(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">All logs today</span>
              <button className="sheet-close" onClick={() => setShowAllLogs(false)}>×</button>
            </div>
            {logs.map((log, i) => (
              <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid #EEF0F2' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{getLogIcon(log.logType)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{getLogDetail(log)}</div>
                  <div style={{ fontSize: 11, color: '#8C9BAB' }}>{formatRelative(log.logged_at || log.start_time)}</div>
                </div>
                <button onClick={() => handleDeleteLog(log)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#8C9BAB' }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="sheet-overlay">
          <div className="sheet" style={{ height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Chat with nesti 🌿</span>
              <button className="sheet-close" onClick={() => setChatOpen(false)}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {chatHistory.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? '#7C9A7E' : 'white', color: msg.role === 'user' ? 'white' : '#2C3E50', fontSize: 13, lineHeight: 1.5, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'white', fontSize: 13, color: '#8C9BAB' }}>nesti is typing...</div>
                </div>
              )}
              {showChatSummary && (
                <div style={{ background: '#F8FFF8', border: '1px solid #7C9A7E', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Here's what I noted 📝</div>
                  {chatNotes.map((note, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <input type="checkbox" checked={selectedNotes.includes(i)} onChange={() => setSelectedNotes(prev => prev.includes(i) ? prev.filter(n => n !== i) : [...prev, i])} />
                      <span style={{ fontSize: 13 }}>{note}</span>
                    </div>
                  ))}
                  <button className="btn-primary" style={{ marginTop: 10 }} onClick={() => { showToast('Saved to log 🌿'); setChatOpen(false) }}>Save to log</button>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" style={{ margin: 0, flex: 1 }} placeholder="Type something..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()} />
              <button onClick={handleChatSend} style={{ width: 44, height: 44, borderRadius: '50%', background: '#7C9A7E', border: 'none', color: 'white', fontSize: 18, cursor: 'pointer' }}>↑</button>
            </div>
          </div>
        </div>
      )}

      {voiceOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,30,20,0.92)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
            {isListening ? 'Listening...' : voiceResult ? 'Got it!' : voiceError ? 'Oops' : 'Processing...'}
          </div>
          {isListening && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
              {[0.6, 1, 0.8, 1, 0.7].map((h, i) => (
                <div key={i} style={{ width: 6, background: '#7C9A7E', borderRadius: 3, height: `${h * 60}%` }} />
              ))}
            </div>
          )}
          {voiceTranscript ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 280 }}>"{voiceTranscript}"</div> : null}
          {voiceResult && (
            <div style={{ background: 'white', borderRadius: 16, padding: 20, maxWidth: 300, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#2C3E50', marginBottom: 16 }}>{voiceResult.preview}</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={confirmVoiceLog} style={{ flex: 1, padding: '12px', background: '#7C9A7E', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Confirm ✓</button>
                <button onClick={() => { setVoiceOpen(false); setActiveSheet(voiceResult.type === 'medicine' ? 'med' : voiceResult.type) }} style={{ flex: 1, padding: '12px', background: '#EEF0F2', color: '#2C3E50', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>Edit ✏️</button>
              </div>
            </div>
          )}
          {voiceError ? <div style={{ color: '#F5A623', fontSize: 13, textAlign: 'center', maxWidth: 280 }}>{voiceError}</div> : null}
          {isListening ? <button onClick={stopVoice} style={{ padding: '12px 32px', background: '#E8967A', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, cursor: 'pointer' }}>Stop</button> : null}
          {!isListening && !voiceResult ? <button onClick={() => setVoiceOpen(false)} style={{ padding: '12px 32px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 50, fontWeight: 700, cursor: 'pointer' }}>Close</button> : null}
        </div>
      )}

      {showWhatsAppSheet && (
        <div className="sheet-overlay" onClick={() => setShowWhatsAppSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Message for Dr. Khanna</span>
              <button className="sheet-close" onClick={() => setShowWhatsAppSheet(false)}>×</button>
            </div>
            <textarea value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} style={{ width: '100%', minHeight: 200, padding: 14, borderRadius: 12, border: '1.5px solid #EEF0F2', fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit', resize: 'none', marginBottom: 16 }} />
            <button className="btn-primary" style={{ background: '#25D366' }} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`)}>Send on WhatsApp</button>
          </div>
        </div>
      )}

      {showClinicInput && (
        <div className="sheet-overlay" onClick={() => setShowClinicInput(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Dr. Khanna's clinic number</span>
              <button className="sheet-close" onClick={() => setShowClinicInput(false)}>×</button>
            </div>
            <input className="input-field" type="tel" placeholder="+91 XXXXX XXXXX" value={clinicInputVal} onChange={e => setClinicInputVal(e.target.value)} />
            <button className="btn-primary" onClick={() => { setClinicNumber(clinicInputVal); setShowClinicInput(false); window.open(`tel:${clinicInputVal}`) }}>Save & Call</button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
