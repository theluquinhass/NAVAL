import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api.js'

export default function Setup() {
    const navigate = useNavigate()

    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [slug, setSlug] = useState('')
    const [message, setMessage] = useState('')
    const [saving, setSaving] = useState(false)

    function generateSlug(name) {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setMessage('')
        setSaving(true)

        try {
            await api.post('/profile', {
                name: name.trim(),
                phone: phone.trim(),
                slug: generateSlug(slug || name)
            })
            navigate('/dashboard')
        } catch (error) {
            setMessage(error || 'Não foi possível salvar o perfil.')
        } finally {
            setSaving(false)
        }
    }


    return (
        <main>
            <h1>Configure Seu Perfil:</h1>
            {message && <p role='status'>{message}</p>}
            <form onSubmit={handleSubmit}>

                <input
                    type='text'
                    value={name}
                    onChange={(event) => {
                        const value = event.target.value
                        setName(value)
                        if (!slug || slug === generateSlug(name)) setSlug(generateSlug(value))
                    }}
                    required
                    placeholder='Nome da Barbearia'
                />

                <input
                    type='tel'
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    placeholder='Telefone'
                />

                <input
                    type='text'
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    required
                    placeholder='Endereço do perfil'
                />

                <button type='submit'>
                    {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>

            </form>
        </main>
    )
}
