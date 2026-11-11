import { CONTRAST_COOKIE, THEME_COOKIE } from './preference'

/**
 * Runs before first paint. SSR already sets these attributes from the cookies; this
 * covers HTML served from a cache (bfcache, prerender) after the cookie changed.
 * System mode needs no script: color.css follows prefers-color-scheme.
 */
export const THEME_BOOTSTRAP = `(function(){try{var d=document.documentElement,c=document.cookie;function g(n){var m=c.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?m[1]:''}var t=g('${THEME_COOKIE}'),k=g('${CONTRAST_COOKIE}');if(t==='light'||t==='dark')d.dataset.theme=t;else delete d.dataset.theme;if(k==='medium'||k==='high')d.dataset.contrast=k;else delete d.dataset.contrast}catch(e){}})()`
