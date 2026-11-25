import { useCallback, useEffect, useState } from 'react'
import {
    createService,
    deleteService,
    listServices,
    updateService
} from '../../services/servicesApi.js'
import './management.css'

const emptyForm = { name: '', description: '', price: '', duration: '' }

function getErrorMessage(error, fallback) {
    return error.response?.data?.error || error.response?.data?.message || error.message || fallback
}

export default function Services() {
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [formError, setFormError] = useState('')
    const [message, setMessage] = useState('')
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(emptyForm)

    const loadServices = useCallback(async () => {
        setLoading(true)
        setLoadError('')
        try {
            setServices(await listServices())
        } catch (error) {
            setLoadError(getErrorMessage(error, 'Não foi possível carregar os serviços.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        let active = true

        listServices()
            .then((data) => {
                if (active) setServices(data)
            })
            .catch((error) => {
                if (active) setLoadError(getErrorMessage(error, 'Não foi possível carregar os serviços.'))
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => { active = false }
    }, [])

    function handleChange(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
    }

    function resetForm() {
        setForm(emptyForm)
        setEditingId(null)
        setFormError('')
    }

    function startEditing(service) {
        setEditingId(service.id)
        setForm({
            name: service.name ?? '',
            description: service.description ?? '',
            price: String(service.price ?? ''),
            duration: String(service.duration ?? '')
        })
        setMessage('')
        setFormError('')
    }

    async function handleSubmit(event) {
        event.preventDefault()
        setSaving(true)
        setFormError('')
        setMessage('')

        const payload = {
            name: form.name,
            description: form.description,
            price: Number(form.price),
            duration: Number(form.duration)
        }

        try {
            if (editingId) {
                await updateService(editingId, payload)
                setMessage('Serviço atualizado com sucesso.')
            } else {
                await createService(payload)
                setMessage('Serviço cadastrado com sucesso.')
            }
            resetForm()
            await loadServices()
        } catch (error) {
            setFormError(getErrorMessage(error, 'Não foi possível salvar o serviço.'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(service) {
        if (!window.confirm(`Deseja excluir o serviço "${service.name}"?`)) return

        setMessage('')
        setFormError('')
        try {
            await deleteService(service.id)
            setMessage('Serviço excluído com sucesso.')
            if (editingId === service.id) resetForm()
            await loadServices()
        } catch (error) {
            setFormError(getErrorMessage(error, 'Não foi possível excluir o serviço.'))
        }
    }

    return (
        <main className="dashboard-management">
            <header className="dashboard-management__header">
                <p className="dashboard-eyebrow">Gestão</p>
                <h1>Serviços</h1>
                <p>Cadastre e atualize os serviços oferecidos pela sua barbearia.</p>
            </header>

            <div className="services-management__grid">
            <form className="dashboard-management__panel services-management__form" onSubmit={handleSubmit}>
                <div className="dashboard-management__panel-heading"><h2>{editingId ? 'Editar serviço' : 'Cadastrar serviço'}</h2><p>Informe nome, valor e duração do atendimento.</p></div>

                <label className="dashboard-management__field" htmlFor="service-name">Nome
                <input
                    id="service-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    required
                />
                </label>

                <label className="dashboard-management__field" htmlFor="service-description">Descrição (opcional)
                <textarea
                    id="service-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                />
                </label>

                <label className="dashboard-management__field" htmlFor="service-price">Preço
                <input
                    id="service-price"
                    name="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange}
                    required
                />
                </label>

                <label className="dashboard-management__field" htmlFor="service-duration">Duração em minutos
                <input
                    id="service-duration"
                    name="duration"
                    type="number"
                    min="1"
                    step="1"
                    value={form.duration}
                    onChange={handleChange}
                    required
                />
                </label>

                <div className="dashboard-management__actions"><button className="dashboard-management__primary" type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
                </button>
                {editingId && (
                    <button className="dashboard-management__secondary" type="button" onClick={resetForm} disabled={saving}>
                        Cancelar edição
                    </button>
                )}</div>
                {formError && <p role="alert">{formError}</p>}
            </form>

            <section className="dashboard-management__panel services-management__list">
            <div className="dashboard-management__panel-heading"><h2>Serviços cadastrados</h2><p>Gerencie os itens disponíveis para agendamento.</p></div>
            {message && <p className="dashboard-management__notice" role="status">{message}</p>}

                {loading ? (
                    <p className="dashboard-management__empty">Carregando serviços...</p>
                ) : loadError ? (
                    <div className="dashboard-management__empty">
                        <p role="alert">{loadError}</p>
                        <button className="dashboard-management__secondary" type="button" onClick={loadServices}>Tentar novamente</button>
                    </div>
                ) : services.length === 0 ? (
                    <p className="dashboard-management__empty">Nenhum serviço cadastrado.</p>
                ) : (
                    <ul className="services-management__items">
                        {services.map((service) => (
                            <li className="services-management__item" key={service.id}>
                                <div className="services-management__item-heading"><h3>{service.name}</h3><span>{Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                <p>{service.description || 'Sem descrição.'}</p>
                                <div className="services-management__item-footer"><span>{service.duration} min</span><div className="dashboard-management__actions"><button className="dashboard-management__secondary" type="button" onClick={() => startEditing(service)}>Editar</button>
                                <button className="dashboard-management__danger" type="button" onClick={() => handleDelete(service)}>Excluir</button></div></div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            </div>
        </main>
    )
}
