<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'
import { LOGO_HTML } from '../logo'

// Modèles téléchargeables (hébergés dans public/modeles/)
const MODELES_BASE = import.meta.env.BASE_URL + 'modeles/'
const urlModeleXlsx = MODELES_BASE + 'Template_TRS_par_poste_LDM.xlsx'
const urlFicheA4 = MODELES_BASE + 'Fiche_releve_TRS_poste_A4.pdf'

const postes = ref([])
const cadences = ref([])
const chargement = ref(true)
const msg = ref('')

const now = new Date()
const du = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const au = ref(now.toISOString().slice(0, 10))

// [cle, colonne, libellé, couleur, groupe] — planifié (organisationnel) vs subi (non planifié)
const MOTIFS = [
  ['format', 'arret_format_min', 'Changement de format', '#f59e0b', 'plan'],
  ['vdlg', 'arret_vdlg_min', 'VDLG', '#6366f1', 'plan'],
  ['vdlp', 'arret_vdlp_min', 'VDLP', '#818cf8', 'plan'],
  ['nettoyage', 'arret_nettoyage_min', 'Nettoyage (hors VDL)', '#0f766e', 'plan'],
  ['maintenance', 'arret_maintenance_min', 'Maintenance préventive', '#0891b2', 'plan'],
  ['panne', 'arret_panne_min', 'Panne', '#ef4444', 'subi'],
  ['attente', 'arret_attente_min', 'Attente', '#94a3b8', 'subi'],
  ['reglage', 'arret_reglage_min', 'Réglage (en cours)', '#8b5cf6', 'subi'],
  ['autre', 'arret_autre_min', 'Autre', '#cbd5e1', 'subi']
]
const CLES_PLAN = MOTIFS.filter(m => m[4] === 'plan').map(m => m[0])

async function charger() {
  chargement.value = true; msg.value = ''
  const r = await supabase.from('trs_postes')
    .select('*, equipements(code, nom), produits(code_pf, designation)')
    .eq('actif', true).gte('date', du.value).lte('date', au.value)
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  postes.value = r.data || []
  const rc = await supabase.from('cadences_produit').select('*')
  if (!rc.error) cadences.value = rc.data || []
  const ro = await supabase.from('equipements').select('id, objectif_trs').eq('actif', true)
  if (!ro.error) { colObjectif.value = true; const m = {}; for (const e of ro.data || []) m[e.id] = e.objectif_trs; objectifs.value = m }
  else colObjectif.value = false
  chargement.value = false
}
onMounted(charger)

// Objectifs / cibles de TRS
const peutEditer = inject('peutEditer', ref(false))
const objectifs = ref({})           // equipId -> objectif_trs (fraction) depuis la base
const colObjectif = ref(false)      // vrai une fois la migration 012 exécutée
const OBJ_DEF_KEY = 'ldmfab-trs-objectif-defaut'
const objectifDefaut = ref(0.75)    // cible par défaut du site (modifiable, mémorisée)
try { const v = localStorage.getItem(OBJ_DEF_KEY); if (v != null && v !== '') objectifDefaut.value = Number(v) } catch (e) { /* ignore */ }
function setObjectifDefaut(pct) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0)) / 100
  objectifDefaut.value = v
  try { localStorage.setItem(OBJ_DEF_KEY, String(v)) } catch (e) { /* ignore */ }
}
const objectifDe = (id) => { const o = objectifs.value[id]; return (o != null && o > 0) ? Number(o) : objectifDefaut.value }
async function majObjectif(id, pct) {
  if (!colObjectif.value) return
  const val = (pct === '' || pct == null) ? null : Math.max(0, Math.min(100, Number(pct))) / 100
  const r = await supabase.from('equipements').update({ objectif_trs: val }).eq('id', id)
  if (!r.error) objectifs.value = { ...objectifs.value, [id]: val }
}

function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  if (!c || c.cadence_nominale == null) return { value: 0, mode: 'debit' }
  const v = Number(c.cadence_nominale)
  // mode 'temps' = cadence en temps par lot (h/lot) -> débit équivalent (lots/h = 1 / temps) ; formule débit inchangée
  if (c.mode === 'temps') return { value: v > 0 ? 60 / v : 0, mode: 'debit' }   // v = min/lot -> débit (lots/h = 60 / temps)
  return { value: v, mode: c.mode || 'debit' }
}

const equipFiltre = ref('')
const moisVisible = ref(true)
const equipList = computed(() => {
  const m = {}
  for (const s of postes.value) if (s.equipements && !m[s.equipement_id]) m[s.equipement_id] = { id: s.equipement_id, code: s.equipements.code, nom: s.equipements.nom }
  return Object.values(m).sort((a, b) => String(a.code).localeCompare(String(b.code)))
})
const equipFiltreCode = computed(() => { const e = equipList.value.find(e => e.id === equipFiltre.value); return e ? e.code : '' })

// Sélecteur produit recherchable (barre de recherche + liste filtrée) : restreint
// toute l'analyse TRS au produit choisi, pour la démontrer produit par produit.
const produitFiltre = ref('')
const rechercheProd = ref('')
const prodOuvert = ref(false)
const normP = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const produitList = computed(() => {
  const m = {}
  for (const s of postes.value) if (s.produit_id && !m[s.produit_id]) m[s.produit_id] = { id: s.produit_id, code: s.produits ? s.produits.code_pf : '?', desig: s.produits ? (s.produits.designation || '') : '' }
  return Object.values(m).sort((a, b) => String(a.code).localeCompare(String(b.code)))
})
const produitListFiltree = computed(() => {
  const q = normP(rechercheProd.value).trim()
  if (!q) return produitList.value
  return produitList.value.filter(p => normP(p.code + ' ' + p.desig).includes(q))
})
const produitFiltreLabel = computed(() => { const p = produitList.value.find(p => p.id === produitFiltre.value); return p ? (p.code + (p.desig ? ' — ' + p.desig : '')) : '' })
function selectProduit(p) { produitFiltre.value = p.id; rechercheProd.value = p.code + (p.desig ? ' — ' + p.desig : ''); prodOuvert.value = false }
function clearProduit() { produitFiltre.value = ''; rechercheProd.value = ''; prodOuvert.value = false }

