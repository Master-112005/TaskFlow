import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api, { errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'

export default function AdminHomePage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [repos, setRepos] = useState(null)
  const [selected, setSelected] = useState(null)
  const [created, setCreated] = useState(null)
  const [projects, setProjects] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [repoDialogOpen, setRepoDialogOpen] = useState(false)
  const [accounts, setAccounts] = useState(null) // linked GitHub accounts
  const [accountId, setAccountId] = useState(null) // account whose repos are shown
  // creating without GitHub: only a name -> lead attaches the repo later
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')

  const connected = !!user?.githubConnected

  useEffect(() => {
    api.get('/projects/my')
      .then((res) => setProjects(res.data))
      .catch(() => {})
  }, [])

  // Open the repository picker: linked GitHub accounts are checked first.
  // One (or zero) GitHub account -> straight to the repos; several -> account choice first.
  // LinkedIn accounts are for the profile only — they cannot serve repositories.
  async function openRepoDialog() {
    setRepoDialogOpen(true)
    setManualOpen(false)
    setManualName('')
    setError('')
    setAccounts(null)
    setAccountId(null)
    setRepos(null)
    setSelected(null)
    try {
      const { data } = await api.get('/github/accounts')
      const githubAccounts = data.filter((a) => a.provider === 'GITHUB')
      setAccounts(githubAccounts)
      if (githubAccounts.length === 1) {
        setAccountId(githubAccounts[0].id)
        loadRepos(githubAccounts[0].id)
      } else if (githubAccounts.length === 0) {
        setError('No GitHub account is linked. Connect GitHub from your profile first, or create the project without GitHub below.')
      }
    } catch (err) {
      setError(errorMessage(err))
      setAccounts([])
    }
  }

  // User picked one of several linked accounts -> show that account's repos
  function chooseAccount(id) {
    setAccountId(id)
    loadRepos(id)
  }

  // Returning from the GitHub OAuth redirect
  useEffect(() => {
    const status = searchParams.get('github')
    if (status === 'connected') {
      refresh().catch(() => {})
      setSearchParams({}, { replace: true })
    } else if (status === 'error') {
      setError('GitHub connection failed or was cancelled. Please try again.')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectGitHub() {
    setError('')
    setBusy(true)
    try {
      const { data } = await api.get('/github/connect-url')
      window.location.href = data.url
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  async function loadRepos(id) {
    setError('')
    setRepos(null)
    setSelected(null)
    setBusy(true)
    try {
      const { data } = await api.get('/projects/github/repos', { params: id ? { accountId: id } : {} })
      setRepos(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // A connected admin skips the connect step entirely; the repository list
  // only loads when the picker dialog is opened.

  async function createProject() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const [owner, name] = selected.split('/')
      const { data } = await api.post('/projects', {
        repoOwner: owner,
        repoName: name,
        accountId: accountId || undefined
      })
      setCreated(data)
      const refreshed = await api.get('/projects/my')
      setProjects(refreshed.data)
      setRepos(null)
      setSelected(null)
      setRepoDialogOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Create a project with just a name — GitHub is completely optional and the
  // team lead connects the repository later from the project page.
  async function createManualProject(e) {
    e.preventDefault()
    if (!manualName.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/projects', { name: manualName.trim() })
      setCreated(data)
      const refreshed = await api.get('/projects/my')
      setProjects(refreshed.data)
      setManualName('')
      setManualOpen(false)
      setRepoDialogOpen(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className="home-page">
      <header className="top-bar">
        <div className="top-left">
          <span
            className="logo-link"
            role="button"
            tabIndex={0}
            onClick={() => navigate(user?.userType === 'ADMIN' ? '/admin' : '/home')}
            title="Go to home"
          >TaskFlow</span>
        </div>
        <div className="top-right">
          <button className="btn sm" onClick={openRepoDialog}>
            New project
          </button>
          {(user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
            <button className="btn sm" onClick={() => navigate('/team')}>
              Team panel
            </button>
          )}
          <ProfileMenu />
        </div>
      </header>

      <main className="home-center wide">
        <h1>Hello {user?.name}</h1>
        {error && <div className="form-error">{error}</div>}
        {!connected && (
          <>
            <p className="home-sub">Connect GitHub to link a repository — or create a project without one and let your team lead connect it later</p>
            <section className="admin-panel">
              <h2>Connect GitHub</h2>
              <p>Connect your GitHub account with one click — no tokens to copy or paste.</p>
              <button className="btn primary" onClick={connectGitHub} disabled={busy}>
                {busy ? 'Redirecting…' : 'Connect GitHub'}
              </button>
            </section>
          </>
        )}

        {repoDialogOpen && (
          <>
            <div className="modal-backdrop" onClick={() => setRepoDialogOpen(false)} />
            <div className="repo-modal">
              <div className="modal-head">
                <h2>
                  {manualOpen
                    ? 'New project without GitHub'
                    : accountId === null && accounts && accounts.length > 1
                      ? 'Choose a GitHub account'
                      : `Pick the project${repos ? ` (${repos.length} repositories)` : ''}`}
                </h2>
                <button className="btn ghost" onClick={() => setRepoDialogOpen(false)}>Close</button>
              </div>

              {manualOpen ? (
                /* without-GitHub path: only a project name */
                <form className="manual-project-form" onSubmit={createManualProject}>
                  <p className="hint">
                    GitHub is optional. The project starts without a repository — the team lead connects
                    GitHub and picks the repository from the project page after joining.
                  </p>
                  <label className="field-label" htmlFor="manual-name">Project name</label>
                  <input
                    id="manual-name"
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Payment service rewrite"
                    autoFocus
                  />
                  <div className="manual-actions">
                    <button type="button" className="btn ghost" onClick={() => setManualOpen(false)}>
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={!manualName.trim() || busy}
                    >
                      {busy ? 'Creating…' : 'Create project & generate code'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* step 1: several accounts linked -> pick one */}
                  {accountId === null && accounts !== null && accounts.length > 1 && (
                    <div className="account-choice">
                      {accounts.map((a) => (
                        <button key={a.id} className="btn account-btn" onClick={() => chooseAccount(a.id)}>
                          <strong>{a.username}</strong>
                          <small>{a.active ? 'Active account' : 'Linked account'}</small>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* step 2: repositories of the chosen (or only) account */}
                  {accountId !== null && (
                    <>
                      <div className="repo-list">
                        {repos === null && <div className="panel-loading">Loading repositories…</div>}
                        {repos && repos.length === 0 && <div className="panel-empty">No repositories found on this account.</div>}
                        {repos && repos.map((r) => (
                          <label key={r.fullName} className={`repo-item ${selected === r.fullName ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="repo"
                              value={r.fullName}
                              checked={selected === r.fullName}
                              onChange={() => setSelected(r.fullName)}
                            />
                            <div className="repo-info">
                              <strong>{r.fullName}</strong>
                              <small>{r.isPrivate ? 'private' : 'public'}{r.description ? ` · ${r.description}` : ''}</small>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button className="btn primary" onClick={createProject} disabled={!selected || busy}>
                        {busy ? 'Creating…' : 'Create project & generate code'}
                      </button>
                    </>
                  )}

                  {/* GitHub is optional: a name-only project, lead attaches the repo later */}
                  <div className="manual-option">
                    <button
                      className="btn ghost"
                      onClick={() => { setManualOpen(true); setError('') }}
                    >
                      Create without GitHub
                    </button>
                  </div>
                </>
              )}

              {error && <div className="form-error">{error}</div>}
            </div>
          </>
        )}

        {created && (
          <section className="admin-panel success-panel">
            <h2>Project created: {created.name}</h2>
            <p>Share this code with your team members:</p>
            <div className="code-display">
              <span className="code-value">{created.inviteCode}</span>
              <button className="btn ghost" onClick={() => copyCode(created.inviteCode)}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {!created.repoOwner && (
              <p className="hint">No repository connected yet — the team lead connects GitHub and picks the repository from the project page.</p>
            )}
            <button className="btn primary" onClick={() => navigate(`/project/${created.id}`)}>
              Open project
            </button>
          </section>
        )}

        {projects.length > 0 && (
          <section className="admin-panel">
            <h2>Your projects</h2>
            <div className="project-table">
              {projects.map((p) => (
                <div key={p.id} className="project-row">
                  <div className="project-cell main">
                    <strong>{p.name}</strong>
                    <small>{p.repoOwner ? `${p.repoOwner}/${p.repoName}` : 'No repository connected yet'}</small>
                  </div>
                  <div className="project-cell">
                    <small>{p.memberCount} member(s)</small>
                  </div>
                  <div className="project-cell code">
                    <code>{p.inviteCode}</code>
                    <button className="btn ghost" onClick={() => copyCode(p.inviteCode)}>Copy</button>
                  </div>
                  <button className="btn primary sm" onClick={() => navigate(`/project/${p.id}`)}>
                    Open
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
