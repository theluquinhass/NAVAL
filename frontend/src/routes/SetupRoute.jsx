import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import api from '../services/api.js'

export default function SetupRoute({ children }) {
    const [profileExists, setProfileExists] = useState(null)
    const [error, setError] = useState(false)

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
    }, [])

    if (error) return <p>Erro de conexão!</p>
    if (profileExists === null) return <p>Carregando...</p>
    if (profileExists) return <Navigate to="/dashboard" replace />

    return children
}
