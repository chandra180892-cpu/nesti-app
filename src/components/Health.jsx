import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const BABY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const VACCINATIONS = [
  { name:'BCG, Hep B, OPV', date:'2026-01-07', status:'done', age:'27 days' },
  { name:'RSV Vaccine', date:'2026-01-14', status:'done', age:'34 days' },
  { name:'6-week vaccines (DTP, PCV, Rotavirus)', date:'2026-02-22', status:'done', age:'73 days' },
  { name:'10-week vaccines', date:'2026-03-23', status:'done', age:'102 days' },
  { name:'14-week vaccines', date:'2026-04-20', status:'upcoming', daysAway:21 },
  { name:'6-month vaccines', date:'2026-06-11', status:'upcoming', daysAway:73 },
]

const MEDICAL_HISTORY = [
  {
    id:'neuro', icon:'🧠', title:'Neuro', upcoming:'Appt: 15 May 2026 🟡', upcomingColor:'#F5A623',
    timeline:[
      { age:'3 days', text:'IVH Grade 2 detected', status:'concern' },
      { age:'7 days', text:'Regressed to Grade 1', status:'improving' },
      { age:'23 days', text:'Fully resolved ✅', status:'resolved' },
    ],
    upcoming_detail:'Neurodevelopment clinic appointment — 15 May 2026'
  },
  {
    id:'resp', icon:'🫁', title:'Respiratory', upcoming:'Fully resolved ✅', upcomingColor:'#2E7D32',
    timeline:[
      { age:'Birth', text:'Intubated, surfactant given', status:'concern' },
      { age:'5 days', text:'Room air achieved ✅', status:'resolved' },
      { age:'5–6 days', text:'Apnea episode, caffeine started', status:'concern' },
      { age:'24 days', text:'Caffeine stopped, no recurrence ✅', status:'resolved' },
    ]
  },
  {
    id:'kidney', icon:'🧂', title:'Kidneys', upcoming:'Scan due ~Jun 2026 🟡', upcomingColor:'#F5A623',
    timeline:[
      { age:'Birth', text:'Bilateral cysts detected, largest 5.7mm', status:'concern' },
      { age:'~6 weeks', text:'Creatinine normalised ✅', status:'resolved' },
      { age:'3.5 months', text:'Cysts reducing, non-worrisome ✅', status:'resolved' },
    ],
    upcoming_detail:'USG KUB + MCU scan due ~Jun 2026'
  },
  {
    id:'rop', icon:'👁️', title:'Eyes (ROP)', upcoming:'Fully resolved ✅', upcomingColor:'#2E7D32',
    timeline:[
      { age:'26 days', text:'Zone II, Stage 1–2, No Plus disease', status:'concern' },
      { age:'Jan 2026', text:'Follow-up — trending well ✅', status:'improving' },
      { age:'15 Feb 2026', text:'Full ROP clearance received ✅ — no further follow-up needed', status:'resolved' },
    ]
  },
  {
    id:'jaundice', icon:'💛', title:'Jaundice', upcoming:'Fully resolved ✅', upcomingColor:'#2E7D32',
    timeline:[
      { age:'24 hrs', text:'Phototherapy started', status:'concern' },
      { age:'73 hrs', text:'Second phototherapy session', status:'concern' },
      { age:'~5 days', text:'Resolved ✅', status:'resolved' },
    ]
  },
]

const MEDICINES = [
  { name:'Vitamin D3 (Calsine P)', dose:'0.5ml', frequency:'Once daily' },
  { name:'Vitamin A to Z drops', dose:'0.5ml', frequency:'Once daily' },
  { name:'Iron (Tonoferron)', dose:'0.3ml', frequency:'Once daily' },
  { name:'Calcium (Calcimax P)', dose:'2ml', frequency:'Three times daily' },
]

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
  return <div className="toast">{message}</div>
}

