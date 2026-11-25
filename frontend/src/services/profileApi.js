import api from './api.js'

export function updateProfile(payload) {
    return api.put('/profile', payload).then((response) => response.data.profile)
}
