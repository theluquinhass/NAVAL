import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext.js";
import { supabase } from "../lib/supabase";

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
        })

        setData()

        return () => {
            listener.subscription.unsubscribe()
        }
    }, [])

    const signOut = useCallback(() => supabase.auth.signOut(), [])

    const value = useMemo(() => ({
        session,
        user,
        loading,
        signOut,
    }), [session, user, loading, signOut])

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
