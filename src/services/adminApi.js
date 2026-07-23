import { API_URL } from './leaktokApi'

const tokenKey = 'leaktok_admin_token'

export const getAdminToken = () => sessionStorage.getItem(tokenKey)
export const clearAdminToken = () => sessionStorage.removeItem(tokenKey)

async function adminRequest(path, options = {}) {
  const token = getAdminToken()
  const response = await fetch(`${API_URL}/admin${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    const error = new Error(payload.message || 'Admin request failed.')
    error.status = response.status
    if (response.status === 401) clearAdminToken()
    throw error
  }
  return payload.data
}

export async function adminLogin(username, password) {
  const data = await adminRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  sessionStorage.setItem(tokenKey, data.token)
  return data.admin
}

export async function adminLogout() {
  try { await adminRequest('/logout', { method: 'POST' }) } finally { clearAdminToken() }
}

export const getAdmin = () => adminRequest('/me')
export const getDashboard = () => adminRequest('/dashboard')
export const getAdminVideos = () => adminRequest('/videos')
export const createAdminVideo = (video) => adminRequest('/videos', { method: 'POST', body: JSON.stringify(video) })
export const updateAdminVideo = (id, video) => adminRequest(`/videos/${id}`, { method: 'PUT', body: JSON.stringify(video) })
export const deleteAdminVideo = (id) => adminRequest(`/videos/${id}`, { method: 'DELETE' })
