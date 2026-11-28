import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FeedbackContext } from './feedbackContext.js'

const TOAST_DURATION_MS = 4500

// `request.input` turns the dialog into a prompt: it resolves with the typed
// text (trimmed) or `false` when cancelled.
function ConfirmDialog({ request, onClose }) {
    const dialogRef = useRef(null)
    const keyHandlerRef = useRef(null)
    const inputRef = useRef(null)
    const cancelRef = useRef(null)
    const confirmRef = useRef(null)
    const [value, setValue] = useState(request.input?.defaultValue ?? '')
    const missingValue = Boolean(request.input) && !value.trim()

    useEffect(() => {
        const previousFocus = document.activeElement
        // Prompts start on the field; destructive confirmations on the safe choice.
        if (inputRef.current) inputRef.current.select()
        else cancelRef.current?.focus()
        return () => { previousFocus?.focus?.() }
    }, [])

    useEffect(() => {
        const dialog = dialogRef.current
        const listener = (event) => keyHandlerRef.current?.(event)
        dialog?.addEventListener('keydown', listener)
        return () => dialog?.removeEventListener('keydown', listener)
    }, [])

    function accept() {
        if (missingValue) return
        onClose(request.input ? value.trim() : true)
    }

    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault()
            onClose(false)
            return
        }
        if (event.key === 'Enter' && event.target === inputRef.current) {
            event.preventDefault()
            accept()
            return
        }
        if (event.key !== 'Tab') return
        const order = [inputRef.current, cancelRef.current, confirmRef.current].filter((element) => element && !element.disabled)
        const index = order.indexOf(document.activeElement)
        event.preventDefault()
        const next = event.shiftKey ? (index <= 0 ? order.length - 1 : index - 1) : (index + 1) % order.length
        order[next]?.focus()
    }
    useLayoutEffect(() => { keyHandlerRef.current = handleKeyDown })

    const tone = request.tone === 'danger' ? 'danger' : 'primary'

    return (
        <div className="ui-dialog-backdrop">
            <div
                ref={dialogRef}
                className="ui-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="ui-confirm-title"
                aria-describedby={request.message ? 'ui-confirm-message' : undefined}
            >
                <h2 id="ui-confirm-title">{request.title}</h2>
                {request.message && <p id="ui-confirm-message">{request.message}</p>}
                {request.input && (
                    <label className="ui-dialog__field">
                        <span>{request.input.label}</span>
                        <input ref={inputRef} type="text" value={value} maxLength={request.input.maxLength ?? 300} onChange={(event) => setValue(event.target.value)} />
                    </label>
                )}
                <div className="ui-dialog__actions">
                    <button ref={cancelRef} type="button" className="ui-button ui-button--secondary" onClick={() => onClose(false)}>
                        {request.cancelLabel || 'Cancelar'}
                    </button>
                    <button ref={confirmRef} type="button" className={`ui-button ui-button--${tone}`} disabled={missingValue} onClick={accept}>
                        {request.confirmLabel || 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function FeedbackProvider({ children }) {
    const [confirmRequest, setConfirmRequest] = useState(null)
    const [toasts, setToasts] = useState([])
    const nextToastId = useRef(0)

    const pendingConfirmRef = useRef(null)

    const confirm = useCallback((options) => new Promise((resolve) => {
        pendingConfirmRef.current?.resolve(false)
        const request = { ...options, resolve }
        pendingConfirmRef.current = request
        setConfirmRequest(request)
    }), [])

    const closeConfirm = useCallback((accepted) => {
        pendingConfirmRef.current?.resolve(accepted)
        pendingConfirmRef.current = null
        setConfirmRequest(null)
    }, [])

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
    }, [])

    const notify = useCallback((message, { tone = 'success' } = {}) => {
        nextToastId.current += 1
        const id = nextToastId.current
        setToasts((current) => [...current.slice(-2), { id, message, tone }])
        setTimeout(() => dismiss(id), TOAST_DURATION_MS)
    }, [dismiss])

    const value = useMemo(() => ({ confirm, notify }), [confirm, notify])

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            {confirmRequest && <ConfirmDialog request={confirmRequest} onClose={closeConfirm} />}
            <div className="ui-toast-region" role="status" aria-live="polite">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`ui-toast ui-toast--${toast.tone}`}>
                        <p>{toast.message}</p>
                        <button type="button" aria-label="Fechar aviso" onClick={() => dismiss(toast.id)}>×</button>
                    </div>
                ))}
            </div>
        </FeedbackContext.Provider>
    )
}
