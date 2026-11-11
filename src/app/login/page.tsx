import { signInDemo } from '@/actions/auth'

// Temporary sign-in used while the pages are rebuilt.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const params = await searchParams
    const next = Array.isArray(params.next) ? params.next[0] : params.next
    async function demo() {
        'use server'
        await signInDemo(next)
    }
    return (
        <main>
            <form action={demo}>
                <button type="submit">Continue as demo cook</button>
            </form>
        </main>
    )
}
