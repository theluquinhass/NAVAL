import { useCallback, useMemo, useState } from 'react'
import api from '../services/api.js'
import { ProfileContext } from './profileContext.js'

export function ProfileProvider({ profile: initialProfile, children }) {
    const [profile, setProfileState] = useState(initialProfile)
    const [previousInitial, setPreviousInitial] = useState(initialProfile)

    // Keep the local state in sync when the provider receives a new profile.
    if (initialProfile !== previousInitial) {
        setPreviousInitial(initialProfile)
        setProfileState(initialProfile)
    }

    const setProfile = useCallback((next) => setProfileState(next), [])
    const refreshProfile = useCallback(async () => {
        const response = await api.get('/profile')
        const refreshed = response.data.profile
        setProfileState(refreshed)
        return refreshed
    }, [])

    const value = useMemo(
        () => ({ profile, setProfile, refreshProfile }),
        [profile, setProfile, refreshProfile]
    )

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
