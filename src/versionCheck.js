// Détection de nouvelle version déployée (anti-cache navigateur).
// La version du bundle chargé est injectée à la compilation (__APP_VERSION__) ;
// on la compare à /version.json (régénéré à chaque build). Si une version plus
// récente est en ligne, on affiche un bandeau « Recharger » qui recharge la
// page avec un paramètre ?v=… forçant le navigateur à récupérer le HTML frais.

const APP_VERSION = (typeof __APP_VERSION__ !== 'undefined') ? String(__APP_VERSION__) : ''
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`
let banniereAffichee = false

async function verifier() {
  if (banniereAffichee || !APP_VERSION) return
  try {
    const r = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const j = await r.json()
    const enLigne = j && j.v ? String(j.v) : ''
    // Ne proposer que si la version en ligne est strictement plus récente
    // (horodatages) — évite toute boucle si un cache CDN renvoie une version plus ancienne.
    if (/^\d+$/.test(enLigne) && /^\d+$/.test(APP_VERSION) && Number(enLigne) > Number(APP_VERSION)) {
      afficherBanniere(enLigne)
    }
  } catch (e) { /* hors-ligne ou version.json indisponible : on ignore */ }
}

function afficherBanniere(v) {
  if (banniereAffichee) return
  banniereAffichee = true
  const style = document.createElement('style')
  style.textContent = '.pt-maj{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:14px;background:#0f2a33;color:#fff;padding:11px 16px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.28);font:600 13.5px system-ui,Segoe UI,sans-serif;max-width:92vw}.pt-maj button{background:#22c55e;color:#06281a;border:0;border-radius:8px;padding:7px 15px;font:700 13px system-ui;cursor:pointer}.pt-maj button:hover{background:#16a34a}.pt-maj .x{background:none;color:#9fb4bd;font-size:18px;padding:0 4px;line-height:1}'
  document.head.appendChild(style)
  const bar = document.createElement('div')
  bar.className = 'pt-maj'
  const txt = document.createElement('span')
  txt.textContent = 'Une nouvelle version de ProdTrack est disponible.'
  const btn = document.createElement('button')
  btn.type = 'button'; btn.textContent = 'Recharger'
  btn.onclick = () => {
    try { const u = new URL(location.href); u.searchParams.set('v', v); location.replace(u.toString()) }
    catch (e) { location.reload() }
  }
  const x = document.createElement('button')
  x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.title = 'Plus tard'
  x.onclick = () => bar.remove()
  bar.appendChild(txt); bar.appendChild(btn); bar.appendChild(x)
  document.body.appendChild(bar)
}

export function startVersionCheck() {
  verifier()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier() })
  setInterval(verifier, 5 * 60 * 1000)
}
