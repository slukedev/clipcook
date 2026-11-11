'use server'

// Compatibility shim for the pre-rebuild login page; new code imports from '@/actions/auth'.
import { signInWithIdToken, signOut } from '@/actions/auth'

export async function signInAction(idToken: string, nextPath?: string): Promise<void> {
    const result = await signInWithIdToken(idToken, nextPath)
    if (!result.ok) throw new Error(result.error)
}

export async function signOutAction(): Promise<void> {
    await signOut()
}