const postesFiltres = computed(() => postes.value.filter(s =>
  (!equipFiltre.value || s.equipement_id === equipFiltre.value) &&
  (!produitFiltre.value || s.produit_id === produitFiltre.value)
))
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const trsParMois = computed(() => {
  const parM = {}
  for (const s of postesFiltres.value) {
    const mo = new Date(s.date).getMonth()
    if (!parM[mo]) parM[mo] = { ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0 }
    const a = parM[mo]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const m of MOTIFS) arr += s[m[1]] || 0
    const tf = Math.max(0, to - arr)
    a.ouverture += to; a.fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { a.ecoule += Number(s.production_realisee) || 0; a.fonctPerf += tf }
    else if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prodPerf += Number(s.production_realisee) || 0; a.prodQual += Number(s.production_realisee) || 0; a.rebutsQual += Number(s.rebuts) || 0 }
  }
  const out = Array(12).fill(0)
  for (let mo = 0; mo < 12; mo++) {
    const a = parM[mo]; if (!a) continue
    const dispo = a.ouverture ? a.fonct / a.ouverture : 0
    const perf = a.theo ? Math.min(1, a.prodPerf / a.theo) : (a.fonctPerf ? Math.min(1, a.ecoule / a.fonctPerf) : 0)
    const qualite = a.prodQual ? Math.max(0, (a.prodQual - a.rebutsQual) / a.prodQual) : 1
    out[mo] = +((dispo * perf * qualite) * 100).toFixed(1)
  }
  return out
})
// TRS technique par mois (arrêts planifiés exclus du temps requis)
const trsTechParMois = computed(() => {
  const parM = {}
  for (const s of postesFiltres.value) {
    const mo = new Date(s.date).getMonth()
    if (!parM[mo]) parM[mo] = { ouverture: 0, fonct: 0, arrPlan: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0 }
    const a = parM[mo]
    const to = s.temps_ouverture_min || 0
    let arr = 0, arrP = 0
    for (const m of MOTIFS) { const v = s[m[1]] || 0; arr += v; if (m[4] === 'plan') arrP += v }
    const tf = Math.max(0, to - arr)
    a.ouverture += to; a.fonct += tf; a.arrPlan += arrP
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { a.ecoule += Number(s.production_realisee) || 0; a.fonctPerf += tf }
    else if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prodPerf += Number(s.production_realisee) || 0; a.prodQual += Number(s.production_realisee) || 0; a.rebutsQual += Number(s.rebuts) || 0 }
  }
  const out = Array(12).fill(0)
  for (let mo = 0; mo < 12; mo++) {
    const a = parM[mo]; if (!a) continue
    const requis = Math.max(0, a.ouverture - a.arrPlan)
    const dispoTech = requis ? a.fonct / requis : 0
    const perf = a.theo ? Math.min(1, a.prodPerf / a.theo) : (a.fonctPerf ? Math.min(1, a.ecoule / a.fonctPerf) : 0)
    const qualite = a.prodQual ? Math.max(0, (a.prodQual - a.rebutsQual) / a.prodQual) : 1
    out[mo] = +((dispoTech * perf * qualite) * 100).toFixed(1)
  }
  return out
})

// TRS par poste 3×8 (Matin / Après-midi / Nuit = postes 1 / 2 / 3)
const POSTE_LIB = { 1: 'Matin', 2: 'Après-midi', 3: 'Nuit' }
const trsParPoste = computed(() => {
  const by = {}
  for (const s of postesFiltres.value) {
    const p = Number(s.poste) || 0
    if (!by[p]) by[p] = { ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0, nb: 0 }
    const a = by[p]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const m of MOTIFS) arr += s[m[1]] || 0
    const tf = Math.max(0, to - arr)
    a.ouverture += to; a.fonct += tf; a.nb++
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { a.ecoule += Number(s.production_realisee) || 0; a.fonctPerf += tf }
    else if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prodPerf += Number(s.production_realisee) || 0; a.prodQual += Number(s.production_realisee) || 0; a.rebutsQual += Number(s.rebuts) || 0 }
  }
  return [1, 2, 3].map(p => {
    const a = by[p]
    if (!a) return { poste: p, lib: POSTE_LIB[p], nb: 0, dispo: 0, perf: 0, qualite: 0, trs: 0, vide: true }
    const dispo = a.ouverture ? a.fonct / a.ouverture : 0
    const perf = a.theo ? Math.min(1, a.prodPerf / a.theo) : (a.fonctPerf ? Math.min(1, a.ecoule / a.fonctPerf) : 0)
    const qualite = a.prodQual ? Math.max(0, (a.prodQual - a.rebutsQual) / a.prodQual) : 1
    return { poste: p, lib: POSTE_LIB[p], nb: a.nb, dispo, perf, qualite, trs: dispo * perf * qualite, vide: false, perfCalc: (a.theo > 0 || a.fonctPerf > 0) }
  })
})

const parEquip = computed(() => {
  const m = {}
  for (const s of postesFiltres.value) {
    const k = s.equipement_id
    if (!m[k]) m[k] = {
      id: k, code: s.equipements ? s.equipements.code : '?', nom: s.equipements ? s.equipements.nom : '',
      ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0, nbPostes: 0, prodTot: 0,
      arrets: Object.fromEntries(MOTIFS.map(mo => [mo[0], 0]))
    }
    const e = m[k]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const mo of MOTIFS) { const v = s[mo[1]] || 0; e.arrets[mo[0]] += v; arr += v }
    const tf = Math.max(0, to - arr)
    e.ouverture += to; e.fonct += tf; e.nbPostes++; e.prodTot += Number(s.production_realisee) || 0
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') {
      e.ecoule += Number(s.production_realisee) || 0
      e.fonctPerf += tf
    } else if (cd.value > 0) {
      e.theo += (tf / 60) * cd.value
      e.prodPerf += Number(s.production_realisee) || 0
      e.prodQual += Number(s.production_realisee) || 0
      e.rebutsQual += Number(s.rebuts) || 0
    }
  }
  return Object.values(m).map(e => {
    const dispo = e.ouverture ? e.fonct / e.ouverture : 0
    const perf = e.theo ? Math.min(1, e.prodPerf / e.theo) : (e.fonctPerf ? Math.min(1, e.ecoule / e.fonctPerf) : 0)
    const qualite = e.prodQual ? Math.max(0, (e.prodQual - e.rebutsQual) / e.prodQual) : 1
    const arrPlan = CLES_PLAN.reduce((s, c) => s + (e.arrets[c] || 0), 0)
    const requis = Math.max(0, e.ouverture - arrPlan)
    const dispoTech = requis ? e.fonct / requis : 0
    const trs = dispo * perf * qualite
    const objectif = objectifDe(e.id)
    return { ...e, dispo, perf, qualite, trs, objectif, sousObjectif: trs < objectif, ecartObj: trs - objectif, arrPlan, requis, dispoTech, trsTech: dispoTech * perf * qualite, perfCalc: (e.theo > 0 || e.fonctPerf > 0), pctNettoyage: e.ouverture ? e.arrets.nettoyage / e.ouverture : 0 }
  }).sort((a, b) => b.trs - a.trs)
})

const pertes = computed(() => {
  const t = Object.assign({ ouverture: 0, fonct: 0 }, Object.fromEntries(MOTIFS.map(mo => [mo[0], 0])))
  for (const e of parEquip.value) {
    t.ouverture += e.ouverture; t.fonct += e.fonct
    for (const mo of MOTIFS) t[mo[0]] += e.arrets[mo[0]]
  }
  return t
})
const totalArrets = computed(() => MOTIFS.reduce((s, mo) => s + pertes.value[mo[0]], 0))

// TRS global (pondéré)
const global = computed(() => {
  let ouv = 0, sTrs = 0, sDispo = 0, sPerf = 0, sQual = 0, sTrsTech = 0, sDispoTech = 0, prodTot = 0, perfCalc = false
  for (const e of parEquip.value) { ouv += e.ouverture; sTrs += e.trs * e.ouverture; sDispo += e.dispo * e.ouverture; sPerf += e.perf * e.ouverture; sQual += e.qualite * e.ouverture; sTrsTech += e.trsTech * e.ouverture; sDispoTech += e.dispoTech * e.ouverture; prodTot += e.prodTot || 0; if (e.perfCalc) perfCalc = true }
  return ouv ? { dispo: sDispo / ouv, perf: sPerf / ouv, qualite: sQual / ouv, trs: sTrs / ouv, dispoTech: sDispoTech / ouv, trsTech: sTrsTech / ouv, prodTot, perfCalc } : { dispo: 0, perf: 0, qualite: 0, trs: 0, dispoTech: 0, trsTech: 0, prodTot: 0, perfCalc: false }
})

// Pourquoi la Performance est à 0 : cadence manquante (non calculable) ou production non saisie.
const diagPerf = computed(() => {
  const g = global.value
  if (!postes.value.length || g.perf > 0.005) return null
  if (!g.perfCalc) return 'cadence'
  if ((g.prodTot || 0) === 0) return 'production'
  return null
})

