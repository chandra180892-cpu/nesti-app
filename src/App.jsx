import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Today from './components/Today'
import Growth from './components/Growth'
import Health from './components/Health'
import Memories from './components/Memories'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [parentProfile, setParentProfile] = useState(null)
  const [showSignOut, setShowSignOut] = useState(false)

  const BABY = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Maanvik',
    dob: '2025-12-11',
    edd: '2026-02-15',
    gestational_weeks: 30,
    gestational_days: 4,
    sex: 'boy',
    birth_weight_kg: 1.71,
    blood_group: 'AB+'
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) loadParentProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadParentProfile(session.user.id)
      else setParentProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadParentProfile = async (userId) => {
    const { data } = await supabase
      .from('parents')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (data) setParentProfile(data)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setParentProfile(null)
    setActiveTab('today')
    setShowSignOut(false)
  }

  const getAge = () => {
    const dob = new Date('2025-12-11')
    const edd = new Date('2026-02-15')
    const today = new Date()
    const chronDays = Math.floor((today - dob) / (1000 * 60 * 60 * 24))
    const chronMonths = Math.floor(chronDays / 30.44)
    const chronRemDays = Math.floor(chronDays % 30.44)
    const corrDays = Math.max(0, Math.floor((today - edd) / (1000 * 60 * 60 * 24)))
    const corrWeeks = Math.floor(corrDays / 7)
    const corrRemDays = corrDays % 7
    return { chronMonths, chronRemDays, corrWeeks, corrRemDays, chronDays, corrDays }
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    const name = parentProfile?.relationship === 'Mom' ? "Maanvik's Mom" : "Maanvik's Dad"
    if (h >= 5 && h < 12) return `Good morning, ${name} ☀️`
    if (h >= 12 && h < 17) return `Good afternoon, ${name} 🌤`
    if (h >= 17 && h < 21) return `Good evening, ${name} 🌙`
    return `You're up late, ${name} 🌙 — hope he's sleeping well`
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FDFCFA' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#7C9A7E', letterSpacing: '-0.5px' }}>nesti</div>
        <div style={{ fontSize: 13, color: '#8C9BAB', marginTop: 4 }}>loading...</div>
      </div>
    </div>
  )

  if (!session) return <Auth />

  const tabs = [
    { id: 'today', label: 'Today', icon: '🏠' },
    { id: 'growth', label: 'Growth', icon: '📈' },
    { id: 'health', label: 'Health', icon: '🩺' },
    { id: 'memories', label: 'Memories', icon: '📸' }
  ]

  return (
    <div className="app-container">
      {/* Sign out menu */}
      {showSignOut && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowSignOut(false)}>
          <div style={{ position: 'absolute', top: 60, right: 16, background: 'white', borderRadius: 16, padding: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', minWidth: 160 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '12px 16px', fontSize: 13, color: '#8C9BAB', borderBottom: '1px solid #EEF0F2' }}>
              Signed in as<br />
              <span style={{ fontWeight: 700, color: '#2C3E50' }}>{parentProfile?.name || session.user.email}</span>
            </div>
            <button onClick={handleSignOut} style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#E05C5C', textAlign: 'left' }}>
              Sign out
            </button>
          </div>
        </div>
      )}

      <div className="screen">
        {activeTab === 'today' && (
          <Today
            session={session}
            baby={BABY}
            age={getAge()}
            greeting={getGreeting()}
            parentProfile={parentProfile}
            onMenuTap={() => setShowSignOut(!showSignOut)}
          />
        )}
        {activeTab === 'growth' && (
          <Growth baby={BABY} age={getAge()} />
        )}
        {activeTab === 'health' && (
          <Health baby={BABY} />
        )}
        {activeTab === 'memories' && (
          <Memories baby={BABY} session={session} />
        )}
      </div>

      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
