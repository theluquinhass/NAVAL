import { useTheme } from '../../contexts/ThemeContext.jsx'
import Icon from '../ui/Icon.jsx'

export default function Header({ isSidebarOpen, menuButtonRef, onToggleSidebar }) {
    const { theme, toggleTheme } = useTheme()
    const nextThemeLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'

    return (
        <header className="dashboard-header">
            <button
                ref={menuButtonRef}
                type="button"
                className="dashboard-header__menu ui-icon-button"
                aria-label={isSidebarOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
                aria-expanded={isSidebarOpen}
                aria-controls="naval-dashboard-sidebar"
                onClick={onToggleSidebar}
            >
                <Icon name={isSidebarOpen ? 'close' : 'menu'} />
            </button>

            <span className="dashboard-header__brand" aria-hidden="true">NAVAL</span>

            <button
                type="button"
                className="ui-icon-button dashboard-header__theme"
                aria-label={nextThemeLabel}
                title={nextThemeLabel}
                onClick={toggleTheme}
            >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
        </header>
    )
}
