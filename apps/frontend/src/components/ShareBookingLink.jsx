import Icon from './ui/Icon.jsx'
import { useToast } from './ui/feedbackContext.js'
import { markBookingLinkShared } from './shareBookingLinkState.js'
import './ShareBookingLink.css'

function bookingUrl(slug) {
    return `${window.location.origin}/book/${encodeURIComponent(slug)}`
}

async function copyText(text) {
    if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE')
    await navigator.clipboard.writeText(text)
}

export default function ShareBookingLink({ slug, barbershopName, onShared }) {
    const notify = useToast()
    if (!slug) return null

    const url = bookingUrl(slug)
    const whatsappText = `Agende seu horário na ${barbershopName || 'barbearia'} pelo link: ${url}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`

    function registerShare() {
        markBookingLinkShared(slug)
        onShared?.()
    }

    async function handleCopy() {
        try {
            await copyText(url)
            registerShare()
            notify('Link copiado! Cole no WhatsApp, Instagram ou onde quiser.')
        } catch {
            notify('Não foi possível copiar automaticamente. Selecione o link e copie manualmente.', { tone: 'error' })
        }
    }

    return (
        <section className="share-link" aria-labelledby="share-link-title">
            <div className="share-link__intro">
                <span className="share-link__icon"><Icon name="link" /></span>
                <div>
                    <h2 id="share-link-title">Sua página de agendamento</h2>
                    <p>Envie este link para seus clientes marcarem horário sozinhos, 24 horas por dia.</p>
                </div>
            </div>

            <label className="share-link__field">
                <span className="share-link__field-label">Link da sua barbearia</span>
                <input type="text" readOnly value={url} onFocus={(event) => event.target.select()} />
            </label>

            <div className="share-link__actions">
                <button type="button" className="ui-button ui-button--primary" onClick={handleCopy}>
                    <Icon name="copy" />Copiar link
                </button>
                <a className="ui-button ui-button--secondary" href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={registerShare}>
                    <Icon name="whatsapp" />Enviar no WhatsApp
                </a>
                <a className="ui-button ui-button--ghost" href={url} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" />Ver página
                </a>
            </div>
        </section>
    )
}
