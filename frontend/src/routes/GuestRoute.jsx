import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

const GuestRoute = ({children}) => {
    const {user, loading} = useAuth()

    if(loading){
        return <p className="dashboard-loading" role="status">Carregando...</p>
    }

    if(user){
        return <Navigate to="/dashboard" replace/>
    }
    return children

    
}

export default GuestRoute