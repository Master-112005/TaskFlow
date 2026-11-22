import React, { useEffect, useState } from 'react'
import api, { ROLE_LABELS, STATUS_LABELS, formatWhen, errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import { UserAvatar } from './Avatar'

// display order of the role groups (top -> bottom)
const GROUP_ORDER = ['MANAGER', 'ADMIN', 'TEAM_LEAD', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'TESTER', 'DEV_TEAM']

export default function TeamPanel({ project, onOpenChat }) {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [removingId, setRemovingId] = useState(null)
  const [error, setError] = useState('')
  // two-step removal: click × -> warning with OK -> OK arms -> click × again
  const [warnMember, setWarnMember] = useState(null)
  const [armedMemberId, setArmedMemberId] = useState(null)

  useEffect(() => {
    api.get(`/projects/${project.id}/members`)
      .then((res) => setMembers(res.data))
      .catch(() => {})
  }, [project.id])

  const isAdmin = user?.userType === 'ADMIN'

  // Remove a teammate — always asks for the warning + OK + a second click
  // first (the creator is protected by the backend and has no remove button
  // here anyway).
  function requestRemoveMember(m) {
    if (armedMemberId === m.id) {
      setArmedMemberId(null)
      setWarnMember(null)
      removeMember(m)
    } else {
      setWarnMember(m)
      setArmedMemberId(null)
    }
  }

  function confirmRemoveMember() {
    setArmedMemberId(warnMember?.id || null)
    setWarnMember(null)
  }

  async function removeMember(m) {
    setRemovingId(m.id)
    setError('')
    try {
      await api.delete(`/projects/${project.id}/members/${m.id}`)
      setMembers((prev) => prev.filter((x) => x.id !== m.id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRemovingId(null)
    }
  }

  // group members by role, keeping GROUP_ORDER (empty groups are hidden)
  const groups = GROUP_ORDER
    .map((role) => ({ role, people: members.filter((m) => m.role === role) }))
    .filter((g) => g.people.length > 0)

  return (
    <aside className="team-panel">
      <div className="team-scroll">
        {/* project details */}
        <section className="team-section">
          <h3 className="team-heading">Project</h3>
          <div className="proj-detail">
            <div className="proj-row"><span>Name</span><strong>{project.name}</strong></div>
            <div className="proj-row"><span>Repository</span>
              <a href={`https://github.com/${project.repoOwner}/${project.repoName}`} target="_blank" rel="noreferrer">
                {project.repoOwner}/{project.repoName}
              </a>
            </div>
            <div className="proj-row"><span>Created by</span><strong>{project.createdByName}</strong></div>
            <div className="proj-row"><span>Created on</span><strong>{formatWhen(project.createdAt)}</strong></div>
            <div className="proj-row"><span>Team size</span><strong>{members.length} member{members.length === 1 ? '' : 's'}</strong></div>
            {isAdmin && (
              <div className="proj-row"><span>Invite code</span>
                <span className="code-display small">{project.inviteCode}</span>
              </div>
            )}
          </div>
        </section>

        {/* team details, grouped by role */}
        <section className="team-section">
          <h3 className="team-heading">Team · {members.length}</h3>
          {warnMember && (
            <div className="warn-note">
              <span>
                Remove <strong>{warnMember.name}</strong> from this project? They will lose access
                to this project's chat and details. Press OK, then press × again to remove.
              </span>
              <button className="btn sm warn-ok" onClick={confirmRemoveMember}>OK</button>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.role} className="role-group">
              <div className="role-group-head">
                <span>{ROLE_LABELS[g.role] || g.role}</span>
                <span className="role-count">{g.people.length}</span>
              </div>
              {g.people.map((m) => (
                <div key={m.id} className="team-member" title={m.email}>
                  <UserAvatar name={m.name} avatar={m.avatar} className="sm" />
                  <span className="tm-name">{m.name}</span>
                  {m.status && (
                    <span className="badge badge-status">{STATUS_LABELS[m.status] || m.status}</span>
                  )}
                  {/* hover-only actions: private chat (everyone but yourself) + remove (admins) */}
                  <div className="member-actions">
                    {m.id !== user?.id && (
                      <button
                        className="member-chat"
                        title={`Chat with ${m.name}`}
                        onClick={() => onOpenChat(m)}
                      >
                        Chat
                      </button>
                    )}
                    {isAdmin && m.id !== project.createdById && (
                      <button
                        className={`member-remove ${armedMemberId === m.id ? 'armed' : ''}`}
                        title={
                          armedMemberId === m.id
                            ? `Click again to remove ${m.name}`
                            : `Remove ${m.name} from this project`
                        }
                        disabled={removingId === m.id}
                        onClick={() => requestRemoveMember(m)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {members.length === 0 && <div className="menu-empty">Loading team…</div>}
          {error && <div className="form-error">{error}</div>}
        </section>
      </div>
    </aside>
  )
}
