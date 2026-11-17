import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ROLE_LABELS, STATUS_LABELS, errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import { UserAvatar, AVATAR_KEYS, AvatarImage } from './Avatar'

export default function ProfileMenu() {
  const { user, refresh, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Pick an avatar right in the dropdown: saved immediately, click again to clear.
  async function chooseAvatar(key) {
    if (saving) return
    const next = user?.avatar === key ? '' : key
    setSaving(true)
    setError('')
    try {
      await api.put('/auth/profile', { name: user.name, avatar: next })
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Set the availability status right in the dropdown: saved immediately.
  async function chooseStatus(key) {
    if (saving) return
    const next = user?.status === key ? '' : key
    setSaving(true)
    setError('')
    try {
      await api.put('/auth/profile', { name: user.name, status: next })
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-menu" ref={ref}>
      <button className="avatar-btn-wrap" onClick={() => setOpen(!open)} title={user?.name}>
        <UserAvatar name={user?.name} avatar={user?.avatar} />
      </button>
      {open && (
        <div className="profile-dropdown">
          <div className="profile-head">
            <UserAvatar name={user?.name} avatar={user?.avatar} className="big" />
            <div>
              <div className="profile-name">
                {user?.name}
                {user?.status && (
                  <span className="badge badge-status">{STATUS_LABELS[user.status] || user.status}</span>
                )}
              </div>
              <div className="profile-email">{user?.email}</div>
              <span className={`badge ${user?.userType === 'ADMIN' ? 'badge-admin' : 'badge-normal'}`}>
                {user?.userType === 'ADMIN' ? 'Admin user' : 'Normal user'} · {ROLE_LABELS[user?.role] || user?.role}
              </span>
            </div>
          </div>

          <div className="dropdown-avatars">
            <div className="dropdown-label">Avatar</div>
            <div className="avatar-picker">
              {AVATAR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`avatar-option ${user?.avatar === key ? 'selected' : ''}`}
                  onClick={() => chooseAvatar(key)}
                  disabled={saving}
                  title={user?.avatar === key ? 'Back to initials' : 'Use this avatar'}
                >
                  <AvatarImage id={key} />
                </button>
              ))}
            </div>
            {error && <div className="chat-error">{error}</div>}
          </div>

          <div className="dropdown-status">
            <div className="dropdown-label">Status</div>
            <div className="status-picker">
              {Object.keys(STATUS_LABELS).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`status-option ${user?.status === key ? 'selected' : ''}`}
                  onClick={() => chooseStatus(key)}
                  disabled={saving}
                  title={user?.status === key ? 'Remove this status' : `Set status to ${STATUS_LABELS[key]}`}
                >
                  {STATUS_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          <button
            className="dropdown-item"
            onClick={() => {
              setOpen(false)
              navigate('/profile')
            }}
          >
            Edit profile
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              setOpen(false)
              navigate(user.userType === 'ADMIN' ? '/admin' : '/home')
            }}
          >
            Home
          </button>
          <button className="dropdown-item danger" onClick={() => { signOut(); navigate('/login', { replace: true }) }}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
