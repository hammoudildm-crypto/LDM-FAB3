<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'

const anneeCourante = new Date().getFullYear()
const moisCourant = new Date().getMonth()   // 0-11
function joursOuvresEntre(d1, d2) { let n = 0; const d = new Date(d1); d.setHours(0, 0, 0, 0); while (d <= d2) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; d.setDate(d.getDate() + 1) } return n }
const joursEcoules = Math.max(1, joursOuvresEntre(new Date(new Date().getFullYear(), 0, 1), new Date()))
const joursRestants = Math.max(1, joursOuvresEntre(new Date(), new Date(new Date().getFullYear(), 11, 31)))

// --- Régime de travail par équipement (défini sur Suivi de capacité, stocké localement) ---
const equipements = ref([])
let regimeEquip = {}, reqEquip = {}
try { regimeEquip = JSON.parse(localStorage.getItem('sc_reg_equip') || '{}') } catch (e) { /* ignore */ }
try { reqEquip = JSON.parse(localStorage.getItem('sc_req_we') || '{}') } catch (e) { /* ignore */ }
function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/s[ée]ch/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
const PHASE_TO_KEYS = {
  'Pesée': ['pesee'], 'Granulation et Séchage': ['granulation', 'sechage'], 'Mélange': ['melange'],
  'Compression': ['compression'], 'Remplissage Gélules': ['remplissage'], 'Pelliculage': ['pelliculage'],
  'Livraison Vrac': [], 'Conditionnement': ['conditionnement']
}
// Régime effectif d'une phase = le meilleur régime parmi ses équipements
function regimePhase(ph) {
  const keys = PHASE_TO_KEYS[ph] || []
  if (!keys.length) return { postes: 3, we: false }
  let maxPostes = 0, we = false, found = false
  for (const e of equipements.value) {
    const k = phaseDeType(e.type) || phaseDeType(e.nom) || phaseDeType(e.code)
    if (!k || !keys.includes(k)) continue
    found = true
    const r = regimeEquip[e.id]
    let postes = 3
    if (r === '4') { postes = 3; we = true }
    else if (r) postes = Number(r)
    if (reqEquip[e.id]) we = true
    if (postes > maxPostes) maxPostes = postes
  }
  return found ? { postes: maxPostes || 3, we } : { postes: 3, we: false }
}
function joursOuvresRegime(we, d1, d2) { let n = 0; const d = new Date(d1); d.setHours(0, 0, 0, 0); while (d <= d2) { const wd = d.getDay(); if (we || (wd !== 0 && wd !== 6)) n++; d.setDate(d.getDate() + 1) } return n }
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const anneeSel = ref(anneeCourante)

// Ateliers de fabrication (phases) + Conditionnement en dernière ligne
const PHASES = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Livraison Vrac', 'Conditionnement']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const moisActuelIdx = computed(() => anneeSel.value === anneeCourante ? new Date().getMonth() : -1)

const phases = ref([])
const conds = ref([])
const hist = ref([])
const ofs = ref([])
const histLots = ref([])   // historique des lots par phase (TDB importé)
const planRows = ref([])    // PDP : quantités planifiées par produit et mois
const erreur = ref('')
const chargement = ref(true)

async function fetchAllPaged(make) {
  const size = 1000
  let from = 0, all = []
  for (;;) {
    const r = await make().range(from, from + size - 1)
    if (r.error) return { error: r.error, data: all }
    all = all.concat(r.data || [])
    if (!r.data || r.data.length < size) break
    from += size
  }
  return { data: all, error: null }
}

async function charger() {
  erreur.value = ''
  chargement.value = true
  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_phase').eq('actif', true))
  if (rp.error) { erreur.value = rp.error.message; chargement.value = false; return }
  phases.value = rp.data || []
  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, date_conditionnement, date_fin').eq('actif', true))
  if (!rc.error) conds.value = rc.data || []
  const rh = await fetchAllPaged(() => supabase.from('production_historique').select('annee, mois, etape, nb_lots'))
  if (!rh.error) hist.value = rh.data || []
  const ro = await fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, date_fin_fabrication, produits(code_pf, designation)').eq('actif', true))
  if (!ro.error) ofs.value = ro.data || []
  const rhl = await fetchAllPaged(() => supabase.from('historique_lots_phases')
    .select('numero_lot, code_pf, designation, phase, date_fin'))
  if (!rhl.error) histLots.value = rhl.data || []
  const rpl = await fetchAllPaged(() => supabase.from('plan_production')
    .select('annee, mois, quantite_planifiee, produits(id, gamme, taille_lot)'))
  if (!rpl.error) planRows.value = rpl.data || []   // table absente -> on reste sur le temps réel
  const req = await fetchAllPaged(() => supabase.from('equipements').select('id, nom, type, code').eq('actif', true))
  if (!req.error) equipements.value = req.data || []
  chargement.value = false
}

