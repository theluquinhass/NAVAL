const SHARED_FLAG_PREFIX = 'naval-link-shared:'

// True once the owner copied or sent the public booking link from this browser.
export function hasSharedBookingLink(slug) {
    if (!slug) return false
    try {
        return window.localStorage.getItem(`${SHARED_FLAG_PREFIX}${slug}`) === '1'
    } catch {
        return false
    }
}

export function markBookingLinkShared(slug) {
    try {
        window.localStorage.setItem(`${SHARED_FLAG_PREFIX}${slug}`, '1')
    } catch {
        // Storage may be unavailable; sharing still works.
    }
}
