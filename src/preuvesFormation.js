// Preuve (évidence) de formation : photo prise sur place ou pièce jointe (image / PDF).
// Stockage dans la table Supabase `formation_preuves` (une preuve par enregistrement),
// en data URL base64. Les images sont compressées côté navigateur avant envoi.
// Module partagé entre l'écran « Enregistrements » et la « Matrice » pour éviter les doublons.
import { ref } from 'vue'
import { supabase } from './supabase'

// Compresse/redimensionne une image en JPEG (réduit fortement le poids avant stockage).
function compresserImage(file, maxDim = 1400, q = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
      if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r) }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      try { resolve(c.toDataURL('image/jpeg', q)) } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}
function lireDataURL(file) {
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error || new Error('Lecture échouée')); fr.readAsDataURL(file) })
}
function dataURLtoBlob(dataURL, fallbackMime) {
  const s = String(dataURL)
  const i = s.indexOf(',')
  const head = s.slice(0, i), b64 = s.slice(i + 1)
  const mime = (head.match(/data:([^;]+)/) || [])[1] || fallbackMime || 'application/octet-stream'
  const bin = atob(b64), len = bin.length, arr = new Uint8Array(len)
  for (let k = 0; k < len; k++) arr[k] = bin.charCodeAt(k)
  return new Blob([arr], { type: mime })
}

// opts.erreur / opts.message : refs d'affichage de la page hôte (facultatifs).
export function usePreuvesFormation(opts = {}) {
  const preuves = ref({})     // index léger : { [enregistrement_id]: { nom, mime } }  — SANS la donnée (perf)
  const busy = ref(null)      // id d'enregistrement en cours d'envoi
  const cible = ref(null)     // id visé par le prochain fichier choisi
  const fileJoindre = ref(null)  // <input type=file>  (galerie / fichier, image ou PDF)
  const filePhoto = ref(null)    // <input type=file capture>  (appareil photo sur mobile)
  const setErr = (m) => { if (opts.erreur) opts.erreur.value = m }
  const setMsg = (m) => { if (opts.message) opts.message.value = m }

  // Charge l'index des preuves existantes (ids + nom + mime), paginé, sans la donnée base64.
  async function chargerPreuves() {
    try {
      const all = []; let from = 0
      for (;;) {
        const r = await supabase.from('formation_preuves').select('enregistrement_id, nom, mime').range(from, from + 999)
        if (r.error) { preuves.value = {}; return }   // table absente (migration 010 non exécutée) → silencieux
        all.push(...(r.data || []))
        if (!r.data || r.data.length < 1000) break
        from += 1000
      }
      const m = {}; for (const x of all) m[x.enregistrement_id] = { nom: x.nom, mime: x.mime }
      preuves.value = m
    } catch { preuves.value = {} }
  }

  // Déclenche le sélecteur de fichier (mode 'photo' = appareil photo, 'fichier' = galerie/PDF).
  function choisir(enrId, mode) {
    if (!enrId) { setErr('Enregistre d’abord la formation avant d’y joindre une preuve.'); return }
    cible.value = enrId
    const input = mode === 'photo' ? filePhoto.value : fileJoindre.value
    if (input) { input.value = ''; input.click() }
  }

  async function onFichier(ev) {
    const file = ev && ev.target && ev.target.files && ev.target.files[0]
    const id = cible.value
    if (!file || !id) return
    setErr(''); setMsg('')
    busy.value = id
    try {
      let data, mime
      if (file.type && file.type.startsWith('image/')) {
        data = await compresserImage(file); mime = 'image/jpeg'
      } else if (file.type === 'application/pdf') {
        if (file.size > 5 * 1024 * 1024) { setErr('PDF trop volumineux (max 5 Mo). Réduis-le ou prends une photo.'); return }
        data = await lireDataURL(file); mime = 'application/pdf'
      } else { setErr('Format non supporté — joins une image ou un PDF.'); return }
      const payload = { enregistrement_id: id, nom: file.name || 'preuve', mime, data, taille: data.length }
      const r = await supabase.from('formation_preuves').upsert(payload, { onConflict: 'enregistrement_id' }).select('enregistrement_id, nom, mime')
      if (r.error) { setErr('Preuve non enregistrée : ' + r.error.message + ' — la migration 010 est-elle exécutée ?'); return }
      preuves.value = { ...preuves.value, [id]: { nom: file.name || 'preuve', mime } }
      setMsg('Preuve de formation enregistrée.')
    } catch (ex) {
      setErr('Échec de la preuve : ' + (ex && ex.message ? ex.message : String(ex)))
    } finally {
      busy.value = null; cible.value = null
      if (ev && ev.target) ev.target.value = ''
    }
  }

  // Ouvre la preuve dans un nouvel onglet (image ou PDF). L'onglet est ouvert dans le
  // geste du clic puis redirigé une fois la donnée récupérée (évite les bloqueurs de pop-up).
  async function voir(enrId) {
    if (!enrId) return
    const w = window.open('', '_blank')
    const r = await supabase.from('formation_preuves').select('data, mime').eq('enregistrement_id', enrId).limit(1)
    if (r.error || !r.data || !r.data.length) { if (w) w.close(); setErr('Preuve introuvable.'); return }
    try {
      const url = URL.createObjectURL(dataURLtoBlob(r.data[0].data, r.data[0].mime))
      if (w) w.location = url; else window.location = url
      setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch { if (w) w.close(); setErr('Impossible d’ouvrir la preuve.') }
  }

  async function supprimer(enrId) {
    if (!enrId) return
    if (!confirm('Supprimer la preuve de formation ?')) return
    setErr(''); setMsg('')
    const r = await supabase.from('formation_preuves').delete().eq('enregistrement_id', enrId)
    if (r.error) { setErr('Suppression refusée : ' + r.error.message); return }
    const m = { ...preuves.value }; delete m[enrId]; preuves.value = m
    setMsg('Preuve supprimée.')
  }

  return { preuves, busy, fileJoindre, filePhoto, chargerPreuves, choisir, onFichier, voir, supprimer }
}