export default function Health({ baby }) {
  const [expandedHistory, setExpandedHistory] = useState(null)
  const [bookedVaccines, setBookedVaccines] = useState({})
  const [clinicNumber, setClinicNumber] = useState('')
  const [showClinicInput, setShowClinicInput] = useState(false)
  const [clinicInputVal, setClinicInputVal] = useState('')
  const [showBookingSheet, setShowBookingSheet] = useState(null)
  const [uploadState, setUploadState] = useState('idle')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadPreview, setUploadPreview] = useState(null)
  const [extractedData, setExtractedData] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editedData, setEditedData] = useState(null)
  const [summaryText, setSummaryText] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [uploadChoiceOpen, setUploadChoiceOpen] = useState(false)
  const cameraRef = React.useRef(null)
  const fileRef = React.useRef(null)

  const showToast = (msg) => setToast(msg)

  const handleBookAppointment = (vaccine) => {
    if (!clinicNumber) { setShowBookingSheet(vaccine); setShowClinicInput(true) }
    else setShowBookingSheet(vaccine)
  }

  const handleSaveClinic = () => {
    setClinicNumber(clinicInputVal)
    setShowClinicInput(false)
  }

  const handleBooked = (vaccineName) => {
    setBookedVaccines(prev => ({ ...prev, [vaccineName]: true }))
    setShowBookingSheet(null)
    showToast('Appointment booked ✓')
  }

  const handleCallClinic = () => {
    if (clinicNumber) window.open(`tel:${clinicNumber}`)
    else { setShowBookingSheet('call'); setShowClinicInput(true) }
  }

  const handleFileSelect = async (file) => {
    if (!file) return
    setUploadFile(file)
    setUploadChoiceOpen(false)
    setUploadState('processing')
    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1]
      const preview = reader.result
      setUploadPreview(preview)
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemPrompt: `You are a medical document reader for baby Maanvik's health records. Extract all medically relevant information. Return ONLY valid JSON with these fields where present: {"date":"","documentType":"","doctorName":"","diagnosis":"","weight_kg":null,"height_cm":null,"hc_cm":null,"medications":[],"findings":"","followUpInstructions":"","vaccinesGiven":[]}. No other text.`,
            userMessage: `Please read this medical document and extract the information: [Document content - base64 image provided]`
          })
        })
        const data = await res.json()
        try {
          const clean = (data.text || '').replace(/```json|```/g, '').trim()
          const parsed = JSON.parse(clean)
          setExtractedData(parsed)
          setEditedData(parsed)
          setUploadState('review')
        } catch {
          setExtractedData({ findings: data.text || 'Could not parse document automatically' })
          setEditedData({ findings: data.text || '' })
          setUploadState('review')
        }
      } catch {
        setExtractedData({ findings: 'Upload successful. Please enter details manually.' })
        setEditedData({ findings: '' })
        setUploadState('review')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveDocument = async () => {
    const dataToSave = editMode ? editedData : extractedData
    await supabase.from('documents').insert({
      baby_id: BABY_ID,
      document_type: dataToSave.documentType || 'general',
      extracted_data: dataToSave,
      uploaded_at: new Date().toISOString()
    })
    showToast('Document saved to Maanvik\'s records ✅')
    setUploadState('idle')
    setExtractedData(null)
    setEditMode(false)
  }

  const generateSummary = async () => {
    setSummaryLoading(true)
    const systemPrompt = `You are a medical documentation assistant creating a comprehensive paediatrician visit summary for Dr. Saurabh Khanna. Patient: Maanvik, premature baby born at 30+4 weeks. Create a detailed summary with these sections:

1. PATIENT OVERVIEW — Name, DOB, gestational age, corrected age, blood group AB+
2. GROWTH SINCE LAST VISIT — Latest weight 4.70kg (23 Mar), height 59cm, HC 37cm. Velocity ~36g/day. Percentile ~42nd corrected age.
3. FEEDING SUMMARY — Target 560ml/day. Breastmilk primary.
4. SLEEP PATTERN — Target 14-17hrs/day WHO standard.
5. MEDICATIONS — Vitamin D3 0.5ml OD, Vitamin A to Z 0.5ml OD, Iron Tonoferron 0.3ml OD, Calcium Calcimax P 2ml TDS.
6. DEVELOPMENTAL MILESTONES — Social smile emerging, head control developing, tracking objects. Corrected age 5-6 weeks.
7. ACTIVE MEDICAL CONCERNS — Kidney cysts reducing (scan due Jun 2026). ROP fully resolved (15 Feb 2026). IVH fully resolved. Colic improving.
8. UPCOMING FOLLOW-UPS — Neurodevelopment clinic: 15 May 2026. USG KUB+MCU: Jun 2026. 14-week vaccines: 20 Apr 2026.
9. SUGGESTED DISCUSSION POINTS — 3-5 specific questions for this consultation.

Write professionally. Flag anything urgent in [URGENT] tags. Keep each section concise.`

    const fallback = `PAEDIATRICIAN VISIT SUMMARY — Maanvik
Date: ${new Date().toLocaleDateString('en', { day:'numeric', month:'long', year:'numeric' })}
Prepared by: nesti AI

1. PATIENT OVERVIEW
Name: Maanvik | DOB: 11 Dec 2025 | Blood Group: AB+
Gestational age at birth: 30+4 weeks | Corrected age: ~5-6 weeks
Chronological age: 3 months 17 days

2. GROWTH SINCE LAST VISIT
Weight: 4.70kg (23 Mar 2026) — up from 4.30kg (11 Mar), +400g in 12 days (~33g/day ✅)
Height: 59cm | Head Circumference: 37cm
Percentile: ~42nd (corrected age) — good catch-up trajectory

3. FEEDING SUMMARY
Target: 560ml/day | Method: Breastmilk primary
Pattern: 8-10 feeds/day, good latch reported

4. SLEEP PATTERN
Target: 14-17hrs/day (WHO) | Quality: Settled episodes noted
Colic ongoing ~3 weeks, improving, prefers upright position

5. MEDICATIONS (all current)
- Vitamin D3 (Calsine P) 0.5ml OD
- Vitamin A to Z drops 0.5ml OD
- Iron (Tonoferron) 0.3ml OD
- Calcium (Calcimax P) 2ml TDS

6. DEVELOPMENTAL MILESTONES
✓ Social smile emerging (strong positive sign given IVH history)
✓ Head control developing appropriately for corrected age
✓ Tracking objects with eyes
→ Monitoring: Eye tracking past midline, vocalisation patterns

7. ACTIVE MEDICAL CONCERNS
- Kidneys: Bilateral cysts — reducing, non-worrisome. Scan due Jun 2026.
- ROP: Fully resolved — clearance received 15 Feb 2026 ✅
- Neuro/IVH: Fully resolved by Day 23 ✅
- Colic: Active, improving. Prefers upright position.

8. UPCOMING FOLLOW-UPS
🔴 Neurodevelopment clinic — 15 May 2026 (book soon)
🟡 14-week vaccines — 20 Apr 2026
🟡 USG KUB + MCU scan — Jun 2026

9. SUGGESTED DISCUSSION POINTS
1. Is Maanvik's weight gain velocity appropriate for his corrected age trajectory?
2. Should we commence formal neurodevelopmental assessment at the May clinic visit?
3. Is the colic pattern and duration normal for an ex-30-weeker?
4. Any dietary changes recommended as we approach solids introduction window (May-Jul 2026)?
5. Confirm USG KUB + MCU scheduling and any preparation required.`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, userMessage: 'Generate the complete doctor visit summary for Maanvik based on his latest data.' })
      })
      const data = await res.json()
      setSummaryText(data.text || fallback)
    } catch { setSummaryText(fallback) }
    setSummaryLoading(false)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard ✓'))
  }

  const statusColor = { concern:'#FFEBEE', improving:'#FFF8E1', resolved:'#E8F5E9' }
  const statusDot = { concern:'#E05C5C', improving:'#F5A623', resolved:'#7C9A7E' }

  return (
    <div>
      <div style={{ padding:'20px 16px 8px', background:'white', borderBottom:'1px solid #EEF0F2' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'#2C3E50' }}>Maanvik's health 🩺</div>
      </div>

      {/* Vaccination Timeline */}
      <div className="section-label" style={{ marginTop:16 }}>Vaccinations</div>
      <div className="card">
        {VACCINATIONS.map((v, i) => (
          <div key={i} style={{ display:'flex', gap:12, paddingBottom:i < VACCINATIONS.length-1 ? 14 : 0, marginBottom:i < VACCINATIONS.length-1 ? 14 : 0, borderBottom:i < VACCINATIONS.length-1 ? '1px solid #EEF0F2' : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:20 }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:v.status==='done'?'#7C9A7E':'#EEF0F2', border:`2px solid ${v.status==='done'?'#7C9A7E':'#8C9BAB'}`, flexShrink:0, marginTop:2 }} />
              {i < VACCINATIONS.length-1 && <div style={{ width:2, flex:1, background:'#EEF0F2', marginTop:4 }} />}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#2C3E50' }}>{v.name}</div>
                  <div style={{ fontSize:11, color:'#8C9BAB' }}>
                    {v.status === 'done' ? `✅ ${new Date(v.date).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'})} · Age: ${v.age}` : `🔜 Due ~${new Date(v.date).toLocaleDateString('en',{day:'numeric',month:'short'})} · ${v.daysAway} days away`}
                  </div>
                </div>
                {v.status === 'upcoming' && (
                  bookedVaccines[v.name]
                    ? <span className="chip chip-green">Booked ✓</span>
                    : <button onClick={() => handleBookAppointment(v)} style={{ padding:'6px 12px', borderRadius:50, background:'#E8967A', color:'white', border:'none', fontWeight:700, fontSize:11, cursor:'pointer' }}>Book 📅</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Medical History */}
      <div className="section-label" style={{ marginTop:4 }}>Medical history</div>
      {MEDICAL_HISTORY.map(item => (
        <div key={item.id} className="card" style={{ marginBottom:8 }}>
          <div onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              <span style={{ fontSize:14, fontWeight:700, color:'#2C3E50' }}>{item.title}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:11, fontWeight:600, color:item.upcomingColor }}>{item.upcoming}</span>
              <span style={{ color:'#8C9BAB', fontSize:14 }}>{expandedHistory === item.id ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedHistory === item.id && (
            <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid #EEF0F2' }}>
              {item.timeline.map((t, i) => (
                <div key={i} style={{ display:'flex', gap:12, marginBottom:i < item.timeline.length-1 ? 12 : 0 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:statusDot[t.status], marginTop:4, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:'#8C9BAB', textTransform:'uppercase' }}>{t.age}</div>
                    <div style={{ fontSize:13, color:'#2C3E50' }}>{t.text}</div>
                  </div>
                </div>
              ))}
              {item.upcoming_detail && (
                <div style={{ marginTop:12, padding:'10px 12px', background:'#FFF8E1', borderRadius:10, fontSize:12, color:'#F57F17', fontWeight:600 }}>
                  🔜 {item.upcoming_detail}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Upload Prescriptions */}
      <div className="section-label" style={{ marginTop:4 }}>Prescriptions & scans 📎</div>
      <div className="card">
        {uploadState === 'idle' && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:12 }}>Upload prescriptions, scan reports, or discharge summaries</div>
            <button onClick={() => setUploadChoiceOpen(true)} style={{ padding:'12px 28px', borderRadius:50, background:'#7C9A7E', color:'white', border:'none', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Add a file</button>
          </div>
        )}

        {uploadState === 'processing' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            {uploadPreview && <img src={uploadPreview} alt="upload" style={{ width:80, height:80, objectFit:'cover', borderRadius:12, marginBottom:12 }} />}
            <div style={{ fontSize:14, fontWeight:600, color:'#7C9A7E' }}>Reading your file... 🔍</div>
            <div style={{ width:'100%', height:4, background:'#EEF0F2', borderRadius:2, marginTop:12, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'#7C9A7E', borderRadius:2, animation:'slideRight 1.5s ease infinite', width:'60%' }} />
            </div>
          </div>
        )}

        {uploadState === 'review' && extractedData && (
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#2C3E50', marginBottom:12 }}>Here's what nesti found 🔍</div>
            {!editMode ? (
              <div>
                {Object.entries(extractedData).filter(([k,v]) => v && v !== '' && v !== null && !(Array.isArray(v) && v.length===0)).map(([key, val]) => (
                  <div key={key} style={{ display:'flex', gap:12, padding:'8px 0', borderBottom:'1px solid #EEF0F2' }}>
                    <span style={{ fontSize:12, color:'#8C9BAB', fontWeight:600, minWidth:100, textTransform:'capitalize' }}>{key.replace(/_/g,' ')}</span>
                    <span style={{ fontSize:13, color:'#2C3E50', flex:1 }}>{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                  </div>
                ))}
                <div style={{ display:'flex', gap:8, marginTop:16 }}>
                  <button onClick={handleSaveDocument} className="btn-primary">Looks good — Save ✓</button>
                  <button onClick={() => setEditMode(true)} className="btn-secondary">Edit ✏️</button>
                </div>
              </div>
            ) : (
              <div>
                {editedData && Object.entries(editedData).map(([key, val]) => (
                  <div key={key} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#8C9BAB', marginBottom:4, textTransform:'capitalize' }}>{key.replace(/_/g,' ')}</div>
                    <input className="input-field" style={{ margin:0 }} value={Array.isArray(val) ? val.join(', ') : (val || '')} onChange={e => setEditedData(prev => ({ ...prev, [key]: e.target.value }))} />
                  </div>
                ))}
                <button onClick={() => { setEditMode(false); handleSaveDocument() }} className="btn-primary">Save edited data</button>
              </div>
            )}
          </div>
        )}

        {uploadState === 'saved' && (
          <div style={{ textAlign:'center', padding:'12px 0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:700, color:'#2E7D32' }}>Saved to Maanvik's records</div>
            <button onClick={() => setUploadState('idle')} style={{ marginTop:12, background:'none', border:'none', color:'#7C9A7E', fontWeight:600, cursor:'pointer' }}>Add another</button>
          </div>
        )}
      </div>

      {/* Doctor Summary */}
      <div className="section-label" style={{ marginTop:4 }}>Doctor visit summary</div>
      <div className="card">
        <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:12 }}>Generate a comprehensive summary for Dr. Saurabh Khanna — includes growth, development, medications, and suggested discussion points.</div>
        {summaryText && (
          <div style={{ background:'#F8F8F8', borderRadius:12, padding:14, marginBottom:12, fontSize:12, lineHeight:1.8, color:'#2C3E50', whiteSpace:'pre-line', maxHeight:300, overflowY:'auto' }}>
            {summaryText}
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={generateSummary} className="btn-primary" disabled={summaryLoading} style={{ flex:2 }}>
            {summaryLoading ? 'Generating...' : summaryText ? '↻ Refresh Summary' : 'Generate Summary 📋'}
          </button>
          {summaryText && (
            <button onClick={() => copyToClipboard(summaryText)} className="btn-secondary" style={{ flex:1 }}>Copy</button>
          )}
        </div>
        {summaryText && (
          <button onClick={() => { const short = `Hi Dr. Khanna,\n\nSharing Maanvik's latest summary:\n\nWeight: 4.70kg | Height: 59cm | HC: 37cm\nVelocity: ~33g/day ✅\nMilestones: Social smile emerging, head control developing\nUpcoming: Neurodev clinic 15 May, Vaccines 20 Apr, USG KUB Jun\n\nGenerated by nesti app`; window.open(`https://wa.me/?text=${encodeURIComponent(short)}`) }}
            style={{ width:'100%', marginTop:8, padding:'12px', borderRadius:12, background:'#E8F5E9', color:'#25D366', border:'none', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send to Dr. Khanna on WhatsApp
          </button>
        )}
      </div>

      <div style={{ height:20 }} />

      {/* Upload choice sheet */}
      {uploadChoiceOpen && (
        <div className="sheet-overlay" onClick={() => setUploadChoiceOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Add a document</span>
              <button className="sheet-close" onClick={() => setUploadChoiceOpen(false)}>×</button>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div onClick={() => cameraRef.current?.click()} style={{ flex:1, padding:'24px 12px', background:'#F0F7F0', borderRadius:16, textAlign:'center', cursor:'pointer', border:'1.5px dashed #7C9A7E' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#2C3E50' }}>Open Camera</div>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
              </div>
              <div onClick={() => fileRef.current?.click()} style={{ flex:1, padding:'24px 12px', background:'#F0F7F0', borderRadius:16, textAlign:'center', cursor:'pointer', border:'1.5px dashed #7C9A7E' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
                <div style={{ fontSize:13, fontWeight:700, color:'#2C3E50' }}>Upload File</div>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking sheet */}
      {showBookingSheet && (
        <div className="sheet-overlay" onClick={() => setShowBookingSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Book Appointment 📅</span>
              <button className="sheet-close" onClick={() => setShowBookingSheet(null)}>×</button>
            </div>
            {showClinicInput ? (
              <>
                <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:12 }}>What's Dr. Khanna's clinic number?</div>
                <input className="input-field" type="tel" placeholder="+91 XXXXX XXXXX" value={clinicInputVal} onChange={e => setClinicInputVal(e.target.value)} />
                <button className="btn-primary" onClick={handleSaveClinic}>Save & Continue →</button>
              </>
            ) : (
              <>
                <div style={{ fontSize:13, color:'#8C9BAB', marginBottom:16 }}>
                  {typeof showBookingSheet === 'object' ? showBookingSheet.name : 'Clinic call'}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => typeof showBookingSheet === 'object' && handleBooked(showBookingSheet.name)} style={{ flex:1, padding:'14px', borderRadius:12, background:'#E8F5E9', color:'#2E7D32', border:'1.5px solid #7C9A7E', fontWeight:700, fontSize:13, cursor:'pointer' }}>✅ I've booked it</button>
                  <button onClick={handleCallClinic} style={{ flex:1, padding:'14px', borderRadius:12, background:'#E3F2FD', color:'#1565C0', border:'none', fontWeight:700, fontSize:13, cursor:'pointer' }}>📞 Call Clinic</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
