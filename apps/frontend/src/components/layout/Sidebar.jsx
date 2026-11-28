import { NavLink, useLocation } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile.js'
import Icon from '../ui/Icon.jsx'

const SETTINGS_PATHS = ['/dashboard/settings', '/dashboard/business']

const groups = [
    { title: null, items: [{ label: 'Início', icon: 'dashboard', to: '/dashboard' }] },
    { title: 'Atendimento', items: [
        { label: 'Agenda', icon: 'calendar', to: '/dashboard/agenda' },
        { label: 'Clientes', icon: 'users', to: '/dashboard/customers' }
    ] },
    { title: 'Barbearia', items: [
        { label: 'Serviços', icon: 'scissors', to: '/dashboard/services' },
        { label: 'Horários', icon: 'clock', to: '/dashboard/working-hours' },
        { label: 'Financeiro', icon: 'wallet', to: '/dashboard/finance' }
    ] },
    { title: 'Produtos', requiresProducts: true, items: [
        { label: 'Estoque', icon: 'box', to: '/dashboard/products' },
        { label: 'Movimentações', icon: 'swap', to: '/dashboard/products/movements' },
        { label: 'Vendas e compras', icon: 'receipt', to: '/dashboard/products/finance' }
    ] }
]

function linkClass(isActive) {
    return `dashboard-sidebar__link${isActive ? ' dashboard-sidebar__link--active' : ''}`
}

export default function Sidebar({ isMobile, isOpen, onClose, sidebarRef, firstLinkRef }) {
    const profile = useProfile()
    const { pathname } = useLocation()
    const visibleGroups = groups.filter((group) => !group.requiresProducts || profile?.sellsProducts)
    const settingsActive = SETTINGS_PATHS.includes(pathname)

    return (
        <aside
            id="naval-dashboard-sidebar"
            ref={sidebarRef}
            className={`dashboard-sidebar${isOpen ? ' dashboard-sidebar--open' : ''}`}
            aria-label="Navegação do NAVAL"
            aria-hidden={isMobile ? !isOpen : undefined}
            inert={isMobile && !isOpen}
            tabIndex={-1}
        >
            <div className="dashboard-sidebar__heading">
                <span className="dashboard-sidebar__brand">
                    <span className="dashboard-sidebar__mark" aria-hidden="true">N</span>
                    <span className="dashboard-sidebar__brand-text">
                        <strong>NAVAL</strong>
                        {profile?.name && <small>{profile.name}</small>}
                    </span>
                </span>
                <button type="button" className="dashboard-sidebar__close" aria-label="Fechar navegação" onClick={onClose}>
                    <Icon name="close" />
                </button>
            </div>

            <nav className="dashboard-sidebar__nav" aria-label="Navegação principal">
                {visibleGroups.map((group, groupIndex) => (
                    <section className="dashboard-sidebar__group" key={group.title ?? 'main'} aria-label={group.title ?? 'Principal'}>
                        {group.title && <h2 className="dashboard-sidebar__group-title">{group.title}</h2>}
                        <div className="dashboard-sidebar__group-items">
                            {group.items.map((item, itemIndex) => (
                                <NavLink
                                    key={item.to}
                                    ref={groupIndex === 0 && itemIndex === 0 ? firstLinkRef : undefined}
                                    to={item.to}
                                    end
                                    className={({ isActive }) => linkClass(isActive)}
                                    onClick={onClose}
                                >
                                    <Icon name={item.icon} className="dashboard-sidebar__icon" /><span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    </section>
                ))}
            </nav>

            <div className="dashboard-sidebar__footer">
                {profile?.slug && (
                    <a
                        className="dashboard-sidebar__link"
                        href={`/book/${encodeURIComponent(profile.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Icon name="external" className="dashboard-sidebar__icon" />
                        <span>Minha página de agendamento</span>
                    </a>
                )}
                <NavLink
                    to="/dashboard/settings"
                    className={() => linkClass(settingsActive)}
                    aria-current={settingsActive ? 'page' : undefined}
                    onClick={onClose}
                >
                    <Icon name="settings" className="dashboard-sidebar__icon" /><span>Configurações</span>
                </NavLink>
            </div>
        </aside>
    )
}
