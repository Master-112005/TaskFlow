import React, { createContext, useContext, useEffect, useState } from 'react'
import api from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tf_user')) || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(!!localStorage.getItem('tf_token'))

  useEffect(() => {
    const token = localStorage.getItem('tf_token')
    if (!token) {
      setLoading(false)
      return
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        // only treat a real 401 as signed-out; keep the session on transient errors
        if (err?.response?.status === 401) {
          // remove the dead token too, so the bounce does not repeat on every reload
          localStorage.removeItem('tf_token')
          localStorage.removeItem('tf_user')
          setUser(null)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  function signIn(data) {
    localStorage.setItem('tf_token', data.token)
    localStorage.setItem('tf_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  async function refresh() {
    const { data } = await api.get('/auth/me')
    localStorage.setItem('tf_user', JSON.stringify(data))
    setUser(data)
    return data
  }

  function signOut() {
    localStorage.removeItem('tf_token')
    localStorage.removeItem('tf_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
