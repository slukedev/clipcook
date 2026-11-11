// Builds the "Clip to ClipCook" bookmarklet. Client-safe: the settings page renders the link.

/** Total characters the bookmarklet sends; the server rejects bodies over 1 MB. */
const HTML_BUDGET = 500_000
const JSONLD_BUDGET = 250_000

/**
 * Runs on the recipe page. It reads what the browser already has (ld+json blocks,
 * the recipe card, head meta) and POSTs it to ClipCook in a new tab, so sites that
 * block servers still clip. If the page's CSP forbids posting a form elsewhere,
 * it falls back to opening /clip?url= for a server-side clip.
 */
export function bookmarkletSource(origin: string): string {
    const o = JSON.stringify(origin.replace(/\/+$/, ''))
    return `(function(){
var o=${o},d=document,done=false;
function fallback(){if(done)return;done=true;window.open(o+'/clip?url='+encodeURIComponent(location.href),'_blank');}
var budget=${JSONLD_BUDGET},ld=[];
[].forEach.call(d.querySelectorAll('script[type*="ld+json"]'),function(s){var t=s.textContent||'';if(t&&t.length<=budget&&ld.length<50){ld.push(t);budget-=t.length;}});
var card=d.querySelector('.wprm-recipe,.tasty-recipes,.mv-create-card,.mv-create,[itemtype*="schema.org/Recipe"],[itemtype*="schema.org/recipe"]');
var head=[].map.call(d.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"],meta[name="application-name"],link[rel="canonical"]'),function(m){return m.outerHTML;}).join('');
var body=card?card.outerHTML:(ld.length?'':((d.querySelector('article,main,[role=main]')||d.body).outerHTML));
var html=(head+body).slice(0,${HTML_BUDGET});
var f=d.createElement('form');f.method='POST';f.action=o+'/api/clip?url='+encodeURIComponent(location.href);f.target='_blank';f.enctype='multipart/form-data';f.acceptCharset='utf-8';f.style.display='none';
function add(n,v){var i=d.createElement('textarea');i.name=n;i.value=v;f.appendChild(i);}
add('url',location.href);add('title',d.title||'');add('html',html);ld.forEach(function(t){add('jsonld',t);});
function onViolation(e){if(e.violatedDirective&&e.violatedDirective.indexOf('form-action')===0)fallback();}
d.addEventListener('securitypolicyviolation',onViolation);
(d.body||d.documentElement).appendChild(f);
try{f.submit();}catch(e){fallback();}
setTimeout(function(){d.removeEventListener('securitypolicyviolation',onViolation);if(f.parentNode)f.parentNode.removeChild(f);},2000);
})();`
}

/** The draggable `javascript:` URL for the settings page. */
export function bookmarkletHref(origin: string): string {
    const compact = bookmarkletSource(origin)
        .split('\n')
        .map((line) => line.trim())
        .join('')
    return `javascript:${encodeURIComponent(compact)}`
}
