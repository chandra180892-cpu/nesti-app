import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('Dad')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setMessage(error.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('parents').insert({
          user_id: data.user.id,
          baby_id: null,
          name,
          relationship
        })
        setMessage('Account created! Please check your email to verify.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#FDFCFA', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🌿</div>
          <div style={{ fontSize:28, fontWeight:800, color:'#7C9A7E', letterSpacing:'-0.5px' }}>AIRA</div>
<div style={{ fontSize:13, color:'#7C9A7E', fontWeight:600, marginTop:2 }}>Know more. Worry less.</div>
<div style={{ fontSize:13, color:'#8C9BAB', marginTop:4 }}>Your Parenting OS</div>
        </div>

        <div style={{ background:'white', borderRadius:20, padding:24, boxShadow:'0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', background:'#F5F5F5', borderRadius:12, padding:4, marginBottom:24 }}>
            {['signin','signup'].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, padding:'10px', borderRadius:10, border:'none',
                background: mode===m ? 'white' : 'transparent',
                fontWeight: mode===m ? 700 : 500,
                color: mode===m ? '#2C3E50' : '#8C9BAB',
                cursor:'pointer', fontSize:14,
                boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition:'all 0.2s'
              }}>
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <>
              <input className="input-field" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#8C9BAB', marginBottom:8 }}>I am Maanvik's</div>
                <div className="toggle-group">
                  {['Mom','Dad','Grandparent','Caregiver'].map(r => (
                    <button key={r} className={`toggle-option ${relationship===r?'active':''}`} onClick={() => setRelationship(r)} style={{ fontSize:12, padding:'10px 4px' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <input className="input-field" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input-field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

          {message && (
            <div style={{ padding:'10px 14px', borderRadius:10, background: message.includes('created') ? '#E8F5E9' : '#FFEBEE', color: message.includes('created') ? '#2E7D32' : '#C62828', fontSize:13, marginBottom:16 }}>
              {message}
            </div>
          )}

          <button className="btn-primary" onClick={handleAuth} disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        <div style={{ textAlign:'center', marginTop:20, fontSize:13, color:'#8C9BAB' }}>
          AIRA keeps Maanvik's data safe and private 🔒
        </div>
      </div>
    </div>
  )
}
