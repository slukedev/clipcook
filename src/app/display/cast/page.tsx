import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CastReceiver } from './cast-receiver'

export const metadata: Metadata = { title: 'Kitchen display' }

/** The Cast receiver app (register this URL as the Custom Receiver in the Cast console). */
export default function CastPage() {
    if (!process.env.NEXT_PUBLIC_CAST_APP_ID) notFound()
    return <CastReceiver />
}
