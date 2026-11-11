// Web storage that never throws: private windows, blocked site data and quota errors
// all read as "nothing stored" and drop the write.

type Area = 'session' | 'local'

function area(kind: Area): Storage | null {
    try {
        return kind === 'session' ? window.sessionStorage : window.localStorage
    } catch {
        return null
    }
}

export function readJson<T>(kind: Area, key: string, fallback: T): T {
    try {
        const raw = area(kind)?.getItem(key)
        return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T)
    } catch {
        return fallback
    }
}

export function writeJson(kind: Area, key: string, value: unknown): void {
    try {
        const store = area(kind)
        if (!store) return
        if (value === null || value === undefined) store.removeItem(key)
        else store.setItem(key, JSON.stringify(value))
    } catch {
        // Storage is a convenience here; the UI keeps working without it.
    }
}
