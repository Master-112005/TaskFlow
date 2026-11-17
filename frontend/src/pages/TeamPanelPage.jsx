import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { ROLE_LABELS, errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'
import { UserAvatar } from '../components/Avatar'

/**
 * Manager's team panel: every team lead on the left; on the right, the members
 * of the selected lead (all members when nothing is selected).
 */
export default function TeamPanelPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null) // lead id, or null = all leads
  const [members, setMembers] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/team/leads')
      .then((res) => setLeads(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    setMembers(null)
    const url = selectedLead ? `/team/members?leadId=${selectedLead}` : '/team/members'
    api.get(url)
      .then((res) => setMembers(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [selectedLead])

  const activeLead = leads?.find((l) => l.id === selectedLead)

  return (
    <div className="home-page">
      <header className="top-bar">
        <div className="top-left">
          <button className="back-circle" onClick={() => navigate(-1)} title="Go back">&lt;</button>
          <span className="logo-link" onClick={() => navigate(user?.userType === 'ADMIN' ? '/admin' : '/home')} title="Go to home">Team panel</span>
        </div>
        <ProfileMenu />
      </header>

      <main className="team-wrap">
        <h1>Team structure</h1>
        <p className="home-sub">Select a team lead on the left to see their members on the right</p>

        {error && <div className="form-error">{error}</div>}

        <div className="team-columns">
          <section className="admin-panel">
            <h2>Team leads</h2>
            <div className="lead-list">
              {leads === null && <div className="panel-loading">Loading…</div>}
              {leads && leads.length === 0 && (
                <div className="panel-empty">No team leads registered yet.</div>
              )}
              {leads && leads.length > 0 && (
                <button
                  type="button"
                  className={`lead-item ${selectedLead === null ? 'selected' : ''}`}
                  onClick={() => setSelectedLead(null)}
                >
                  <div className="lead-info">
                    <strong>All team leads</strong>
                    <small>Show every member</small>
                  </div>
                </button>
              )}
              {leads && leads.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`lead-item ${selectedLead === l.id ? 'selected' : ''}`}
                  onClick={() => setSelectedLead(l.id)}
                >
                  <UserAvatar name={l.name} avatar={l.avatar} className="sm" />
                  <div className="lead-info">
                    <strong>{l.name}</strong>
                    <small>{l.email}</small>
                    <small>{l.projectCount} project(s) · {l.memberCount} member(s)</small>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-panel">
            <h2>{activeLead ? `Members of ${activeLead.name}` : 'All team members'}</h2>
            <div className="lead-list">
              {members === null && <div className="panel-loading">Loading…</div>}
              {members && members.length === 0 && (
                <div className="panel-empty">
                  {activeLead
                    ? `No members work in ${activeLead.name}'s projects yet.`
                    : 'No members under the team leads yet.'}
                </div>
              )}
              {members && members.map((m) => (
                <div key={m.id} className="request-row" title={m.email}>
                  <UserAvatar name={m.name} avatar={m.avatar} className="sm" />
                  <div className="request-info">
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </div>
                  <span className="badge badge-role">{ROLE_LABELS[m.role] || m.role}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
