import React, { useEffect, useRef, useState } from 'react'
import api, { formatWhen, ROLE_LABELS, STATUS_LABELS, errorMessage } from '../api'
import { useAuth } from '../AuthContext'
import { UserAvatar, initialsOf } from './Avatar'

const MENTION_REGEX = /@([A-Za-z0-9_.-]+)|#([0-9]+)/g
const TRIGGER_REGEX = /(^|\s)([@#])([A-Za-z0-9_]*)$/
const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, '')

export default function Chat({ projectId, dmUser, onDmUser }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [members, setMembers] = useState([])

  // @mention / #issue click popup
  const [popup, setPopup] = useState(null)
  // WhatsApp-style autocomplete while typing
  const [suggest, setSuggest] = useState(null) // { type: 'mention'|'issue', query }
  const [activeIdx, setActiveIdx] = useState(0)
  const [issueList, setIssueList] = useState(null) // cached list for the # picker

  const bottomRef = useRef(null)
  const lastIdRef = useRef(0)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  // team members (for @mention popups)
  useEffect(() => {
    api.get(`/projects/${projectId}/members`)
      .then((res) => setMembers(res.data))
      .catch(() => {})
  }, [projectId])

  // load issues once when the # picker is first opened
  useEffect(() => {
    if (suggest?.type === 'issue' && issueList === null) {
      api.get(`/projects/${projectId}/issues`)
        .then((res) => setIssueList(res.data))
        .catch(() => setIssueList([]))
    }
  }, [suggest?.type, projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // message polling (project chat or DM depending on dmUser)
  useEffect(() => {
    let stop = false
    lastIdRef.current = 0
    setMessages([])

    async function poll() {
      try {
        const params = {}
        if (lastIdRef.current) params.after = lastIdRef.current
        if (dmUser) params.withUser = dmUser.id
        const { data } = await api.get(`/projects/${projectId}/messages`, { params })
        if (stop || !Array.isArray(data)) return
        if (data.length) {
          lastIdRef.current = data[data.length - 1].id
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id))
            return [...prev, ...data.filter((m) => !seen.has(m.id))]
          })
        }
        setError('')
      } catch (e) {
        if (!stop) setError(errorMessage(e))
      }
    }

    poll()
    const timer = setInterval(poll, 3000)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [projectId, dmUser?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ---------- autocomplete options ----------
  const mentionOptions = suggest?.type === 'mention'
    ? members.filter((m) => {
        const q = (suggest.query || '').toLowerCase()
        return !q || norm(m.name).startsWith(q) || m.name.toLowerCase().split(' ')[0].startsWith(q)
      })
    : []

  const issueOptions = suggest?.type === 'issue' && issueList
    ? issueList.filter((i) => {
        const q = (suggest.query || '').toLowerCase()
        return !q || String(i.number).startsWith(q) || i.title.toLowerCase().includes(q)
      })
    : null

  function handleInputChange(e) {
    const val = e.target.value
    setText(val)
    const m = TRIGGER_REGEX.exec(val)
    if (m) {
      setActiveIdx(0)
      setSuggest({ type: m[2] === '@' ? 'mention' : 'issue', query: m[3] })
    } else {
      setSuggest(null)
    }
  }

  function applySuggestion(replacement) {
    const m = TRIGGER_REGEX.exec(text)
    if (!m) {
      setSuggest(null)
      return
    }
    const before = text.slice(0, m.index + m[1].length)
    setText(before + replacement + ' ')
    setSuggest(null)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (!suggest) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest(null)
      return
    }
    const options = suggest.type === 'mention' ? mentionOptions : (issueOptions || [])
    if (!options || options.length === 0) return
    const idx = Math.min(activeIdx, options.length - 1)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(Math.min(idx + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(Math.max(idx - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[idx]
      if (suggest.type === 'mention') applySuggestion('@' + opt.name.split(' ')[0])
      else applySuggestion('#' + opt.number)
    }
  }

  // ---------- click popups ----------
  function placePopup(e, extra) {
    const rect = chatRef.current?.getBoundingClientRect()
    const x = rect ? Math.min(e.clientX - rect.left, rect.width - 300) : 40
    const y = rect ? Math.min(e.clientY - rect.top + 10, rect.height - 230) : 40
    setPopup({ x: Math.max(8, x), y: Math.max(8, y), ...extra })
  }

  function openMention(name, e) {
    const token = norm(name)
    const member =
      members.find((m) => norm(m.name) === token) || // exact (ignoring spaces/case)
      members.find((m) => norm(m.name).startsWith(token)) || // prefix
      members.find((m) => norm(m.name.split(' ')[0]) === token) || // first name
      null
    placePopup(e, { type: 'mention', member, name })
  }

  function openIssue(number, e) {
    placePopup(e, { type: 'issue', loading: true, number })
    api.get(`/projects/${projectId}/issues/${number}`)
      .then((res) => setPopup((p) => (p && p.number === Number(number) ? { ...p, loading: false, issue: res.data } : p)))
      .catch((err) => setPopup((p) => (p && p.number === Number(number) ? { ...p, loading: false, error: errorMessage(err) } : p)))
  }

  // ---------- rendering with @ / # links ----------
  function renderContent(content) {
    const nodes = []
    let last = 0
    let key = 0
    for (const m of content.matchAll(MENTION_REGEX)) {
      if (m.index > last) nodes.push(<span key={key++}>{content.slice(last, m.index)}</span>)
      if (m[1] !== undefined) {
        nodes.push(
          <span key={key++} className="mention" onClick={(e) => openMention(m[1], e)}>
            @{m[1]}
          </span>
        )
      } else {
        nodes.push(
          <span key={key++} className="issue-ref" onClick={(e) => openIssue(m[2], e)}>
            #{m[2]}
          </span>
        )
      }
      last = m.index + m[0].length
    }
    if (last < content.length) nodes.push(<span key={key++}>{content.slice(last)}</span>)
    return nodes
  }

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const { data } = await api.post(`/projects/${projectId}/messages`, {
        content,
        recipientId: dmUser ? dmUser.id : undefined
      })
      lastIdRef.current = Math.max(lastIdRef.current, data.id)
      setMessages((prev) => [...prev, data])
      setText('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  const initials = initialsOf

  return (
    <div className="chat" ref={chatRef}>
      {dmUser && (
        <div className="dm-bar">
          <button className="btn ghost" onClick={() => onDmUser(null)}>Project chat</button>
          <span className="dm-title">
            Private chat with <strong>{dmUser.name}</strong>
            <span className="badge badge-role">{ROLE_LABELS[dmUser.role] || dmUser.role}</span>
            {dmUser.status && <span className="badge badge-status">{STATUS_LABELS[dmUser.status] || dmUser.status}</span>}
          </span>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            {dmUser ? `No messages yet — say hi to ${dmUser.name}` : 'No messages yet — say hi to your team'}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.senderId === user.id ? 'mine' : ''}`}>
            <div className="msg-meta">
              <UserAvatar name={m.senderName} avatar={m.senderAvatar} className="xs" />
              <span className="msg-author">{m.senderName}</span>
              <span className="badge badge-role">{ROLE_LABELS[m.senderRole] || m.senderRole}</span>
              {m.senderStatus && (
                <span className="badge badge-status">{STATUS_LABELS[m.senderStatus] || m.senderStatus}</span>
              )}
              <span className="msg-time">{formatWhen(m.createdAt)}</span>
            </div>
            <div className="msg-bubble">{renderContent(m.content)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {popup && (
        <>
          <div className="popup-backdrop" onClick={() => setPopup(null)} />
          <div className="chat-popup" style={{ left: popup.x, top: popup.y }}>
            {popup.type === 'mention' && (popup.member ? (
              <>
                <div className="mention-card">
                  <UserAvatar name={popup.member.name} avatar={popup.member.avatar} className="big" />
                  <div>
                    <div className="popup-name">
                      {popup.member.name}
                      {popup.member.status && (
                        <span className="badge badge-status">{STATUS_LABELS[popup.member.status] || popup.member.status}</span>
                      )}
                    </div>
                    <div className="popup-email">{popup.member.email}</div>
                    <span className="badge badge-role">{ROLE_LABELS[popup.member.role] || popup.member.role}</span>
                  </div>
                </div>
                {popup.member.id !== user.id && (
                  <button
                    className="btn primary full"
                    onClick={() => { onDmUser(popup.member); setPopup(null) }}
                  >
                    Chat with {popup.member.name.split(' ')[0]}
                  </button>
                )}
              </>
            ) : (
              <div className="panel-empty">No team member named @{popup.name} in this project.</div>
            ))}

            {popup.type === 'issue' && (
              popup.loading ? (
                <div className="panel-loading">Loading #{popup.number}…</div>
              ) : popup.error ? (
                <div className="panel-empty">{popup.error}</div>
              ) : (
                <>
                  <div className="popup-card-top">
                    <span className={`state-badge ${popup.issue.state === 'open' ? 'state-open' : 'state-closed'}`}>
                      {popup.issue.state}
                    </span>
                    <span className="panel-number">#{popup.number}</span>
                  </div>
                  <div className="popup-name">{popup.issue.title}</div>
                  <div className="issue-desc">
                    {popup.issue.body ? popup.issue.body.slice(0, 400) : 'No description provided.'}
                  </div>
                  <a className="issue-link" href={popup.issue.htmlUrl} target="_blank" rel="noreferrer">
                    View on GitHub
                  </a>
                </>
              )
            )}
          </div>
        </>
      )}

      {error && <div className="chat-error">{error}</div>}

      {suggest && (
        <div className="mention-menu">
          {suggest.type === 'mention' ? (
            mentionOptions.length ? mentionOptions.map((m, i) => (
              <button
                type="button"
                key={m.id}
                className={`mention-item ${Math.min(activeIdx, mentionOptions.length - 1) === i ? 'active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => applySuggestion('@' + m.name.split(' ')[0])}
              >
                <UserAvatar name={m.name} avatar={m.avatar} className="sm" />
                <span className="mi-name">{m.name}</span>
                <span className="badge badge-role">{ROLE_LABELS[m.role] || m.role}</span>
                {m.status && <span className="badge badge-status">{STATUS_LABELS[m.status] || m.status}</span>}
              </button>
            )) : <div className="menu-empty">No team members found</div>
          ) : (
            issueList === null ? <div className="menu-empty">Loading issues…</div>
            : issueOptions && issueOptions.length ? issueOptions.map((it, i) => (
              <button
                type="button"
                key={it.number}
                className={`mention-item ${Math.min(activeIdx, issueOptions.length - 1) === i ? 'active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => applySuggestion('#' + it.number)}
              >
                <span className="mi-number">#{it.number}</span>
                <span className="mi-name">{it.title}</span>
                <span className={`state-badge ${it.state === 'open' ? 'state-open' : 'state-closed'}`}>{it.state}</span>
              </button>
            )) : <div className="menu-empty">No issues found</div>
          )}
        </div>
      )}

      <form className="chat-input" onSubmit={send}>
        <input
          ref={inputRef}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={dmUser ? `Message ${dmUser.name}…` : 'Message your team… (type @ for teammates, # for issues)'}
          maxLength={2000}
        />
        <button type="submit" disabled={!text.trim() || sending}>
          Send
        </button>
      </form>
    </div>
  )
}
