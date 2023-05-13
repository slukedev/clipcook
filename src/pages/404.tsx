import Head from 'next/head'
import { Main } from '@/components/main';

export default function Home() {
  return (
    <>
      <Head>
        <title>ClipCook - Page Not Found</title>
        <meta name="description" content="Page not found" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#D0BCFF" />
      </Head>
      <Main pageName="pageNotFound">
        <h1>404</h1>
        <p>Page not found</p>
      </Main>
    </>
  )
}