const trsParEquipChart = computed(() => [{ label: 'TRS %', color: '#4338ca', data: parEquip.value.map(e => +(e.trs * 100).toFixed(1)) }])
const labelsEquip = computed(() => parEquip.value.map(e => e.nom ? e.code + ' — ' + e.nom : e.code))
const pertesChart = computed(() => [{ label: 'Minutes', color: '#64748b', data: MOTIFS.map(mo => pertes.value[mo[0]]) }])
const labelsMotifs = computed(() => MOTIFS.map(mo => mo[2]))

const pct = (x) => (x * 100).toFixed(1) + ' %'
const fmt = (n) => n == null ? '0' : Math.round(Number(n)).toLocaleString('fr-FR')
const heures = (min) => (min / 60).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' h'
// Niveau OEE : vert ≥ 85 %, orange 65–85 %, rouge < 65 %
const niv = (x) => x >= 0.85 ? 'ok' : (x >= 0.65 ? 'mid' : 'ko')
const NIV_COL = { ok: '#16a34a', mid: '#d97706', ko: '#dc2626' }
const pctNum = (x) => Math.round((x || 0) * 100)
// Facteur limitant = la plus basse des trois composantes
const facteurLimitant = computed(() => {
  const g = global.value
  const arr = [['Disponibilité', g.dispo], ['Performance', g.perf], ['Qualité', g.qualite]].sort((a, b) => a[1] - b[1])
  return { nom: arr[0][0], val: arr[0][1] }
})
const topPerte = computed(() => {
  let best = null
  for (const mo of MOTIFS) { const v = pertes.value[mo[0]]; if (v > 0 && (!best || v > best.min)) best = { label: mo[2], min: v } }
  return best
})
// Pareto séparé planifié / subi (chaque groupe trié décroissant + % cumulé intra-groupe)
const paretoDe = (groupe) => {
  const list = MOTIFS.filter(m => m[4] === groupe)
  const tot = list.reduce((s, mo) => s + (pertes.value[mo[0]] || 0), 0)
  const rows = list.map(mo => ({ cle: mo[0], label: mo[2], color: mo[3], min: pertes.value[mo[0]] || 0, pct: tot ? (pertes.value[mo[0]] || 0) / tot * 100 : 0 }))
    .filter(r => r.min > 0).sort((a, b) => b.min - a.min)
  let cum = 0; for (const r of rows) { cum += r.pct; r.cum = cum }
  return { rows, total: tot }
}
const paretoPlan = computed(() => paretoDe('plan'))
const paretoSubi = computed(() => paretoDe('subi'))
const aucunArret = computed(() => totalArrets.value === 0)
// Répartition planifié / subi des arrêts (part organisationnelle vs fiabilité)
const ratioPlanifie = computed(() => {
  const p = paretoPlan.value.total, s = paretoSubi.value.total, tot = p + s
  return { plan: p, subi: s, total: tot, pctPlan: tot ? Math.round(p / tot * 100) : 0, pctSubi: tot ? Math.round(s / tot * 100) : 0 }
})
const sousObjectifCount = computed(() => parEquip.value.filter(e => e.sousObjectif).length)
const globalSousObjectif = computed(() => global.value.trs < objectifDefaut.value)

