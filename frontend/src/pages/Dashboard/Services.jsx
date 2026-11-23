import { useCallback, useEffect, useState } from 'react'
import {
    createService,
    deleteService,
    listServices,
    updateService
} from '../../services/servicesApi.js'

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
        <section>
            <h2>Serviços</h2>

            <form onSubmit={handleSubmit}>
                <h3>{editingId ? 'Editar serviço' : 'Cadastrar serviço'}</h3>

                <label htmlFor="service-name">Nome</label>
                <input
                    id="service-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    required
                />

                <label htmlFor="service-description">Descrição (opcional)</label>
                <textarea
                    id="service-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                />

                <label htmlFor="service-price">Preço</label>
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

                <label htmlFor="service-duration">Duração em minutos</label>
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

                <button type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
                </button>
                {editingId && (
                    <button type="button" onClick={resetForm} disabled={saving}>
                        Cancelar edição
                    </button>
                )}
                {formError && <p role="alert">{formError}</p>}
            </form>

            {message && <p role="status">{message}</p>}

            <div>
                <h3>Serviços cadastrados</h3>
                {loading ? (
                    <p>Carregando serviços...</p>
                ) : loadError ? (
                    <div>
                        <p role="alert">{loadError}</p>
                        <button type="button" onClick={loadServices}>Tentar novamente</button>
                    </div>
                ) : services.length === 0 ? (
                    <p>Nenhum serviço cadastrado.</p>
                ) : (
                    <ul>
                        {services.map((service) => (
                            <li key={service.id}>
                                <h4>{service.name}</h4>
                                <p>{service.description || 'Sem descrição.'}</p>
                                <p>Preço: {Number(service.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                <p>Duração: {service.duration} minutos</p>
                                <button type="button" onClick={() => startEditing(service)}>Editar</button>
                                <button type="button" onClick={() => handleDelete(service)}>Excluir</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}