// Matrice : { phase -> [12 compteurs] } = nb de LOTS DISTINCTS ayant terminé la phase ce mois-là
// Données LIVE (suivi fabrication) agrégées : étape -> année -> [12 mois]
const liveParAn = computed(() => {
  const m = {}, vus = {}
  const ajouter = (ph, ordreId, d) => {
    if (/^(granulation|s[ée]chage)$/i.test(String(ph).trim())) ph = 'Granulation et Séchage'
    if (!d || ordreId == null || !PHASES.includes(ph)) return
    const dt = new Date(d), y = dt.getFullYear(), mo = dt.getMonth()
    if (!m[ph]) m[ph] = {}
    if (!m[ph][y]) m[ph][y] = Array(12).fill(0)
    const cle = ph + '|' + y + '|' + mo
    if (!vus[cle]) vus[cle] = new Set()
    if (!vus[cle].has(ordreId)) { vus[cle].add(ordreId); m[ph][y][mo]++ }
  }
  for (const sp of phases.value) { if (sp.date_phase) ajouter(sp.phase, sp.ordre_id, sp.date_phase) }
  for (const c of conds.value) ajouter('Conditionnement', c.ordre_id, c.date_fin || c.date_conditionnement)
  for (const o of ofs.value) ajouter('Livraison Vrac', o.id, o.date_fin_fabrication)
  return m
})
// Données HISTORIQUE importées (table production_historique)
const histParAn = computed(() => {
  const m = {}
  const norm = (e) => /^(granulation|s[ée]chage)$/i.test(String(e).trim()) ? 'Granulation et Séchage' : e
  for (const r of hist.value) {
    const etape = norm(r.etape)
    if (!m[etape]) m[etape] = {}
    if (!m[etape][r.annee]) m[etape][r.annee] = Array(12).fill(0)
    if (r.mois >= 1 && r.mois <= 12) m[etape][r.annee][r.mois - 1] = Math.max(m[etape][r.annee][r.mois - 1] || 0, r.nb_lots)
  }
  return m
})
// Valeurs mensuelles d'une étape pour une année : historique si année passée, sinon temps réel
function valeurs(stage, year) {
  const h = (histParAn.value[stage] && histParAn.value[stage][year]) ? histParAn.value[stage][year] : null
  const l = (liveParAn.value[stage] && liveParAn.value[stage][year]) ? liveParAn.value[stage][year] : null
  if (year < anneeCourante) return h || Array(12).fill(0)                 // années passées : historique importé
  const hh = h || Array(12).fill(0), ll = l || Array(12).fill(0)
  return hh.map((v, i) => v > 0 ? v : ll[i])                              // année en cours : historique à ce jour, sinon temps réel
}
const matrice = computed(() => {
  const m = {}
  for (const ph of PHASES) m[ph] = valeurs(ph, anneeSel.value)
  return m
})

function totalLigne(ph) { return (matrice.value[ph] || []).reduce((s, x) => s + x, 0) }
const totalColonne = computed(() => {
  const t = Array(12).fill(0)
  for (const ph of PHASES) for (let i = 0; i < 12; i++) t[i] += matrice.value[ph][i]
  return t
})
const grandTotal = computed(() => totalColonne.value.reduce((s, x) => s + x, 0))
const maxCellule = computed(() => {
  let mx = 0
  for (const ph of PHASES) for (const n of matrice.value[ph]) if (n > mx) mx = n
  return mx
})
function intensite(n) {
  if (!n || !maxCellule.value) return 0
  return n / maxCellule.value
}

// KPIs
const atelierTop = computed(() => {
  let best = null, mx = -1
  for (const ph of PHASES) { const t = totalLigne(ph); if (t > mx) { mx = t; best = ph } }
  return mx > 0 ? { nom: best, n: mx } : null
})
const moisTop = computed(() => {
  let best = -1, mx = -1
  totalColonne.value.forEach((n, i) => { if (n > mx) { mx = n; best = i } })
  return mx > 0 ? { nom: MOIS_LONG[best], n: mx } : null
})

// --- Comparaison multi-années : une courbe par année, par atelier ---
const ANNEES_COMP = []
for (let a = anneeCourante - 3; a <= anneeCourante; a++) ANNEES_COMP.push(a)
const COULEURS_ANNEES = ['#cbd5e1', '#60a5fa', '#2dd4bf', '#0f766e']
const matriceMultiAn = computed(() => {
  const m = {}
  for (const ph of PHASES) { m[ph] = {}; for (const y of ANNEES_COMP) m[ph][y] = valeurs(ph, y) }
  return m
})
function seriesAtelier(ph) {
  return ANNEES_COMP.map((y, i) => ({ label: String(y), color: COULEURS_ANNEES[i] || '#0f766e', data: matriceMultiAn.value[ph][y] }))
}
function totalAtelierAnnee(ph, y) { return ((matriceMultiAn.value[ph] || {})[y] || []).reduce((s, x) => s + x, 0) }

