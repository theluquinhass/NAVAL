import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BusinessPanel from './BusinessPanel.jsx'
import AccountPanel from './AccountPanel.jsx'
import PreferencesPanel from './PreferencesPanel.jsx'
import '../management.css'
import './settings.css'

const TABS = [
    { id: 'business', label: 'Meu negócio', path: '/dashboard/business' },
    { id: 'account', label: 'Conta e segurança', path: '/dashboard/settings' },
    { id: 'preferences', label: 'Preferências', path: '/dashboard/settings?tab=preferences' }
]

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
