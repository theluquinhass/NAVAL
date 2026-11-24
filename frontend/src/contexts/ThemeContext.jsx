import { createContext, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore } from 'react'

const ThemeContext = createContext(null)
const THEME_PREFERENCE_STORAGE_KEY = 'naval-theme-preference'
const THEME_PREFERENCES = ['light', 'dark', 'system']

function isThemePreference(value) {
    return THEME_PREFERENCES.includes(value)
}

function getInitialPreference() {
    const documentPreference = document.documentElement.dataset.themePreference
    if (isThemePreference(documentPreference)) return documentPreference

    try {
        const storedPreference = window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
        if (isThemePreference(storedPreference)) return storedPreference
    } catch {
        // Storage can be unavailable; default to following the operating system.
    }

    return 'system'
}

function subscribeToSystemTheme(onChange) {
    if (typeof window.matchMedia !== 'function') return () => {}

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', onChange)
        return () => mediaQuery.removeEventListener('change', onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
}

function getSystemTheme() {
    if (typeof window.matchMedia !== 'function') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getServerSystemTheme() {
    return 'light'
}

export function ThemeProvider({ children }) {
    const [preference, setPreference] = useState(getInitialPreference)
    const systemTheme = useSyncExternalStore(
        subscribeToSystemTheme,
        getSystemTheme,
        getServerSystemTheme,
    )
    const theme = preference === 'system' ? systemTheme : preference

    useLayoutEffect(() => {
        const root = document.documentElement
        root.dataset.themePreference = preference
        root.dataset.theme = theme

        try {
            window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference)
        } catch {
            // The theme remains active for this session even when it cannot be persisted.
        }
    }, [preference, theme])

    const setThemePreference = useCallback((nextPreference) => {
        if (isThemePreference(nextPreference)) setPreference(nextPreference)
    }, [])

    const toggleTheme = useCallback(() => {
        setPreference(theme === 'dark' ? 'light' : 'dark')
    }, [theme])

    return (
        <ThemeContext.Provider value={{ theme, preference, setThemePreference, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
    return useContext(ThemeContext)
}
