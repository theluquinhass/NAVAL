import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import api from "../../services/api"
import Services from './Services.jsx'

export default function Dashboard() {
    const { signOut, loading } = useAuth()
    const [profile, setProfile] = useState(null)

    useEffect(() => {
        api.get('/profile')
            .then(response => {
                setProfile(response.data)
            })
            .catch(error => {
                console.log(error.response?.data || error.message)
            })
    }, [])


    if (loading) {
        return <p>Carregando...</p>
    }

    return (
        <main>
            {profile && (
                <>
                    <h1>Ola, {profile.profile?.name || 'Barbeiro'}!</h1>
                    <p>Slug: {profile.profile?.slug || 'Perfil nao cadastrado'}</p>
                </>
            )}
            <Services />
            <button onClick={signOut}>Sair</button>
        </main>
    )
}
