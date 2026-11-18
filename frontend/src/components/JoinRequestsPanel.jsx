import React, { useEffect, useState } from 'react'
import api, { ROLE_LABELS, formatWhen, errorMessage } from '../api'
import { UserAvatar } from './Avatar'

/**
 * Slide-in panel with the pending join requests of one project.
 * Opens from the project page next to the Issues / Pull Requests panels.
 */
export default function JoinRequestsPanel({ project, onClose }) {
  const [items, setItems] = useState(null)
  const [handlingId, setHandlingId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setItems(null)
    setError('')
    try {
      const { data } = await api.get(`/projects/${project.id}/join-requests`)
      setItems(data)
    } catch (e) {
      setError(errorMessage(e))
      setItems([])
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  async function decide(id, action) {
    setHandlingId(id)
    setError('')
    try {
      await api.post(`/projects/join-requests/${id}/${action}`)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setHandlingId(null)
    }
  }

  return (
    <aside className="side-panel requests">
      <div className="panel-head">
        <h2>Join requests</h2>
        <button className="btn ghost" onClick={onClose} title="Close">Close</button>
      </div>
      <div className="panel-sub">
        {project.repoOwner ? `${project.repoOwner}/${project.repoName}` : 'No repository connected yet'}
      </div>
      <div className="panel-body">
        {items === null && <div className="panel-loading">Loading…</div>}
        {items && items.length === 0 && (
          <div className="panel-empty">No pending requests for this project.</div>
        )}
        {items && items.map((r) => (
          <div key={r.id} className="request-row">
            <UserAvatar name={r.userName} avatar={r.avatar} className="sm" />
            <div className="request-info">
              <strong>{r.userName}</strong>
              <small>{r.userEmail}</small>
              <small>{ROLE_LABELS[r.role] || r.role} · {formatWhen(r.requestedAt)}</small>
            </div>
            <div className="request-actions">
              <button
                className="btn primary sm"
                disabled={handlingId === r.id}
                onClick={() => decide(r.id, 'approve')}
              >
                Approve
              </button>
              <button
                className="btn sm"
                disabled={handlingId === r.id}
                onClick={() => decide(r.id, 'reject')}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="chat-error">{error}</div>}
    </aside>
  )
}
