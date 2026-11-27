import { performance } from 'node:perf_hooks'

export function addServerTiming(res, name, durationMs) {
    const value = `${name};dur=${durationMs.toFixed(1)}`
    const current = res.getHeader('Server-Timing')
    res.setHeader('Server-Timing', current ? `${current}, ${value}` : value)
}

export function requestTiming(req, res, next) {
    const started = performance.now()
    let recorded = false

    const record = () => {
        if (recorded || res.headersSent) return
        recorded = true
        addServerTiming(res, 'total', performance.now() - started)
    }

    const originalSend = res.send.bind(res)
    const originalEnd = res.end.bind(res)
    res.send = (...args) => {
        record()
        return originalSend(...args)
    }
    res.end = (...args) => {
        record()
        return originalEnd(...args)
    }

    next()
}