// Export PDF (fenêtre d'impression, logo ProdTrack) — reflète les filtres actifs.
function exporterPDF() {
  if (!parEquip.value.length) { msg.value = 'Rien à exporter sur cette période.'; return }
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const dFr = (d) => { try { return new Date(d).toLocaleDateString('fr-FR') } catch (e) { return d } }
  const g = global.value
  const eqSel = equipList.value.find(e => e.id === equipFiltre.value)
  const equipTxt = equipFiltre.value ? (equipFiltreCode.value + (eqSel && eqSel.nom ? ' — ' + eqSel.nom : '')) : 'Tous'
  const prodTxt = produitFiltre.value ? produitFiltreLabel.value : 'Tous'

  // Anneau TRS + chaîne D×P×Q (couleurs par niveau OEE), comme l'écran
  const nivC = (x) => NIV_COL[niv(x)]
  const p0 = (x) => Math.round((x || 0) * 100)
  const ce = ';-webkit-print-color-adjust:exact;print-color-adjust:exact'
  const nd = !g.perfCalc   // pas de cadence -> Performance/TRS non calculables
  const donut = '<svg viewBox="0 0 42 42" width="104" height="104"><circle cx="21" cy="21" r="15.915" fill="none" stroke="#eef2f6" stroke-width="3.6"/>' + (nd ? '' : '<circle cx="21" cy="21" r="15.915" fill="none" stroke="' + nivC(g.trs) + '" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="' + p0(g.trs) + ' ' + (100 - p0(g.trs)) + '" stroke-dashoffset="25" style="' + ce + '"/>') + '<text x="21" y="20.5" text-anchor="middle" font-size="' + (nd ? '6' : '9') + '" font-weight="800" fill="' + (nd ? '#94a3b8' : nivC(g.trs)) + '">' + (nd ? 'n/d' : p0(g.trs) + '%') + '</text><text x="21" y="27" text-anchor="middle" font-size="3.4" font-weight="700" fill="#94a3b8" letter-spacing="0.15em">TRS</text></svg>'
  const chainRow = (lbl, v, ndr) => '<div class="hcr"><span class="hcl">' + lbl + '</span><span class="hct"><span class="hcf" style="width:' + (ndr ? 0 : p0(v)) + '%;background:' + (ndr ? '#cbd5e1' : nivC(v)) + ce + '"></span></span><span class="hcv" style="color:' + (ndr ? '#94a3b8' : nivC(v)) + '">' + (ndr ? 'n/d' : p0(v) + ' %') + '</span></div>'
  const heroTech = '<div class="herotech">TRS technique<br><b style="color:' + (nd ? '#94a3b8' : nivC(g.trsTech)) + '">' + (nd ? 'n/d' : p0(g.trsTech) + ' %') + '</b><br><small>arrêts planifiés exclus</small></div>'
  const hero = '<div class="hero"><div style="text-align:center">' + donut + heroTech + '</div><div class="chain">' + chainRow('Disponibilité', g.dispo) + chainRow('Performance', g.perf, nd) + chainRow('Qualité', g.qualite) + '<div class="formula">Disponibilité × Performance × Qualité = <b>TRS global</b></div></div></div>'
  const fl = facteurLimitant.value, tp = topPerte.value
  const interpret = nd
    ? '<div class="interp">💡 TRS <b style="color:#64748b">n/d</b> — Performance non calculable (cadence manquante). Disponibilité <b style="color:' + nivC(g.dispo) + '">' + p0(g.dispo) + ' %</b> · Qualité <b style="color:' + nivC(g.qualite) + '">' + p0(g.qualite) + ' %</b>' + (tp ? '. Principal poste d\'arrêt : <b>' + esc(tp.label) + '</b> (' + heures(tp.min) + ').' : '') + '</div>'
    : '<div class="interp">💡 TRS global <b style="color:' + nivC(g.trs) + '">' + p0(g.trs) + ' %</b> · TRS technique <b style="color:' + nivC(g.trsTech) + '">' + p0(g.trsTech) + ' %</b> (arrêts planifiés exclus) — facteur limitant : <b>' + esc(fl.nom) + '</b> (' + p0(fl.val) + ' %)' + (tp ? '. Principal poste d\'arrêt : <b>' + esc(tp.label) + '</b> (' + heures(tp.min) + ').' : '') + '</div>'

  // TRS par poste (3×8) — mini-anneaux Matin / Après-midi / Nuit
  const posteDonut = (trs, vide, ndp) => '<svg viewBox="0 0 42 42" width="62" height="62"><circle cx="21" cy="21" r="15.915" fill="none" stroke="#eef2f6" stroke-width="4"/>' + (vide || ndp ? '' : '<circle cx="21" cy="21" r="15.915" fill="none" stroke="' + nivC(trs) + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + p0(trs) + ' ' + (100 - p0(trs)) + '" stroke-dashoffset="25" style="' + ce + '"/>') + '<text x="21" y="24" text-anchor="middle" font-size="' + (ndp ? '7' : '10') + '" font-weight="800" fill="' + (vide || ndp ? '#94a3b8' : nivC(trs)) + '">' + (vide ? '—' : (ndp ? 'n/d' : p0(trs) + '%')) + '</text></svg>'
  const posteCells = trsParPoste.value.map(p => { const ndp = !p.vide && !p.perfCalc; return '<div class="pcell"><div>' + posteDonut(p.trs, p.vide, ndp) + '</div><div class="pm"><div class="plib">' + esc(p.lib) + ' <span class="pn">Poste ' + p.poste + '</span></div>' + (p.vide ? '<div class="pv">Aucune saisie</div>' : '<div class="pdpq"><b style="color:' + nivC(p.dispo) + '">D ' + p0(p.dispo) + '%</b> · <b style="color:' + (ndp ? '#94a3b8' : nivC(p.perf)) + '">P ' + (ndp ? 'n/d' : p0(p.perf) + '%') + '</b> · <b style="color:' + nivC(p.qualite) + '">Q ' + p0(p.qualite) + '%</b></div><div class="pnp">' + p.nb + ' poste' + (p.nb > 1 ? 's' : '') + ' saisi' + (p.nb > 1 ? 's' : '') + '</div>') + '</div></div>' }).join('')
  const posteBlock = '<h2>TRS par poste (3×8)</h2><div class="pgrid">' + posteCells + '</div>'

  const maxTrs = Math.max(1, ...parEquip.value.map(e => e.trs * 100))
  const bars = parEquip.value.map(e => {
    const v = e.trs * 100
    return '<div class="bar"><span class="bl">' + esc(e.code) + (e.nom ? ' <i>' + esc(e.nom) + '</i>' : '') + '</span><span class="bt"><span class="bf" style="width:' + (v / maxTrs * 100).toFixed(1) + '%;background:' + nivC(e.trs) + ce + '"></span></span><span class="bv" style="color:' + nivC(e.trs) + '">' + v.toFixed(1) + ' %</span></div>'
  }).join('')

  const eqRows = parEquip.value.map(e => '<tr><td><b>' + esc(e.code) + '</b> ' + esc(e.nom || '') + '</td><td class="r">' + heures(e.ouverture) + '</td><td class="r">' + heures(e.fonct) + '</td><td class="r" style="color:' + nivC(e.dispo) + '">' + pct(e.dispo) + '</td><td class="r" style="color:' + nivC(e.perf) + '">' + pct(e.perf) + '</td><td class="r" style="color:' + nivC(e.qualite) + '">' + pct(e.qualite) + '</td><td class="r"><b style="color:' + nivC(e.trs) + '">' + pct(e.trs) + '</b></td><td class="r" style="color:' + nivC(e.trsTech) + '">' + pct(e.trsTech) + '</td><td class="r"' + (e.sousObjectif ? ' style="color:#b91c1c;font-weight:800"' : '') + '>' + p0(e.objectif) + ' %' + (e.sousObjectif ? ' ▼' : '') + '</td><td class="r">' + heures(e.arrets.nettoyage) + '</td></tr>').join('')

  const ta = totalArrets.value, ouv = pertes.value.ouverture
  const paretoP = paretoPlan.value, paretoS = paretoSubi.value
  const barsGrp = (par) => { const mx = Math.max(1, ...par.rows.map(r => r.min)); return par.rows.map(r => '<div class="bar"><span class="bl">' + esc(r.label) + '</span><span class="bt"><span class="bf" style="width:' + (r.min / mx * 100).toFixed(1) + '%;background:' + r.color + ce + '"></span></span><span class="bv">' + heures(r.min) + ' · ' + r.cum.toFixed(0) + ' %</span></div>').join('') }
  const rowsGrp = (par) => par.rows.map(r => '<tr><td><span class="dot" style="background:' + r.color + '"></span>' + esc(r.label) + '</td><td class="r">' + heures(r.min) + '</td><td class="r">' + (ta ? (r.min / ta * 100).toFixed(1) : 0) + ' %</td><td class="r">' + (ouv ? (r.min / ouv * 100).toFixed(1) : 0) + ' %</td></tr>').join('')

  const moisData = {}
  for (const s of postesFiltres.value) moisData[new Date(s.date).getMonth()] = true
  const moisRows = MOIS.map((lbl, mo) => moisData[mo] ? '<tr><td>' + lbl + '</td><td class="r"><b>' + trsParMois.value[mo].toFixed(1) + ' %</b></td><td class="r">' + trsTechParMois.value[mo].toFixed(1) + ' %</td></tr>' : '').join('')
  const rp = ratioPlanifie.value

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Suivi TRS ' + esc(dFr(du.value)) + '</title>' +
    '<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:24px;font-size:12px}' +
    'h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;color:#4338ca;border-bottom:2px solid #eee;padding-bottom:4px;margin:18px 0 10px}' +
    '.sub{color:#64748b;margin:0 0 10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px;margin:0 0 12px;font-size:12px}.meta b{color:#475569}' +
    '.interp{background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #4338ca;border-radius:8px;padding:9px 12px;margin:0 0 12px;font-size:12px}' +
    '.hero{display:flex;align-items:center;gap:20px;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 6px}' +
    '.chain{flex:1}.hcr{display:grid;grid-template-columns:90px 1fr 46px;align-items:center;gap:8px;margin:4px 0}.hcl{font-size:11px;font-weight:600;color:#475569}' +
    '.hct{height:9px;background:#eef2f6;border-radius:5px;overflow:hidden}.hcf{display:block;height:100%;border-radius:5px}.hcv{font-size:12px;font-weight:800;text-align:right}' +
    '.formula{margin-top:5px;font-size:10px;color:#94a3b8;font-weight:600}.formula b{color:#4338ca}' +
    '.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:6px}.pcell{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px}.plib{font-size:12px;font-weight:800}.pn{font-size:9.5px;font-weight:600;color:#94a3b8}.pdpq{font-size:10.5px;color:#475569;margin-top:2px}.pdpq b{font-weight:800}.pnp{font-size:9px;color:#94a3b8;margin-top:1px}.pv{font-size:10.5px;color:#94a3b8;margin-top:2px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #eef2f6}' +
    'th{background:#eef2ff;color:#3730a3;font-size:10px;text-transform:uppercase}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}' +
    '.bar{display:grid;grid-template-columns:172px 1fr 60px;align-items:center;gap:8px;margin:3px 0}.bl{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bl i{font-weight:400;color:#94a3b8}' +
    '.bt{background:#eef2f6;border-radius:5px;height:14px;overflow:hidden}.bf{display:block;height:100%;background:#4338ca;-webkit-print-color-adjust:exact;print-color-adjust:exact}.bv{font-size:11px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}' +
    '.dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.herotech{font-size:9px;font-weight:600;color:#94a3b8;margin-top:3px;line-height:1.3}.herotech b{font-size:12px}.herotech small{font-size:7.5px}' +
    '.grptag{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;margin:12px 0 5px;padding:3px 9px;border-radius:5px;border-left:3px solid;-webkit-print-color-adjust:exact;print-color-adjust:exact}.grptag.plan{color:#4338ca;background:#eef2ff;border-color:#6366f1}.grptag.subi{color:#b45309;background:#fff7ed;border-color:#f59e0b}' +
    '.grprow td{background:#f1f5f9;font-weight:800;font-size:9px;text-transform:uppercase;color:#475569}' +
    '.ratio{font-size:11px;font-weight:600;color:#475569;margin:0 0 8px}' +
    '.objnote{font-size:11px;font-weight:600;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:6px 10px;margin:0 0 8px}' +
    '.foot{margin-top:22px;color:#94a3b8;font-size:10px;border-top:1px solid #eee;padding-top:6px}@media print{body{margin:12mm}}</style></head><body>' + LOGO_HTML +
    '<h1>Suivi TRS</h1>' +
    '<p class="sub">Rendement global des équipements · Disponibilité × Performance × Qualité</p>' +
    '<div class="meta"><div><b>Période :</b> ' + esc(dFr(du.value)) + ' → ' + esc(dFr(au.value)) + '</div><div><b>Équipement :</b> ' + esc(equipTxt) + '</div><div><b>Produit :</b> ' + esc(prodTxt) + '</div><div><b>Postes analysés :</b> ' + postesFiltres.value.length + '</div></div>' +
    interpret + hero + posteBlock +
    '<h2>TRS par équipement</h2>' + bars +
    '<div class="objnote">🎯 Objectif par défaut : <b>' + p0(objectifDefaut.value) + ' %</b> · ' + (sousObjectifCount.value ? '<b style="color:#b91c1c">' + sousObjectifCount.value + ' équipement(s) sous objectif ▼</b>' : '<b style="color:#047857">tous au-dessus de l\'objectif ✓</b>') + '</div>' +
    '<h2>Détail par équipement</h2>' +
    '<table><thead><tr><th>Équipement</th><th class="r">Ouverture</th><th class="r">Fonct.</th><th class="r">Dispo.</th><th class="r">Perf.</th><th class="r">Qualité</th><th class="r">TRS</th><th class="r">TRS tech.</th><th class="r">Objectif</th><th class="r">Nettoyage</th></tr></thead><tbody>' + eqRows + '</tbody></table>' +
    '<h2>Pertes de temps — planifiés vs subis</h2>' +
    '<div class="ratio">Répartition des arrêts : <b style="color:#4338ca">Planifiés ' + rp.pctPlan + ' %</b> · <b style="color:#b45309">Subis ' + rp.pctSubi + ' %</b> — ' + heures(rp.total) + ' au total</div>' +
    '<div class="grptag plan">Planifiés (organisationnels) — ' + heures(paretoP.total) + '</div>' + (barsGrp(paretoP) || '<div class="muted">Aucun</div>') +
    '<div class="grptag subi">Subis (non planifiés) — ' + heures(paretoS.total) + '</div>' + (barsGrp(paretoS) || '<div class="muted">Aucun</div>') +
    '<table style="margin-top:10px"><thead><tr><th>Motif d\'arrêt</th><th class="r">Durée</th><th class="r">% des arrêts</th><th class="r">% ouverture</th></tr></thead><tbody><tr class="grprow"><td colspan="4">Planifiés</td></tr>' + rowsGrp(paretoP) + '<tr class="grprow"><td colspan="4">Subis</td></tr>' + rowsGrp(paretoS) + '</tbody></table>' +
    (moisRows ? '<h2>TRS par mois — global vs technique</h2><table><thead><tr><th>Mois</th><th class="r">TRS global</th><th class="r">TRS technique</th></tr></thead><tbody>' + moisRows + '</tbody></table>' : '') +
    '<p class="foot">ProdTrack — LDM Groupe · Document généré le ' + esc(new Date().toLocaleDateString('fr-FR')) + '</p>' +
    '</body></html>'
  const w = window.open('', '_blank')
  if (!w) { msg.value = 'Autorise les pop-ups pour générer le PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
</script>

<template>
  <div class="strs-page">
    <PageHeader title="Suivi TRS" tone="indigo"
      subtitle="TRS par équipement, décomposé Disponibilité / Performance / Qualité, sur la période.">
      <div class="periode">
        <label>Équipement <select v-model="equipFiltre"><option value="">Tous</option><option v-for="e in equipList" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option></select></label>
        <label class="prod-pick">Produit
          <div class="combo">
            <input type="text" v-model="rechercheProd" placeholder="Tous — rechercher un produit…" @focus="prodOuvert = true" @input="prodOuvert = true" @blur="prodOuvert = false" />
            <button v-if="produitFiltre || rechercheProd" type="button" class="combo-x" @mousedown.prevent="clearProduit" title="Effacer le filtre produit">×</button>
            <ul v-if="prodOuvert && produitListFiltree.length" class="combo-list">
              <li class="combo-all" @mousedown.prevent="clearProduit">Tous les produits</li>
              <li v-for="p in produitListFiltree" :key="p.id" :class="{ sel: p.id === produitFiltre }" @mousedown.prevent="selectProduit(p)"><strong>{{ p.code }}</strong><span v-if="p.desig"> — {{ p.desig }}</span></li>
            </ul>
          </div>
        </label>
        <label>Du <input type="date" v-model="du" @change="charger" /></label>
        <label>Au <input type="date" v-model="au" @change="charger" /></label>
      </div>
      <div class="dl-group">
        <a class="dl-btn" :href="urlFicheA4" download target="_blank" rel="noopener" title="Fiche de relevé vierge, format A4 (PDF)">⬇ Fiche A4 (PDF)</a>
        <a class="dl-btn" :href="urlModeleXlsx" download title="Classeur Excel : fiche, registre, référentiel, guide">⬇ Modèle Excel</a>
      </div>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div v-if="!parEquip.length" class="empty">Aucune saisie TRS sur cette période<span v-if="produitFiltre || equipFiltre"> avec les filtres actuels</span>. Renseigne des postes dans « Saisie TRS ».</div>

      <template v-else>
        <div class="toolbar">
          <span v-if="equipFiltre || produitFiltre" class="flt-chip">Filtre :<b v-if="equipFiltre">{{ equipFiltreCode }}</b><b v-if="produitFiltre">{{ produitFiltreLabel }}</b></span>
          <label class="obj-ctl" title="Cible de TRS par défaut (mémorisée sur ce poste de travail)">🎯 Objectif TRS <input type="number" min="0" max="100" step="1" :value="Math.round(objectifDefaut * 100)" @change="setObjectifDefaut($event.target.value)" /> %</label>
          <span v-if="sousObjectifCount" class="obj-chip">⚠ {{ sousObjectifCount }} équip. sous objectif</span>
          <span v-else class="obj-chip ok">✓ Tous au-dessus de l'objectif</span>
          <button type="button" class="btn-pdf" @click="exporterPDF">⬇ Télécharger en PDF</button>
        </div>

        <!-- Interprétation automatique -->
        <div class="interpret" :class="global.perfCalc ? ('in-' + niv(global.trs)) : 'in-nd'">
          <span class="int-ic">💡</span>
          <span v-if="global.perfCalc" class="int-tx">TRS global <b :style="{ color: NIV_COL[niv(global.trs)] }">{{ pctNum(global.trs) }} %</b> · TRS technique <b :style="{ color: NIV_COL[niv(global.trsTech)] }">{{ pctNum(global.trsTech) }} %</b> <span class="int-note">(arrêts planifiés exclus)</span> — facteur limitant : <b>{{ facteurLimitant.nom }}</b> ({{ pctNum(facteurLimitant.val) }} %)<template v-if="topPerte">. Principal poste d'arrêt : <b>{{ topPerte.label }}</b> ({{ heures(topPerte.min) }}).</template></span>
          <span v-else class="int-tx">TRS <b style="color:#64748b">n/d</b> — Performance non calculable (cadence manquante). Disponibilité <b :style="{ color: NIV_COL[niv(global.dispo)] }">{{ pctNum(global.dispo) }} %</b> · Qualité <b :style="{ color: NIV_COL[niv(global.qualite)] }">{{ pctNum(global.qualite) }} %</b><template v-if="topPerte">. Principal poste d'arrêt : <b>{{ topPerte.label }}</b> ({{ heures(topPerte.min) }}).</template></span>
        </div>
        <p v-if="diagPerf === 'cadence'" class="diag-perf">⚠️ <b>Performance non calculable</b> : aucune <b>cadence</b> n'est définie pour {{ equipFiltre ? 'cet équipement' : 'ces équipements' }} sur la période — le TRS ne peut pas être calculé. Renseigne la cadence dans <b>Configuration › Cadences</b>, puis les chiffres s'afficheront.</p>
        <p v-else-if="diagPerf === 'production'" class="diag-perf">⚠️ <b>Performance à 0</b> : la cadence est définie mais <b>aucune quantité produite</b> n'a été saisie sur la période. Renseigne la production dans <b>Saisie TRS</b> pour obtenir la Performance et le TRS.</p>

        <div class="strs-grid">
          <!-- Héro : anneau TRS + chaîne Disponibilité × Performance × Qualité -->
          <section class="card hero">
            <div class="hero-gauge">
              <svg viewBox="0 0 42 42" class="donut" role="img" :aria-label="'TRS ' + pctNum(global.trs) + ' %'">
                <circle class="donut-bg" cx="21" cy="21" r="15.915" />
                <circle class="donut-seg" cx="21" cy="21" r="15.915" :stroke="NIV_COL[niv(global.trs)]" :stroke-dasharray="pctNum(global.trs) + ' ' + (100 - pctNum(global.trs))" stroke-dashoffset="25" />
                <text x="21" y="20.5" class="donut-val" :style="{ fill: global.perfCalc ? NIV_COL[niv(global.trs)] : '#94a3b8' }">{{ global.perfCalc ? pctNum(global.trs) + '%' : 'n/d' }}</text>
                <text x="21" y="27" class="donut-sub">TRS</text>
              </svg>
              <div class="hero-tech">TRS technique<br><b :style="{ color: global.perfCalc ? NIV_COL[niv(global.trsTech)] : '#94a3b8' }">{{ global.perfCalc ? pctNum(global.trsTech) + ' %' : 'n/d' }}</b></div>
            </div>
            <div class="hero-chain">
              <div class="hc-row" v-for="f in [['Disponibilité', global.dispo], ['Performance', global.perf], ['Qualité', global.qualite]]" :key="f[0]">
                <span class="hc-lbl">{{ f[0] }}</span>
                <span class="hc-bar"><span class="hc-bar-f" :style="{ width: pctNum(f[1]) + '%', background: NIV_COL[niv(f[1])] }"></span></span>
                <span class="hc-val" :style="{ color: (f[0] === 'Performance' && !global.perfCalc) ? '#94a3b8' : NIV_COL[niv(f[1])] }">{{ (f[0] === 'Performance' && !global.perfCalc) ? 'n/d' : pctNum(f[1]) + ' %' }}</span>
              </div>
              <div class="hc-formula">Disponibilité <span>×</span> Performance <span>×</span> Qualité <span>=</span> <b>TRS</b></div>
            </div>
          </section>

          <!-- Pertes de temps en Pareto -->
          <section class="card">
            <h3 class="card-title">Pertes de temps — Pareto <span class="ct-sub">planifiés / subis</span></h3>
            <div v-if="aucunArret" class="muted">Aucun arrêt enregistré sur la période.</div>
            <template v-else>
              <div class="ratio-bar">
                <div class="ratio-head"><span>Répartition des arrêts</span><span class="ratio-tot">{{ heures(ratioPlanifie.total) }}</span></div>
                <div class="ratio-track">
                  <span class="ratio-plan" :style="{ width: ratioPlanifie.pctPlan + '%' }"></span>
                  <span class="ratio-subi" :style="{ width: ratioPlanifie.pctSubi + '%' }"></span>
                </div>
                <div class="ratio-lbl"><span class="rl plan">Planifiés {{ ratioPlanifie.pctPlan }} %</span><span class="rl subi">Subis {{ ratioPlanifie.pctSubi }} %</span></div>
              </div>
              <div class="par-grp"><span class="par-grp-tag plan">Planifiés (organisationnels)</span><span class="par-grp-tot">{{ heures(paretoPlan.total) }}</span></div>
              <div class="pareto">
                <div v-for="r in paretoPlan.rows" :key="r.cle" class="par-row">
                  <span class="par-nom"><span class="par-dot" :style="{ background: r.color }"></span>{{ r.label }}</span>
                  <span class="par-track"><span class="par-f" :style="{ width: r.pct + '%', background: r.color }"></span></span>
                  <span class="par-min">{{ heures(r.min) }}</span>
                  <span class="par-cum">cumul {{ r.cum.toFixed(0) }} %</span>
                </div>
                <div v-if="!paretoPlan.rows.length" class="muted sm">Aucun arrêt planifié.</div>
              </div>
              <div class="par-grp"><span class="par-grp-tag subi">Subis (non planifiés)</span><span class="par-grp-tot">{{ heures(paretoSubi.total) }}</span></div>
              <div class="pareto">
                <div v-for="r in paretoSubi.rows" :key="r.cle" class="par-row">
                  <span class="par-nom"><span class="par-dot" :style="{ background: r.color }"></span>{{ r.label }}</span>
                  <span class="par-track"><span class="par-f" :style="{ width: r.pct + '%', background: r.color }"></span></span>
                  <span class="par-min">{{ heures(r.min) }}</span>
                  <span class="par-cum">cumul {{ r.cum.toFixed(0) }} %</span>
                </div>
                <div v-if="!paretoSubi.rows.length" class="muted sm">Aucun arrêt subi.</div>
              </div>
            </template>
          </section>

          <!-- TRS par poste (3×8) côte à côte avec TRS par mois -->
          <section class="card">
            <h3 class="card-title">TRS par poste <span class="ct-sub">(3×8)</span></h3>
            <div class="poste-grid">
              <div v-for="p in trsParPoste" :key="p.poste" class="poste-cell" :class="{ vide: p.vide }">
                <svg class="poste-ring" viewBox="0 0 42 42" :aria-label="p.lib + ' ' + (p.vide || !p.perfCalc ? 'n/d' : pctNum(p.trs) + ' %')">
                  <circle cx="21" cy="21" r="15.915" fill="none" stroke="#eef2f6" stroke-width="4" />
                  <circle v-if="!p.vide && p.perfCalc" cx="21" cy="21" r="15.915" fill="none" :stroke="NIV_COL[niv(p.trs)]" stroke-width="4" stroke-linecap="round" :stroke-dasharray="pctNum(p.trs) + ' ' + (100 - pctNum(p.trs))" stroke-dashoffset="25" />
                  <text x="21" y="23.5" text-anchor="middle" :font-size="(!p.vide && !p.perfCalc) ? 8 : 10" font-weight="800" :fill="(p.vide || !p.perfCalc) ? '#94a3b8' : NIV_COL[niv(p.trs)]">{{ p.vide ? '—' : (p.perfCalc ? pctNum(p.trs) + '%' : 'n/d') }}</text>
                </svg>
                <div class="poste-info">
                  <div class="poste-lib">{{ p.lib }} <span class="poste-n">Poste {{ p.poste }}</span></div>
                  <div v-if="!p.vide" class="poste-dpq"><b :style="{ color: NIV_COL[niv(p.dispo)] }">D {{ pctNum(p.dispo) }}%</b> · <b :style="{ color: p.perfCalc ? NIV_COL[niv(p.perf)] : '#94a3b8' }">P {{ p.perfCalc ? pctNum(p.perf) + '%' : 'n/d' }}</b> · <b :style="{ color: NIV_COL[niv(p.qualite)] }">Q {{ pctNum(p.qualite) }}%</b></div>
                  <div v-else class="poste-vide-tx">Aucune saisie sur la période</div>
                  <div v-if="!p.vide" class="poste-np">{{ p.nb }} poste{{ p.nb > 1 ? 's' : '' }} saisi{{ p.nb > 1 ? 's' : '' }}</div>
                </div>
              </div>
            </div>
          </section>

          <section class="card mois-card">
            <h3 class="card-title clickable-title" @click="moisVisible = !moisVisible">TRS global vs technique — par mois<span v-if="equipFiltre" class="flt"> — {{ equipFiltreCode }}</span><span v-if="produitFiltre" class="flt"> — {{ produitFiltreLabel }}</span> <span class="toggle-caret">{{ moisVisible ? '▾ masquer' : '▸ afficher' }}</span></h3>
            <MiniChart v-if="moisVisible" :labels="MOIS" :format="v => v + ' %'" show-values :value-format="v => v ? Math.round(v) + '%' : ''" :series="[{ label: 'TRS global', color: '#0f766e', data: trsParMois }, { label: 'TRS technique', color: '#6366f1', data: trsTechParMois }]" />
          </section>
        </div>

        <!-- TRS par équipement en pleine largeur (classement) -->
        <section class="card">
          <h3 class="card-title">TRS par équipement<span v-if="produitFiltre" class="flt"> — {{ produitFiltreLabel }}</span></h3>
          <div class="eqrank eqrank-full">
            <div v-for="e in parEquip" :key="e.id" class="eqbar" :class="{ 'sous-obj': e.sousObjectif }">
              <span class="eqbar-code">{{ e.code }} <span class="eqbar-nom">{{ e.nom }}</span></span>
              <span class="eqbar-track"><span class="eqbar-f" :style="{ width: pctNum(e.trs) + '%', background: NIV_COL[niv(e.trs)] }"></span><span class="eqbar-obj" :style="{ left: pctNum(e.objectif) + '%' }" :title="'Objectif ' + pctNum(e.objectif) + ' %'"></span></span>
              <span class="eqbar-val" :style="{ color: NIV_COL[niv(e.trs)] }">{{ pctNum(e.trs) }} %<span v-if="e.sousObjectif" class="obj-flag" :title="'Sous objectif (' + pctNum(e.objectif) + ' %)'">▼</span></span>
            </div>
          </div>
        </section>

        <!-- Détail par équipement -->
        <section class="card">
          <h3 class="card-title">Détail par équipement</h3>
          <div class="table-scroll">
            <table class="mini">
              <thead><tr><th>Équipement</th><th class="right">Ouverture</th><th class="right">Fonct.</th><th class="right">Dispo.</th><th class="right">Perf.</th><th class="right">Qualité</th><th class="right">TRS</th><th class="right">TRS tech.</th><th class="right">Objectif</th><th class="right">Nettoyage</th></tr></thead>
              <tbody>
                <tr v-for="e in parEquip" :key="e.id">
                  <td class="strong">{{ e.code }} <span class="nom">{{ e.nom }}</span></td>
                  <td class="right nowrap">{{ heures(e.ouverture) }}</td>
                  <td class="right nowrap">{{ heures(e.fonct) }}</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.dispo)] }">{{ pctNum(e.dispo) }} %</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.perf)] }">{{ pctNum(e.perf) }} %</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.qualite)] }">{{ pctNum(e.qualite) }} %</td>
                  <td class="right trs-cell" :style="{ color: NIV_COL[niv(e.trs)] }">{{ pctNum(e.trs) }} %</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.trsTech)] }">{{ pctNum(e.trsTech) }} %</td>
                  <td class="right obj-cell" :class="{ 'sous-obj-cell': e.sousObjectif }">
                    <input v-if="peutEditer && colObjectif" class="obj-in" type="number" min="0" max="100" :value="objectifs[e.id] != null ? Math.round(objectifs[e.id] * 100) : ''" :placeholder="Math.round(objectifDefaut * 100)" @change="majObjectif(e.id, $event.target.value)" /><template v-else>{{ pctNum(e.objectif) }}</template> %<span v-if="e.sousObjectif" class="obj-flag" title="Sous objectif">▼</span>
                  </td>
                  <td class="right nettoyage-cell">{{ heures(e.arrets.nettoyage) }} <span class="pcm">({{ pct(e.pctNettoyage) }})</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.strs-page { color: #1b2733; }
.periode { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
.periode label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 4px; }
.periode input, .periode select { font-size: 14px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 600; }
/* Combobox produit recherchable */
.combo { position: relative; }
.combo input { min-width: 240px; width: 240px; padding-right: 28px; }
.combo-x { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); border: none; background: #e2e8f0; color: #475569; width: 18px; height: 18px; border-radius: 50%; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0; }
.combo-x:hover { background: #cbd5e1; }
.combo-list { position: absolute; z-index: 50; top: calc(100% + 4px); left: 0; margin: 0; padding: 4px; list-style: none; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; box-shadow: 0 10px 24px rgba(16,24,40,.14); min-width: 280px; max-width: 420px; max-height: 280px; overflow-y: auto; }
.combo-list li { padding: 7px 10px; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap; color: #1b2733; }
.combo-list li:hover { background: #eef2ff; }
.combo-list li.sel { background: #e0e7ff; }
.combo-list li.combo-all { color: #64748b; font-style: italic; border-radius: 0; border-bottom: 1px solid #f1f5f9; margin-bottom: 2px; }
.combo-list li span { font-weight: 400; color: #64748b; }
.flt-banner { background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3; padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; }
.card-title .flt { color: #4338ca; font-weight: 700; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }
.empty { color: #94a3b8; text-align: center; padding: 30px; font-style: italic; }
.toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.obj-ctl { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #475569; }
.obj-ctl input { width: 56px; font-size: 13px; font-weight: 700; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: right; color: #1b2733; background: #fff; }
.obj-chip { font-size: 12.5px; font-weight: 700; padding: 6px 11px; border-radius: 8px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.obj-chip.ok { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.btn-pdf { display: inline-flex; align-items: center; gap: 6px; background: #4338ca; color: #fff; border: none; border-radius: 9px; padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.btn-pdf:hover { background: #3730a3; }
.dl-group { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.dl-btn { height: 34px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 9px; font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, border-color .15s; }
.dl-btn:hover { background: #4338ca; border-color: #4338ca; color: #fff; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .dl-btn { background: #1e293b; color: #a5b4fc; border-color: #334155; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .dl-btn:hover { background: #4338ca; color: #fff; border-color: #4338ca; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 19px; height: 19px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.big { font-size: 26px; color: #4338ca; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 6px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.clickable-title { cursor: pointer; user-select: none; }
.toggle-caret { font-size: 13px; color: #94a3b8; font-weight: 500; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.nom { font-weight: 400; color: #94a3b8; font-size: 12px; }
.trs-cell { font-weight: 800; color: #4338ca; }
.nettoyage-cell { color: #0f766e; font-weight: 600; }
.pcm { color: #94a3b8; font-weight: 400; font-size: 12px; }
.pertes-list { margin-top: 14px; }
.perte-row { display: grid; grid-template-columns: 16px 130px 90px 1fr 1fr; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.perte-row.hl { background: #f0fdfa; border-radius: 6px; }
.perte-dot { width: 13px; height: 13px; border-radius: 4px; }
.perte-nom { font-weight: 600; }
.perte-min { font-weight: 700; text-align: right; }
.perte-pct, .perte-pct2 { color: #64748b; font-size: 12.5px; }
/* ---- Refonte Suivi TRS ---- */
.flt-chip { font-size: 12px; color: #64748b; font-weight: 600; margin-right: auto; }
.flt-chip b { color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 2px 9px; margin-left: 6px; }
.interpret { display: flex; align-items: flex-start; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4338ca; border-radius: 10px; padding: 11px 14px; margin-bottom: 16px; font-size: 14px; color: #334155; }
.diag-perf { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 10px; padding: 10px 14px; margin: -6px 0 16px; font-size: 13.5px; color: #92400e; line-height: 1.5; }
.diag-perf b { color: #78350f; }
.interpret.in-ok { border-left-color: #16a34a; } .interpret.in-mid { border-left-color: #d97706; } .interpret.in-ko { border-left-color: #dc2626; }
.interpret.in-nd { border-left-color: #94a3b8; background: #f8fafc; }
.int-ic { font-size: 16px; line-height: 1.3; }
/* Grille 2×2 homogène : 4 cartes de même largeur et même hauteur */
.strs-grid { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: 14px; margin-bottom: 16px; align-items: stretch; }
.strs-grid > .card { margin-bottom: 0; }
.strs-grid > .card:not(.hero) { display: flex; flex-direction: column; }
.strs-grid .poste-grid { flex: 1; grid-template-rows: repeat(3, 1fr); }
.strs-grid > .mois-card > .mc { margin: auto 0; width: 100%; }
.ct-sub { font-size: 12px; font-weight: 600; color: #94a3b8; }
.poste-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.poste-cell { display: flex; align-items: center; gap: 13px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
.poste-cell.vide { background: #fafbfc; }
.poste-ring { width: 60px; height: 60px; flex: none; }
.poste-info { min-width: 0; }
.poste-lib { font-size: 15px; font-weight: 800; color: #0f172a; }
.poste-n { font-size: 11px; font-weight: 600; color: #94a3b8; }
.poste-dpq { font-size: 12px; color: #475569; margin-top: 3px; } .poste-dpq b { font-weight: 800; }
.poste-np { font-size: 10.5px; color: #94a3b8; margin-top: 2px; }
.poste-vide-tx { font-size: 12px; color: #94a3b8; margin-top: 3px; }
@media (max-width: 860px) { .poste-grid { grid-template-columns: 1fr; } }
.hero { display: flex; align-items: center; gap: 22px; }
.hero-gauge { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.hero-tech { margin-top: 2px; font-size: 11px; font-weight: 600; color: #94a3b8; text-align: center; line-height: 1.3; }
.hero-tech b { font-size: 15px; }
.int-note { color: #94a3b8; font-weight: 400; font-size: 12px; }
.par-grp { display: flex; align-items: center; justify-content: space-between; margin: 12px 0 7px; }
.par-grp:first-child { margin-top: 2px; }
.par-grp-tag { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; padding: 3px 9px; border-radius: 6px; border-left: 3px solid; }
.par-grp-tag.plan { color: #4338ca; background: #eef2ff; border-color: #6366f1; }
.par-grp-tag.subi { color: #b45309; background: #fff7ed; border-color: #f59e0b; }
.par-grp-tot { font-size: 12.5px; font-weight: 800; color: #475569; font-variant-numeric: tabular-nums; }
.muted.sm { font-size: 12px; padding: 2px 0; }
.ratio-bar { margin: 0 0 12px; padding: 0 0 12px; border-bottom: 1px solid #eef2f6; }
.ratio-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
.ratio-tot { color: #94a3b8; font-variant-numeric: tabular-nums; }
.ratio-track { display: flex; height: 16px; border-radius: 8px; overflow: hidden; background: #f1f5f9; }
.ratio-plan { background: #6366f1; transition: width .4s; }
.ratio-subi { background: #f59e0b; transition: width .4s; }
.ratio-lbl { display: flex; justify-content: space-between; margin-top: 5px; font-size: 11.5px; font-weight: 800; }
.rl.plan { color: #4338ca; } .rl.subi { color: #b45309; }
.donut { width: 150px; height: 150px; }
.donut-bg { fill: none; stroke: #eef2f6; stroke-width: 3.6; }
.donut-seg { fill: none; stroke-width: 3.6; stroke-linecap: round; transition: stroke-dasharray .5s ease; }
.donut-val { font-size: 9px; font-weight: 800; text-anchor: middle; }
.donut-sub { font-size: 3.4px; font-weight: 700; fill: #94a3b8; text-anchor: middle; letter-spacing: .15em; }
.hero-chain { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9px; }
.hc-row { display: grid; grid-template-columns: 96px 1fr 46px; align-items: center; gap: 10px; }
.hc-lbl { font-size: 12.5px; font-weight: 600; color: #475569; }
.hc-bar { height: 10px; background: #eef2f6; border-radius: 5px; overflow: hidden; }
.hc-bar-f { display: block; height: 100%; border-radius: 5px; transition: width .4s; }
.hc-val { font-size: 14px; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
.hc-formula { margin-top: 4px; font-size: 11.5px; color: #94a3b8; font-weight: 600; }
.hc-formula span { color: #cbd5e1; margin: 0 2px; } .hc-formula b { color: #4338ca; }
.pareto { display: flex; flex-direction: column; gap: 7px; }
.par-row { display: grid; grid-template-columns: 168px 1fr auto auto; align-items: center; gap: 10px; }
.par-nom { font-size: 12.5px; font-weight: 600; color: #1b2733; display: flex; align-items: center; gap: 6px; line-height: 1.2; min-width: 0; overflow-wrap: anywhere; }
.par-dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.par-track { height: 11px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.par-f { display: block; height: 100%; border-radius: 5px; }
.par-min { font-size: 12.5px; font-weight: 700; color: #334155; font-variant-numeric: tabular-nums; white-space: nowrap; }
.par-cum { font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
.eqrank { display: flex; flex-direction: column; gap: 8px; }
.eqbar { display: grid; grid-template-columns: 280px 1fr 54px; align-items: center; gap: 12px; }
.eqbar-code { font-size: 13px; font-weight: 700; color: #1b2733; line-height: 1.25; overflow-wrap: anywhere; }
.eqbar-nom { font-weight: 400; color: #94a3b8; }
.eqbar-track { position: relative; height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.eqbar-obj { position: absolute; top: 0; bottom: 0; width: 2px; background: #0f172a; z-index: 2; }
.eqbar.sous-obj .eqbar-code { color: #b91c1c; }
.obj-flag { color: #dc2626; font-size: 11px; margin-left: 3px; }
.obj-cell { white-space: nowrap; }
.obj-in { width: 46px; font-size: 13px; font-weight: 700; padding: 3px 5px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: right; color: #1b2733; }
.sous-obj-cell { background: #fef2f2; }
.eqbar-f { display: block; height: 100%; border-radius: 7px; transition: width .4s; }
.eqbar-val { font-size: 14px; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
.niv-cell { font-weight: 700; font-variant-numeric: tabular-nums; }
.trs-cell { font-weight: 800; font-variant-numeric: tabular-nums; }
@media (max-width: 860px) { .strs-grid { grid-template-columns: 1fr; grid-auto-rows: auto; } .hero { flex-direction: column; text-align: center; } .eqbar { grid-template-columns: 150px 1fr 48px; } .par-row { grid-template-columns: 132px 1fr auto; } .par-cum { display: none; } }
</style>
