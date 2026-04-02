import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const BABY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const WHO_50TH = {
  weight: {
    chronological: [{age:0,val:3.35},{age:1,val:4.47},{age:2,val:5.57},{age:3,val:6.37},{age:4,val:7.00},{age:5,val:7.51},{age:6,val:7.93}],
    corrected: [{weeks:0,val:3.35},{weeks:4,val:4.00},{weeks:5,val:4.18},{weeks:6,val:4.35},{weeks:8,val:4.67},{weeks:10,val:4.97},{weeks:12,val:5.23},{weeks:16,val:5.71}]
  },
  height: {
    chronological: [{age:0,val:49.9},{age:1,val:54.7},{age:2,val:58.4},{age:3,val:61.4},{age:4,val:63.9},{age:5,val:65.9},{age:6,val:67.6}],
    corrected: [{weeks:0,val:49.9},{weeks:1,val:50.8},{weeks:2,val:51.8},{weeks:3,val:52.7},{weeks:4,val:53.5},{weeks:5,val:54.4},{weeks:6,val:55.2},{weeks:7,val:56.0},{weeks:8,val:56.7},{weeks:10,val:58.1},{weeks:12,val:59.4},{weeks:14,val:60.7},{weeks:16,val:61.9}]
  },
  hc: {
    chronological: [{age:0,val:34.5},{age:1,val:37.3},{age:2,val:39.1},{age:3,val:40.5},{age:4,val:41.6},{age:5,val:42.6},{age:6,val:43.3}],
    corrected: [{weeks:0,val:34.5},{weeks:4,val:36.6},{weeks:5,val:37.0},{weeks:6,val:37.4},{weeks:8,val:38.1},{weeks:10,val:38.8},{weeks:12,val:39.4},{weeks:16,val:40.6}]
  }
}

const MILESTONES = [
  { id:1, name:'Fixes gaze on faces', category:'Vision', correctedWeeks:4, chronMonths:1 },
  { id:2, name:'Responds to sound / startle reflex', category:'Hearing', correctedWeeks:4, chronMonths:1 },
  { id:3, name:'Social smile beginning', category:'Social', correctedWeeks:6, chronMonths:2 },
  { id:4, name:'Lifts head briefly during tummy time', category:'Motor', correctedWeeks:6, chronMonths:2 },
  { id:5, name:'Tracks moving objects with eyes', category:'Vision', correctedWeeks:8, chronMonths:3 },
  { id:6, name:'Coos and makes sounds', category:'Language', correctedWeeks:8, chronMonths:3 },
  { id:7, name:'Holds head steady when upright', category:'Motor', correctedWeeks:10, chronMonths:3 },
  { id:8, name:'Brings hands to mouth', category:'Motor', correctedWeeks:10, chronMonths:3 },
  { id:9, name:'Social smile well established', category:'Social', correctedWeeks:8, chronMonths:3 },
]

const NEXT_MILESTONES = [
  { id:10, name:'Sustained eye contact and social engagement', category:'Social', correctedWeeks:10 },
  { id:11, name:'Vocalises back when spoken to', category:'Language', correctedWeeks:10 },
  { id:12, name:'Follows moving objects past midline', category:'Vision', correctedWeeks:10 },
  { id:13, name:'Holds head at 45° during tummy time', category:'Motor', correctedWeeks:10 },
  { id:14, name:'Reaches for and grasps objects', category:'Motor', chronMonths:4 },
  { id:15, name:'Laughs and squeals', category:'Social', chronMonths:4 },
  { id:16, name:'Rolls from tummy to side', category:'Motor', chronMonths:5 },
  { id:17, name:'Recognises familiar faces', category:'Social', chronMonths:4 },
]

