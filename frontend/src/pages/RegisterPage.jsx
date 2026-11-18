import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api, { ROLE_LABELS, errorMessage } from '../api'
import { useAuth } from '../AuthContext'

const NORMAL_ROLES = ['FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER', 'DEV_TEAM']
const ADMIN_ROLES = ['TEAM_LEAD', 'ADMIN', 'MANAGER']

export default function RegisterPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [userType, setUserType] = useState('NORMAL')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'FRONTEND_DEVELOPER' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const roles = userType === 'NORMAL' ? NORMAL_ROLES : ADMIN_ROLES

  function changeType(type) {
    setUserType(type)
    setForm((f) => ({ ...f, role: type === 'NORMAL' ? 'FRONTEND_DEVELOPER' : 'TEAM_LEAD' }))
  }

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/auth/register', { ...form, userType })
      signIn(data)
      // A normal user must connect GitHub before entering projects — first
      // sign-in goes to the profile's connect prompt, then straight home.
      if (data.user.userType === 'NORMAL' && !data.user.githubConnected) {
        navigate('/profile?connect=first', { replace: true })
      } else {
        navigate(data.user.userType === 'ADMIN' ? '/admin' : '/home', { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="logo">TaskFlow</h1>
        <p className="auth-sub">Create your account</p>

        <div className="toggle-row">
          <button type="button" className={`toggle ${userType === 'NORMAL' ? 'on' : ''}`} onClick={() => changeType('NORMAL')}>
            Normal user
            <small>Developer, Tester, Dev team</small>
          </button>
          <button type="button" className={`toggle ${userType === 'ADMIN' ? 'on' : ''}`} onClick={() => changeType('ADMIN')}>
            Admin user
            <small>Team lead, Admin, Manager</small>
          </button>
        </div>

        <label>Name</label>
        <input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />

        <label>Password</label>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} />

        <label>{userType === 'NORMAL' ? 'What do you do?' : 'Your position'}</label>
        <select value={form.role} onChange={(e) => set('role', e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>

        {error && <div className="form-error">{error}</div>}

        <button className="btn primary full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
