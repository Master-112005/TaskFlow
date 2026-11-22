import React, { useEffect, useState } from 'react'
import api, { formatWhen, errorMessage } from '../api'

/** Colour a run badge by its state/conclusion. */
function runBadgeClass(run) {
  if (run.status !== 'completed') return 'run-pending'
  switch (run.conclusion) {
    case 'success': return 'run-success'
    case 'failure':
    case 'timed_out': return 'run-failure'
    case 'cancelled':
    case 'skipped': return 'run-cancelled'
    default: return 'run-neutral'
  }
}

function runBadgeText(run) {
  if (run.status !== 'completed') return run.status.replace('_', ' ')
  return run.conclusion || 'completed'
}

/**
 * Slide-in panel for GitHub Actions: recent workflow runs plus controls to
 * run a workflow manually, cancel an in-flight run, and re-run a finished one.
 */
export default function ActionsPanel({ project, onClose }) {
  const [workflows, setWorkflows] = useState(null)
  const [runs, setRuns] = useState(null)
  const [branches, setBranches] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  // dispatch form
  const [formOpen, setFormOpen] = useState(false)
  const [workflowId, setWorkflowId] = useState('')
  const [ref, setRef] = useState('')
  const [dispatching, setDispatching] = useState(false)
  const [formError, setFormError] = useState('')

  // run being cancelled / re-run / deleted
  const [busyRunId, setBusyRunId] = useState(null)
  const [deleteArmedId, setDeleteArmedId] = useState(null)

  // workflow being enabled / disabled
  const [busyWorkflowId, setBusyWorkflowId] = useState(null)
  const [showWorkflows, setShowWorkflows] = useState(false)

  async function load() {
    setRuns(null)
    setError('')
    try {
      const [wf, rn] = await Promise.all([
        api.get(`/projects/${project.id}/actions/workflows`),
        api.get(`/projects/${project.id}/actions/runs`)
      ])
      setWorkflows(wf.data)
      setRuns(rn.data)
      if (!workflowId && wf.data.length > 0) setWorkflowId(String(wf.data[0].id))
    } catch (e) {
      setError(errorMessage(e))
      setWorkflows([])
      setRuns([])
    }
  }

  async function loadBranches() {
    setBranches(null)
    try {
      const { data } = await api.get(`/projects/${project.id}/branches`)
      setBranches(data)
      const preferred = data.find((b) => b.name === 'main') || data.find((b) => b.name === 'develop') || data[0]
      if (!ref && preferred) setRef(preferred.name)
    } catch (e) {
      setBranches([])
      setFormError(errorMessage(e))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  function openForm() {
    setFormOpen(true)
    setFormError('')
    setNote('')
    if (branches === null) loadBranches()
  }

  function closeForm() {
    setFormOpen(false)
    setFormError('')
  }

  async function submitDispatch(e) {
    e.preventDefault()
    if (dispatching) return
    setDispatching(true)
    setFormError('')
    try {
      await api.post(`/projects/${project.id}/actions/workflows/${workflowId}/dispatch`, { ref })
      const wf = workflows?.find((w) => String(w.id) === String(workflowId))
      setFormOpen(false)
      setNote(`${wf ? wf.name : 'Workflow'} queued on ${ref}.`)
      await load()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setDispatching(false)
    }
  }

  async function act(kind, run) {
    setBusyRunId(run.id)
    setError('')
    setNote('')
    try {
      await api.post(`/projects/${project.id}/actions/runs/${run.id}/${kind}`)
      setNote(kind === 'cancel' ? 'Run cancelled.' : 'A new run was queued.')
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyRunId(null)
    }
  }

  async function deleteRun(run) {
    if (deleteArmedId !== run.id) {
      setDeleteArmedId(run.id)
      return
    }
    setBusyRunId(run.id)
    setError('')
    setNote('')
    try {
      await api.delete(`/projects/${project.id}/actions/runs/${run.id}`)
      setDeleteArmedId(null)
      setNote('Run deleted.')
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyRunId(null)
    }
  }

  async function toggleWorkflow(wf) {
    const enabling = wf.state === 'disabled'
    setBusyWorkflowId(wf.id)
    setError('')
    setNote('')
    try {
      await api.post(
        `/projects/${project.id}/actions/workflows/${wf.id}/${enabling ? 'enable' : 'disable'}`
      )
      setNote(`${wf.name} ${enabling ? 'enabled' : 'disabled'}.`)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyWorkflowId(null)
    }
  }

  const sortedBranches = branches ? [...branches].sort((a, b) => a.name.localeCompare(b.name)) : []
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

  const running = runs?.filter((r) => r.status !== 'completed').length ?? 0

  return (
    <aside className="side-panel actions">
      <div className="panel-head">
        <h2>Actions</h2>
        <div>
          {!formOpen && (
            <button className="panel-add" onClick={openForm} title="Run workflow">+</button>
          )}
          <button className="btn ghost" onClick={load} title="Refresh">Refresh</button>
          {formOpen && (
            <button className="btn ghost" onClick={closeForm} title="Cancel">Cancel</button>
          )}
        </div>
      </div>
      <div className="panel-sub">
        {project.repoOwner ? `${project.repoOwner}/${project.repoName}` : ''}
        {runs && ` · ${running} running, ${runs.length} recent`}
        {workflows && (
          <>
            {' · '}
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowWorkflows((v) => !v)}
            >
              {showWorkflows ? 'hide workflows' : `${workflows.length} workflows`}
            </button>
          </>
        )}
      </div>

      {showWorkflows && workflows && (
        <div className="workflow-list">
          {workflows.map((wf) => (
            <div key={wf.id} className="workflow-row">
              <span className={`state-badge ${wf.state === 'disabled' ? 'run-neutral' : 'run-success'}`}>
                {wf.state || 'active'}
              </span>
              <span className="workflow-name" title={wf.path || ''}>{wf.name}</span>
              <button
                className="btn sm"
                onClick={() => toggleWorkflow(wf)}
                disabled={busyWorkflowId === wf.id}
              >
                {busyWorkflowId === wf.id
                  ? 'Working…'
                  : wf.state === 'disabled' ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
      )}

      {connectionDead && (
        <div className="reconnect-note">
          <span>{error}</span>
          <button className="btn primary sm" onClick={reconnectGitHub}>Reconnect GitHub</button>
        </div>
      )}

      {formOpen && (
        <form className="panel-form" onSubmit={submitDispatch}>
          <label>
            Workflow
            {workflows === null ? (
              <select disabled><option>Loading workflows…</option></select>
            ) : (
              <select
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                required
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}{w.state === 'disabled' ? ' (disabled)' : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label>
            Branch
            {branches === null ? (
              <select disabled><option>Loading branches…</option></select>
            ) : (
              <select value={ref} onChange={(e) => setRef(e.target.value)} required>
                {sortedBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            )}
          </label>
          <button className="btn primary full" disabled={dispatching || branches === null}>
            {dispatching ? 'Starting…' : 'Run workflow'}
          </button>
          {formError && <div className="form-error">{formError}</div>}
        </form>
      )}

      {note && <div className="github-note actions-note">{note}</div>}

      <div className="panel-body">
        {runs === null && <div className="panel-loading">Loading…</div>}
        {runs && runs.length === 0 && !connectionDead && (
          <div className="panel-empty">No workflow runs yet.</div>
        )}
        {runs && runs.map((r) => (
          <div key={r.id} className="panel-card run-card">
            <div className="panel-card-top">
              <span className={`state-badge ${runBadgeClass(r)}`}>{runBadgeText(r)}</span>
              <span className="panel-number">#{r.runNumber}</span>
            </div>
            <div className="panel-title">{r.name}</div>
            <div className="panel-meta">
              {r.branch && <span>{r.branch}</span>}
              {r.event && <span>{r.event.replace('_', ' ')}</span>}
              {r.actor && <span>by {r.actor}</span>}
              {r.createdAt && <span>{formatWhen(r.createdAt)}</span>}
            </div>
            <div className="run-actions">
              {r.status === 'completed' ? (
                <button
                  className="btn sm"
                  onClick={() => act('rerun', r)}
                  disabled={busyRunId === r.id}
                  title="Queue a new run of this workflow"
                >
                  {busyRunId === r.id ? 'Working…' : 'Re-run'}
                </button>
              ) : (
                <button
                  className="btn sm run-cancel"
                  onClick={() => act('cancel', r)}
                  disabled={busyRunId === r.id}
                  title="Cancel this run"
                >
                  {busyRunId === r.id ? 'Working…' : 'Cancel run'}
                </button>
              )}
              {r.htmlUrl && (
                <a className="btn sm ghost" href={r.htmlUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
              <button
                className="btn sm run-cancel"
                onClick={() => deleteRun(r)}
                disabled={busyRunId === r.id}
                title="Delete this run and its logs"
              >
                {deleteArmedId === r.id ? 'Confirm delete' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && !connectionDead && <div className="chat-error">{error}</div>}
    </aside>
  )
}
