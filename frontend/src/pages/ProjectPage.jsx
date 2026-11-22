import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api, { errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import ProfileMenu from '../components/ProfileMenu'
import Chat from '../components/Chat'
import ActionsPanel from '../components/ActionsPanel'
import GitHubPanel from '../components/GitHubPanel'
import JoinRequestsPanel from '../components/JoinRequestsPanel'
import RepoPicker from '../components/RepoPicker'
import TeamPanel from '../components/TeamPanel'

export default function ProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null) // null | 'issues' | 'pulls' | 'actions' | 'requests'
  // private chat partner (MemberDto) — shared by the chat area and the team panel
  const [dmUser, setDmUser] = useState(null)
  // lead flow: connect GitHub, then pick the repository for a repo-less project
  const [repoPickerOpen, setRepoPickerOpen] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [setupNote, setSetupNote] = useState('')

  // Normal users must have their own GitHub account connected BEFORE entering
  // a project (their issues/PRs are made under their account).
  useEffect(() => {
    if (user && user.userType === 'NORMAL' && !user.githubConnected) {
      navigate('/profile?connect=first', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    api.get(`/projects/${id}`)
      .then((res) => setProject(res.data))
      .catch((err) => setError(errorMessage(err)))
  }, [id])

  // Returning from the GitHub OAuth connect started from this page:
  // a repo-less project goes straight into the repository picker; a project
  // that already has a repo just reloads (the fresh token heals Issues/PRs).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('github')
    if (status === 'connected' || status === 'already') {
      // clean the URL without reloading
      window.history.replaceState({}, '', `/project/${id}`)
      api.get(`/projects/${id}`).then((res) => {
        setProject(res.data)
        if (status === 'connected' && !(res.data.repoOwner && res.data.repoName)) {
          setRepoPickerOpen(true)
        } else {
          setSetupNote(status === 'connected'
            ? `GitHub account connected — repository connection refreshed.`
            : `GitHub account is already connected to TaskFlow.`)
        }
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function connectGitHub() {
    setError('')
    setSetupNote('')
    try {
      const { data } = await api.get('/github/connect-url', { params: { returnTo: `/project/${id}` } })
      window.location.href = data.url
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function attachRepo(owner, name, accountId) {
    setAttachBusy(true)
    setSetupNote('')
    try {
      const { data } = await api.post(`/projects/${id}/repo`, {
        repoOwner: owner,
        repoName: name,
        accountId: accountId || undefined
      })
      setProject(data)
      setRepoPickerOpen(false)
      setSetupNote(`Repository ${data.repoOwner}/${data.repoName} connected — Issues, Pull Requests and Actions are now available.`)
    } catch (err) {
      throw err // RepoPicker shows the error inline
    } finally {
      setAttachBusy(false)
    }
  }

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
  const hasRepo = Boolean(project.repoOwner && project.repoName)

  return (
    <div className="project-page">
      <header className="top-bar">
        <div className="top-left">
          <button className="back-circle" onClick={() => navigate(-1)} title="Go back">&lt;</button>
          <div className="project-heading">
            <strong>{project.name}</strong>
            <small>{hasRepo ? `${project.repoOwner}/${project.repoName}` : 'No repository connected yet'}</small>
          </div>
          {isAdmin && (
            <>
              <span className="code-pill" title="Invite code">{project.inviteCode}</span>
              <button
                className="btn ghost pill small"
                title="Change invite code"
                onClick={() => {
                  const newCode = prompt("Enter new 6-character invite code:");
                  if (newCode && /^[A-Z2-9]{6}$/.test(newCode)) {
                    api.put(`/projects/${project.id}/invite-code`).then(() => {
                      setProject(prev => prev ? { ...prev, inviteCode: newCode } : null);
                      alert("Invite code updated successfully!");
                    }).catch(err => alert(errorMessage(err)));
                  } else if (newCode) {
                    alert("Invalid code format. Use 6 characters from: ABCDEFGHJKMNPQRSTUVWXYZ23456789");
                  }
                }}
              >
                Change
              </button>
              <button
                className="btn ghost pill small"
                title="Delete project"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this project? This will also remove all join requests and members.")) {
                    api.delete(`/projects/${project.id}`).then(() => {
                      alert("Project deleted successfully!");
                      navigate(-1);
                    }).catch(err => alert(errorMessage(err)));
                  }
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
        <div className="top-right">
          {hasRepo && (
            <>
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
              <button
                className={`btn pill ${panel === 'actions' ? 'active' : ''}`}
                onClick={() => setPanel(panel === 'actions' ? null : 'actions')}
              >
                Actions
              </button>
            </>
          )}
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

      {!hasRepo && (
        <div className="repo-setup-banner">
          {isAdmin ? (
            <>
              <span>
                This project has no GitHub repository yet. Connect your GitHub account, then pick
                the repository — after that Issues, Pull Requests, Actions and the invite-code flow work as usual.
              </span>
              <div className="repo-setup-actions">
                <button className="btn primary sm" onClick={connectGitHub}>Connect GitHub</button>
                <button className="btn sm" onClick={() => setRepoPickerOpen(true)}>
                  {project.githubToken ? 'Change repository' : 'Select repository'}
                </button>
              </div>
              {setupNote && <div className="github-note">{setupNote}</div>}
            </>
          ) : (
            <span>The team lead hasn't connected a GitHub repository for this project yet.</span>
          )}
        </div>
      )}

      <div className="project-body">
        <main className="chat-area">
          <Chat projectId={project.id} dmUser={dmUser} onDmUser={setDmUser} />
        </main>
        {panel === 'requests' && (
          <JoinRequestsPanel project={project} onClose={() => setPanel(null)} />
        )}
        {panel === 'actions' && hasRepo && (
          <ActionsPanel project={project} onClose={() => setPanel(null)} />
        )}
        {panel && panel !== 'requests' && panel !== 'actions' && hasRepo && (
          <GitHubPanel mode={panel} project={project} onClose={() => setPanel(null)} />
        )}
        <TeamPanel project={project} onOpenChat={setDmUser} />
      </div>

      {repoPickerOpen && (
        <RepoPicker
          onClose={() => setRepoPickerOpen(false)}
          onPick={attachRepo}
        />
      )}
    </div>
  )
}
