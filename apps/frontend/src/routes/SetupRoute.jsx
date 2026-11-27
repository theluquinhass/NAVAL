import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api.js'

export default function SetupRoute({ children }) {
    const [profileExists, setProfileExists] = useState(null)
    const [error, setError] = useState(false)
    const [retryKey, setRetryKey] = useState(0)

    useEffect(() => {
        let active = true

        api.get('/profile')
            .then((response) => {
                if (active) setProfileExists(Boolean(response.data.profile))
            })
            .catch((requestError) => {
                console.error('Erro ao buscar perfil:', requestError)
                if (active) setError(true)
            })

        return () => { active = false }
    }, [retryKey])

    if (error) {
        return (
            <section className="dashboard-panel dashboard-error" role="alert">
                <p>Erro de conexão ao verificar o cadastro da barbearia.</p>
                <button
                    className="dashboard-retry"
                    type="button"
                    onClick={() => {
                        setError(false)
                        setProfileExists(null)
                        setRetryKey((current) => current + 1)
                    }}
                >
                    Tentar novamente
                </button>
            </section>
        )
    }
    if (profileExists === null) return <p className="dashboard-loading" role="status">Carregando...</p>
    if (profileExists) return <Navigate to="/dashboard" replace />

    return children
}
