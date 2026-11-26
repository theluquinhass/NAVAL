import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import { getErrorMessage } from '../../utils/dashboard.js'
import { buildProfilePayload } from '../../utils/profilePayload.js'
import { normalizeSlug } from '../../utils/slug.js'
import '../../styles/auth.css'

export default function Setup() {
    const navigate = useNavigate()

    const [barberName, setBarberName] = useState('')
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [slug, setSlug] = useState('')
    const [sellsProducts, setSellsProducts] = useState(null)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const slugPreview = normalizeSlug(slug || name)
    const publicUrl = `${window.location.origin}/book/${slugPreview || 'sua-barbearia'}`

    async function handleSubmit(event) {
        event.preventDefault()
        setError('')
        setSaving(true)

        try {
            await api.post('/profile', buildProfilePayload({ barberName, name, phone, slug, sellsProducts }))
            navigate('/dashboard')
        } catch (requestError) {
            setError(getErrorMessage(requestError, 'Não foi possível salvar o perfil. Tente novamente.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card auth-card--wide">
                <div className="auth-card__brand">
                    <span className="auth-card__mark" aria-hidden="true">N</span>
                    <span className="auth-card__eyebrow">NAVAL</span>
                </div>

                <h1>Configure sua barbearia</h1>
                <p className="auth-card__subtitle">Esses dados aparecem na página pública onde seus clientes vão agendar.</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <p className="auth-feedback auth-feedback--error" role="alert">{error}</p>}

                    <div className="auth-field">
                        <label htmlFor="setup-barber-name">Nome do barbeiro</label>
                        <input
                            id="setup-barber-name"
                            type="text"
                            value={barberName}
                            onChange={(event) => { setBarberName(event.target.value); setError('') }}
                            autoComplete="name"
                            placeholder="Ex.: Lucas Caetano"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="setup-name">Nome da barbearia</label>
                        <input
                            id="setup-name"
                            type="text"
                            value={name}
                            onChange={(event) => {
                                const value = event.target.value
                                setName(value)
                                if (!slug || slug === normalizeSlug(name)) setSlug(normalizeSlug(value))
                                setError('')
                            }}
                            autoComplete="organization"
                            placeholder="Ex.: Barbearia do Zé"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="setup-phone">Telefone</label>
                        <input
                            id="setup-phone"
                            type="tel"
                            value={phone}
                            onChange={(event) => { setPhone(event.target.value); setError('') }}
                            autoComplete="tel"
                            placeholder="(85) 99999-1234"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="setup-slug">Endereço do perfil</label>
                        <input
                            id="setup-slug"
                            type="text"
                            value={slug}
                            onChange={(event) => { setSlug(event.target.value); setError('') }}
                            onBlur={() => setSlug(normalizeSlug(slug))}
                            placeholder="barbearia-do-ze"
                            required
                        />
                    </div>

                    <div className="auth-preview">
                        <span>Link público da sua barbearia</span>
                        <code>{publicUrl}</code>
                    </div>

                    <fieldset className="auth-field auth-choice">
                        <legend>Você também vende produtos?</legend>
                        <p className="auth-choice__hint">Isso define quais ferramentas aparecem no seu dashboard. Você poderá mudar depois em Configurações.</p>
                        <div className="auth-choice__options">
                            <label className="auth-choice__option">
                                <input
                                    type="radio"
                                    name="sellsProducts"
                                    value="yes"
                                    checked={sellsProducts === true}
                                    onChange={() => { setSellsProducts(true); setError('') }}
                                    required
                                />
                                <span><strong>Sim</strong><small>Ativa estoque, movimentações e financeiro de produtos.</small></span>
                            </label>
                            <label className="auth-choice__option">
                                <input
                                    type="radio"
                                    name="sellsProducts"
                                    value="no"
                                    checked={sellsProducts === false}
                                    onChange={() => { setSellsProducts(false); setError('') }}
                                    required
                                />
                                <span><strong>Não</strong><small>Mostro apenas agendamentos, serviços e financeiro da barbearia.</small></span>
                            </label>
                        </div>
                    </fieldset>

                    <button className="auth-submit" type="submit" disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar perfil'}
                    </button>
                </form>

                <div className="auth-links">
                    <span>Você poderá editar esses dados depois em Configurações.</span>
                </div>
            </section>
        </main>
    )
}
