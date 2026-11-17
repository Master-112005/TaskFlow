import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'

export default function UserHomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(false)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    api.get('/projects/my')
      .then((res) => setProjects(res.data))
      .catch(() => {})
  }, [])

  async function join(e) {
    e.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/projects/join', { code: code.trim() })
      if (data.status === 'JOINED' && data.project) {
        navigate(`/project/${data.project.id}`)
      } else {
        // the admin now has to approve the request before the user can enter
        setPending(true)
        setBusy(false)
      }
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="home-page">
      <header className="top-bar">
        <span className="logo-link" onClick={() => navigate('/home')} title="Go to home">TaskFlow</span>
        <ProfileMenu />
      </header>

      <main className="home-center">
        <h1>Welcome, {user?.name}</h1>
        <p className="home-sub">
          Enter the project code your team lead or manager shared with you
        </p>

        <form className="code-form" onSubmit={join}>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7KX2M9"
            maxLength={12}
            autoFocus
          />
          <button className="btn primary" disabled={busy || !code.trim()}>
            {busy ? 'Joining…' : 'Enter project'}
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
        {pending && (
          <div className="join-pending">
            Request sent — the project admin must approve you before you can enter.
            The project will appear under "Your projects" once approved.
          </div>
        )}

        {projects.length > 0 && (
          <section className="my-projects">
            <h3>Your projects</h3>
            <div className="project-chips">
              {projects.map((p) => (
                <button key={p.id} className="project-chip" onClick={() => navigate(`/project/${p.id}`)}>
                  {p.name}
                  <small>{p.repoOwner}/{p.repoName}</small>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
