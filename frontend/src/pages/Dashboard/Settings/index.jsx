import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth.js'
import { useProfile, useRefreshProfile, useSetProfile } from '../../../hooks/useProfile.js'
import { useTheme } from '../../../contexts/ThemeContext.jsx'
import { supabase } from '../../../lib/supabase.js'
import { updateProfile } from '../../../services/profileApi.js'
import { getErrorMessage } from '../../../utils/dashboard.js'
import { normalizeSlug } from '../../../utils/slug.js'
import '../management.css'
import './settings.css'

const TABS = [
    { id: 'business', label: 'Meu negócio', path: '/dashboard/business' },
    { id: 'account', label: 'Conta e segurança', path: '/dashboard/settings' },
    { id: 'preferences', label: 'Preferências', path: '/dashboard/settings?tab=preferences' }
]

function profileToForm(profile) {
    return {
        barberName: profile?.barberName ?? profile?.name ?? '',
        name: profile?.name ?? '',
        phone: profile?.phone ?? '',
        slug: profile?.slug ?? '',
        sellsProducts: Boolean(profile?.sellsProducts)
    }
}

function Feedback({ value }) {
    if (!value) return null
    return (
        <p className={`settings__feedback${value.type === 'error' ? ' settings__feedback--error' : ''}`} role={value.type === 'error' ? 'alert' : 'status'}>
            {value.text}
        </p>
    )
}

function BusinessPanel({ activeTab }) {
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

function AccountPanel({ activeTab }) {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const [feedback, setFeedback] = useState(null)
    const [sending, setSending] = useState(false)
    const [signingOut, setSigningOut] = useState(false)

    async function handleReset() {
        if (!user?.email) return
        setFeedback(null)
        setSending(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/login`
            })
            if (error) throw error
            setFeedback({ type: 'success', text: 'Enviamos um link de redefinição para o e-mail da conta.' })
        } catch (error) {
            setFeedback({ type: 'error', text: getErrorMessage(error, 'Não foi possível enviar o link de redefinição.') })
        } finally {
            setSending(false)
        }
    }

    async function handleSignOut() {
        setFeedback(null)
        setSigningOut(true)
        try {
            const { error } = await signOut()
            if (error) throw error
            navigate('/login', { replace: true })
        } catch (error) {
            setFeedback({ type: 'error', text: getErrorMessage(error, 'Não foi possível encerrar a sessão.') })
            setSigningOut(false)
        }
    }

    return (
        <section className="dashboard-management__panel settings__panel" role="tabpanel" id="settings-panel-account" aria-labelledby="settings-tab-account" hidden={activeTab !== 'account'}>
            <div className="dashboard-management__panel-heading">
                <h2>Conta e segurança</h2>
                <p>Gerencie o acesso à sua conta NAVAL.</p>
            </div>

            <Feedback value={feedback} />

            <div className="settings__account-email">
                <span>E-mail da conta</span>
                <strong>{user?.email || 'Não disponível'}</strong>
            </div>

            <div className="dashboard-management__actions">
                <button
                    className="dashboard-management__secondary"
                    type="button"
                    disabled={!user?.email || sending}
                    onClick={handleReset}
                >
                    {sending ? 'Enviando...' : 'Redefinir senha por e-mail'}
                </button>
                <button
                    className="dashboard-management__danger"
                    type="button"
                    disabled={signingOut}
                    onClick={handleSignOut}
                >
                    {signingOut ? 'Saindo...' : 'Sair da conta'}
                </button>
            </div>
        </section>
    )
}

function PreferencesPanel({ activeTab }) {
    const { preference, setThemePreference } = useTheme()

    return (
        <section className="dashboard-management__panel settings__panel" role="tabpanel" id="settings-panel-preferences" aria-labelledby="settings-tab-preferences" hidden={activeTab !== 'preferences'}>
            <div className="dashboard-management__panel-heading">
                <h2>Preferências</h2>
                <p>A aparência segue a preferência escolhida aqui e no cabeçalho.</p>
            </div>

            <div className="settings__form">
                <label htmlFor="settings-theme">
                    Tema
                    <select
                        id="settings-theme"
                        value={preference}
                        onChange={(event) => setThemePreference(event.target.value)}
                    >
                        <option value="system">Seguir o sistema</option>
                        <option value="light">Claro</option>
                        <option value="dark">Escuro</option>
                    </select>
                </label>

                <dl className="settings__fixed-info">
                    <div>
                        <dt>Fuso horário</dt>
                        <dd>America/Fortaleza (UTC-3)</dd>
                    </div>
                    <div>
                        <dt>Moeda</dt>
                        <dd>BRL (Real brasileiro)</dd>
                    </div>
                    <div>
                        <dt>Formato de hora</dt>
                        <dd>24 horas</dd>
                    </div>
                </dl>
            </div>
        </section>
    )
}

export default function Settings() {
    const location = useLocation()
    const navigate = useNavigate()
    const tabRefs = useRef({})

    const activeTab = location.pathname === '/dashboard/business'
        ? 'business'
        : new URLSearchParams(location.search).get('tab') === 'preferences'
            ? 'preferences'
            : 'account'

    function selectTab(tabId) {
        navigate(TABS.find((tab) => tab.id === tabId)?.path || '/dashboard/settings', { replace: true })
    }

    function handleTabKeyDown(event, index) {
        const keys = {
            ArrowRight: (index + 1) % TABS.length,
            ArrowLeft: (index - 1 + TABS.length) % TABS.length,
            Home: 0,
            End: TABS.length - 1
        }
        const nextIndex = keys[event.key]
        if (nextIndex === undefined) return

        event.preventDefault()
        const nextTab = TABS[nextIndex]
        selectTab(nextTab.id)
        tabRefs.current[nextTab.id]?.focus()
    }

    return (
        <main className="dashboard-management settings-page">
            <header className="dashboard-management__header">
                <h1>Configurações</h1>
                <p>Gerencie os dados da barbearia, sua conta e as preferências do painel.</p>
            </header>

            <div className="settings__tabs" role="tablist" aria-label="Seções de configuração">
                {TABS.map((tab, index) => (
                    <button
                        key={tab.id}
                        ref={(element) => { tabRefs.current[tab.id] = element }}
                        id={`settings-tab-${tab.id}`}
                        className={`settings__tab${activeTab === tab.id ? ' settings__tab--active' : ''}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        aria-controls={`settings-panel-${tab.id}`}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        onClick={() => selectTab(tab.id)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <BusinessPanel activeTab={activeTab} />
            <AccountPanel activeTab={activeTab} />
            <PreferencesPanel activeTab={activeTab} />
        </main>
    )
}
