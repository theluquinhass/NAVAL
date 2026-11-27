import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'
import './DashboardLayout.css'

const MOBILE_QUERY = '(max-width: 48rem)'

function matchesMobileQuery() {
    return typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches
}

export default function DashboardLayout({ children }) {
    const [isMobile, setIsMobile] = useState(matchesMobileQuery)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const sidebarRef = useRef(null)
    const firstLinkRef = useRef(null)
    const menuButtonRef = useRef(null)
    const wasSidebarOpenRef = useRef(false)

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return undefined

        const mediaQuery = window.matchMedia(MOBILE_QUERY)
        const handleChange = (event) => {
            setIsMobile(event.matches)
            if (!event.matches) setIsSidebarOpen(false)
        }

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange)
            return () => mediaQuery.removeEventListener('change', handleChange)
        }

        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
    }, [])

    useLayoutEffect(() => {
        if (isMobile && isSidebarOpen) {
            wasSidebarOpenRef.current = true
            firstLinkRef.current?.focus()
            return
        }

        if (wasSidebarOpenRef.current) {
            wasSidebarOpenRef.current = false
            if (isMobile) menuButtonRef.current?.focus()
        }
    }, [isMobile, isSidebarOpen])

    useEffect(() => {
        if (!isMobile || !isSidebarOpen) return undefined

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault()
                setIsSidebarOpen(false)
                return
            }

            if (event.key !== 'Tab') return

            const sidebarElements = sidebarRef.current?.querySelectorAll(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )
            const focusable = [
                ...Array.from(sidebarElements ?? []),
                ...(menuButtonRef.current ? [menuButtonRef.current] : []),
            ].filter((element) => element.getClientRects().length > 0)

            if (focusable.length === 0) {
                event.preventDefault()
                sidebarRef.current?.focus()
                return
            }

            const firstElement = focusable[0]
            const lastElement = focusable[focusable.length - 1]
            const focusIsOutsidePanel = !sidebarRef.current?.contains(document.activeElement)
                && document.activeElement !== menuButtonRef.current

            if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsidePanel)) {
                event.preventDefault()
                lastElement.focus()
            } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutsidePanel)) {
                event.preventDefault()
                firstElement.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isMobile, isSidebarOpen])

    const mobileNavigationOpen = isMobile && isSidebarOpen

    return (
        <div
            className="dashboard-layout"
            role={mobileNavigationOpen ? 'dialog' : undefined}
            aria-modal={mobileNavigationOpen ? 'true' : undefined}
            aria-label={mobileNavigationOpen ? 'Navegação do NAVAL' : undefined}
        >
            <Sidebar
                isMobile={isMobile}
                isOpen={mobileNavigationOpen}
                onClose={() => setIsSidebarOpen(false)}
                sidebarRef={sidebarRef}
                firstLinkRef={firstLinkRef}
            />

            {mobileNavigationOpen && (
                <button
                    type="button"
                    className="dashboard-layout__backdrop"
                    aria-label="Fechar navegação"
                    tabIndex={-1}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <div className="dashboard-layout__workspace">
                <Header
                    isSidebarOpen={mobileNavigationOpen}
                    menuButtonRef={menuButtonRef}
                    onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                />
                <div className="dashboard-layout__content" inert={mobileNavigationOpen}>
                    {children ?? (
                        <Suspense fallback={<p className="dashboard-loading" role="status">Carregando página...</p>}>
                            <Outlet />
                        </Suspense>
                    )}
                </div>
            </div>
        </div>
    )
}
