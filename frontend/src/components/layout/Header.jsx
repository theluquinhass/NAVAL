import { useTheme } from '../../contexts/ThemeContext.jsx'

export default function Header({ isSidebarOpen, menuButtonRef, onToggleSidebar }) {
    const { preference, setThemePreference } = useTheme()

    return (
        <header className="dashboard-header">
            <button
                ref={menuButtonRef}
                type="button"
                className="dashboard-header__menu"
                aria-label={isSidebarOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
                aria-expanded={isSidebarOpen}
                aria-controls="naval-dashboard-sidebar"
                onClick={onToggleSidebar}
            >
                <span aria-hidden="true">☰</span>
            </button>

            <label className="dashboard-header__theme-control">
                <span>Tema</span>
                <select
                    aria-label="Preferência de tema"
                    value={preference}
                    onChange={(event) => setThemePreference(event.target.value)}
                >
                    <option value="system">Sistema</option>
                    <option value="light">Claro</option>
                    <option value="dark">Escuro</option>
                </select>
            </label>
        </header>
    )
}
