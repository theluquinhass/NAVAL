import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    createCustomer,
    getCustomerDetails,
    listCustomers,
    updateCustomer
} from '../../../services/customersApi.js'
import { formatDateTime, getErrorMessage } from '../../../utils/dashboard.js'
import { useLatestRequest } from '../../../hooks/useLatestRequest.js'
import '../management.css'
import './customers.css'

const emptyForm = { name: '', phone: '' }

function getStatus(status) {
    if (status === 'confirmed') return { label: 'Confirmado', className: 'customers__status--confirmed' }
    if (status === 'cancelled') return { label: 'Cancelado', className: 'customers__status--cancelled' }
    return { label: status || 'Outro', className: 'customers__status--other' }
}

function getInitials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

export default function Customers() {
    const [customers, setCustomers] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [selectedId, setSelectedId] = useState('')
    const [details, setDetails] = useState(null)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [detailsError, setDetailsError] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [editingId, setEditingId] = useState('')
    const [form, setForm] = useState(emptyForm)
    const [formError, setFormError] = useState('')
    const [message, setMessage] = useState('')
    const [saving, setSaving] = useState(false)
    const beginCustomersRequest = useLatestRequest()

    const loadCustomers = useCallback(async (term = search) => {
        const isCurrent = beginCustomersRequest()
        setLoading(true)
        setLoadError('')
        try {
            const result = await listCustomers(term.trim())
            if (!isCurrent()) return
            setCustomers(result)
            setSelectedId((current) => result.some((customer) => customer.id === current) ? current : '')
        } catch (error) {
            if (isCurrent()) setLoadError(getErrorMessage(error, 'Não foi possível carregar os clientes.'))
        } finally {
            if (isCurrent()) setLoading(false)
        }
    }, [search, beginCustomersRequest])

    useEffect(() => {
        const timeout = window.setTimeout(() => loadCustomers(search), 220)
        return () => window.clearTimeout(timeout)
    }, [search, loadCustomers])

    useEffect(() => {
        if (!selectedId) return undefined

        let active = true
        getCustomerDetails(selectedId)
            .then((result) => { if (active) setDetails(result) })
            .catch((error) => {
                if (active) setDetailsError(getErrorMessage(error, 'Não foi possível carregar o histórico.'))
            })
            .finally(() => { if (active) setDetailsLoading(false) })

        return () => { active = false }
    }, [selectedId])

    const selectedCustomer = useMemo(
        () => customers.find((customer) => customer.id === selectedId)
            ?? (details?.customer?.id === selectedId ? details.customer : null),
        [customers, selectedId, details]
    )
    const selectedDetails = details?.customer?.id === selectedId ? details : null

    function selectCustomer(id) {
        if (id === selectedId) return
        setDetailsLoading(true)
        setDetailsError('')
        setSelectedId(id)
    }

    function openCreateForm() {
        setEditingId('')
        setForm(emptyForm)
        setFormError('')
        setMessage('')
        setFormOpen(true)
    }

    function openEditForm(customer) {
        setEditingId(customer.id)
        setForm({ name: customer.name, phone: customer.phone })
        setFormError('')
        setMessage('')
        setFormOpen(true)
    }

    function closeForm() {
        if (saving) return
        setFormOpen(false)
        setEditingId('')
        setForm(emptyForm)
        setFormError('')
    }

    function handleChange(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
        setFormError('')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        if (saving) return

        const payload = { name: form.name.trim(), phone: form.phone.trim() }
        if (!payload.name || !payload.phone) {
            setFormError('Preencha o nome e o telefone do cliente.')
            return
        }

        setSaving(true)
        setFormError('')
        setMessage('')
        try {
            const saved = editingId
                ? await updateCustomer(editingId, payload)
                : await createCustomer(payload)
            setFormOpen(false)
            setEditingId('')
            setForm(emptyForm)
            setMessage(editingId ? 'Cliente atualizado.' : 'Cliente cadastrado.')
            await loadCustomers(search)
            if (saved.id !== selectedId) selectCustomer(saved.id)
        } catch (error) {
            setFormError(getErrorMessage(error, 'Não foi possível salvar o cliente.'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="dashboard-management customers-page">
            <header className="dashboard-management__header customers-page__header">
                <div>
                    <p className="dashboard-eyebrow">Gestão</p>
                    <h1>Clientes</h1>
                    <p>Organize os contatos e acompanhe o histórico de atendimentos.</p>
                </div>
                <button className="dashboard-management__primary" type="button" onClick={openCreateForm}>
                    Novo cliente
                </button>
            </header>

            {message && <p className="dashboard-management__notice" role="status">{message}</p>}

            {formOpen && (
                <form className="dashboard-management__panel customers__form" onSubmit={handleSubmit}>
                    <div className="dashboard-management__panel-heading">
                        <h2>{editingId ? 'Editar cliente' : 'Cadastrar cliente'}</h2>
                        <p>Os dados podem ser atualizados manualmente a qualquer momento.</p>
                    </div>
                    <label className="dashboard-management__field" htmlFor="customer-name">Nome
                        <input id="customer-name" name="name" type="text" autoComplete="name" maxLength={100} required value={form.name} onChange={handleChange} />
                    </label>
                    <label className="dashboard-management__field" htmlFor="customer-phone">Telefone
                        <input id="customer-phone" name="phone" type="tel" autoComplete="tel" maxLength={25} required value={form.phone} onChange={handleChange} placeholder="(84) 99999-9999" />
                    </label>
                    {formError && <p role="alert">{formError}</p>}
                    <div className="dashboard-management__actions">
                        <button className="dashboard-management__primary" type="submit" disabled={saving}>
                            {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar cliente'}
                        </button>
                        <button className="dashboard-management__secondary" type="button" onClick={closeForm} disabled={saving}>Cancelar</button>
                    </div>
                </form>
            )}

            <div className="customers__grid">
                <section className="dashboard-management__panel customers__list-panel" aria-labelledby="customers-list-title">
                    <div className="dashboard-management__panel-heading">
                        <h2 id="customers-list-title">Sua carteira</h2>
                        <p>{customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}</p>
                    </div>
                    <label className="customers__search" htmlFor="customer-search">
                        <span>Buscar cliente</span>
                        <input id="customer-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou telefone" />
                    </label>

                    {loading ? (
                        <p className="dashboard-management__empty" role="status">Carregando clientes...</p>
                    ) : loadError ? (
                        <div className="dashboard-management__empty">
                            <p role="alert">{loadError}</p>
                            <button className="dashboard-management__secondary" type="button" onClick={() => loadCustomers(search)}>Tentar novamente</button>
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="customers__empty">
                            <span className="customers__empty-icon" aria-hidden="true">+</span>
                            <h3>{search ? 'Nenhum resultado' : 'Sua lista começa aqui'}</h3>
                            <p>{search ? 'Tente buscar por outro nome ou telefone.' : 'Cadastre clientes ou aguarde novos agendamentos para formar sua carteira.'}</p>
                            {!search && <button className="dashboard-management__secondary" type="button" onClick={openCreateForm}>Cadastrar primeiro cliente</button>}
                        </div>
                    ) : (
                        <ul className="customers__items">
                            {customers.map((customer) => (
                                <li key={customer.id}>
                                    <button
                                        type="button"
                                        className={`customers__item${selectedId === customer.id ? ' customers__item--selected' : ''}`}
                                        onClick={() => selectCustomer(customer.id)}
                                        aria-current={selectedId === customer.id ? 'true' : undefined}
                                    >
                                        <span className="customers__avatar" aria-hidden="true">{getInitials(customer.name)}</span>
                                        <span className="customers__item-copy"><strong>{customer.name}</strong><span>{customer.phone}</span></span>
                                        <span className="customers__chevron" aria-hidden="true">›</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="dashboard-management__panel customers__details" aria-labelledby="customer-details-title">
                    {!selectedCustomer ? (
                        <div className="customers__detail-placeholder">
                            <span className="customers__placeholder-icon" aria-hidden="true">⌕</span>
                            <h2 id="customer-details-title">Detalhes do cliente</h2>
                            <p>Selecione alguém da lista para consultar os dados e o histórico de atendimentos.</p>
                        </div>
                    ) : (
                        <>
                            <div className="customers__profile">
                                <span className="customers__avatar customers__avatar--large" aria-hidden="true">{getInitials(selectedCustomer.name)}</span>
                                <div className="customers__profile-copy">
                                    <p className="dashboard-eyebrow">Cliente</p>
                                    <h2 id="customer-details-title">{selectedCustomer.name}</h2>
                                    <p>{selectedCustomer.phone}</p>
                                </div>
                                <button className="dashboard-management__secondary" type="button" onClick={() => openEditForm(selectedCustomer)}>Editar</button>
                            </div>
                            <div className="customers__history-heading">
                                <div><h3>Histórico de atendimentos</h3><p>Agendamentos associados a este cliente.</p></div>
                            </div>
                            {detailsLoading ? (
                                <p className="dashboard-management__empty" role="status">Carregando histórico...</p>
                            ) : detailsError ? (
                                <p className="dashboard-management__empty" role="alert">{detailsError}</p>
                            ) : !selectedDetails?.appointments?.length ? (
                                <p className="dashboard-management__empty">Ainda não há atendimentos associados a este cliente.</p>
                            ) : (
                                <ul className="customers__history">
                                    {selectedDetails.appointments.map((appointment) => {
                                        const status = getStatus(appointment.status)
                                        return (
                                            <li className="customers__history-item" key={appointment.id}>
                                                <span className="customers__history-marker" aria-hidden="true" />
                                                <div className="customers__history-main">
                                                    <strong>{appointment.service?.name || 'Atendimento'}</strong>
                                                    <span>{formatDateTime(appointment.starts_at)}</span>
                                                    <small>Snapshot: {appointment.customer_name} · {appointment.customer_phone}</small>
                                                </div>
                                                <span className={`customers__status ${status.className}`}>{status.label}</span>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </>
                    )}
                </section>
            </div>
        </main>
    )
}
