import { ProfileContext } from './profileContext.js'

export function ProfileProvider({ profile, children }) {
    return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}
