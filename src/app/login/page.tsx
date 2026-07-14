import { LoginClient } from './LoginClient'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const params = await searchParams
    const raw = Array.isArray(params.next) ? params.next[0] : params.next
    const nextPath = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined
    return <LoginClient nextPath={nextPath} />
}
