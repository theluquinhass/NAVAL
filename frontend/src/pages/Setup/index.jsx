import { useState } from 'react'
import api from '../../services/api.js'

export default function Register() {

    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [slug, setSlug] = useState('')
    const [message, setMessage] = useState('')

    return (
        <main>
            <h1>Configure Seu Perfil:</h1>
            <form >

                <input
                    type='text'
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    placeholder='Nome'
                />

                <input
                    type='tel'
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    placeholder='Email'
                />

                <input
                    type='text'
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    minLength={8}
                    placeholder='Senha'
                />

                <button type='submit'>
                    Salvar Perfil
                </button>

            </form>
        </main>
    )
}