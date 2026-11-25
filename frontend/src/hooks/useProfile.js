import { useContext } from 'react'
import { ProfileContext } from '../contexts/profileContext.js'

export function useProfile() {
    return useContext(ProfileContext)?.profile ?? null
}

export function useSetProfile() {
    return useContext(ProfileContext)?.setProfile
}
