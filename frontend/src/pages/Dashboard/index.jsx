import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import api from "../../services/api"

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
            <p>Ola, {profile && <p>{ profile.user.email }</p>}</p>
            {profile && <p>{profile.message}</p>}
            <button onClick={signOut}>Sair</button>
        </main>
    )
}