// --- PRÉVISIONNEL DE FIN D'ANNÉE ---------------------------------
// Méthode : réalisé des mois clôturés, rapporté à l'année entière via le
// profil saisonnier moyen des années passées. Repli linéaire si pas d'historique.
function profilSaisonnier(ph) {
  const prof = Array(12).fill(0); let n = 0
  for (const y of ANNEES_COMP) {
    if (y >= anneeCourante) continue                    // années passées complètes
    const data = matriceMultiAn.value[ph][y]
    const tot = data.reduce((s, x) => s + x, 0)
    if (tot <= 0) continue
    for (let m = 0; m < 12; m++) prof[m] += data[m] / tot
    n++
  }
  return n ? prof.map(x => x / n) : null
}
// Plan (PDP) converti en LOTS par atelier : boîtes planifiées / taille de lot,
// réparties selon la gamme du produit (Vrac & Conditionnement = tous les produits).
const planParAtelier = computed(() => {
  const res = {}
  for (const ph of PHASES) res[ph] = 0
  const parProduit = {}
  for (const r of planRows.value) {
    if (Number(r.annee) !== anneeCourante) continue
    const pr = r.produits
    if (!pr || !pr.id) continue
    if (!parProduit[pr.id]) parProduit[pr.id] = { boites: 0, gamme: Array.isArray(pr.gamme) ? pr.gamme : [], taille: Number(pr.taille_lot || 0) }
    parProduit[pr.id].boites += Number(r.quantite_planifiee || 0)
  }
  for (const id in parProduit) {
    const o = parProduit[id]
    if (o.taille <= 0 || o.boites <= 0) continue
    const lots = o.boites / o.taille
    const gset = new Set(o.gamme.map(g => String(g).toLowerCase().trim()))
    for (const ph of PHASES) {
      const compte = (ph === 'Livraison Vrac' || ph === 'Conditionnement') ? true : gset.has(ph.toLowerCase())
      if (compte) res[ph] += lots
    }
  }
  for (const ph of PHASES) res[ph] = Math.round(res[ph])
  return res
})
function projectionAtelier(ph) {
  const data = (matriceMultiAn.value[ph] || {})[anneeCourante] || Array(12).fill(0)
  const mc = moisCourant
  const realiseTotal = data.reduce((s, x) => s + x, 0)      // réalisé (mois courant partiel inclus)
  let realiseClos = 0
  for (let m = 0; m < mc; m++) realiseClos += data[m]        // mois entièrement clôturés
  // A+2 : projection = rythme réalisé/jour ouvré étendu sur les jours ouvrés de l'année selon le régime
  const reg = regimePhase(ph)
  const jEc = Math.max(1, joursOuvresRegime(reg.we, new Date(anneeCourante, 0, 1), new Date()))
  const jTot = joursOuvresRegime(reg.we, new Date(anneeCourante, 0, 1), new Date(anneeCourante, 11, 31))
  let methode = 'regime'
  let projTotal = realiseTotal > 0 ? Math.round(realiseTotal / jEc * jTot) : 0
  projTotal = Math.max(projTotal, realiseTotal)  // jamais sous le réalisé
  const totN1 = totalAtelierAnnee(ph, anneeCourante - 1)
  const vsN1 = totN1 > 0 ? Math.round((projTotal / totN1 - 1) * 100) : null
  const plan = planParAtelier.value[ph] || 0
  const pctPlan = plan > 0 ? Math.round((projTotal / plan) * 100) : null
  const reste = plan > 0 ? Math.max(0, plan - realiseTotal) : Math.max(0, projTotal - realiseTotal)
  const moisEcoules = mc + 1
  const moisRestants = Math.max(1, 12 - mc - 1)
  return { ph, realise: realiseTotal, projTotal, reste, methode, vsN1, plan, pctPlan,
    realMens: realiseTotal / moisEcoules, realJour: realiseTotal / joursEcoules,
    resteMens: reste / moisRestants, resteJour: reste / joursRestants }
}
const projectionsTable = computed(() => {
  return PHASES.map(ph => projectionAtelier(ph))
})
const projTotaux = computed(() => {
  const rows = projectionsTable.value
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0)
  const realise = sum('realise'), projTotal = sum('projTotal'), plan = sum('plan'), reste = sum('reste')
  let totN1 = 0
  for (const r of rows) totN1 += totalAtelierAnnee(r.ph, anneeCourante - 1)
  return {
    realise, realMens: sum('realMens'), realJour: sum('realJour'), projTotal, plan,
    pctPlan: plan > 0 ? Math.round(projTotal / plan * 100) : null,
    reste, resteMens: sum('resteMens'), resteJour: sum('resteJour'),
    vsN1: totN1 > 0 ? Math.round((projTotal / totN1 - 1) * 100) : null
  }
})
const projKpis = computed(() => {
  const rows = projectionsTable.value.filter(r => r.plan > 0)
  const atteignent = rows.filter(r => r.pctPlan != null && r.pctPlan >= 100).length
  let pire = null
  for (const r of rows) { if (r.pctPlan == null) continue; if (!pire || r.pctPlan < pire.pctPlan) pire = r }
  return { avancement: projTotaux.value.pctPlan, atteignent, total: rows.length, pire, vsN1: projTotaux.value.vsN1 }
})
const atelierSel = ref('Compression')
const anneesActives = ref(new Set(ANNEES_COMP))
function toggleAnnee(y) {
  const s = new Set(anneesActives.value)
  if (s.has(y)) s.delete(y); else s.add(y)
  anneesActives.value = s
}
const montrerTendance = ref(false)
// Droite de tendance (régression linéaire) sur les nMois premiers mois.
function tendance(data, nMois) {
  const out = Array(12).fill(null)
  const n = Math.max(0, Math.min(12, nMois))
  if (n < 2) return out
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let m = 0; m < n; m++) { const y = Number(data[m] || 0); sx += m; sy += y; sxx += m * m; sxy += m * y }
  const denom = n * sxx - sx * sx
  if (denom === 0) return out
  const b = (n * sxy - sx * sy) / denom
  const a = (sy - b * sx) / n
  for (let m = 0; m < n; m++) out[m] = Math.max(0, Math.round((a + b * m) * 10) / 10)
  return out
}
const seriesChart = computed(() => {
  const ans = ANNEES_COMP.filter(y => anneesActives.value.has(y))
  const base = ans.map(y => ({
    label: String(y), color: COULEURS_ANNEES[ANNEES_COMP.indexOf(y)] || '#0f766e',
    data: matriceMultiAn.value[atelierSel.value][y]
  }))
  if (!montrerTendance.value) return base
  const trends = ans.map(y => ({
    label: y + ' · tendance',
    color: COULEURS_ANNEES[ANNEES_COMP.indexOf(y)] || '#0f766e',
    data: tendance(matriceMultiAn.value[atelierSel.value][y], y >= anneeCourante ? moisCourant : 12)
  }))
  return [...base, ...trends]
})

