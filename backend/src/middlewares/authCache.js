import { createHash } from 'node:crypto'

const AUTH_CACHE_TTL_MS = 30_000
const MAX_ENTRIES = 500
const CLOCK_SKEW_MS = 1_000

const cache = new Map()

function tokenKey(token) {
    return createHash('sha256').update(token).digest('hex')
}

function tokenExpiryMs(token) {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
        return Number.isFinite(payload.exp) ? payload.exp * 1_000 : null
    } catch {
        return null
    }
}

export function getCachedUser(token) {
    const key = tokenKey(token)
    const entry = cache.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key)
        return null
    }
    return entry.user
}

export function cacheUser(token, user) {
    const key = tokenKey(token)
    const now = Date.now()
    const jwtExpiry = tokenExpiryMs(token)
    const expiresAt = Math.min(
        now + AUTH_CACHE_TTL_MS,
        jwtExpiry === null ? Number.POSITIVE_INFINITY : jwtExpiry - CLOCK_SKEW_MS
    )
    if (expiresAt <= now) return

    cache.delete(key)
    cache.set(key, { user: { id: user.id }, expiresAt })
    while (cache.size > MAX_ENTRIES) {
        cache.delete(cache.keys().next().value)
    }
}

export function getTokenExpiryMs(token) {
    return tokenExpiryMs(token)
}

export function clearAuthCache() {
    cache.clear()
}
