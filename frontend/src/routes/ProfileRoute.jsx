import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ProfileProvider } from "../contexts/ProfileProvider.jsx";
import api from '../services/api.js'
import { getErrorMessage } from '../utils/dashboard.js'

const ProfileRoute = ({ children }) => {
    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileError, setProfileError] = useState('')
    const [retryKey, setRetryKey] = useState(0)

    useEffect(() => {
        let active = true

        api.get('/profile')
            .then((response) => {
                if (active) setProfile(response.data.profile)
            })
            .catch((requestError) => {
                if (!active) return
                setProfile(null)
                setProfileError(getErrorMessage(requestError, 'Não foi possível carregar os dados da barbearia.'))
            })
            .finally(() => { if (active) setProfileLoading(false) })

        return () => { active = false }
    }, [retryKey])

    if (profileLoading) {
        return <p className="dashboard-loading" role="status">Carregando dados da barbearia...</p>
    }

    if (profileError) {
        return (
            <section className="dashboard-panel dashboard-error" role="alert">
                <p>Não foi possível carregar os dados da barbearia. {profileError}</p>
                <button
                    className="dashboard-retry"
                    type="button"
                    onClick={() => {
                        setProfileLoading(true)
                        setProfileError('')
                        setRetryKey((current) => current + 1)
                    }}
                >
                    Tentar novamente
                </button>
            </section>
        )
    }

    if (!profile) {
        return <Navigate to="/setup" replace />
    }

    return <ProfileProvider profile={profile}>{children}</ProfileProvider>
}

export default ProfileRoute
