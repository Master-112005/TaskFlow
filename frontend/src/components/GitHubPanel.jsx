import React, { useEffect, useState } from 'react'
import api, { formatWhen, errorMessage } from '../api'

const STATE_BADGE = {
  open: 'state-open',
  closed: 'state-closed',
  merged: 'state-merged'
}

/**
 * Slide-in panel listing GitHub issues (mode="issues")
 * or pull requests (mode="pulls") for a project.
 * The "+" button in the header opens a form to create a new one.
 */
export default function GitHubPanel({ mode, project, onClose }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false) // create form open
  const [branches, setBranches] = useState(null) // for the PR form
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const isIssues = mode === 'issues'
  const endpoint = isIssues ? 'issues' : 'pulls'

  async function load() {
    setItems(null)
    setError('')
    try {
      const { data } = await api.get(`/projects/${project.id}/${endpoint}`)
      setItems(data)
    } catch (e) {
      setError(errorMessage(e))
      setItems([])
    }
  }

  async function loadBranches() {
    setBranches(null)
    try {
      const { data } = await api.get(`/projects/${project.id}/branches`)
      setBranches(data)
    } catch (e) {
      setBranches([])
    }
  }

  useEffect(() => {
    if (project) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, endpoint])

  // switching panels resets the form state
  useEffect(() => {
    setCreating(false)
    setFormError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function openForm() {
    setCreating(true)
    setFormError('')
    if (!isIssues) loadBranches()
  }

  async function submitCreate(e) {
    e.preventDefault()
    const f = e.target.elements
    setBusy(true)
    setFormError('')
    try {
      if (isIssues) {
        await api.post(`/projects/${project.id}/issues`, {
          title: f.title.value.trim(),
          body: f.body.value.trim()
        })
      } else {
        await api.post(`/projects/${project.id}/pulls`, {
          title: f.title.value.trim(),
          head: f.head.value,
          base: f.base.value,
          body: f.body.value.trim(),
          draft: f.draft.checked
        })
      }
      setCreating(false)
      load()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const sortedBranches = branches ? [...branches].sort((a, b) => a.name.localeCompare(b.name)) : []

  // The GitHub connection behind this panel is dead (expired / revoked):
  // offer the reconnect right here instead of sending the user to the profile.
  const connectionDead = error.includes('connect it again')

  async function reconnectGitHub() {
    setError('')
    try {
      const { data } = await api.get('/github/connect-url', { params: { returnTo: `/project/${project.id}` } })
      window.location.href = data.url
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <aside className={`side-panel ${mode}`}>
      <div className="panel-head">
        <h2>{isIssues ? 'Issues' : 'Pull Requests'}</h2>
        <div>
          {!creating && (
            <button className="panel-add" onClick={openForm} title={isIssues ? 'New issue' : 'New pull request'}>
              +
            </button>
          )}
          <button className="btn ghost" onClick={load} title="Refresh">Refresh</button>
          {creating && (
            <button className="btn ghost" onClick={() => { setCreating(false); setFormError('') }} title="Cancel">
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="panel-sub">
        {project.repoOwner ? `${project.repoOwner}/${project.repoName}` : ''}
      </div>
      {connectionDead && (
        <div className="reconnect-note">
          <span>{error}</span>
          <button className="btn primary sm" onClick={reconnectGitHub}>Reconnect GitHub</button>
        </div>
      )}
      {creating && (
        <form className="panel-form" onSubmit={submitCreate}>
          {isIssues ? (
            <>
              <label>
                Title
                <input name="title" required maxLength={256} placeholder="What is the issue about?" autoFocus />
              </label>
              <label>
                Description
                <textarea name="body" rows={5} placeholder="Describe the problem (optional)" />
              </label>
            </>
          ) : (
            <>
              <label>
                Title
                <input name="title" required maxLength={256} placeholder="What does this pull request do?" autoFocus />
              </label>
              <label>
                Base branch (merge into)
                {branches === null ? (
                  <select name="base" disabled><option>Loading branches…</option></select>
                ) : (
                  <select name="base" required>
                    {sortedBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                )}
              </label>
              <label>
                Head branch (merge from)
                {branches === null ? (
                  <select name="head" disabled><option>Loading branches…</option></select>
                ) : (
                  <select name="head" required>
                    {sortedBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
                  </select>
                )}
              </label>
              <label>
                Description
                <textarea name="body" rows={4} placeholder="Describe the changes (optional)" />
              </label>
              <label className="panel-check">
                <input type="checkbox" name="draft" /> Open as draft
              </label>
            </>
          )}
          <button className="btn primary full" disabled={busy || (!isIssues && branches === null)}>
            {busy ? 'Creating…' : isIssues ? 'Create issue' : 'Open pull request'}
          </button>
          {formError && <div className="form-error">{formError}</div>}
        </form>
      )}
      <div className="panel-body">
        {items === null && <div className="panel-loading">Loading…</div>}
        {items && items.length === 0 && (
          <div className="panel-empty">No {isIssues ? 'issues' : 'pull requests'} found.</div>
        )}
        {items &&
          items.map((it) => (
            <a
              key={it.number}
              className="panel-card"
              href={it.htmlUrl}
              target="_blank"
              rel="noreferrer"
            >
              <div className="panel-card-top">
                <span className={`state-badge ${STATE_BADGE[it.state] || ''}`}>
                  {it.state === 'closed' && isIssues ? 'closed' : it.state}
                </span>
                <span className="panel-number">#{it.number}</span>
              </div>
              <div className="panel-title">{it.title}</div>
              <div className="panel-meta">
                {isIssues && it.labels?.length > 0 && (
                  <span className="panel-labels">{it.labels.join(', ')}</span>
                )}
                {!isIssues && (
                  <span className="panel-labels">
                    {it.headBranch} -&gt; {it.baseBranch}
                    {it.isDraft ? ' · draft' : ''}
                  </span>
                )}
                {it.author && <span>by {it.author}</span>}
                <span>{formatWhen(it.createdAt)}</span>
              </div>
            </a>
          ))}
      </div>
      {error && <div className="chat-error">{error}</div>}
    </aside>
  )
}
