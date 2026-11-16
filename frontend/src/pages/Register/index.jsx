import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { use } from 'react'

export default function Register() {

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name
                    }
                }
            })
            if (error) {
                console.error(error.message)
                return
            }
            setMessage('Cadastro realizado!! Verifique seu e-mail para confirmar sua conta.')
        } catch (exception) {
            console.error('Erro inesperado:', exception)
        }
    }

    return (
        <main>
            <h1>Criar conta no NAVAL</h1>
            {message && <p>{message}</p>}
            <form onSubmit={handleSubmit}>

                <input
                    type='text'
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder='Nome'
                />

                <input
                    type='email'
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder='Email'
                />

                <input
                    type='password'
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    placeholder='Senha'
                />

                <button type='submit'>
                    Criar Conta
                </button>

            </form>
        </main>
    )
}