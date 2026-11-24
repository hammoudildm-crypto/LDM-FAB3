<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'
import { LOGO_HTML } from '../logo'

const postes = ref([])
const cadences = ref([])
const chargement = ref(true)
const msg = ref('')

const now = new Date()
const du = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const au = ref(now.toISOString().slice(0, 10))

const MOTIFS = [
  ['panne', 'arret_panne_min', 'Panne', '#ef4444'],
  ['format', 'arret_format_min', 'Format', '#f59e0b'],
  ['nettoyage', 'arret_nettoyage_min', 'Nettoyage', '#0f766e'],
  ['reglage', 'arret_reglage_min', 'Réglage', '#8b5cf6'],
  ['maintenance', 'arret_maintenance_min', 'Maintenance', '#6366f1'],
  ['attente', 'arret_attente_min', 'Attente', '#94a3b8'],
  ['autre', 'arret_autre_min', 'Autre', '#cbd5e1']
]

async function charger() {
  chargement.value = true; msg.value = ''
  const r = await supabase.from('trs_postes')
    .select('*, equipements(code, nom), produits(code_pf, designation)')
    .eq('actif', true).gte('date', du.value).lte('date', au.value)
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  postes.value = r.data || []
  const rc = await supabase.from('cadences_produit').select('*')
  if (!rc.error) cadences.value = rc.data || []
  chargement.value = false
}
onMounted(charger)

function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' }
}

const equipFiltre = ref('')
const moisVisible = ref(false)
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

const parEquip = computed(() => {
  const m = {}
  for (const s of postesFiltres.value) {
    const k = s.equipement_id
    if (!m[k]) m[k] = {
      id: k, code: s.equipements ? s.equipements.code : '?', nom: s.equipements ? s.equipements.nom : '',
      ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0, nbPostes: 0,
      arrets: { panne: 0, format: 0, nettoyage: 0, reglage: 0, maintenance: 0, attente: 0, autre: 0 }
    }
    const e = m[k]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const mo of MOTIFS) { const v = s[mo[1]] || 0; e.arrets[mo[0]] += v; arr += v }
    const tf = Math.max(0, to - arr)
    e.ouverture += to; e.fonct += tf; e.nbPostes++
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
    return { ...e, dispo, perf, qualite, trs: dispo * perf * qualite, pctNettoyage: e.ouverture ? e.arrets.nettoyage / e.ouverture : 0 }
  }).sort((a, b) => b.trs - a.trs)
})

const pertes = computed(() => {
  const t = { ouverture: 0, fonct: 0, panne: 0, format: 0, nettoyage: 0, reglage: 0, maintenance: 0, attente: 0, autre: 0 }
  for (const e of parEquip.value) {
    t.ouverture += e.ouverture; t.fonct += e.fonct
    for (const mo of MOTIFS) t[mo[0]] += e.arrets[mo[0]]
  }
  return t
})
const totalArrets = computed(() => MOTIFS.reduce((s, mo) => s + pertes.value[mo[0]], 0))

