const STORAGE_KEY = 'polo_api_origin'

function readQueryApi() {
    if (typeof window === 'undefined') return ''
    try {
        const q = new URLSearchParams(window.location.search).get('api')
        return q ? q.trim().replace(/\/$/, '') : ''
    } catch {
        return ''
    }
}

function isHttpsOrigin(value) {
    try {
        const u = new URL(value)
        return u.protocol === 'https:' && !!u.host
    } catch {
        return false
    }
}

function resolveApiOrigin() {
    const fromEnv = String(import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
    if (typeof window === 'undefined') return fromEnv || 'http://localhost:8080'

    const localDev = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    if (localDev) return fromEnv || 'http://localhost:8080'

    const fromQuery = readQueryApi()
    if (isHttpsOrigin(fromQuery)) {
        localStorage.setItem(STORAGE_KEY, fromQuery)
        return fromQuery
    }
    const saved = String(localStorage.getItem(STORAGE_KEY) || '').replace(/\/$/, '')
    if (isHttpsOrigin(saved)) return saved
    return fromEnv || 'http://localhost:8080'
}

export const API_ORIGIN = resolveApiOrigin()
export const STORE_ONLY = import.meta.env.VITE_STORE_ONLY === 'true'