// --- Clic sur une barre : les lots de ce mois / cette année pour l'atelier ---
const anneesChart = computed(() => ANNEES_COMP.filter(y => anneesActives.value.has(y)))
const ofById = computed(() => { const m = {}; for (const o of ofs.value) m[o.id] = o; return m })
const modalPA = ref(null)   // { mois, annee }
function ouvrirBarrePA(i, si) {
  const ys = anneesChart.value
  if (!ys.length) return
  const y = ys[si == null ? ys.length - 1 : si]
  if (y == null) return
  modalPA.value = { mois: i, annee: y }
}
// Lots du mois : TEMPS RÉEL (base) + HISTORIQUE importé (TDB), fusionnés par n° de lot.
//  - Livraison Vrac   -> date de fin de FABRICATION (ordres_fabrication)
//  - Conditionnement  -> date de fin de CONDITIONNEMENT
//  - autres phases    -> suivi_phases (temps réel) + historique_lots_phases (TDB)
const lotsMoisPA = computed(() => {
  const m = modalPA.value
  if (!m) return []
  const ph = atelierSel.value, y = m.annee
  const dansMois = (d) => { if (!d) return false; const dt = new Date(d); return dt.getFullYear() === y && dt.getMonth() === m.mois }
  const parLot = new Map()
  const push = (lot, code, desig, src) => {
    if (lot == null) return
    const k = String(lot).trim()
    if (!k || parLot.has(k)) return
    parLot.set(k, { lot: k, code: code || '—', desig: desig || '', src })
  }
  const pushOf = (id, src) => {
    const o = ofById.value[id]
    if (!o) return
    push(o.numero_lot, o.produits ? o.produits.code_pf : null, o.produits ? o.produits.designation : null, src)
  }
  if (ph === 'Conditionnement') {
    for (const c of conds.value) if (dansMois(c.date_fin || c.date_conditionnement)) pushOf(c.ordre_id, 'live')
  } else if (ph === 'Livraison Vrac') {
    for (const o of ofs.value) if (dansMois(o.date_fin_fabrication)) pushOf(o.id, 'live')
  } else {
    for (const sp of phases.value) if (sp.phase === ph && dansMois(sp.date_phase)) pushOf(sp.ordre_id, 'live')
    for (const h of histLots.value) if (h.phase === ph && dansMois(h.date_fin)) push(h.numero_lot, h.code_pf, h.designation, 'hist')
  }
  return [...parLot.values()].sort((a, b) => String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true }))
})
const valeurBarrePA = computed(() => {
  const m = modalPA.value; if (!m) return 0
  const d = matriceMultiAn.value[atelierSel.value]
  return d && d[m.annee] ? d[m.annee][m.mois] : 0
})
// La valeur affichée vient-elle de l'historique importé (compteurs seuls, sans lots) ?
const sourceHistPA = computed(() => {
  const m = modalPA.value; if (!m) return false
  if (m.annee < anneeCourante) return true
  const h = (histParAn.value[atelierSel.value] || {})[m.annee]
  return !!(h && h[m.mois] > 0)
})

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['Atelier', ...MOIS, 'Total']
  const lignes = PHASES.map(ph => [ph, ...matrice.value[ph], totalLigne(ph)])
  lignes.push(['Total', ...totalColonne.value, grandTotal.value])
  telechargerCSV('production_par_atelier_' + anneeSel.value + '.csv', entetes, lignes)
}

onMounted(charger)
</script>