// TRS global (pondéré)
const global = computed(() => {
  let ouv = 0, sTrs = 0, sDispo = 0, sPerf = 0, sQual = 0
  for (const e of parEquip.value) { ouv += e.ouverture; sTrs += e.trs * e.ouverture; sDispo += e.dispo * e.ouverture; sPerf += e.perf * e.ouverture; sQual += e.qualite * e.ouverture }
  return ouv ? { dispo: sDispo / ouv, perf: sPerf / ouv, qualite: sQual / ouv, trs: sTrs / ouv } : { dispo: 0, perf: 0, qualite: 0, trs: 0 }
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
// Pertes en Pareto : triées décroissant + % cumulé
const pertesPareto = computed(() => {
  const ta = totalArrets.value
  const rows = MOTIFS.map(mo => ({ cle: mo[0], label: mo[2], color: mo[3], min: pertes.value[mo[0]], pct: ta ? pertes.value[mo[0]] / ta * 100 : 0 }))
    .filter(r => r.min > 0).sort((a, b) => b.min - a.min)
  let cum = 0
  for (const r of rows) { cum += r.pct; r.cum = cum }
  return rows
})

// Export PDF (fenêtre d'impression, logo ProdTrack) — reflète les filtres actifs.
function exporterPDF() {
  if (!parEquip.value.length) { msg.value = 'Rien à exporter sur cette période.'; return }
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const dFr = (d) => { try { return new Date(d).toLocaleDateString('fr-FR') } catch (e) { return d } }
  const g = global.value
  const eqSel = equipList.value.find(e => e.id === equipFiltre.value)
  const equipTxt = equipFiltre.value ? (equipFiltreCode.value + (eqSel && eqSel.nom ? ' — ' + eqSel.nom : '')) : 'Tous'
  const prodTxt = produitFiltre.value ? produitFiltreLabel.value : 'Tous'

  const kpis = [['TRS global', pct(g.trs), true], ['Disponibilité', pct(g.dispo), false], ['Performance', pct(g.perf), false], ['Qualité', pct(g.qualite), false]]
    .map(k => '<div class="kpi' + (k[2] ? ' big' : '') + '"><div class="kv2">' + k[1] + '</div><div class="kl">' + k[0] + '</div></div>').join('')

  const maxTrs = Math.max(1, ...parEquip.value.map(e => e.trs * 100))
  const bars = parEquip.value.map(e => {
    const v = e.trs * 100
    return '<div class="bar"><span class="bl">' + esc(e.code) + (e.nom ? ' <i>' + esc(e.nom) + '</i>' : '') + '</span><span class="bt"><span class="bf" style="width:' + (v / maxTrs * 100).toFixed(1) + '%"></span></span><span class="bv">' + v.toFixed(1) + ' %</span></div>'
  }).join('')

  const eqRows = parEquip.value.map(e => '<tr><td><b>' + esc(e.code) + '</b> ' + esc(e.nom || '') + '</td><td class="r">' + heures(e.ouverture) + '</td><td class="r">' + heures(e.fonct) + '</td><td class="r">' + pct(e.dispo) + '</td><td class="r">' + pct(e.perf) + '</td><td class="r">' + pct(e.qualite) + '</td><td class="r"><b>' + pct(e.trs) + '</b></td><td class="r">' + heures(e.arrets.nettoyage) + '</td></tr>').join('')

  const ta = totalArrets.value, ouv = pertes.value.ouverture
  const perteRows = MOTIFS.map(mo => '<tr><td><span class="dot" style="background:' + mo[3] + '"></span>' + esc(mo[2]) + '</td><td class="r">' + heures(pertes.value[mo[0]]) + '</td><td class="r">' + (ta ? ((pertes.value[mo[0]] / ta) * 100).toFixed(1) : 0) + ' %</td><td class="r">' + (ouv ? ((pertes.value[mo[0]] / ouv) * 100).toFixed(1) : 0) + ' %</td></tr>').join('')
  const maxPerte = Math.max(1, ...MOTIFS.map(mo => pertes.value[mo[0]]))
  const perteBars = MOTIFS.map(mo => '<div class="bar"><span class="bl">' + esc(mo[2]) + '</span><span class="bt"><span class="bf" style="width:' + (pertes.value[mo[0]] / maxPerte * 100).toFixed(1) + '%;background:' + mo[3] + '"></span></span><span class="bv">' + heures(pertes.value[mo[0]]) + '</span></div>').join('')

  const moisData = {}
  for (const s of postesFiltres.value) moisData[new Date(s.date).getMonth()] = true
  const moisRows = MOIS.map((lbl, mo) => moisData[mo] ? '<tr><td>' + lbl + '</td><td class="r"><b>' + trsParMois.value[mo].toFixed(1) + ' %</b></td></tr>' : '').join('')

  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Suivi TRS ' + esc(dFr(du.value)) + '</title>' +
    '<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:24px;font-size:12px}' +
    'h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;color:#4338ca;border-bottom:2px solid #eee;padding-bottom:4px;margin:18px 0 10px}' +
    '.sub{color:#64748b;margin:0 0 10px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px;margin:0 0 12px;font-size:12px}.meta b{color:#475569}' +
    '.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0 0 6px}' +
    '.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}.kv2{font-size:20px;font-weight:800}.kpi.big .kv2{color:#4338ca}.kl{font-size:11px;color:#64748b;margin-top:3px}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #eef2f6}' +
    'th{background:#eef2ff;color:#3730a3;font-size:10px;text-transform:uppercase}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}' +
    '.bar{display:grid;grid-template-columns:150px 1fr 60px;align-items:center;gap:8px;margin:3px 0}.bl{font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bl i{font-weight:400;color:#94a3b8}' +
    '.bt{background:#eef2f6;border-radius:5px;height:14px;overflow:hidden}.bf{display:block;height:100%;background:#4338ca;-webkit-print-color-adjust:exact;print-color-adjust:exact}.bv{font-size:11px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}' +
    '.dot{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.foot{margin-top:22px;color:#94a3b8;font-size:10px;border-top:1px solid #eee;padding-top:6px}@media print{body{margin:12mm}}</style></head><body>' + LOGO_HTML +
    '<h1>Suivi TRS</h1>' +
    '<p class="sub">Rendement global des équipements · Disponibilité × Performance × Qualité</p>' +
    '<div class="meta"><div><b>Période :</b> ' + esc(dFr(du.value)) + ' → ' + esc(dFr(au.value)) + '</div><div><b>Équipement :</b> ' + esc(equipTxt) + '</div><div><b>Produit :</b> ' + esc(prodTxt) + '</div><div><b>Postes analysés :</b> ' + postesFiltres.value.length + '</div></div>' +
    '<div class="kpis">' + kpis + '</div>' +
    '<h2>TRS par équipement</h2>' + bars +
    '<h2>Détail par équipement</h2>' +
    '<table><thead><tr><th>Équipement</th><th class="r">Ouverture</th><th class="r">Fonct.</th><th class="r">Dispo.</th><th class="r">Perf.</th><th class="r">Qualité</th><th class="r">TRS</th><th class="r">Nettoyage</th></tr></thead><tbody>' + eqRows + '</tbody></table>' +
    '<h2>Détail des pertes de temps (tous équipements)</h2>' + perteBars +
    '<table style="margin-top:10px"><thead><tr><th>Motif d\'arrêt</th><th class="r">Durée</th><th class="r">% des arrêts</th><th class="r">% ouverture</th></tr></thead><tbody>' + perteRows + '</tbody></table>' +
    (moisRows ? '<h2>TRS par mois</h2><table><thead><tr><th>Mois</th><th class="r">TRS</th></tr></thead><tbody>' + moisRows + '</tbody></table>' : '') +
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
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div v-if="!parEquip.length" class="empty">Aucune saisie TRS sur cette période<span v-if="produitFiltre || equipFiltre"> avec les filtres actuels</span>. Renseigne des postes dans « Saisie TRS ».</div>

      <template v-else>
        <div class="toolbar">
          <span v-if="equipFiltre || produitFiltre" class="flt-chip">Filtre :<b v-if="equipFiltre">{{ equipFiltreCode }}</b><b v-if="produitFiltre">{{ produitFiltreLabel }}</b></span>
          <button type="button" class="btn-pdf" @click="exporterPDF">⬇ Télécharger en PDF</button>
        </div>

        <!-- Interprétation automatique -->
        <div class="interpret" :class="'in-' + niv(global.trs)">
          <span class="int-ic">💡</span>
          <span class="int-tx">TRS global <b :style="{ color: NIV_COL[niv(global.trs)] }">{{ pctNum(global.trs) }} %</b> — facteur limitant : <b>{{ facteurLimitant.nom }}</b> ({{ pctNum(facteurLimitant.val) }} %)<template v-if="topPerte">. Principal poste d'arrêt : <b>{{ topPerte.label }}</b> ({{ heures(topPerte.min) }}).</template></span>
        </div>

        <div class="strs-top">
          <!-- Héro : anneau TRS + chaîne Disponibilité × Performance × Qualité -->
          <section class="card hero">
            <div class="hero-gauge">
              <svg viewBox="0 0 42 42" class="donut" role="img" :aria-label="'TRS ' + pctNum(global.trs) + ' %'">
                <circle class="donut-bg" cx="21" cy="21" r="15.915" />
                <circle class="donut-seg" cx="21" cy="21" r="15.915" :stroke="NIV_COL[niv(global.trs)]" :stroke-dasharray="pctNum(global.trs) + ' ' + (100 - pctNum(global.trs))" stroke-dashoffset="25" />
                <text x="21" y="20.5" class="donut-val" :style="{ fill: NIV_COL[niv(global.trs)] }">{{ pctNum(global.trs) }}%</text>
                <text x="21" y="27" class="donut-sub">TRS</text>
              </svg>
            </div>
            <div class="hero-chain">
              <div class="hc-row" v-for="f in [['Disponibilité', global.dispo], ['Performance', global.perf], ['Qualité', global.qualite]]" :key="f[0]">
                <span class="hc-lbl">{{ f[0] }}</span>
                <span class="hc-bar"><span class="hc-bar-f" :style="{ width: pctNum(f[1]) + '%', background: NIV_COL[niv(f[1])] }"></span></span>
                <span class="hc-val" :style="{ color: NIV_COL[niv(f[1])] }">{{ pctNum(f[1]) }} %</span>
              </div>
              <div class="hc-formula">Disponibilité <span>×</span> Performance <span>×</span> Qualité <span>=</span> <b>TRS</b></div>
            </div>
          </section>

          <!-- Pertes de temps en Pareto -->
          <section class="card">
            <h3 class="card-title">Pertes de temps — Pareto</h3>
            <div v-if="!pertesPareto.length" class="muted">Aucun arrêt enregistré sur la période.</div>
            <div v-else class="pareto">
              <div v-for="r in pertesPareto" :key="r.cle" class="par-row">
                <span class="par-nom"><span class="par-dot" :style="{ background: r.color }"></span>{{ r.label }}</span>
                <span class="par-track"><span class="par-f" :style="{ width: r.pct + '%', background: r.color }"></span></span>
                <span class="par-min">{{ heures(r.min) }}</span>
                <span class="par-cum">cumul {{ r.cum.toFixed(0) }} %</span>
              </div>
            </div>
          </section>
        </div>

        <!-- TRS par équipement : classement coloré par niveau -->
        <section class="card">
          <h3 class="card-title">TRS par équipement<span v-if="produitFiltre" class="flt"> — {{ produitFiltreLabel }}</span></h3>
          <div class="eqrank">
            <div v-for="e in parEquip" :key="e.id" class="eqbar">
              <span class="eqbar-code">{{ e.code }} <span class="eqbar-nom">{{ e.nom }}</span></span>
              <span class="eqbar-track"><span class="eqbar-f" :style="{ width: pctNum(e.trs) + '%', background: NIV_COL[niv(e.trs)] }"></span></span>
              <span class="eqbar-val" :style="{ color: NIV_COL[niv(e.trs)] }">{{ pctNum(e.trs) }} %</span>
            </div>
          </div>
        </section>

        <!-- Détail par équipement -->
        <section class="card">
          <h3 class="card-title">Détail par équipement</h3>
          <div class="table-scroll">
            <table class="mini">
              <thead><tr><th>Équipement</th><th class="right">Ouverture</th><th class="right">Fonct.</th><th class="right">Dispo.</th><th class="right">Perf.</th><th class="right">Qualité</th><th class="right">TRS</th><th class="right">Nettoyage</th></tr></thead>
              <tbody>
                <tr v-for="e in parEquip" :key="e.id">
                  <td class="strong">{{ e.code }} <span class="nom">{{ e.nom }}</span></td>
                  <td class="right nowrap">{{ heures(e.ouverture) }}</td>
                  <td class="right nowrap">{{ heures(e.fonct) }}</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.dispo)] }">{{ pctNum(e.dispo) }} %</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.perf)] }">{{ pctNum(e.perf) }} %</td>
                  <td class="right niv-cell" :style="{ color: NIV_COL[niv(e.qualite)] }">{{ pctNum(e.qualite) }} %</td>
                  <td class="right trs-cell" :style="{ color: NIV_COL[niv(e.trs)] }">{{ pctNum(e.trs) }} %</td>
                  <td class="right nettoyage-cell">{{ heures(e.arrets.nettoyage) }} <span class="pcm">({{ pct(e.pctNettoyage) }})</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- TRS par mois -->
        <section class="card">
          <h3 class="card-title clickable-title" @click="moisVisible = !moisVisible">TRS par mois<span v-if="equipFiltre" class="flt"> — {{ equipFiltreCode }}</span><span v-if="produitFiltre" class="flt"> — {{ produitFiltreLabel }}</span> <span class="toggle-caret">{{ moisVisible ? '▾ masquer' : '▸ afficher' }}</span></h3>
          <MiniChart v-if="moisVisible" :labels="MOIS" :format="v => v + ' %'" :value-format="v => v || ''" show-values :series="[{ label: 'TRS %', color: '#0f766e', data: trsParMois }]" />
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
.toolbar { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.btn-pdf { display: inline-flex; align-items: center; gap: 6px; background: #4338ca; color: #fff; border: none; border-radius: 9px; padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.btn-pdf:hover { background: #3730a3; }
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
.interpret.in-ok { border-left-color: #16a34a; } .interpret.in-mid { border-left-color: #d97706; } .interpret.in-ko { border-left-color: #dc2626; }
.int-ic { font-size: 16px; line-height: 1.3; }
.strs-top { display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px; margin-bottom: 16px; align-items: stretch; }
.hero { display: flex; align-items: center; gap: 22px; }
.hero-gauge { flex: 0 0 auto; }
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
.par-row { display: grid; grid-template-columns: 120px 1fr auto auto; align-items: center; gap: 10px; }
.par-nom { font-size: 12.5px; font-weight: 600; color: #1b2733; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.par-dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.par-track { height: 11px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.par-f { display: block; height: 100%; border-radius: 5px; }
.par-min { font-size: 12.5px; font-weight: 700; color: #334155; font-variant-numeric: tabular-nums; white-space: nowrap; }
.par-cum { font-size: 11px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
.eqrank { display: flex; flex-direction: column; gap: 8px; }
.eqbar { display: grid; grid-template-columns: 220px 1fr 54px; align-items: center; gap: 12px; }
.eqbar-code { font-size: 13px; font-weight: 700; color: #1b2733; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eqbar-nom { font-weight: 400; color: #94a3b8; }
.eqbar-track { height: 14px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.eqbar-f { display: block; height: 100%; border-radius: 7px; transition: width .4s; }
.eqbar-val { font-size: 14px; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
.niv-cell { font-weight: 700; font-variant-numeric: tabular-nums; }
.trs-cell { font-weight: 800; font-variant-numeric: tabular-nums; }
@media (max-width: 860px) { .strs-top { grid-template-columns: 1fr; } .hero { flex-direction: column; text-align: center; } .eqbar { grid-template-columns: 120px 1fr 48px; } .par-row { grid-template-columns: 90px 1fr auto; } .par-cum { display: none; } }
</style>
