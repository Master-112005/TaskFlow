import React, { useEffect, useState } from 'react'
import api, { formatWhen, errorMessage } from '../api'

const STATE_BADGE = {
  open: 'state-open',
  closed: 'state-closed',
  merged: 'state-merged'
}

function reviewClass(state) {
  switch (state) {
    case 'APPROVED': return 'run-success'
    case 'CHANGES_REQUESTED': return 'run-failure'
    default: return 'run-neutral'
  }
}

/**
 * Slide-in panel for GitHub issues (mode="issues") and pull requests
 * (mode="pulls"). The list creates new items; clicking one opens an in-app
 * detail view with comments, reviews and lifecycle controls (close/reopen,
 * edit, delete, merge, approve/request changes).
 */
export default function GitHubPanel({ mode, project }) {
  const isIssues = mode === 'issues'
  const endpoint = isIssues ? 'issues' : 'pulls'
  const base = `/projects/${project.id}`

  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [branches, setBranches] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  // detail view
  const [detail, setDetail] = useState(null)
  const [comments, setComments] = useState(null)
  const [reviews, setReviews] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [detailBusy, setDetailBusy] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [mergeMethod, setMergeMethod] = useState('merge')

  async function load() {
    setItems(null)
    setError('')
    try {
      const { data } = await api.get(`${base}/${endpoint}`)
      setItems(data)
    } catch (e) {
      setError(errorMessage(e))
      setItems([])
    }
  }

  async function loadBranches() {
    setBranches(null)
    try {
      const { data } = await api.get(`${base}/branches`)
      setBranches(data)
    } catch (e) {
      setBranches([])
    }
  }

  useEffect(() => {
    if (project) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, endpoint])

  // switching panels resets the form and detail state
  useEffect(() => {
    setCreating(false)
    setFormError('')
    setDetail(null)
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
        await api.post(`${base}/issues`, {
          title: f.title.value.trim(),
          body: f.body.value.trim()
        })
      } else {
        await api.post(`${base}/pulls`, {
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

  // ---------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------

  async function openDetail(item) {
    setDetail(item)
    setComments(null)
    setReviews(null)
    setDetailError('')
    setCommentText('')
    setEditOpen(false)
    setDeleteArmed(false)
    await loadThread(item)
  }

  async function loadThread(item) {
    try {
      const { data } = await api.get(`${base}/${endpoint}/${item.number}/comments`)
      setComments(data)
    } catch (e) {
      setComments([])
      setDetailError(errorMessage(e))
    }
    if (!isIssues) {
      try {
        const { data } = await api.get(`${base}/pulls/${item.number}/reviews`)
        setReviews(data)
      } catch (e) {
        setReviews([])
      }
    }
  }

  async function refreshDetail() {
    if (!detail) return
    await loadThread(detail)
    await load()
  }

  async function patchDetail(payload) {
    setDetailBusy(true)
    setDetailError('')
    try {
      const { data } = await api.patch(`${base}/${endpoint}/${detail.number}`, payload)
      setDetail(data)
      load()
      return true
    } catch (e) {
      setDetailError(errorMessage(e))
      return false
    } finally {
      setDetailBusy(false)
    }
  }

  async function toggleState() {
    await patchDetail({ state: detail.state === 'open' ? 'closed' : 'open' })
  }

  function openEdit() {
    setEditTitle(detail.title)
    setEditBody(detail.body || '')
    setEditOpen(true)
    setDetailError('')
  }

  async function saveEdit(e) {
    e.preventDefault()
    const ok = await patchDetail({ title: editTitle.trim(), body: editBody })
    if (ok) setEditOpen(false)
  }

  async function deleteIssue() {
    if (!deleteArmed) {
      setDeleteArmed(true)
      return
    }
    setDetailBusy(true)
    setDetailError('')
    try {
      await api.delete(`${base}/issues/${detail.number}`)
      setDetail(null)
      load()
    } catch (e) {
      setDetailError(errorMessage(e))
    } finally {
      setDetailBusy(false)
    }
  }

  async function merge() {
    setDetailBusy(true)
    setDetailError('')
    try {
      await api.post(`${base}/pulls/${detail.number}/merge`, { mergeMethod })
      setDetail({ ...detail, state: 'closed' })
      load()
    } catch (e) {
      setDetailError(errorMessage(e))
    } finally {
      setDetailBusy(false)
    }
  }

  async function submitReview(event) {
    setDetailBusy(true)
    setDetailError('')
    try {
      await api.post(`${base}/pulls/${detail.number}/reviews`, {
        event,
        body: commentText.trim()
      })
      setCommentText('')
      await loadThread(detail)
      load()
    } catch (e) {
      setDetailError(errorMessage(e))
    } finally {
      setDetailBusy(false)
    }
  }

  async function submitComment() {
    if (!commentText.trim()) return
    setDetailBusy(true)
    setDetailError('')
    try {
      const { data } = await api.post(`${base}/${endpoint}/${detail.number}/comments`, {
        body: commentText.trim()
      })
      setComments((prev) => [...(prev || []), data])
      setCommentText('')
      load()
    } catch (e) {
      setDetailError(errorMessage(e))
    } finally {
      setDetailBusy(false)
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

  // ---------------------------------------------------------------
  // Detail rendering
  // ---------------------------------------------------------------

  if (detail) {
    const open = detail.state === 'open'
    return (
      <aside className={`side-panel ${mode}`}>
        <div className="panel-head">
          <h2>#{detail.number}</h2>
          <div>
            <button className="btn ghost" onClick={refreshDetail} title="Refresh">Refresh</button>
          </div>
        </div>
        <div className="panel-sub">
          {project.repoOwner}/{project.repoName} · {isIssues ? 'issue' : 'pull request'}
        </div>

        <div className="panel-body">
          <button className="btn ghost sm detail-back" onClick={() => setDetail(null)}>
            &lt; Back to {isIssues ? 'issues' : 'pull requests'}
          </button>

          <div className="panel-card-top">
            <span className={`state-badge ${STATE_BADGE[detail.state] || ''}`}>{detail.state}</span>
            <span className="panel-number">
              {detail.author ? `by ${detail.author}` : ''}
              {detail.createdAt ? ` · ${formatWhen(detail.createdAt)}` : ''}
            </span>
          </div>
          <h3 className="detail-title">{detail.title}</h3>

          {!isIssues && (
            <div className="detail-branches">
              {detail.headBranch} &rarr; {detail.baseBranch}
              {detail.isDraft ? ' · draft' : ''}
            </div>
          )}
          {isIssues && detail.labels?.length > 0 && (
            <div className="panel-meta">
              <span className="panel-labels">{detail.labels.join(', ')}</span>
            </div>
          )}

          <div className="detail-body">{detail.body?.trim() ? detail.body : 'No description.'}</div>

          <div className="detail-actions">
            <button className="btn sm" onClick={toggleState} disabled={detailBusy}>
              {open ? 'Close' : 'Reopen'}
            </button>
            <button className="btn sm" onClick={openEdit} disabled={detailBusy}>Edit</button>

            {!isIssues && open && (
              <>
                <select value={mergeMethod} onChange={(e) => setMergeMethod(e.target.value)}>
                  <option value="merge">Merge commit</option>
                  <option value="squash">Squash and merge</option>
                  <option value="rebase">Rebase and merge</option>
                </select>
                <button className="btn primary sm" onClick={merge} disabled={detailBusy}>
                  {detailBusy ? 'Working…' : 'Merge'}
                </button>
                <button className="btn sm" onClick={() => submitReview('APPROVE')} disabled={detailBusy}>
                  Approve
                </button>
                <button className="btn sm" onClick={() => submitReview('REQUEST_CHANGES')} disabled={detailBusy}>
                  Request changes
                </button>
              </>
            )}

            {isIssues && (
              <button className="btn sm run-cancel" onClick={deleteIssue} disabled={detailBusy}>
                {deleteArmed ? 'Confirm delete' : 'Delete'}
              </button>
            )}
          </div>

          {editOpen && (
            <form className="panel-form detail-edit" onSubmit={saveEdit}>
              <label>
                Title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={256}
                  autoFocus
                />
              </label>
              <label>
                Description
                <textarea
                  rows={5}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </label>
              <div className="detail-actions">
                <button className="btn primary sm" disabled={detailBusy}>
                  {detailBusy ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn sm" onClick={() => setEditOpen(false)}>Cancel</button>
              </div>
            </form>
          )}

          {detailError && <div className="form-error">{detailError}</div>}

          {!isIssues && reviews?.length > 0 && (
            <section className="thread">
              <h4 className="thread-title">Reviews</h4>
              {reviews.map((r) => (
                <div key={r.id} className="comment-row">
                  <div className="comment-head">
                    <strong>{r.author}</strong>
                    <span className={`state-badge ${reviewClass(r.state)}`}>{r.state}</span>
                    <span>{formatWhen(r.submittedAt)}</span>
                  </div>
                  {r.body && <div className="comment-body">{r.body}</div>}
                </div>
              ))}
            </section>
          )}

          <section className="thread">
            <h4 className="thread-title">Comments</h4>
            {comments === null && <div className="panel-loading">Loading…</div>}
            {comments?.length === 0 && <div className="panel-empty small">No comments yet.</div>}
            {comments?.map((c) => (
              <div key={c.id} className="comment-row">
                <div className="comment-head">
                  <strong>{c.author}</strong>
                  <span>{formatWhen(c.createdAt)}</span>
                </div>
                <div className="comment-body">{c.body}</div>
              </div>
            ))}

            <textarea
              className="comment-box"
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={isIssues ? 'Write a comment…' : 'Write a comment or review note…'}
            />
            <div className="detail-actions">
              <button
                className="btn primary sm"
                onClick={submitComment}
                disabled={detailBusy || !commentText.trim()}
              >
                {detailBusy ? 'Sending…' : 'Add comment'}
              </button>
            </div>
          </section>
        </div>
      </aside>
    )
  }

  // ---------------------------------------------------------------
  // List rendering
  // ---------------------------------------------------------------

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
            <button
              key={it.number}
              type="button"
              className="panel-card panel-card-btn"
              onClick={() => openDetail(it)}
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
                {isIssues && it.comments > 0 && (
                  <span>{it.comments} comment{it.comments === 1 ? '' : 's'}</span>
                )}
                <span>{formatWhen(it.createdAt)}</span>
              </div>
            </button>
          ))}
      </div>
      {error && <div className="chat-error">{error}</div>}
    </aside>
  )
}
