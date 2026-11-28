import { useState } from 'react'
import { useProfile, useRefreshProfile, useSetProfile } from '../../../hooks/useProfile.js'
import { updateProfile } from '../../../services/profileApi.js'
import { getErrorMessage } from '../../../utils/dashboard.js'
import { normalizeSlug } from '../../../utils/slug.js'
import Feedback from './SettingsFeedback.jsx'
import ShareBookingLink from '../../../components/ShareBookingLink.jsx'

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

    const slug = normalizeSlug(form.slug)
    const publicUrl = `${window.location.origin}/book/${slug}`

    function updateField(field, value) {
        setFeedback(null)
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


    return (
        <section className="dashboard-management__panel settings__panel" role="tabpanel" id="settings-panel-business" aria-labelledby="settings-tab-business" hidden={activeTab !== 'business'}>
            <ShareBookingLink slug={profile?.slug} barbershopName={profile?.name} />

            <div className="dashboard-management__panel-heading settings__business-heading">
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
                    Endereço da sua página
                    <input
                        id="business-slug"
                        type="text"
                        value={form.slug}
                        maxLength={80}
                        aria-describedby="business-slug-preview"
                        autoCapitalize="none"
                        required
                        onChange={(event) => updateField('slug', event.target.value)}
                        onBlur={() => setForm((current) => ({ ...current, slug: normalizeSlug(current.slug) }))}
                    />
                    <small id="business-slug-preview" className="settings__slug-preview">
                        {slug ? <>Seu link: <code>{publicUrl}</code>{slug !== profile?.slug && ' (salve para aplicar)'}</> : 'Preencha o endereço para gerar o link.'}
                    </small>
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

                <div className="dashboard-management__actions">
                    <button className="dashboard-management__primary" type="submit" disabled={saving}>
                        {saving ? 'Salvando...' : 'Salvar dados'}
                    </button>
                </div>
            </form>
        </section>
    )
}
