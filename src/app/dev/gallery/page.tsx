import { notFound } from 'next/navigation'
import { GalleryClient } from './GalleryClient'

export const metadata = { title: 'Gallery' }

/** Dev-only component gallery for visual QA. Not built in production. */
export default function GalleryPage() {
    if (process.env.NODE_ENV === 'production') notFound()
    return <GalleryClient />
}
