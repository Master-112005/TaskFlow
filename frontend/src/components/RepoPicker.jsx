import React, { useEffect, useState } from 'react'
import api, { errorMessage } from '../api'

/**
 * Repository picker dialog for the project page's lead flow:
 * after connecting GitHub, the lead picks one of the linked GitHub accounts
 * and then one of that account's repositories. onPick(fullName, accountId).
 */
export default function RepoPicker({ onClose, onPick }) {
  const [accounts, setAccounts] = useState(null)
  const [accountId, setAccountId] = useState(null)
  const [repos, setRepos] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // GitHub-only accounts (LinkedIn profiles have no repositories)
  useEffect(() => {
    api.get('/github/accounts')
      .then((res) => {
        const gh = res.data.filter((a) => a.provider === 'GITHUB')
        setAccounts(gh)
        if (gh.length === 1) setAccountId(gh[0].id)
      })
      .catch((err) => {
        setError(errorMessage(err))
        setAccounts([])
      })
  }, [])

  useEffect(() => {
    if (accountId === null) return
    setRepos(null)
    setSelected(null)
    api.get('/projects/github/repos', { params: { accountId } })
      .then((res) => setRepos(res.data))
      .catch((err) => {
        setError(errorMessage(err))
        setRepos([])
      })
  }, [accountId])

  async function attach() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      const [owner, name] = selected.split('/')
      await onPick(owner, name, accountId)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="repo-modal">
        <div className="modal-head">
          <h2>
            {accountId === null ? 'Choose a GitHub account' : 'Pick the project repository'}
          </h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        {accountId === null && accounts !== null && accounts.length > 1 && (
          <div className="account-choice">
            {accounts.map((a) => (
              <button key={a.id} className="btn account-btn" onClick={() => setAccountId(a.id)}>
                <strong>{a.username}</strong>
                <small>{a.active ? 'Active account' : 'Linked account'}</small>
              </button>
            ))}
          </div>
        )}

        {accounts !== null && accounts.length === 0 && (
          <div className="panel-empty">No GitHub account connected yet.</div>
        )}

        {accountId !== null && (
          <>
            <div className="repo-list">
              {repos === null && <div className="panel-loading">Loading repositories…</div>}
              {repos && repos.length === 0 && (
                <div className="panel-empty">No repositories found on this account.</div>
              )}
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
            <button className="btn primary" onClick={attach} disabled={!selected || busy}>
              {busy ? 'Connecting…' : 'Use this repository'}
            </button>
          </>
        )}

        {error && <div className="form-error">{error}</div>}
      </div>
    </>
  )
}
