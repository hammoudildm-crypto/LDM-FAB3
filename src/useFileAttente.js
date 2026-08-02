// src/useFileAttente.js
// =============================================================================
// Logique « File d'attente par atelier » centralisée (source unique).
// Utilisée par : DisponibiliteEquipements.vue  et  AvancementLots.vue
//
// Entrées (refs réactives) :
//   ofs   = ordres_fabrication (actifs) — besoin de : id, statut, date_lancement,
//           date_fin_fabrication, date_reception, boites_fabriquees,
//           quantite_theorique, produits(gamme, unites_par_boite)
//   suivi = suivi_phases (actifs)       — ordre_id, phase, statut, date_debut, date_phase
//   conds = conditionnement (actifs)    — ordre_id, quantite_conditionnee, statut
//
// Sorties : condComplet, ordresConditionnes, phasesLot, queuePhase,
//           attentePesee, lotEtape (+ condTermine, condBoxParLot).
//   queuePhase : { <cle_phase>: { attente: [{id,date}], cours: [{id,date}] } }
//                trié par date. Les pages « hydratent » les id pour l'affichage.
// =============================================================================
import { computed, unref } from 'vue'

// Clés de phase, dans l'ordre de la gamme de fabrication
export const PHASE_KEYS = ['pesee', 'granulation', 'sechage', 'melange', 'compression', 'remplissage', 'pelliculage', 'conditionnement']
export const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage Gélules', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
// Libellé de phase (minuscule) -> clé
export const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k
// Nom de phase (gamme ou suivi) -> clé. « Granulation », « Séchage » et « Granulation et Séchage » -> 'granulation' (fusionnés).
export function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/granul|s[ée]ch/.test(t)) return 'granulation'
  return NOM_KEY[t] || null
}
// Gamme canonique de fabrication (repli quand le produit n'a pas de gamme)
export const CANON_FAB = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
// Carte d'affichage regroupée (Granulation + Séchage fusionnés en une carte)
export const CARTE_DE_KEY = { granulation: 'Granulation et séchage', sechage: 'Granulation et séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage Gélules', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }

