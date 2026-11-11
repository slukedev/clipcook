import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Gallery } from './gallery'

export const metadata: Metadata = { title: 'Gallery', robots: { index: false } }

export default function GalleryPage() {
    if (process.env.NODE_ENV !== 'development') notFound()
    return <Gallery />
}