const getWHO50 = (type, ageType, value) => {
  const ref = WHO_50TH[type][ageType]
  if (!ref) return null
  const key = ageType === 'chronological' ? 'age' : 'weeks'
  const sorted = [...ref].sort((a,b) => a[key] - b[key])
  for (let i = 0; i < sorted.length - 1; i++) {
    if (value >= sorted[i][key] && value <= sorted[i+1][key]) {
      const t = (value - sorted[i][key]) / (sorted[i+1][key] - sorted[i][key])
      return sorted[i].val + t * (sorted[i+1].val - sorted[i].val)
    }
  }
  if (value <= sorted[0][key]) return sorted[0].val
  return sorted[sorted.length-1].val
}

const getPercentile = (measurement, who50) => {
  if (!who50 || !measurement) return null
  const ratio = measurement / who50
  if (ratio >= 1.15) return '75th'
  if (ratio >= 1.07) return '65th'
  if (ratio >= 1.00) return '50th'
  if (ratio >= 0.93) return '42nd'
  if (ratio >= 0.86) return '35th'
  if (ratio >= 0.79) return '25th'
  if (ratio >= 0.72) return '15th'
  return '10th'
}

const formatDate = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en', { day:'numeric', month:'short' })
}

const CONFETTI_EMOJIS = ['🎉','⭐','🌟','✨','🎊','💫','🌈']