export function useFileAttente(sources) {
  const ofs = () => unref(sources.ofs) || []
  const suivi = () => unref(sources.suivi) || []
  const conds = () => unref(sources.conds) || []

  // Lots avec au moins un enregistrement de conditionnement
  const ordresConditionnes = computed(() => {
    const s = new Set()
    for (const c of conds()) s.add(c.ordre_id)
    return s
  })

  // Conditionnement définitif (au moins un enregistrement Terminé/Libéré)
  const condTermine = computed(() => {
    const s = new Set()
    for (const c of conds()) if (c.statut === 'Terminé' || c.statut === 'Libéré') s.add(c.ordre_id)
    return s
  })

  // Boîtes conditionnées cumulées par lot
  const condBoxParLot = computed(() => {
    const upb = {}
    for (const o of ofs()) upb[o.id] = o.produits ? Number(o.produits.unites_par_boite || 0) : 0
    const m = {}
    for (const c of conds()) {
      const u = upb[c.ordre_id] || 0
      if (u <= 0) continue
      m[c.ordre_id] = (m[c.ordre_id] || 0) + Math.floor(Number(c.quantite_conditionnee || 0) / u)
    }
    return m
  })

  // Conditionnement complet : Terminé/Libéré OU quantité conditionnée >= 85 % du fabriqué
  const condComplet = computed(() => {
    const s = new Set(condTermine.value)
    const cb = condBoxParLot.value
    for (const o of ofs()) {
      if (s.has(o.id)) continue
      const avail = Number(o.boites_fabriquees || 0) || Number(o.quantite_theorique || 0)
      if (avail > 0 && (cb[o.id] || 0) >= avail * 0.85) s.add(o.id)
    }
    return s
  })

  // Statut de chaque phase par lot (clé phase en minuscules), priorité au Terminé
  const phasesLot = computed(() => {
    const m = {}
    for (const sp of suivi()) {
      const id = sp.ordre_id, k = phaseKey(sp.phase)
      if (!k) continue
      if (!m[id]) m[id] = {}
      const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut || null }
      const cur = m[id][k]
      if (!cur || sp.statut === 'Terminé') m[id][k] = rec
    }
    return m
  })

  // File par phase : lots à l'étape courante.
  //   attente = étape précédente finie (pas encore démarrée) ; cours = démarrée.
  //   Items { id, date } triés par date (la date sert au tri/affichage côté pages).
  const queuePhase = computed(() => {
    const q = {}
    for (const k of PHASE_KEYS) q[k] = { attente: [], cours: [] }
    const condFini = condComplet.value
    const condAny = ordresConditionnes.value
    const plAll = phasesLot.value
    for (const o of ofs()) {
      if ((!o.date_lancement && !o.date_fin_fabrication) || condFini.has(o.id)) continue
      if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
      const pl = plAll[o.id] || {}
      const stat = (nom) => (pl[phaseKey(nom)] || {}).statut
      const gammeB = (o.produits && Array.isArray(o.produits.gamme) && o.produits.gamme.length) ? o.produits.gamme : CANON_FAB
      const gamme = []; let _pk = null
      for (const _ph of gammeB) { const _k = phaseKey(_ph); if (_k && _k === _pk) continue; gamme.push(_ph); _pk = _k }
      // Règle : le lot est à sa phase la plus AVANCÉE déjà saisie (dans la gamme du produit).
      //   En cours -> en cours ; À faire -> en attente ; Terminé -> en attente de la phase suivante,
      //   et si c'était la dernière phase de fabrication -> conditionnement.
      if (Object.keys(pl).length === 0) {
        if (o.date_fin_fabrication) {
          (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ id: o.id, date: o.date_fin_fabrication })
        } else {
          const k0 = phaseKey(gamme[0])
          if (k0 && q[k0]) q[k0].attente.push({ id: o.id, date: o.date_lancement })
        }
        continue
      }
      let curIdx = -1
      for (let i = 0; i < gamme.length; i++) {
        const kk = phaseKey(gamme[i]); const rr = kk ? pl[kk] : null
        if (!rr || rr.statut !== 'Terminé') { curIdx = i; break }
      }
      if (curIdx < 0) {
        (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ id: o.id, date: o.date_fin_fabrication || o.date_lancement })
      } else {
        const kCur = phaseKey(gamme[curIdx]); const rCur = kCur ? pl[kCur] : null
        if (kCur && q[kCur]) {
          if (rCur && rCur.statut === 'En cours') q[kCur].cours.push({ id: o.id, date: (rCur && rCur.date) || o.date_lancement })
          else q[kCur].attente.push({ id: o.id, date: (rCur && rCur.date) || o.date_lancement })
        }
      }
    }
    const byDate = (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
    for (const k in q) { q[k].attente.sort(byDate); q[k].cours.sort(byDate) }
    return q
  })

  // Lots planifiés EN ATTENTE DE PESÉE : réception OF faite, pesée pas encore terminée
  const attentePesee = computed(() => {
    const cc = condComplet.value
    const plAll = phasesLot.value
    const res = []
    for (const o of ofs()) {
      if (!o.date_reception && !o.date_lancement) continue
      if (o.date_fin_fabrication) continue
      if (cc.has(o.id)) continue
      if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
      const pl = plAll[o.id] || {}
      if ((pl['pesee'] || {}).statut === 'Terminé') continue
      if (Object.keys(pl).some(k => k !== 'pesee')) continue   // a déjà une phase au-delà de la pesée -> plus en attente de pesée
      res.push(o.id)
    }
    return res
  })

  // Carte d'affichage + état (attente/cours) de chaque lot, aligné sur la file d'attente
  const lotEtape = computed(() => {
    const m = {}
    for (const id of attentePesee.value) m[id] = { carte: 'En attente de pesée', etat: 'attente' }
    const q = queuePhase.value
    for (const k in q) {
      if (k === 'pesee') continue
      const carte = CARTE_DE_KEY[k]
      if (!carte) continue
      for (const l of q[k].attente) { if (!m[l.id]) m[l.id] = { carte, etat: 'attente' } }
      for (const l of q[k].cours) { m[l.id] = { carte, etat: 'cours' } }
    }
    return m
  })

  return { ordresConditionnes, condTermine, condBoxParLot, condComplet, phasesLot, queuePhase, attentePesee, lotEtape }
}
