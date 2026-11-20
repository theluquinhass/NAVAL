import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const setData = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) throw error
                setSession(session)
                setUser(session?.user ?? null)
                console.log(session)
            } catch (error) {
                console.error("Erro ao buscar sessao", error.message)
                setSession(null)
                setUser(null)
            } finally {
                setLoading(false)
            }
        }


        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)
        })

        setData()

        return () => {
            listener.subscription.unsubscribe()
        }
    }, [])

    const value = {
        session,
        user,
        loading,
        signOut: () => supabase.auth.signOut(),
    }


    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext)
}