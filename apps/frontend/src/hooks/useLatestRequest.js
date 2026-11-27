import { useCallback, useEffect, useRef } from 'react'

/**
 * Guards async loads against out-of-order responses and updates after unmount.
 *
 * Call `beginRequest()` when a request starts; it returns `isCurrent()`, which is
 * true only while that request is the most recent one and the component is mounted.
 *
 * @returns {() => () => boolean}
 */
export function useLatestRequest() {
    const sequence = useRef(0)
    const mounted = useRef(false)

    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])

    return useCallback(() => {
        sequence.current += 1
        const requestId = sequence.current
        return () => mounted.current && sequence.current === requestId
    }, [])
}
