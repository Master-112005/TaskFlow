import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'
import Chat from '../components/Chat'
import GitHubPanel from '../components/GitHubPanel'
import JoinRequestsPanel from '../components/JoinRequestsPanel'
import TeamPanel from '../components/TeamPanel'

export default function ProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null) // null | 'issues' | 'pulls' | 'requests'
  // private chat partner (MemberDto) — shared by the chat area and the team panel
  const [dmUser, setDmUser] = useState(null)

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [id])

  if (error) {
    return (
      <div className="home-page">
        <header className="top-bar">
          <div className="top-left">
            <button className="back-circle" onClick={() => navigate(-1)} title="Go back">&lt;</button>
            <span className="logo-link" onClick={() => navigate(user?.userType === 'ADMIN' ? '/admin' : '/home')} title="Go to home">TaskFlow</span>
          </div>
          <ProfileMenu />
        </header>
        <main className="home-center"><div className="form-error">{error}</div></main>
      </div>
    )
  }

  if (!project) {
    return <div className="page-loading">Loading project…</div>
  }

  const isAdmin = user?.userType === 'ADMIN'

  return (
    <div className="project-page">
      <header className="top-bar">
        <div className="top-left">
          <button className="back-circle" onClick={() => navigate(-1)} title="Go back">&lt;</button>
          <div className="project-heading">
            <strong>{project.name}</strong>
            <small>{project.repoOwner}/{project.repoName}</small>
          </div>
          {isAdmin && (
            <span className="code-pill" title="Invite code">{project.inviteCode}</span>
          )}
        </div>
        <div className="top-right">
          <button
            className={`btn pill ${panel === 'issues' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'issues' ? null : 'issues')}
          >
            Issues
          </button>
          <button
            className={`btn pill ${panel === 'pulls' ? 'active' : ''}`}
            onClick={() => setPanel(panel === 'pulls' ? null : 'pulls')}
          >
            Pull Requests
          </button>
          {isAdmin && (
            <button
              className={`btn pill ${panel === 'requests' ? 'active' : ''}`}
              onClick={() => setPanel(panel === 'requests' ? null : 'requests')}
            >
              Requests
            </button>
          )}
          <ProfileMenu />
        </div>
      </header>

      <div className="project-body">
        <main className="chat-area">
          <Chat projectId={project.id} dmUser={dmUser} onDmUser={setDmUser} />
        </main>
        {panel === 'requests' && (
          <JoinRequestsPanel project={project} onClose={() => setPanel(null)} />
        )}
        {panel && panel !== 'requests' && (
          <GitHubPanel mode={panel} project={project} onClose={() => setPanel(null)} />
        )}
        <TeamPanel project={project} onOpenChat={setDmUser} />
      </div>
    </div>
  )
}
