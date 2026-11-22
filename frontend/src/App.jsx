import React, { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UserHomePage from './pages/UserHomePage'
import AdminHomePage from './pages/AdminHomePage'
import ProjectPage from './pages/ProjectPage'
import ProfilePage from './pages/ProfilePage'
import TeamPanelPage from './pages/TeamPanelPage'

function Protected({ children, type }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (type && user.userType !== type) {
    return <Navigate to={user.userType === 'ADMIN' ? '/admin' : '/home'} replace />
  }
  return children
}

/**
 * Safety net for the GitHub OAuth redirect: if GitHub drops the ?code&state
 * on any React route (e.g. wrong callback URL registered on the OAuth App),
 * forward it to the backend so the token exchange still happens instead of
 * dumping the user on /login.
 */
function OAuthRedirectGuard() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const hasOAuthPayload = params.get('code') && params.get('state')
  const isCallbackPath = location.pathname.startsWith('/api/github/oauth/callback')

  useEffect(() => {
    if (hasOAuthPayload) {
      // relative on purpose: works in dev (Vite proxy) and in production
      // (host proxy forwards /api/* to the backend) with zero config
      window.location.replace('/api/github/oauth/callback' + location.search)
    }
  }, [hasOAuthPayload, location.search])

  if (hasOAuthPayload || isCallbackPath) {
    return <div className="page-loading">Finishing GitHub connection…</div>
  }
  return null
}

export default function App() {
  return (
    <>
      <OAuthRedirectGuard />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/home" element={<Protected type="NORMAL"><UserHomePage /></Protected>} />
        <Route path="/admin" element={<Protected type="ADMIN"><AdminHomePage /></Protected>} />
        <Route path="/project/:id" element={<Protected><ProjectPage /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
        <Route path="/team" element={<Protected type="ADMIN"><TeamPanelPage /></Protected>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  )
}
