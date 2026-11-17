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
 */
export default function GitHubPanel({ mode, project, onClose }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
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

  useEffect(() => {
    if (project) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, endpoint])

  return (
    <aside className={`side-panel ${mode}`}>
      <div className="panel-head">
        <h2>{isIssues ? 'Issues' : 'Pull Requests'}</h2>
        <div>
          <button className="btn ghost" onClick={load} title="Refresh">Refresh</button>
          <button className="btn ghost" onClick={onClose} title="Close">Close</button>
        </div>
      </div>
      <div className="panel-sub">
        {project.repoOwner}/{project.repoName}
      </div>
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
