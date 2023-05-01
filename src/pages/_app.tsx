import '@/styles/globals.scss'
import type { AppProps } from 'next/app'
import initAuth from '@/initAuth'
import { AnimatePresence } from 'framer-motion'

initAuth();

export default function App({ Component, pageProps }: AppProps) {
  if (typeof window != 'undefined') {
    document.body.removeAttribute("style");
  }

  return (
    <AnimatePresence mode="wait">
      <Component {...pageProps} />
    </AnimatePresence>
  )
}
