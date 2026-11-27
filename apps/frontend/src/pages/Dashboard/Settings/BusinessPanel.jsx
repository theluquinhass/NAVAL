import { useState } from 'react'
import { useProfile, useRefreshProfile, useSetProfile } from '../../../hooks/useProfile.js'
import { updateProfile } from '../../../services/profileApi.js'
import { getErrorMessage } from '../../../utils/dashboard.js'
import { normalizeSlug } from '../../../utils/slug.js'
import Feedback from './SettingsFeedback.jsx'

function profileToForm(profile) {
    return {
        barberName: profile?.barberName ?? profile?.name ?? '',
        name: profile?.name ?? '',
        phone: profile?.phone ?? '',
        slug: profile?.slug ?? '',
        sellsProducts: Boolean(profile?.sellsProducts)
    }
}

export default function BusinessPanel({ activeTab }) {
    const profile = useProfile()
    const setProfile = useSetProfile()
    const refreshProfile = useRefreshProfile()
    const [form, setForm] = useState(() => profileToForm(profile))
    const [saving, setSaving] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [copyFeedback, setCopyFeedback] = useState('')

    const slug = normalizeSlug(form.slug)
    const publicUrl = `${window.location.origin}/book/${slug}`

    function updateField(field, value) {
        setFeedback(null)
        setCopyFeedback('')
        setForm((current) => {
            if (field === 'name' && normalizeSlug(current.slug) === normalizeSlug(current.name)) {
                return { ...current, name: value, slug: normalizeSlug(value) }
            }
            return { ...current, [field]: value }
        })
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setFeedback(null)
        setCopyFeedback('')

        if (!slug) {
            setFeedback({ type: 'error', text: 'Informe um endereço de perfil válido.' })
            return
        }

        setSaving(true)
        try {
            const updated = await updateProfile({
                barberName: form.barberName.trim(),
                name: form.name.trim(),
                phone: form.phone.trim(),
                slug,
                sellsProducts: form.sellsProducts
            })
            setForm(profileToForm(updated))
            setProfile?.(updated)
            if (refreshProfile) {
                await refreshProfile().catch(() => {})
            }
            setFeedback({
                type: 'success',
                text: form.sellsProducts
                    ? 'Dados atualizados. As ferramentas de produtos estão visíveis no menu.'
                    : 'Dados atualizados. As ferramentas de produtos foram ocultadas do menu.'
            })
        } catch (error) {
            setFeedback({ type: 'error', text: getErrorMessage(error, 'Não foi possível salvar os dados do negócio.') })
        } finally {
            setSaving(false)
        }
    }

    async function handleCopy() {
        if (!slug) return
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Área de transferência indisponível')
            await navigator.clipboard.writeText(publicUrl)
            setCopyFeedback('Link copiado.')
        } catch {
            setCopyFeedback('Não foi possível copiar. Selecione o link e copie manualmente.')
        }
    }

    return (
        <section className="dashboard-management__panel settings__panel" role="tabpanel" id="settings-panel-business" aria-labelledby="settings-tab-business" hidden={activeTab !== 'business'}>
            <div className="dashboard-management__panel-heading">
                <h2>Dados do negócio</h2>
                <p>Essas informações aparecem na sua página pública de agendamentos.</p>
            </div>

            <Feedback value={feedback} />

            <form className="settings__form" onSubmit={handleSubmit}>
                <label htmlFor="business-barber-name">
                    Nome do barbeiro
                    <input
                        id="business-barber-name"
                        type="text"
                        value={form.barberName}
                        maxLength={120}
                        autoComplete="name"
                        required
                        onChange={(event) => updateField('barberName', event.target.value)}
                    />
                </label>

                <label htmlFor="business-name">
                    Nome da barbearia
                    <input
                        id="business-name"
                        type="text"
                        value={form.name}
                        maxLength={120}
                        autoComplete="organization"
                        required
                        onChange={(event) => updateField('name', event.target.value)}
                    />
                </label>

                <label htmlFor="business-phone">
                    Telefone
                    <input
                        id="business-phone"
                        type="tel"
                        value={form.phone}
                        maxLength={40}
                        autoComplete="tel"
                        required
                        onChange={(event) => updateField('phone', event.target.value)}
                    />
                </label>

                <label htmlFor="business-slug">
                    Endereço do perfil
                    <input
                        id="business-slug"
                        type="text"
                        value={form.slug}
                        maxLength={80}
                        required
                        onChange={(event) => updateField('slug', event.target.value)}
                        onBlur={() => setForm((current) => ({ ...current, slug: normalizeSlug(current.slug) }))}
                    />
                </label>

                <label className="settings__choice" htmlFor="business-sells-products">
                    <input
                        id="business-sells-products"
                        type="checkbox"
                        checked={form.sellsProducts}
                        onChange={(event) => updateField('sellsProducts', event.target.checked)}
                    />
                    <span className="settings__choice-copy">
                        <strong>Vendo produtos na barbearia</strong>
                        <small>Exibe estoque, movimentações e financeiro de produtos no menu. Ao desativar, os atalhos desaparecem, mas o histórico é preservado.</small>
                    </span>
                </label>

                <div className="settings__public-link">
                    <span>Link público</span>
                    <code>{slug ? publicUrl : 'Preencha o endereço do perfil para gerar o link.'}</code>
                    <button
                        className="dashboard-management__secondary"
                        type="button"
                        disabled={!slug}
                        onClick={handleCopy}
                    >
                        Copiar link
                    </button>
                    {copyFeedback && <small role="status">{copyFeedback}</small>}
                </div>

                <div className="dashboard-management__actions">
                    <button className="dashboard-management__primary" type="submit" disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar dados'}
                    </button>
                </div>
            </form>
        </section>
    )
}
