import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api, { ROLE_LABELS, formatWhen, errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'
import { UserAvatar } from '../components/Avatar'

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [name, setName] = useState(user?.name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // linked GitHub / LinkedIn accounts (all users — normal users get 1 GitHub account, admins 3)
  const isAdmin = user?.userType === 'ADMIN'
  const githubLimit = isAdmin ? 3 : 1
  const [accounts, setAccounts] = useState(null)
  const [accountsError, setAccountsError] = useState('')
  const [removingId, setRemovingId] = useState(null)
  const [connecting, setConnecting] = useState(false)
  // "Add account" chooser: GitHub (OAuth) or LinkedIn (paste profile link)
  const [chooseOpen, setChooseOpen] = useState(false)
  const [linkedinOpen, setLinkedinOpen] = useState(false)
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [addingLinkedIn, setAddingLinkedIn] = useState(false)
  // message shown after returning from the GitHub OAuth flow
  const [githubNote, setGithubNote] = useState(null)

  const githubCount = accounts?.filter((a) => a.provider === 'GITHUB').length ?? 0

  useEffect(() => {
    api.get('/github/accounts')
      .then((res) => setAccounts(res.data))
      .catch((err) => setAccountsError(errorMessage(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Returning from the GitHub OAuth flow ("Add account")
  useEffect(() => {
    const status = searchParams.get('github')
    const login = searchParams.get('login')
    if (status === 'connected') {
      setGithubNote(`GitHub account ${login} linked successfully.`)
      refresh().catch(() => {})
      api.get('/github/accounts')
        .then((res) => setAccounts(res.data))
        .catch(() => {})
      setSearchParams({}, { replace: true })
    } else if (status === 'already') {
      setGithubNote(
        <span>
          {login} was already linked — its connection was refreshed. To add a different GitHub
          account, click Add account again and pick that account in GitHub's account picker.
        </span>
      )
      setSearchParams({}, { replace: true })
    } else if (status === 'error') {
      setAccountsError('GitHub connection failed or was cancelled. Please try again.')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      await api.put('/auth/profile', {
        name: name.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
        // avatar is not sent here: it is chosen from the profile-icon dropdown
      })
      await refresh()
      setCurrentPassword('')
      setNewPassword('')
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Start the GitHub OAuth flow to link one more account; come back to this page.
  // With an account already linked, GitHub's account picker is forced so the
  // user can connect another GitHub account WITHOUT logging out of the first.
  async function addAccount() {
    setConnecting(true)
    setAccountsError('')
    setGithubNote(null)
    try {
      const params = { returnTo: '/profile' }
      if (githubCount > 0) params.picker = 'select'
      const { data } = await api.get('/github/connect-url', { params })
      window.location.href = data.url
    } catch (err) {
      setAccountsError(errorMessage(err))
      setConnecting(false)
    }
  }

  // Save a pasted LinkedIn profile link — no OAuth needed
  async function submitLinkedIn(e) {
    e.preventDefault()
    if (addingLinkedIn) return
    setAddingLinkedIn(true)
    setAccountsError('')
    try {
      const { data } = await api.post('/accounts/linkedin', { url: linkedinUrl.trim() })
      setAccounts((prev) => [...(prev || []), data])
      setLinkedinUrl('')
      setLinkedinOpen(false)
      setChooseOpen(false)
    } catch (err) {
      setAccountsError(errorMessage(err))
    } finally {
      setAddingLinkedIn(false)
    }
  }

  // Remove one linked account; the list is refreshed afterwards
  async function removeAccount(account) {
    setRemovingId(account.id)
    setAccountsError('')
    try {
      const { data } = await api.post(`/github/accounts/${account.id}/remove`)
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      // when the active account changed, githubConnected may change too
      if (data.activeChanged) {
        await refresh()
      }
    } catch (err) {
      setAccountsError(errorMessage(err))
    } finally {
      setRemovingId(null)
    }
  }

  const count = accounts?.length ?? 0
  return (
    <div className="home-page">
      <header className="top-bar">
        <div className="top-left">
          <button className="back-circle" onClick={() => navigate(-1)} title="Go back">&lt;</button>
          <Link className="logo-link" to={isAdmin ? '/admin' : '/home'} title="Go to home">TaskFlow</Link>
        </div>
        <ProfileMenu />
      </header>

      <main className="profile-wrap">
        <div className="profile-grid">
          {/* left: profile */}
          <div className="profile-card">
            <aside className="profile-side">
              <UserAvatar name={name} avatar={user?.avatar} className="xl" />
              <h2 className="profile-side-name">{name}</h2>
              <div className="profile-side-email">{user?.email}</div>
              <div className="profile-side-badges">
                <span className={`badge ${user?.userType === 'ADMIN' ? 'badge-admin' : 'badge-normal'}`}>
                  {user?.userType === 'ADMIN' ? 'Admin user' : 'Normal user'}
                </span>
                <span className="badge badge-role">{ROLE_LABELS[user?.role] || user?.role}</span>
              </div>
              {user?.createdAt && (
                <div className="profile-side-since">Member since {formatWhen(user.createdAt)}</div>
              )}
            </aside>

            <form className="profile-form" onSubmit={submit}>
              <h3 className="team-heading">Account details</h3>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />

              <label>Email</label>
              <input value={user?.email || ''} disabled />
              <p className="hint">Email is your login and cannot be changed.</p>

              <label>Role</label>
              <input value={ROLE_LABELS[user?.role] || user?.role || ''} disabled />

              <h3 className="team-heading">Change password</h3>
              <label>Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Needed only when changing the password"
                autoComplete="current-password"
              />

              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave empty to keep your current password"
                minLength={6}
                autoComplete="new-password"
              />

              {saved && <p className="profile-saved">Profile saved.</p>}
              {error && <div className="form-error">{error}</div>}

              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </div>

          {/* right: linked accounts (all users) */}
          <section className="admin-panel github-accounts">
            <div className="panel-card-head">
              <h2>Accounts</h2>
              <button className="btn sm" onClick={() => { setChooseOpen(!chooseOpen); setLinkedinOpen(false) }} disabled={connecting}>
                {connecting ? 'Opening GitHub…' : 'Add account'}
              </button>
            </div>
            <p className="hint">
              {count === 0
                ? 'No account linked yet.'
                : `${count} account${count === 1 ? '' : 's'} linked to this profile.`}
            </p>

            {/* chooser: GitHub via OAuth, LinkedIn via pasted profile link */}
            {chooseOpen && (
              <div className="account-chooser">
                <button
                  className="btn account-btn"
                  onClick={addAccount}
                  disabled={connecting || githubCount >= githubLimit}
                  title={githubCount >= githubLimit ? 'GitHub limit reached — remove your account first' : 'Connect with GitHub OAuth'}
                >
                  <strong>GitHub</strong>
                  <small>
                    {githubCount >= githubLimit
                      ? isAdmin
                        ? 'Limit reached — up to 3 GitHub accounts. Remove one first.'
                        : 'Limit reached — normal users link one GitHub account. Remove it first.'
                        : githubCount > 0
                          ? 'GitHub shows the account picker — pick the account to add, no logout needed'
                          : isAdmin
                            ? 'Connect with one click (OAuth)'
                            : 'Issues and pull requests you create will be made as this account'}
                  </small>
                </button>
                <button
                  className="btn account-btn"
                  onClick={() => setLinkedinOpen(!linkedinOpen)}
                >
                  <strong>LinkedIn</strong>
                  <small>Paste your LinkedIn profile link</small>
                </button>
              </div>
            )}

              {/* LinkedIn: paste the profile link */}
              {linkedinOpen && (
                <form className="linkedin-form" onSubmit={submitLinkedIn}>
                  <input
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/your-name"
                    required
                  />
                  <div className="linkedin-actions">
                    <button className="btn primary sm" disabled={addingLinkedIn}>
                      {addingLinkedIn ? 'Adding…' : 'Add'}
                    </button>
                    <button type="button" className="btn sm" onClick={() => setLinkedinOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {accounts === null && !accountsError && <div className="panel-loading">Loading accounts…</div>}

              {accounts && accounts.length === 0 && !accountsError && (
                <div className="panel-empty">Add your first account with "Add account".</div>
              )}

              {accounts && accounts.map((a) => (
                <div key={a.id} className="linked-account-row">
                  <div className="linked-info">
                    {a.provider === 'LINKEDIN' ? (
                      <a href={a.username} target="_blank" rel="noreferrer" className="linkedin-link">
                        {a.username.replace(/^https?:\/\/(www\.)?/i, '')}
                      </a>
                    ) : (
                      <strong>{a.username}</strong>
                    )}
                    <small>
                      {a.provider === 'LINKEDIN' ? 'LinkedIn profile' : a.active ? 'Active account' : 'Linked'}
                      {a.connectedAt ? ` · since ${formatWhen(a.connectedAt)}` : ''}
                    </small>
                  </div>
                  <button
                    className="member-remove"
                    title={`Remove ${a.provider === 'LINKEDIN' ? 'this LinkedIn profile' : a.username}`}
                    disabled={removingId === a.id}
                    onClick={() => removeAccount(a)}
                  >
                    ×
                  </button>
                </div>
              ))}

              {githubNote && <div className="github-note">{githubNote}</div>}
              {accountsError && <div className="form-error">{accountsError}</div>}
          </section>
        </div>
      </main>
    </div>
  )
}
