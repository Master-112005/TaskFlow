import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url || ''
    // A wrong password on login/register is NOT a session logout: never wipe
    // storage or redirect because of it.
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register')
    // ONLY the explicit session check (/auth/me) proves the session is dead.
    // Every other endpoint answers 401/400 with a readable message for its own
    // reasons (e.g. an expired GitHub token) — those must stay inline errors
    // instead of throwing the user out of the app.
    const isSessionCheck = url.includes('/auth/me')
    if (status === 401 && !isAuthAttempt && isSessionCheck) {
      localStorage.removeItem('tf_token')
      localStorage.removeItem('tf_user')
      const path = window.location.pathname
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        // replace() keeps the dead page out of the browser history,
        // so Back cannot return to the signed-out app.
        window.location.replace('/login')
      }
    }
    return Promise.reject(err)
  }
)

export function errorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong'
}

export function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const ROLE_LABELS = {
  FRONTEND_DEVELOPER: 'Frontend Developer',
  BACKEND_DEVELOPER: 'Backend Developer',
  TESTER: 'Tester',
  DEV_TEAM: 'Dev Team',
  TEAM_LEAD: 'Team Lead',
  ADMIN: 'Admin',
  MANAGER: 'Manager'
}

// availability statuses shown under the avatar picker
export const STATUS_LABELS = {
  BUSY: 'Busy',
  AVAILABLE: 'Available',
  LEAVE: 'Leave',
  VACATION: 'Vacation'
}

export default api