<template>
  <div class="pa-page">
    <PageHeader title="Production par atelier" tone="teal" />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.activity"></svg></span><div class="kpi-val accent">{{ fmt(grandTotal) }}</div></div><div class="kpi-lbl">Étapes terminées en {{ anneeSel }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.flask"></svg></span><div class="kpi-val">{{ atelierTop ? atelierTop.nom : '—' }}</div></div><div class="kpi-lbl">Atelier le plus actif<span v-if="atelierTop"> ({{ atelierTop.n }})</span></div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.calendar"></svg></span><div class="kpi-val">{{ moisTop ? moisTop.nom : '—' }}</div></div><div class="kpi-lbl">Mois le plus actif<span v-if="moisTop"> ({{ moisTop.n }})</span></div></div>
      </div>

      <div class="pa-layout">
      <aside class="pa-side">
        <div class="side-sec">
          <div class="side-lbl">Année</div>
          <select class="side-select" v-model.number="anneeSel">
            <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Atelier</div>
          <div class="pa-atelier-tg">
            <button v-for="ph in PHASES" :key="ph" type="button" :class="{ on: atelierSel === ph }" @click="atelierSel = ph">{{ ph }}</button>
          </div>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Années (comparaison)</div>
          <div class="side-annees2">
            <button v-for="(y, i) in ANNEES_COMP" :key="y" type="button" class="an-btn" :class="{ on: anneesActives.has(y) }" @click="toggleAnnee(y)"><span class="an-dot" :style="{ background: COULEURS_ANNEES[i] }"></span>{{ y }}</button>
          </div>
        </div>
      </aside>
        <div class="pa-content">
      <section class="card">
        <div class="card-head"><h2 class="card-title">Comparaison mensuelle par atelier</h2></div>
        <div class="chart-titre">{{ atelierSel }} — lots terminés par mois</div>
        <div class="chart-wrap">
          <MiniChart v-if="seriesChart.length" :series="seriesChart" :labels="MOIS" :show-switch="true" :show-values="true" clickable @pick="ouvrirBarrePA" />
          <p v-else class="empty">Sélectionne au moins une année pour afficher le graphe.</p>
        </div>
      </section>
        </div>
      </div>

      <div class="pa-row2">
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Lots fabriqués par atelier — {{ anneeSel }}</h2>
          <button class="btn-exp" @click="exporterCSV" :disabled="!grandTotal">Exporter CSV</button>
        </div>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th class="at-col">Atelier</th>
                <th v-for="(m, i) in MOIS" :key="m" class="mois-col" :class="{ 'mois-actuel-col': i === moisActuelIdx }" :title="m">{{ m.charAt(0) }}</th>
                <th class="tot-col">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ph in PHASES" :key="ph" :class="{ cond: ph === 'Conditionnement', 'at-row-active': atelierSel === ph }" @click="atelierSel = ph" :title="'Afficher ' + ph + ' dans le graphe'">
                <td class="at-name">{{ ph }}</td>
                <td v-for="(n, i) in matrice[ph]" :key="i" class="num" :class="{ 'mois-actuel-col': i === moisActuelIdx }"
                    :style="n ? { background: 'rgba(15,118,110,' + (0.08 + intensite(n) * 0.55) + ')', color: intensite(n) > 0.6 ? '#fff' : '#0f5c54' } : null">
                  {{ n || '·' }}
                </td>
                <td class="num strong">{{ totalLigne(ph) }}</td>
              </tr>
              <tr v-if="!grandTotal"><td :colspan="14" class="empty">Aucune étape terminée en {{ anneeSel }}. Les lots apparaissent ici dès qu'une phase est saisie « Terminé » (avec sa date) dans Suivi des phases.</td></tr>
            </tbody>
            <tfoot v-if="grandTotal">
              <tr>
                <td class="strong">Total</td>
                <td v-for="(n, i) in totalColonne" :key="i" class="num strong" :class="{ 'mois-actuel-col': i === moisActuelIdx }">{{ n || '·' }}</td>
                <td class="num strong accent">{{ grandTotal }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    <section v-if="projectionsTable.length" class="proj-card">
      <div class="proj-head">
        <h2 class="proj-title">Prévisionnel de fin d'année — {{ anneeCourante }}</h2>
        <span class="proj-sub">réalisé à ce jour, projeté au 31/12</span>
      </div>
      <div class="proj-scroll">
        <table class="proj-table">
          <thead>
            <tr>
              <th>Atelier</th>
              <th class="ta-r">Réalisé à ce jour</th>
              <th class="ta-r">Réal. /mois</th>
              <th class="ta-r">Réal. /jour</th>
              <th class="ta-r">Projection {{ anneeCourante }}</th>
              <th class="ta-r">Plan {{ anneeCourante }}</th>
              <th class="ta-r">% du plan</th>
              <th class="ta-r">Reste / plan</th>
              <th class="ta-r">Reste /mois</th>
              <th class="ta-r">Reste /jour</th>
              <th class="ta-r">vs {{ anneeCourante - 1 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in projectionsTable" :key="r.ph" :class="{ 'proj-on': r.ph === atelierSel }">
              <td class="proj-at">{{ r.ph }}<span v-if="r.methode === 'lineaire'" class="proj-star" title="Sans historique saisonnier : projection linéaire">*</span></td>
              <td class="ta-r">{{ fmt(r.realise) }}</td>
              <td class="ta-r">{{ fmt(Math.round(r.realMens)) }}</td>
              <td class="ta-r">{{ fmt(Math.round(r.realJour)) }}</td>
              <td class="ta-r proj-val">{{ fmt(r.projTotal) }}</td>
              <td class="ta-r">{{ r.plan ? fmt(r.plan) : '—' }}</td>
              <td class="ta-r" :class="r.pctPlan == null ? '' : (r.pctPlan >= 100 ? 'proj-up' : (r.pctPlan >= 80 ? 'proj-warn' : 'proj-down'))">{{ r.pctPlan != null ? r.pctPlan + ' %' : '—' }}</td>
              <td class="ta-r proj-reste">{{ fmt(r.reste) }}</td>
              <td class="ta-r">{{ fmt(Math.round(r.resteMens)) }}</td>
              <td class="ta-r">{{ fmt(Math.round(r.resteJour)) }}</td>
              <td class="ta-r" :class="r.vsN1 == null ? '' : (r.vsN1 >= 0 ? 'proj-up' : 'proj-down')">
                <template v-if="r.vsN1 != null">{{ r.vsN1 >= 0 ? '+' : '' }}{{ r.vsN1 }} %</template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="proj-total">
              <td class="proj-at">Total</td>
              <td class="ta-r">{{ fmt(projTotaux.realise) }}</td>
              <td class="ta-r">{{ fmt(Math.round(projTotaux.realMens)) }}</td>
              <td class="ta-r">{{ fmt(Math.round(projTotaux.realJour)) }}</td>
              <td class="ta-r proj-val">{{ fmt(projTotaux.projTotal) }}</td>
              <td class="ta-r">{{ projTotaux.plan ? fmt(projTotaux.plan) : '—' }}</td>
              <td class="ta-r" :class="projTotaux.pctPlan == null ? '' : (projTotaux.pctPlan >= 100 ? 'proj-up' : (projTotaux.pctPlan >= 80 ? 'proj-warn' : 'proj-down'))">{{ projTotaux.pctPlan != null ? projTotaux.pctPlan + ' %' : '—' }}</td>
              <td class="ta-r proj-reste">{{ fmt(projTotaux.reste) }}</td>
              <td class="ta-r">{{ fmt(Math.round(projTotaux.resteMens)) }}</td>
              <td class="ta-r">{{ fmt(Math.round(projTotaux.resteJour)) }}</td>
              <td class="ta-r" :class="projTotaux.vsN1 == null ? '' : (projTotaux.vsN1 >= 0 ? 'proj-up' : 'proj-down')"><template v-if="projTotaux.vsN1 != null">{{ projTotaux.vsN1 >= 0 ? '+' : '' }}{{ projTotaux.vsN1 }} %</template><template v-else>—</template></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="proj-kpis">
        <div class="proj-kpi"><div class="proj-kpi-v" :class="projKpis.avancement == null ? '' : (projKpis.avancement >= 100 ? 'pk-up' : (projKpis.avancement >= 80 ? 'pk-warn' : 'pk-down'))">{{ projKpis.avancement != null ? projKpis.avancement + ' %' : '—' }}</div><div class="proj-kpi-l">Avancement du plan · projeté fin {{ anneeCourante }}</div></div>
        <div class="proj-kpi"><div class="proj-kpi-v">{{ projKpis.atteignent }}/{{ projKpis.total }}</div><div class="proj-kpi-l">Ateliers atteignant leur plan</div></div>
        <div class="proj-kpi"><div class="proj-kpi-v" :class="projKpis.pire && projKpis.pire.pctPlan < 100 ? 'pk-down' : 'pk-up'">{{ projKpis.pire ? projKpis.pire.pctPlan + ' %' : '—' }}</div><div class="proj-kpi-l">Plus en retard : {{ projKpis.pire ? projKpis.pire.ph : '—' }}</div></div>
        <div class="proj-kpi"><div class="proj-kpi-v" :class="projKpis.vsN1 == null ? '' : (projKpis.vsN1 >= 0 ? 'pk-up' : 'pk-down')">{{ projKpis.vsN1 != null ? (projKpis.vsN1 >= 0 ? '+' : '') + projKpis.vsN1 + ' %' : '—' }}</div><div class="proj-kpi-l">Projection vs {{ anneeCourante - 1 }}</div></div>
      </div>
    </section>
      </div>

            <p class="hint">Chaque cellule = nombre de <strong>lots distincts</strong> ayant <strong>terminé</strong> l'étape ce mois-là. Les <strong>années passées</strong> proviennent de l'<strong>historique importé</strong> (TDB PROD) ; l'<strong>année en cours</strong> est calculée en <strong>temps réel</strong> depuis Suivi des phases. Un même lot compte une fois par atelier.</p>
    </template>

    <div v-if="modalPA" class="modal-overlay" @click="modalPA = null">
      <div class="pa-modal" @click.stop>
        <div class="pa-md-head">
          <h3>{{ atelierSel }} — {{ MOIS_LONG[modalPA.mois] }} {{ modalPA.annee }}</h3>
          <button class="pa-md-x" @click="modalPA = null">✕</button>
        </div>
        <div class="pa-md-sub">{{ fmt(valeurBarrePA) }} lot(s) terminé(s)<span v-if="lotsMoisPA.length"> · {{ lotsMoisPA.length }} détaillé(s)</span></div>
        <div class="pa-md-body">
          <p v-if="sourceHistPA && !lotsMoisPA.length" class="pa-note">Valeur issue de l'<strong>historique importé</strong> — le détail des lots n'est pas disponible pour ce mois.</p>
          <div v-else-if="!lotsMoisPA.length" class="empty">Aucun lot pour ce mois.</div>
          <table v-else class="pa-table">
            <tbody>
              <tr v-for="l in lotsMoisPA" :key="l.id">
                <td class="pa-lot">{{ l.lot }}</td>
                <td class="pa-code">{{ l.code }}</td>
                <td class="pa-des">{{ l.desig }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="sourceHistPA && lotsMoisPA.length" class="pa-note">Note : la valeur du graphe vient de l'<strong>historique importé</strong> ; la liste ci-dessus est le détail <strong>temps réel</strong> — les deux peuvent différer.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pa-page { color: #1b2733; }
.pa-layout { display: flex; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.pa-side { flex: 0 0 275px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; align-self: stretch; overflow: hidden; }
.pa-content { flex: 1; min-width: 0; }
.pa-row2 { display: flex; gap: 10px; align-items: stretch; margin-bottom: 8px; }
.pa-row2 > .card, .pa-row2 > .proj-card { flex: 1 1 0; min-width: 0; margin-bottom: 0; display: flex; flex-direction: column; }
@media (max-width: 1100px) { .pa-row2 { flex-direction: column; } .pa-row2 > .card, .pa-row2 > .proj-card { width: 100%; } }
.side-sec { padding: 10px 12px; border-bottom: 1px solid #eef2f6; }
.side-sec:last-child { border-bottom: none; }
.side-lbl { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; margin-bottom: 7px; }
.side-tg { display: flex; flex-direction: column; gap: 5px; }
.side-tg button { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; color: #64748b; padding: 6px 10px; cursor: pointer; text-align: left; }
.side-tg button:hover { background: #eef2f7; }
.side-tg button.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.side-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.side-2col button { font-size: 10.5px; padding: 6px 6px; text-align: center; white-space: normal; line-height: 1.15; }
.side-select { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; color: #1b2733; background: #fff; box-sizing: border-box; cursor: pointer; }
.side-annees2 { display: flex; flex-wrap: nowrap; gap: 3px; }
.side-annees2 .an-btn { display: inline-flex; align-items: center; justify-content: center; gap: 3px; font: inherit; font-size: 10px; font-weight: 600; padding: 5px 3px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; color: #475569; cursor: pointer; flex: 1; min-width: 0; }
.side-annees2 .an-btn.on { border-color: #0f766e; background: #f0fdfa; color: #0f766e; }
.side-annees2 .an-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.side-annees { flex-direction: row; flex-wrap: wrap; }
.side-annees button { flex: 1; min-width: 44px; text-align: center; padding: 7px 4px; }
@media (max-width: 820px) { .pa-layout { flex-direction: column; } .pa-side { flex-basis: auto; width: 100%; position: static; } .side-tg { flex-direction: row; flex-wrap: wrap; } .side-tg button { flex: 1; } }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 10px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 26px; height: 26px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 15px; height: 15px; }
.kpi-val { font-size: 14px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 10.5px; color: #64748b; margin-top: 3px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 10px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-title { margin: 0; font-size: 13px; }
.btn-exp { margin-left: auto; font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 8.5px; table-layout: fixed; }
table.grid th { text-align: center; font-size: 7px; text-transform: uppercase; letter-spacing: .02em; color: #64748b; padding: 1px 2px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid th.at-col { text-align: left; }
table.grid td { padding: 1px 2px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.at-col { min-width: 60px; width: 60px; }
.mois-col { width: 12px; }
.tot-col { width: 32px; }
.at-name { font-weight: 600; color: #1b2733; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.num { text-align: center; font-variant-numeric: tabular-nums; border-radius: 6px; }
.num.strong { font-weight: 700; }
.accent { color: #0f766e; }
tr.cond .at-name { color: #0f766e; }
tr.cond td { border-top: 1px solid #cbd5e1; }
table.grid tfoot td { border-top: 2px solid #e2e8f0; border-bottom: 0; background: #f8fafc; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; white-space: normal; }
.hint { color: #64748b; font-size: 10px; margin-top: 4px; }
.filtres { display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; }
.filtre-groupe { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.filtre-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding-top: 8px; min-width: 58px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 7px; }
.btn-row button { font-size: 13px; font-weight: 600; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #475569; cursor: pointer; transition: all .15s ease; display: inline-flex; align-items: center; gap: 6px; }
.btn-row button:hover { border-color: #0f766e; color: #0f766e; }
.btn-row button.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.an-dot { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
.btn-row button.an-btn.on .an-dot { background: #fff; }
.chart-titre { font-size: 12px; font-weight: 700; color: #0f766e; margin: 2px 0 1px; }
.chart-wrap { margin-top: 2px; }

@media (max-width: 700px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.pa-modal { background: #fff; border-radius: 14px; width: min(600px, 100%); max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.pa-md-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 10px; }
.pa-md-head h3 { margin: 0; font-size: 15.5px; }
.pa-md-x { background: none; border: 0; font-size: 17px; color: #94a3b8; cursor: pointer; }
.pa-md-sub { padding: 8px 18px; font-size: 12.5px; color: #64748b; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }
.pa-md-body { overflow-y: auto; padding: 6px 18px 16px; }
.pa-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.pa-table td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
.pa-lot { font-family: ui-monospace, monospace; font-weight: 700; white-space: nowrap; }
.pa-code { font-family: ui-monospace, monospace; font-weight: 600; color: #0f766e; white-space: nowrap; }
.pa-des { color: #475569; }
.pa-note { font-size: 12.5px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 10px; border-radius: 7px; margin: 10px 0 0; }
.proj-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 10px; margin-top: 0; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
.proj-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.proj-title { margin: 0; font-size: 13px; color: #161c2e; }
.proj-sub { font-size: 12.5px; color: #64748b; }
.proj-scroll { overflow-x: auto; }
.proj-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.proj-table th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .02em; color: #64748b; padding: 3px 5px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.proj-table td { padding: 2px 5px; border-bottom: 1px solid #f1f5f9; }
.proj-table .ta-r { text-align: right; font-variant-numeric: tabular-nums; }
.proj-at { font-weight: 600; color: #1a2233; font-size: 11px; white-space: nowrap; }
.proj-val { font-weight: 800; color: #0f766e; }
.proj-reste { color: #475569; }
.proj-on { background: #f0fdfa; }
.proj-on .proj-at { color: #0f766e; }
.proj-up { color: #047857; font-weight: 700; }
.proj-down { color: #b91c1c; font-weight: 700; }
.proj-warn { color: #b45309; font-weight: 700; }
.proj-star { color: #b45309; font-weight: 800; cursor: help; }
.proj-note { font-size: 12px; color: #64748b; line-height: 1.5; margin: 12px 0 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 9px 12px; }
.pa-atelier-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.pa-atelier-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #64748b; white-space: nowrap; }
.pa-atelier-tg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.pa-atelier-tg button { border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 6px 4px; font: inherit; font-size: 10px; font-weight: 600; color: #64748b; cursor: pointer; white-space: normal; text-align: center; line-height: 1.2; transition: all .12s; }
.pa-atelier-tg button:hover { border-color: #99f6e4; background: #f0fdfa; }
.pa-atelier-tg button.on { background: #0f766e; border-color: #0f766e; color: #fff; box-shadow: 0 2px 6px rgba(15,118,110,.28); }

/* ===== Design moderne ===== */
.kpi { border-radius: 13px; border-top: 3px solid #14b8a6; box-shadow: 0 4px 14px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.04); background: linear-gradient(158deg, #ffffff, #fbfcff); transition: box-shadow .2s ease, transform .2s ease; padding: 10px 13px; }
.kpi:hover { box-shadow: 0 12px 26px rgba(16,24,40,.12); transform: translateY(-2px); }
.kpi-val { font-size: 18px; font-variant-numeric: tabular-nums; }
.kpi-ic { border-radius: 11px !important; box-shadow: 0 4px 10px rgba(16,24,40,.14) !important; }
.card { border-radius: 14px; box-shadow: 0 4px 14px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.04); }
.card-title { position: relative; padding-left: 13px; font-weight: 800; }
.card-title::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; border-radius: 2px; background: linear-gradient(180deg, #2dd4bf, #0d9488); }
.pa-side { border-radius: 14px; box-shadow: 0 4px 14px rgba(16,24,40,.05); }
table.grid tbody tr:nth-child(even) td { background: #fafbfe; }
table.grid tbody tr:hover td { background: #eef6f5; }
.pa-atelier-tg button.on, .side-sec button.on { box-shadow: 0 2px 8px rgba(15,118,110,.25); }
.pa-page { zoom: 0.65; }
.pa-row2 > .card { flex: 1 1 0; }
.pa-row2 > .proj-card { flex: 1.3 1 0; }
.pa-row2 > .card table.grid tbody tr { cursor: pointer; }
.at-row-active .at-name { color: #0f766e; font-weight: 800; box-shadow: inset 3px 0 0 #0f766e; }
.at-row-active td { background: #f0fdfa !important; }

/* ===== Alignement parfait des deux tableaux ===== */
.pa-row2 .card-head, .pa-row2 .proj-head { height: 34px; min-height: 34px; max-height: 34px; box-sizing: border-box; margin-bottom: 10px; align-items: center; overflow: hidden; flex-wrap: nowrap; }
.pa-row2 table.grid thead, .pa-row2 .proj-table thead { display: table-header-group; }
.pa-row2 table.grid thead th, .pa-row2 .proj-table thead th { height: 34px; box-sizing: border-box; vertical-align: bottom; padding-top: 0; padding-bottom: 5px; line-height: 1.1; }
.pa-row2 table.grid tbody tr, .pa-row2 .proj-table tbody tr { height: 23px; }
.pa-row2 table.grid tbody td, .pa-row2 .proj-table tbody td { height: 23px; max-height: 23px; box-sizing: border-box; padding-top: 0; padding-bottom: 0; line-height: 23px; vertical-align: middle; white-space: nowrap; overflow: hidden; }
.pa-row2 table.grid tfoot td, .pa-row2 .proj-table tfoot td { height: 23px; box-sizing: border-box; padding-top: 0; padding-bottom: 0; line-height: 23px; }
th.mois-actuel-col { background: #fef3c7; color: #b45309; font-weight: 800; }
td.mois-actuel-col { box-shadow: inset 2px 0 0 #f59e0b, inset -2px 0 0 #f59e0b; }
tbody tr:first-child td.mois-actuel-col { box-shadow: inset 2px 0 0 #f59e0b, inset -2px 0 0 #f59e0b, inset 0 2px 0 #f59e0b; }

/* ===== Alignement forcé des lignes (identiques dans les 2 tableaux) ===== */
.pa-row2 table.grid tbody tr, .pa-row2 .proj-table tbody tr { height: 22px !important; }
.pa-row2 table.grid tbody td, .pa-row2 .proj-table tbody td { height: 22px !important; line-height: 22px !important; padding-top: 0 !important; padding-bottom: 0 !important; vertical-align: middle !important; }
.pa-row2 .at-name { display: inline-block !important; vertical-align: middle !important; line-height: 22px !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pa-row2 .num, .pa-row2 .proj-at, .pa-row2 table.grid tbody td *, .pa-row2 .proj-table tbody td * { line-height: 22px !important; }
.proj-total td { font-weight: 800; border-top: 2px solid #cbd5e1; background: #f1f5f9; }
.proj-total .proj-val { color: #0f766e; }
.proj-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
.proj-kpi { background: linear-gradient(158deg, #ffffff, #f8fafc); border: 1px solid #eef1f6; border-radius: 11px; padding: 9px 11px; box-shadow: 0 2px 8px rgba(16,24,40,.05); }
.proj-kpi-v { font-size: 19px; font-weight: 800; color: #1e293b; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.proj-kpi-l { font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px; }
.pk-up { color: #15803d; } .pk-warn { color: #b45309; } .pk-down { color: #dc2626; }
</style>
