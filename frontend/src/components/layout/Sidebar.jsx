import { NavLink } from 'react-router-dom'

const icons = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    services: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="m8.1 8.1 12 12M14 14l6-6M8.1 15.9 12 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    finance: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-13 5h3" /></>,
    business: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18m-11 0v2h4v-2" /></>,
    settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m19.4 15 .1.1 1.2 1-1.2 2.1-1.5-.5a8 8 0 0 1-1.7 1l-.3 1.6h-2.4l-.3-1.6a8 8 0 0 1-1.7-1l-1.5.5-1.2-2.1 1.2-1a8 8 0 0 1 0-2l-1.2-1 1.2-2.1 1.5.5a8 8 0 0 1 1.7-1l.3-1.6H16l.3 1.6a8 8 0 0 1 1.7 1l1.5-.5 1.2 2.1-1.2 1a8 8 0 0 1-.1 1.9Z" transform="translate(-2 -2)" /></>
}

const groups = [
    { title: 'Principal', items: [{ label: 'Dashboard', icon: 'dashboard', to: '/dashboard' }] },
    { title: 'Gestão', items: [
        { label: 'Agenda', icon: 'calendar', to: '/dashboard/agenda' },
        { label: 'Clientes', icon: 'users', to: '/dashboard/customers' },
        { label: 'Serviços', icon: 'services', to: '/dashboard/services' },
        { label: 'Horários', icon: 'clock', to: '/dashboard/working-hours' },
        { label: 'Financeiro', icon: 'finance' }
    ] },
    { title: 'Sistema', items: [
        { label: 'Meu negócio', icon: 'business' },
        { label: 'Configurações', icon: 'settings' }
    ] }
]

function Icon({ name }) {
    return <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}

export default function Sidebar({ isMobile, isOpen, onClose, sidebarRef, firstLinkRef }) {
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
                <span className="dashboard-sidebar__brand">NAVAL</span>
                <button type="button" className="dashboard-sidebar__close" aria-label="Fechar navegação" onClick={onClose}>Fechar</button>
            </div>

            <nav className="dashboard-sidebar__nav" aria-label="Navegação principal">
                {groups.map((group) => (
                    <section className="dashboard-sidebar__group" key={group.title} aria-label={group.title}>
                        <h2 className="dashboard-sidebar__group-title">{group.title}</h2>
                        <div className="dashboard-sidebar__group-items">
                            {group.items.map((item) => item.to ? (
                                <NavLink
                                    key={item.label}
                                    ref={firstLinkRef}
                                    to={item.to}
                                    end
                                    className={({ isActive }) => `dashboard-sidebar__link${isActive ? ' dashboard-sidebar__link--active' : ''}`}
                                    onClick={onClose}
                                >
                                    <Icon name={item.icon} /><span>{item.label}</span>
                                </NavLink>
                            ) : (
                                <div className="dashboard-sidebar__link dashboard-sidebar__link--soon" key={item.label} aria-disabled="true">
                                    <Icon name={item.icon} /><span className="dashboard-sidebar__item-label">{item.label}</span><span className="dashboard-sidebar__coming-soon">Em breve</span>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </nav>
        </aside>
    )
}
