import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Login() {
    
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        try {
            const { data , error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                console.error(error.message)
                return
            }

            console.log('Login realizado!', data)

            
        } catch (exception) {
            console.error('Erro inesparado:', exception)
        }
    }

    return (
        <main>
            <h1>Login</h1>
            <form onSubmit={handleSubmit}>

                <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="Email"
                />

                <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="Senha"
                />

                <button type="submit">
                    Conectar
                </button>

            </form>
        </main>
    )
}