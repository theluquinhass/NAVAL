import { Navigate } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile.js'

export default function ProductsRoute({ children }) {
    const profile = useProfile()

    if (!profile?.sellsProducts) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}
