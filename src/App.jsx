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
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadParentProfile(session.user.id)
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
    return `You're up late, ${name} 🌙`
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#FDFCFA' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🌿</div>
        <div style={{ fontSize:18, fontWeight:700, color:'#7C9A7E' }}>nesti</div>
      </div>
    </div>
  )

  if (!session) return <Auth onAuth={() => {}} />

  const tabs = [
    { id: 'today', label: 'Today', icon: '🏠' },
    { id: 'growth', label: 'Growth', icon: '📈' },
    { id: 'health', label: 'Health', icon: '🩺' },
    { id: 'memories', label: 'Memories', icon: '📸' }
  ]

  return (
    <div className="app-container">
      <div className="screen">
        {activeTab === 'today' && <Today session={session} baby={BABY} age={getAge()} greeting={getGreeting()} parentProfile={parentProfile} />}
        {activeTab === 'growth' && <Growth baby={BABY} age={getAge()} />}
        {activeTab === 'health' && <Health baby={BABY} />}
        {activeTab === 'memories' && <Memories baby={BABY} session={session} />}
      </div>
      <nav className="bottom-nav">
        {tabs.map(tab => (
          <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
