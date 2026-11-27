import { useTheme } from '../../../contexts/ThemeContext.jsx'

export default function PreferencesPanel({ activeTab }) {
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
