import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const BABY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const MILESTONE_TAGS = [
  'First smile 😊',
  'First laugh 😄', 
  'First bath 🛁',
  'Home from NICU 🏠',
  'First outing 🌳',
  'Vaccination day 💉',
  'Doctor visit 🩺',
  'First tummy time 🐢',
  'Just because 💕',
  'Special moment ⭐'
]

const PRESET_MEMORIES = [
  {
    id: 'preset-1',
    caption: 'Home from NICU',
    date: '2026-01-08',
    tag: 'Home from NICU 🏠',
    isPreset: true,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    emoji: '🏠'
  },
  {
    id: 'preset-2',
    caption: 'First smile',
    date: null,
    tag: 'First smile 😊',
    isPreset: true,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    emoji: '😊',
    prompt: true
  },
  {
    id: 'preset-3',
    caption: 'First bath',
    date: null,
    tag: 'First bath 🛁',
    isPreset: true,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    emoji: '🛁',
    prompt: true
  },
  {
    id: 'preset-4',
    caption: '3 months old!',
    date: '2026-03-11',
    tag: 'Just because 💕',
    isPreset: true,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    emoji: '🎂'
  }
]

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [])
  return <div className="toast">{message}</div>
}

export default function Memories({ baby, session }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [expandedMemory, setExpandedMemory] = useState(null)
  const [toast, setToast] = useState(null)
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [tag, setTag] = useState(MILESTONE_TAGS[0])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const fileRef = React.useRef(null)
  const cameraRef = React.useRef(null)

  useEffect(() => { loadMemories() }, [])

  const loadMemories = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('baby_id', BABY_ID)
      .eq('document_type', 'memory')
      .order('uploaded_at', { ascending: false })
    setLoading(false)
    if (data) setMemories(data)
  }

  const handleFileSelect = (file) => {
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSaveMemory = async () => {
    if (!caption.trim()) { setToast('Add a caption first 💕'); return }
    setSaving(true)
    let imageUrl = null
    if (imageFile) {
      const fileName = `${BABY_ID}/${Date.now()}-${imageFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, imageFile)
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('memories').getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }
    }
    const { error } = await supabase.from('documents').insert({
      baby_id: BABY_ID,
      uploaded_by: session.user.id,
      document_type: 'memory',
      extracted_data: { caption, date, tag, imageUrl, imagePreview: imageUrl ? null : imagePreview },
      uploaded_at: new Date().toISOString()
    })
    if (error) { setToast('Error saving memory'); setSaving(false); return }
    setToast('Memory saved! 💕')
    setCaption('')
    setDate(new Date().toISOString().split('T')[0])
    setTag(MILESTONE_TAGS[0])
    setImageFile(null)
    setImagePreview(null)
    setShowAddSheet(false)
    setSaving(false)
    await loadMemories()
  }

  const handleDeleteMemory = async (id) => {
    await supabase.from('documents').delete().eq('id', id)
    setMemories(prev => prev.filter(m => m.id !== id))
    setExpandedMemory(null)
    setToast('Memory removed')
  }

  const handleShare = (memory) => {
    const data = memory.extracted_data || memory
    const text = `Maanvik's memory 💕\n${data.tag || ''}\n${data.caption}\n${data.date ? new Date(data.date).toLocaleDateString('en',{day:'numeric',month:'long',year:'numeric'}) : ''}\n\nShared from nesti app 🌿`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
  }

  const allMemories = [
    ...PRESET_MEMORIES,
    ...memories.map(m => ({
      id: m.id,
      caption: m.extracted_data?.caption || 'Memory',
      date: m.extracted_data?.date,
      tag: m.extracted_data?.tag || 'Just because 💕',
      imageUrl: m.extracted_data?.imageUrl,
      imagePreview: m.extracted_data?.imagePreview,
      isReal: true
    }))
  ]

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div>
      <div style={{ padding: '20px 16px 12px', background: 'white', borderBottom: '1px solid #EEF0F2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#2C3E50' }}>Maanvik's moments 📸</div>
        <button onClick={() => setShowAddSheet(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: '#7C9A7E', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#8C9BAB' }}>Loading memories...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px' }}>
          {allMemories.map(memory => (
            <div key={memory.id} onClick={() => setExpandedMemory(memory)} style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', position: 'relative', aspectRatio: '1', background: memory.gradient || '#F5F5F5' }}>
              {memory.imageUrl || memory.imagePreview ? (
                <img src={memory.imageUrl || memory.imagePreview} alt={memory.caption} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: memory.gradient || 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 36 }}>{memory.emoji || '💕'}</span>
                  {memory.prompt && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Tap to add photo</span>}
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)', padding: '20px 10px 10px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{memory.caption}</div>
                {memory.date && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{formatDate(memory.date)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {memories.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '0 32px 32px', color: '#8C9BAB' }}>
          <div style={{ fontSize: 13 }}>Add your first memory of Maanvik 💕</div>
        </div>
      )}

      {/* Expanded memory */}
      {expandedMemory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', color: 'white' }}>
            <button onClick={() => setExpandedMemory(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>←</button>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{expandedMemory.tag}</div>
            <button onClick={() => setExpandedMemory(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
            {expandedMemory.imageUrl || expandedMemory.imagePreview ? (
              <img src={expandedMemory.imageUrl || expandedMemory.imagePreview} alt={expandedMemory.caption} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 16, objectFit: 'contain' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '1', background: expandedMemory.gradient || 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>
                {expandedMemory.emoji || '💕'}
              </div>
            )}
          </div>

          <div style={{ padding: '20px', color: 'white' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{expandedMemory.caption}</div>
            {expandedMemory.date && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>{formatDate(expandedMemory.date)}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handleShare(expandedMemory)} style={{ flex: 1, padding: '14px', borderRadius: 12, background: '#25D366', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Share on WhatsApp
              </button>
              {expandedMemory.isReal && (
                <button onClick={() => handleDeleteMemory(expandedMemory.id)} style={{ padding: '14px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>🗑</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add memory sheet */}
      {showAddSheet && (
        <div className="sheet-overlay" onClick={() => setShowAddSheet(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-title">Add a memory 💕</span>
              <button className="sheet-close" onClick={() => setShowAddSheet(false)}>×</button>
            </div>

            {/* Photo upload */}
            <div style={{ marginBottom: 16 }}>
              {imagePreview ? (
                <div style={{ position: 'relative' }}>
                  <img src={imagePreview} alt="preview" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12 }} />
                  <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div onClick={() => cameraRef.current?.click()} style={{ flex: 1, padding: '20px 12px', background: '#F0F7F0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', border: '1.5px dashed #7C9A7E' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7C9A7E' }}>Camera</div>
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                  </div>
                  <div onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '20px 12px', background: '#F0F7F0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', border: '1.5px dashed #7C9A7E' }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>🖼</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7C9A7E' }}>Gallery</div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files[0])} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>CAPTION</div>
            <input className="input-field" placeholder="What's this moment about?" value={caption} onChange={e => setCaption(e.target.value)} />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>DATE</div>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#8C9BAB', marginBottom: 8 }}>TAG</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {MILESTONE_TAGS.map(t => (
                <button key={t} onClick={() => setTag(t)} style={{ padding: '6px 12px', borderRadius: 50, border: `1.5px solid ${tag === t ? '#7C9A7E' : '#EEF0F2'}`, background: tag === t ? '#E8F5E9' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: tag === t ? '#2E7D32' : '#8C9BAB' }}>{t}</button>
              ))}
            </div>

            <button className="btn-primary" onClick={handleSaveMemory} disabled={saving}>
              {saving ? 'Saving...' : 'Save Memory 💕'}
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
