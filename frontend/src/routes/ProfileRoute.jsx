import { useEffect, useState } from "react";
import api from '../services/api.js'
import { Navigate } from "react-router-dom";

const ProfileRoute = ({ children }) => {
    const [profile, setProfile] = useState(null)
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileError, setProfileError] = useState(false)

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/profile')
                setProfile(response.data.profile)
            } catch (error) {
                console.error('Erro ao buscar perfil:', error)
                setProfileError(true)
            } finally {
                setProfileLoading(false)
            }
        }

        fetchProfile()
    }, [])

    if(profileLoading){
        return <p>Carregando...</p>
    }
    
    if(profileError){
        return <p>Error de Conexao!</p>
    }

    if (!profile) {
        return <Navigate to="/setup" replace />
    }

    return <>{children}</>

}
export default ProfileRoute