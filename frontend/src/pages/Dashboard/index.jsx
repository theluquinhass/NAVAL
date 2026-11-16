import { useAuth } from "../../contexts/AuthContext"

export default function Dashboard() {
    const { user, signOut, loading } = useAuth()

    if (loading) {
        return <p>Carregando...</p>
    }

    return (
        <main>
            <p>Ola, {user?.email}</p>
            <button onClick={signOut}>Sair</button>
        </main>
    )
}