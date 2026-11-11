import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Shape } from '@/components/ui/shape'
import styles from './offline.module.scss'

export const metadata: Metadata = { title: 'Offline', robots: { index: false } }

// The service worker serves this page in place of any page that cannot load, so the
// address bar shows the page that was asked for. React does not hydrate under a
// foreign URL, hence a tiny plain script: it reloads once the connection is back
// words the page for a share that arrived offline, and offers the grocery list when a
// copy of it is saved on this device, since the list is what people need in a store.
const SCRIPT = `(() => {
  addEventListener('online', () => location.reload());
  if (location.pathname !== '/grocery' && 'caches' in self) {
    caches.match('/grocery', { cacheName: 'pages' }).then((hit) => {
      if (hit) document.querySelectorAll('[data-offline-grocery]').forEach((el) => { el.hidden = false; });
    }).catch(() => {});
  }
  const q = new URLSearchParams(location.search);
  if (location.pathname === '/clip' && (q.has('url') || q.has('text'))) {
    document.querySelectorAll('[data-offline]').forEach((el) => {
      el.hidden = el.getAttribute('data-offline') !== 'share';
    });
  }
})()`

export default async function OfflinePage() {
    const nonce = (await headers()).get('x-nonce') ?? undefined
    return (
        <main className={styles.page}>
            <div className={styles.art} aria-hidden>
                <Shape name="cookie9" size={120} className={styles.shape} />
                <Icon name="cloud_off" size={48} className={styles.icon} />
            </div>
            <div className={styles.copy} aria-live="polite">
                <h1 className={styles.title} data-offline="page">
                    You Are Offline
                </h1>
                <p className={styles.body} data-offline="page">
                    Check your connection, then try again.
                </p>
                <h1 className={styles.title} data-offline="share" hidden>
                    Clip When Back Online
                </h1>
                <p className={styles.body} data-offline="share" hidden>
                    The link stays here and clips as soon as you reconnect.
                </p>
            </div>
            <div className={styles.actions}>
                <Button
                    size="m"
                    // biome-ignore lint/a11y/useValidAnchor: an empty href reloads the address being shown, with or without JS
                    render={<a href="" />}
                    nativeButton={false}
                >
                    Retry
                </Button>
                <span data-offline-grocery="" hidden>
                    <Button
                        size="m"
                        variant="tonal"
                        icon={<Icon name="shopping_basket" />}
                        render={<a href="/grocery" />}
                        nativeButton={false}
                    >
                        Grocery list
                    </Button>
                </span>
            </div>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static script, no user input */}
            <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SCRIPT }} />
        </main>
    )
}
