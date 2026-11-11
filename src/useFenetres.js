// Gestionnaire de fenêtres flottantes dans l'app (MDI) — état partagé (singleton).
// Chaque fenêtre affiche une page (par son chemin de route) sans rechargement.
import { reactive, ref } from 'vue'

const fenetres = reactive([])   // { id, path, titre, couleur, x, y, w, h, z, reduite, agrandie, prev }
const zTop = ref(1)
let seq = 1

function parPath(path) { return fenetres.find(f => f.path === path) }

function ouvrir(path, titre, couleur) {
  if (!path) return null
  const ex = parPath(path)
  if (ex) { ex.reduite = false; focus(ex.id); return ex.id }   // déjà ouverte → la ramener au premier plan
  const vw = window.innerWidth || 1400, vh = window.innerHeight || 900
  const w = Math.min(1120, Math.max(420, Math.round(vw * 0.62)))
  const h = Math.min(780, Math.max(300, Math.round(vh * 0.74)))
  const dec = (fenetres.length % 7) * 32
  const x = Math.max(8, Math.round((vw - w) / 2) - 150 + dec)
  const y = Math.max(64, 72 + dec)
  const id = seq++
  fenetres.push({ id, path, titre: titre || 'Page', couleur: couleur || '#0f766e', x, y, w, h, z: ++zTop.value, reduite: false, agrandie: false, prev: null })
  return id
}
function fermer(id) { const i = fenetres.findIndex(f => f.id === id); if (i >= 0) fenetres.splice(i, 1) }
function focus(id) { const f = fenetres.find(f => f.id === id); if (f) f.z = ++zTop.value }
function reduire(id) { const f = fenetres.find(f => f.id === id); if (f) f.reduite = true }
function restaurer(id) { const f = fenetres.find(f => f.id === id); if (f) { f.reduite = false; focus(id) } }
function basculerAgrandie(id) {
  const f = fenetres.find(f => f.id === id); if (!f) return
  if (f.agrandie) { if (f.prev) { f.x = f.prev.x; f.y = f.prev.y; f.w = f.prev.w; f.h = f.prev.h } f.agrandie = false; f.prev = null }
  else { f.prev = { x: f.x, y: f.y, w: f.w, h: f.h }; f.agrandie = true }
  focus(id)
}
function toutFermer() { fenetres.splice(0, fenetres.length) }

export function useFenetres() {
  return { fenetres, ouvrir, fermer, focus, reduire, restaurer, basculerAgrandie, toutFermer }
}
