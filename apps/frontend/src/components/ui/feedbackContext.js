import { createContext, useContext } from 'react'

// Without a provider (e.g. isolated component tests) fall back to the native
// confirm dialog and silently drop toasts, so components never crash.
const fallback = {
    confirm: async ({ title, message, input }) => {
        const text = [title, message].filter(Boolean).join('\n\n')
        if (!input) return window.confirm(text)
        const value = window.prompt(text, input.defaultValue ?? '')
        return value?.trim() ? value.trim() : false
    },
    notify: () => {}
}

export const FeedbackContext = createContext(fallback)

export function useConfirm() {
    return useContext(FeedbackContext).confirm
}

export function useToast() {
    return useContext(FeedbackContext).notify
}
