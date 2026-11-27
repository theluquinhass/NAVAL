

export default function FormActions({ saving, onCancel, label }) {
    return (
        <div className="dashboard-management__actions">
            <button className="dashboard-management__primary" type="submit" disabled={saving}>
                {saving ? 'Salvando...' : label}
            </button>
            <button className="dashboard-management__secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
        </div>
    )
}
