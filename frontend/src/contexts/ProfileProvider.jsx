import { useMemo, useState } from 'react'
import { ProfileContext } from './profileContext.js'

export function ProfileProvider({ profile: initialProfile, children }) {
    const [profile, setProfile] = useState(initialProfile)
    const value = useMemo(() => ({ profile, setProfile }), [profile])

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