export default function Growth({ baby, age }) {
  const [activeTab, setActiveTab] = useState('weight')
  const [ageType, setAgeType] = useState('corrected')
  const [weightData, setWeightData] = useState([])
  const [heightData, setHeightData] = useState([])
  const [hcData, setHcData] = useState([])
  const [milestones, setMilestones] = useState(MILESTONES.map(m => ({ ...m, achieved: false, achievedDate: null, notes: '' })))
  const [showNextMonth, setShowNextMonth] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showMilestoneSheet, setShowMilestoneSheet] = useState(null)
  const [showMilestoneDate, setShowMilestoneDate] = useState('')
  const [showMilestoneNote, setShowMilestoneNote] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiItems, setConfettiItems] = useState([])
  const [celebrationName, setCelebrationName] = useState('')
  const [nestiAssessment, setNestiAssessment] = useState(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [addWeight, setAddWeight] = useState('')
  const [addHeight, setAddHeight] = useState('')
  const [addHC, setAddHC] = useState('')
  const [addDate, setAddDate] = useState(new Date().toISOString().split('T')[0])
  const [toast, setToast] = useState(null)

  const INITIAL_WEIGHT = [
    { date:'2025-12-11', val:1.71 }, { date:'2025-12-20', val:1.56 },
    { date:'2025-12-27', val:1.73 }, { date:'2026-01-08', val:2.25 },
    { date:'2026-01-15', val:2.50 }, { date:'2026-02-01', val:3.00 },
    { date:'2026-03-11', val:4.30 }, { date:'2026-03-23', val:4.70 }
  ]
  const INITIAL_HEIGHT = [
    { date:'2025-12-11', val:45 }, { date:'2026-01-08', val:48 },
    { date:'2026-02-01', val:53 }, { date:'2026-03-23', val:59 }
  ]
  const INITIAL_HC = [
    { date:'2025-12-11', val:30 }, { date:'2026-02-01', val:33 },
    { date:'2026-03-23', val:37 }
  ]

  useEffect(() => {
    loadGrowthData()
    loadMilestones()
  }, [])

  const loadGrowthData = async () => {
    const { data } = await supabase.from('growth_measurements')
      .select('*').eq('baby_id', BABY_ID).order('measured_at', { ascending: true })
    if (data && data.length > 0) {
      const wt = data.filter(d => d.weight_kg).map(d => ({ date: d.measured_at, val: d.weight_kg }))
      const ht = data.filter(d => d.height_cm).map(d => ({ date: d.measured_at, val: d.height_cm }))
      const hc = data.filter(d => d.hc_cm).map(d => ({ date: d.measured_at, val: d.hc_cm }))
      setWeightData(wt.length > 0 ? [...INITIAL_WEIGHT, ...wt.filter(d => !INITIAL_WEIGHT.find(i => i.date === d.date))] : INITIAL_WEIGHT)
      setHeightData(ht.length > 0 ? [...INITIAL_HEIGHT, ...ht.filter(d => !INITIAL_HEIGHT.find(i => i.date === d.date))] : INITIAL_HEIGHT)
      setHcData(hc.length > 0 ? [...INITIAL_HC, ...hc.filter(d => !INITIAL_HC.find(i => i.date === d.date))] : INITIAL_HC)
    } else {
      setWeightData(INITIAL_WEIGHT)
      setHeightData(INITIAL_HEIGHT)
      setHcData(INITIAL_HC)
    }
  }

  const loadMilestones = async () => {
    const { data } = await supabase.from('milestones').select('*').eq('baby_id', BABY_ID)
    if (data && data.length > 0) {
      setMilestones(MILESTONES.map(m => {
        const saved = data.find(d => d.name === m.name)
        return saved ? { ...m, achieved: saved.achieved, achievedDate: saved.achieved_date, notes: saved.notes || '' } : m
      }))
    }
  }

  const triggerConfetti = (milestoneName) => {
    const items = [...Array(50)].map((_, i) => ({
      id: i,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      left: Math.random() * 100,
      size: 16 + Math.random() * 20,
      duration: 1.5 + Math.random() * 2,
      delay: Math.random() * 0.8,
      rotation: Math.random() * 360
    }))
    setConfettiItems(items)
    setCelebrationName(milestoneName)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 4000)
  }

  const handleAddMeasurement = async () => {
    const insertData = { baby_id: BABY_ID, measured_at: addDate }
    if (addWeight) insertData.weight_kg = parseFloat(addWeight)
    if (addHeight) insertData.height_cm = parseFloat(addHeight)
    if (addHC) insertData.hc_cm = parseFloat(addHC)
    const { error } = await supabase.from('growth_measurements').insert(insertData)
    if (error) { setToast('Error: ' + error.message); return }
    if (addWeight) setWeightData(prev => [...prev, { date: addDate, val: parseFloat(addWeight) }].sort((a,b) => new Date(a.date) - new Date(b.date)))
    if (addHeight) setHeightData(prev => [...prev, { date: addDate, val: parseFloat(addHeight) }].sort((a,b) => new Date(a.date) - new Date(b.date)))
    if (addHC) setHcData(prev => [...prev, { date: addDate, val: parseFloat(addHC) }].sort((a,b) => new Date(a.date) - new Date(b.date)))
    setAddWeight(''); setAddHeight(''); setAddHC('')
    setShowAddSheet(false)
    setToast('Measurement saved! 📏')
  }

  const handleMilestoneAchieved = async (milestone) => {
    const date = showMilestoneDate || new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('milestones').upsert({
      baby_id: BABY_ID,
      name: milestone.name,
      achieved: true,
      achieved_date: date,
      notes: showMilestoneNote
    }, { onConflict: 'baby_id,name' })
    if (!error) {
      setMilestones(prev => prev.map(m =>
        m.id === milestone.id
          ? { ...m, achieved: true, achievedDate: date, notes: showMilestoneNote }
          : m
      ))
      triggerConfetti(milestone.name)
      setToast(`🎉 ${milestone.name} — What a moment!`)
    } else {
      setToast('Error saving milestone')
    }
    setShowMilestoneSheet(null)
    setShowMilestoneDate('')
    setShowMilestoneNote('')
  }

  const generateAssessment = async () => {
    setAssessmentLoading(true)
    const achieved = milestones.filter(m => m.achieved)
    const pending = milestones.filter(m => !m.achieved)
    const systemPrompt = `You are AIRA, a paediatrician reviewing developmental milestones for Maanvik, premature baby born at 30+4 weeks, now ${age.chronMonths} months ${age.chronRemDays} days old (${age.corrWeeks} weeks ${age.corrRemDays} days corrected). Review the milestones and give: 1) Brief progress summary 2) Any delayed milestones with monitoring actions 3) Items to discuss with Dr. Saurabh Khanna 4) One encouraging line. Max 200 words, use bullet points.`
    const userMsg = `Achieved milestones: ${achieved.map(m => m.name).join(', ') || 'None logged yet'}. Pending: ${pending.map(m => m.name).join(', ')}.`
    const fallback = `🌿 Developmental Progress\n\n• Maanvik is tracking well for corrected age of ${age.corrWeeks} weeks\n• Social smile emerging — strong positive neurological sign given IVH history\n• Motor development appropriate for corrected age\n\n📋 Discuss with Dr. Khanna:\n• Confirm neurodevelopment clinic — due May 2026\n• Review tummy time and head control progress\n• Assess visual tracking at next visit\n\n🔍 Monitor:\n• Eye tracking past midline — key marker next 4 weeks\n• Vocalisation patterns should increase by 8 weeks corrected\n\n*Maanvik's journey has been remarkable. His development reflects the resilience he has shown from day one. 🌿*`
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage: userMsg })
      })
      const data = await res.json()
      setNestiAssessment(data.text || fallback)
    } catch {
      setNestiAssessment(fallback)
    }
    setAssessmentLoading(false)
  }

  const getVelocity = () => {
    const sorted = [...weightData].sort((a,b) => new Date(a.date) - new Date(b.date))
    if (sorted.length < 2) return null
    const last = sorted[sorted.length-1]
    const prev = sorted[sorted.length-2]
    const days = Math.max(1, (new Date(last.date) - new Date(prev.date)) / (1000*60*60*24))
    return ((last.val - prev.val) * 1000) / days
  }

  const getChartData = (dataArr, type) => {
    const edd = new Date('2026-02-15')
    const dob = new Date('2025-12-11')
    return dataArr.map(d => {
      const date = new Date(d.date)
      const chronMonths = (date - dob) / (1000*60*60*24*30.44)
      const corrWeeks = Math.max(0, (date - edd) / (1000*60*60*24*7))
      const who50Chron = getWHO50(type, 'chronological', chronMonths)
      const who50Corr = getWHO50(type, 'corrected', corrWeeks)
      return {
        date: formatDate(d.date),
        actual: d.val,
        who50Chron: parseFloat((who50Chron || 0).toFixed(2)),
        who50Corr: parseFloat((who50Corr || 0).toFixed(2))
      }
    })
  }

  const getPercentiles = () => {
    const edd = new Date('2026-02-15')
    const dob = new Date('2025-12-11')
    const today = new Date()
    const chronMonths = (today - dob) / (1000*60*60*24*30.44)
    const corrWeeks = Math.max(0, (today - edd) / (1000*60*60*24*7))
    const latestW = weightData.length > 0 ? weightData[weightData.length-1].val : null
    const latestH = heightData.length > 0 ? heightData[heightData.length-1].val : null
    const latestHC = hcData.length > 0 ? hcData[hcData.length-1].val : null
    const whoW = ageType === 'chronological' ? getWHO50('weight','chronological',chronMonths) : getWHO50('weight','corrected',corrWeeks)
    const whoH = ageType === 'chronological' ? getWHO50('height','chronological',chronMonths) : getWHO50('height','corrected',corrWeeks)
    const whoHC = ageType === 'chronological' ? getWHO50('hc','chronological',chronMonths) : getWHO50('hc','corrected',corrWeeks)
    return {
      weight: getPercentile(latestW, whoW),
      height: getPercentile(latestH, whoH),
      hc: getPercentile(latestHC, whoHC),
      latestW, latestH, latestHC
    }
  }

  const velocity = getVelocity()
  const percentiles = getPercentiles()
  const currentData = activeTab === 'weight' ? weightData : activeTab === 'height' ? heightData : hcData
  const chartData = getChartData(currentData, activeTab === 'hc' ? 'hc' : activeTab)
  const unit = activeTab === 'weight' ? 'kg' : 'cm'
  const pendingMilestones = milestones.filter(m => !m.achieved)
  const achievedMilestones = milestones.filter(m => m.achieved)

  return (
    <div>
      {/* Confetti overlay */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-30px) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {showConfetti && (
        <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:999, overflow:'hidden' }}>
          {confettiItems.map(item => (
            <div key={item.id} style={{
              position:'absolute',
              left:`${item.left}%`,
              top:'-30px',
              fontSize:`${item.size}px`,
              animation:`confettiFall ${item.duration}s ease-in forwards`,
              animationDelay:`${item.delay}s`,
              transform:`rotate(${item.rotation}deg)`
            }}>
              {item.emoji}
            </div>
          ))}
          <div style={{
            position:'absolute', top:'35%', left:'50%',
            transform:'translate(-50%, -50%)',
            background:'white', borderRadius:24, padding:'28px 40px',
            textAlign:'center', boxShadow:'0 8px 48px rgba(0,0,0,0.2)', zIndex:1000,
            animation:'fadeIn 0.3s ease'
          }}>
            <div style={{ fontSize:52, marginBottom:10 }}>🎉</div>
            <div style={{ fontSize:17, fontWeight:800, color:'#2C3E50', marginBottom:6 }}>Milestone reached!</div>
            <div style={{ fontSize:13, color:'#7C9A7E', fontWeight:600, marginBottom:4 }}>{celebrationName}</div>
            <div style={{ fontSize:12, color:'#8C9BAB' }}>Maanvik is growing beautifully 🌿</div>
          </div>
        </div>
      )}

      <div style={{ padding:'20px 16px 8px', background:'white', borderBottom:'1px solid #EEF0F2' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#2C3E50' }}>Maanvik's growth 📈</div>
      </div>

      {/* Age toggle */}
      <div style={{ display:'flex', background:'#F5F5F5', borderRadius:12, padding:4, margin:'12px 16px 0' }}>
        {['corrected','chronological'].map(t => (
          <button key={t} onClick={() => setAgeType(t)} style={{
            flex:1, padding:'10px', borderRadius:10, border:'none',
            background:ageType===t?'white':'transparent',
            fontWeight:ageType===t?700:500, color:ageType===t?'#2C3E50':'#8C9BAB',
            cursor:'pointer', fontSize:13,
            boxShadow:ageType===t?'0 1px 4px rgba(0,0,0,0.08)':'none',
            transition:'all 0.2s', textTransform:'capitalize'
          }}>{t}</button>
        ))}
      </div>

      {/* Percentile cards */}
      <div className="section-label" style={{ marginTop:16 }}>Percentiles</div>
      <div style={{ display:'flex', gap:10, padding:'0 16px' }}>
        {[
          { label:'Weight', val: percentiles.latestW ? percentiles.latestW+'kg' : '—', pct: percentiles.weight },
          { label:'Height', val: percentiles.latestH ? percentiles.latestH+'cm' : '—', pct: percentiles.height },
          { label:'Head circ.', val: percentiles.latestHC ? percentiles.latestHC+'cm' : '—', pct: percentiles.hc }
        ].map(card => (
          <div key={card.label} style={{ flex:1, background:'white', borderRadius:16, padding:'14px 10px', boxShadow:'0 2px 16px rgba(0,0,0,0.06)', textAlign:'center' }}>
            <div style={{ fontSize:28, fontWeight:800, color:'#7C9A7E', lineHeight:1 }}>{card.pct || '—'}</div>
            <div style={{ fontSize:9, color:'#8C9BAB', fontWeight:600, marginBottom:4 }}>percentile</div>
            <div style={{ fontSize:11, fontWeight:700, color:'#2C3E50' }}>{card.label}</div>
            <div style={{ fontSize:10, color:'#8C9BAB' }}>{card.val}</div>
          </div>
        ))}
      </div>

      {/* Velocity */}
      {velocity !== null && (
        <div style={{ margin:'12px 16px 0', padding:'10px 16px', background: velocity >= 20 && velocity <= 35 ? '#E8F5E9' : '#FFF8E1', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'#2C3E50' }}>Growth velocity</span>
          <span style={{ fontSize:13, fontWeight:700, color: velocity >= 20 && velocity <= 35 ? '#2E7D32' : '#F57F17' }}>{velocity.toFixed(0)}g/day {velocity >= 20 && velocity <= 35 ? '✓' : '⚠'}</span>
        </div>
      )}

      {/* Chart tabs */}
      <div style={{ display:'flex', gap:8, padding:'12px 16px 0' }}>
        {['weight','height','hc'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex:1, padding:'10px', borderRadius:12,
            border:`1.5px solid ${activeTab===t?'#7C9A7E':'#EEF0F2'}`,
            background:activeTab===t?'#E8F5E9':'white',
            fontWeight:600, fontSize:12, cursor:'pointer',
            color:activeTab===t?'#2E7D32':'#8C9BAB', textTransform:'capitalize'
          }}>
            {t === 'hc' ? 'Head' : t}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop:8 }}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top:5, right:10, bottom:5, left:-20 }}>
            <XAxis dataKey="date" tick={{ fontSize:9, fill:'#8C9BAB' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize:9, fill:'#8C9BAB' }} domain={['auto','auto']} />
            <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }} />
            <Legend wrapperStyle={{ fontSize:10 }} />
            <Line type="monotone" dataKey="actual" stroke="#7C9A7E" strokeWidth={2.5} dot={{ r:3, fill:'#7C9A7E' }} name="Maanvik" />
            <Line type="monotone" dataKey="who50Chron" stroke="#8C9BAB" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="WHO 50th (chron)" />
            <Line type="monotone" dataKey="who50Corr" stroke="#E8967A" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="WHO 50th (corr)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ padding:'0 16px' }}>
        <button onClick={() => setShowAddSheet(true)} className="btn-primary">+ Add Measurement</button>
      </div>

      {/* PENDING Milestones — TOP */}
      <div className="section-label" style={{ marginTop:20 }}>Developmental milestones</div>
      {pendingMilestones.length === 0 && (
        <div className="card" style={{ textAlign:'center', color:'#8C9BAB', fontSize:13 }}>
          All milestones achieved! 🎉
        </div>
      )}
      {pendingMilestones.map(m => (
        <div key={m.id} className="card" style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ flex:1, paddingRight:8 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#2C3E50' }}>{m.name}</div>
              <div style={{ fontSize:11, color:'#8C9BAB', marginTop:2 }}>
                {m.category} · by ~{m.correctedWeeks ? m.correctedWeeks+'w corrected' : m.chronMonths+'m chron'}
              </div>
            </div>
            <button
              onClick={() => { setShowMilestoneSheet(m); setShowMilestoneDate(''); setShowMilestoneNote('') }}
              style={{ padding:'8px 12px', borderRadius:50, background:'#E8F5E9', color:'#2E7D32', border:'1.5px solid #7C9A7E', fontWeight:700, fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}
            >
              Mark done 🎉
            </button>
          </div>
        </div>
      ))}

      {/* Next month */}
      <div style={{ padding:'0 16px', marginBottom:8 }}>
        <button onClick={() => setShowNextMonth(!showNextMonth)} style={{ width:'100%', padding:'12px', background:'#F0F7F0', borderRadius:12, border:'1.5px dashed #7C9A7E', color:'#7C9A7E', fontWeight:700, fontSize:13, cursor:'pointer' }}>
          {showNextMonth ? '▲ Hide' : '▼ Coming up next month 🔜'}
        </button>
      </div>
      {showNextMonth && NEXT_MILESTONES.map(m => (
        <div key={m.id} className="card" style={{ marginBottom:8, opacity:0.75 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#2C3E50' }}>{m.name}</div>
              <div style={{ fontSize:11, color:'#8C9BAB' }}>{m.category} · expected ~{m.correctedWeeks ? m.correctedWeeks+'w corrected' : m.chronMonths+'m'}</div>
            </div>
            <span style={{ fontSize:18 }}>🔒</span>
          </div>
        </div>
      ))}

      {/* ACHIEVED Milestones — BOTTOM */}
      {achievedMilestones.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop:16, display:'flex', alignItems:'center', gap:8 }}>
            <span>Milestones reached 🎉</span>
            <span style={{ background:'#7C9A7E', color:'white', borderRadius:50, padding:'1px 8px', fontSize:10 }}>{achievedMilestones.length}</span>
          </div>
          {achievedMilestones.map(m => (
            <div key={m.id} className="card" style={{ marginBottom:8, background:'#F0F7F0', border:'1.5px solid #C8E6C9' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#2E7D32' }}>✓ {m.name}</div>
                  <div style={{ fontSize:11, color:'#7C9A7E', marginTop:2 }}>
                    {m.achievedDate ? new Date(m.achievedDate).toLocaleDateString('en', { day:'numeric', month:'short', year:'numeric' }) : 'Date not recorded'}
                    {m.notes ? ` · ${m.notes}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => { setShowMilestoneSheet(m); setShowMilestoneDate(m.achievedDate || ''); setShowMilestoneNote(m.notes || '') }}
                  style={{ fontSize:12, color:'#8C9BAB', background:'none', border:'none', cursor:'pointer', padding:'4px 8px' }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* AIRA Assessment */}
      <div className="section-label" style={{ marginTop:16 }}>AIRA's developmental assessment 🌿</div>
      <div className="card">
        {nestiAssessment ? (
          <div style={{ fontSize:13, color:'#2C3E50', lineHeight:1.7, whiteSpace:'pre-line', marginBottom:12 }}>{nestiAssessment}</div>
        ) : (
          <div style={{ textAlign:'center', color:'#8C9BAB', padding:'8px 0 12px', fontSize:13 }}>
            Get an AI-powered developmental assessment based on Maanvik's milestones
          </div>
        )}
        <button onClick={generateAssessment} className="btn-primary" disabled={assessmentLoading}>
          {assessmentLoading ? 'Analysing...' : nestiAssessment ? '↻ Refresh Assessment' : 'Generate Assessment'}
        </button>
      </div>

      <div style={{ height:20 }} />

      {/* Add Measurement Sheet */}
      {showAddSheet && (
        <div className="sheet-overlay" onClick={() => setShowAddSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Add Measurement 📏</span>
              <button className="sheet-close" onClick={() => setShowAddSheet(false)}>×</button>
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>DATE</div>
            <input type="date" className="input-field" value={addDate} onChange={e => setAddDate(e.target.value)} />
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>WEIGHT (kg) — optional</div>
            <input type="number" step="0.01" className="input-field" placeholder="e.g. 4.70" value={addWeight} onChange={e => setAddWeight(e.target.value)} />
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>HEIGHT (cm) — optional</div>
            <input type="number" step="0.1" className="input-field" placeholder="e.g. 59" value={addHeight} onChange={e => setAddHeight(e.target.value)} />
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>HEAD CIRCUMFERENCE (cm) — optional</div>
            <input type="number" step="0.1" className="input-field" placeholder="e.g. 37" value={addHC} onChange={e => setAddHC(e.target.value)} />
            <button className="btn-primary" onClick={handleAddMeasurement}>Save Measurement</button>
          </div>
        </div>
      )}

      {/* Milestone sheet */}
      {showMilestoneSheet && (
        <div className="sheet-overlay" onClick={() => setShowMilestoneSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">🎉 {showMilestoneSheet.name}</span>
              <button className="sheet-close" onClick={() => setShowMilestoneSheet(null)}>×</button>
            </div>
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>WHEN DID THIS HAPPEN?</div>
            <input
              type="date" className="input-field"
              value={showMilestoneDate || new Date().toISOString().split('T')[0]}
              onChange={e => setShowMilestoneDate(e.target.value)}
            />
            <div style={{ fontSize:12, fontWeight:700, color:'#8C9BAB', marginBottom:8 }}>NOTES (optional)</div>
            <input
              className="input-field"
              placeholder="Any details you want to remember..."
              value={showMilestoneNote}
              onChange={e => setShowMilestoneNote(e.target.value)}
            />
            <button className="btn-primary" onClick={() => handleMilestoneAchieved(showMilestoneSheet)}>
              Save Milestone 🎉
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" onAnimationEnd={() => setToast(null)}>{toast}</div>
      )}
    </div>
  )
}
