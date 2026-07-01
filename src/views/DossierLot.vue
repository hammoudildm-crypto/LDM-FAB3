<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'

const lots = ref([])
const lotId = ref('')
const rechercheLot = ref('')
const anneeF = ref(0)
const moisF = ref(0)
const lot = ref(null)
const phases = ref([])
const conditionnements = ref([])
const showCond = ref(false)
const erreur = ref('')

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

async function chargerLots() {
  erreur.value = ''
  const r = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, date_lancement, date_fin_fabrication, produits(code_pf, designation)')
    .eq('actif', true).order('id', { ascending: false }))
  if (r.error) { erreur.value = r.error.message; return }
  lots.value = r.data
}

async function chargerDossier() {
  lot.value = null; phases.value = []; conditionnements.value = []
  if (!lotId.value) return
  erreur.value = ''

  const rl = await supabase.from('ordres_fabrication')
    .select('*, produits(code_pf, designation, forme, unites_par_boite, poids_unitaire_mg, donneurs_ordre(nom)), equipements(code, nom)')
    .eq('id', lotId.value).single()
  if (rl.error) { erreur.value = rl.error.message; return }
  lot.value = rl.data

  const rp = await supabase.from('suivi_phases')
    .select('*, equipements(code, nom)')
    .eq('ordre_id', lotId.value).eq('actif', true)
    .order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (!rp.error) phases.value = rp.data

  const rc = await supabase.from('conditionnement')
    .select('*, equipements(code, nom)')
    .eq('ordre_id', lotId.value).eq('actif', true)
    .order('date_conditionnement', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (!rc.error) conditionnements.value = rc.data
}

// --- Fabrication ---
function rdt(e, s) {
  if (e == null || s == null || Number(e) === 0) return null
  return (Number(s) / Number(e)) * 100
}
const rendementFab = computed(() => {
  let r = 1, n = 0
  for (const p of phases.value) {
    const rp = rdt(p.quantite_entree, p.quantite_sortie)
    if (rp != null) { r *= rp / 100; n++ }
  }
  return n ? r * 100 : null
})

// --- Conditionnement ---
const upb = computed(() => lot.value && lot.value.produits ? Number(lot.value.produits.unites_par_boite || 0) : 0)
const mm = computed(() => lot.value && lot.value.produits ? Number(lot.value.produits.poids_unitaire_mg || 0) : 0)
const theoBoites = computed(() => lot.value ? Number(lot.value.quantite_theorique || 0) : 0)
const totalConditionne = computed(() => conditionnements.value.reduce((s, c) => s + Number(c.quantite_conditionnee || 0), 0))
const totalRecu = computed(() => conditionnements.value.reduce((s, c) => s + Number(c.quantite_entree || 0), 0))
const totalBoites = computed(() => upb.value > 0 ? Math.floor(totalConditionne.value / upb.value) : null)

// --- Bilan boîtes : vrac (fin fabrication) -> produit fini (conditionnement) ---
// Dernière phase de fabrication = la plus avancée saisie (Pelliculage > Remplissage > Compression)
const ORDRE_FAB = { 'Compression': 5, 'Remplissage Gélules': 6, 'Pelliculage': 7 }
const phaseVrac = computed(() => {
  let best = null, bestO = -1
  for (const ph of phases.value) {
    const o = ORDRE_FAB[ph.phase]
    if (o != null && ph.quantite_sortie != null && o > bestO) { best = ph; bestO = o }
  }
  return best
})
// kg -> mg (×1 000 000) -> unités (÷ poids unitaire) -> boîtes (÷ unités par boîte)
const comprimesVrac = computed(() => {
  const ph = phaseVrac.value
  if (!ph || mm.value <= 0) return null
  return Number(ph.quantite_sortie) * 1e6 / mm.value
})
const boitesVrac = computed(() => {
  if (comprimesVrac.value == null || upb.value <= 0) return null
  return Math.floor(comprimesVrac.value / upb.value)
})
const ecartBoites = computed(() => {
  if (boitesVrac.value == null || totalBoites.value == null) return null
  return boitesVrac.value - totalBoites.value
})
const ecartPct = computed(() => {
  if (ecartBoites.value == null || !boitesVrac.value) return null
  return (ecartBoites.value / boitesVrac.value) * 100
})

// Boîtes d'un enregistrement
function boitesC(c) {
  if (c.quantite_conditionnee == null || upb.value === 0) return null
  return Math.floor(Number(c.quantite_conditionnee) / upb.value)
}
// Rendement conditionnement (ligne) = boîtes obtenues / équivalent du vrac reçu
function rdtCondC(c) {
  const b = boitesC(c)
  const kg = c.quantite_entree
  if (b == null || kg == null || Number(kg) === 0 || mm.value === 0 || upb.value === 0) return null
  const eq = (Number(kg) * 1e6) / mm.value / upb.value
  return eq ? (b / eq) * 100 : null
}
// Rendement global (ligne) = boîtes obtenues / boîtes théoriques du lot
function rdtGlobalC(c) {
  const b = boitesC(c)
  if (b == null || theoBoites.value === 0) return null
  return (b / theoBoites.value) * 100
}
// Synthèse
const rendementCondTotal = computed(() => {
  const b = totalBoites.value
  if (b == null || totalRecu.value === 0 || mm.value === 0 || upb.value === 0) return null
  const eq = (totalRecu.value * 1e6) / mm.value / upb.value
  return eq ? (b / eq) * 100 : null
})
const rendementGlobal = computed(() => {
  if (totalBoites.value == null || theoBoites.value === 0) return null
  return (totalBoites.value / theoBoites.value) * 100
})

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(2) + ' %' }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function eqCode(x) { return x && x.equipements ? x.equipements.code : '—' }
function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}
function imprimer() { window.print() }

onMounted(chargerLots)
const MOIS = [
  { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
  { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
  { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
  { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' }
]
function refDateLot(l) {
  const d = l.date_lancement || l.date_fin_fabrication
  return d ? new Date(d) : null
}
const anneesLot = computed(() => {
  const set = new Set()
  for (const l of lots.value) { const d = refDateLot(l); if (d) set.add(d.getFullYear()) }
  return [...set].sort((a, b) => b - a)
})
const lotsFiltres = computed(() => {
  const q = rechercheLot.value.trim().toLowerCase()
  return lots.value.filter(l => {
    const d = refDateLot(l)
    if (anneeF.value && (!d || d.getFullYear() !== anneeF.value)) return false
    if (moisF.value && (!d || (d.getMonth() + 1) !== moisF.value)) return false
    if (q) {
      const p = l.produits
      const code = p ? String(p.code_pf || '') : ''
      const desig = p ? String(p.designation || '') : ''
      if (!(code.toLowerCase().includes(q) || desig.toLowerCase().includes(q) || String(l.numero_lot || '').toLowerCase().includes(q))) return false
    }
    return true
  })
})
watch(lotId, chargerDossier)
</script>

<template>
  <div class="dl-page">
    <header class="dl-head no-print">
      <div>
        <h1>Dossier de lot</h1>
        <p class="sub">Fiche récapitulative : identification, fabrication et conditionnement d'un lot.</p>
      </div>
      <div class="controls">
        <div class="lot-picker">
          <input v-model="rechercheLot" type="search" class="lot-search" placeholder="Rechercher (code, désignation, n° lot)…" />
          <div class="lot-filters">
            <select v-model.number="anneeF" title="Filtrer par année">
              <option :value="0">Toutes années</option>
              <option v-for="a in anneesLot" :key="a" :value="a">{{ a }}</option>
            </select>
            <select v-model.number="moisF" title="Filtrer par mois">
              <option :value="0">Tous les mois</option>
              <option v-for="m in MOIS" :key="m.v" :value="m.v">{{ m.l }}</option>
            </select>
          </div>
          <select v-model="lotId">
            <option value="">— Choisir un lot — ({{ lotsFiltres.length }})</option>
            <option v-for="l in lotsFiltres" :key="l.id" :value="l.id">
              {{ l.numero_lot }} · {{ l.produits ? l.produits.code_pf + ' ' + l.produits.designation : '' }}
            </option>
          </select>
        </div>
        <button v-if="lot" class="btn" @click="imprimer">Imprimer</button>
      </div>
    </header>

    <p v-if="erreur" class="alert no-print">{{ erreur }}</p>

    <div v-if="!lots.length" class="empty-card no-print">
      Aucun lot. Va d'abord dans <strong>Ordres de fabrication</strong> créer un lot.
    </div>

    <p v-else-if="!lotId" class="hint-select no-print">Choisis un lot ci-dessus pour afficher son dossier.</p>

    <div v-else-if="lot" class="dossier">
      <!-- IDENTIFICATION -->
      <div class="doc-title">
        <h2>Lot {{ lot.numero_lot }}</h2>
        <span class="badge" :class="classeStatut(lot.statut)">{{ lot.statut }}</span>
      </div>

      <section class="block">
        <h3>Identification</h3>
        <div class="info-grid">
          <div><span class="lbl">Produit</span>{{ lot.produits ? lot.produits.designation : '—' }}</div>
          <div><span class="lbl">Code PF</span>{{ lot.produits ? lot.produits.code_pf : '—' }}</div>
          <div><span class="lbl">Donneur d'ordre</span>{{ lot.produits && lot.produits.donneurs_ordre ? lot.produits.donneurs_ordre.nom : '—' }}</div>
          <div><span class="lbl">Forme</span>{{ lot.produits ? (lot.produits.forme || '—') : '—' }}</div>
          <div><span class="lbl">Boîtes théoriques</span>{{ fmt(lot.quantite_theorique) }}</div>
          <div><span class="lbl">Date de lancement</span>{{ fmtDate(lot.date_lancement) }}</div>
          <div><span class="lbl">Ligne principale</span>{{ lot.equipements ? (lot.equipements.code + ' — ' + lot.equipements.nom) : '—' }}</div>
          <div><span class="lbl">Unités / boîte</span>{{ lot.produits ? fmt(lot.produits.unites_par_boite) : '—' }}</div>
        </div>
        <div v-if="lot.commentaire" class="comment"><span class="lbl">Commentaire</span>{{ lot.commentaire }}</div>
      </section>

      <!-- FABRICATION -->
      <section class="block">
        <div class="block-head">
          <h3>Fabrication par phase</h3>
          <span v-if="rendementFab != null" class="rdt-tag">Rendement cumulé : <strong>{{ fmtPct(rendementFab) }}</strong></span>
        </div>
        <table class="grid">
          <thead>
            <tr><th>Phase</th><th>Ligne</th><th class="right">Entrée (kg)</th><th class="right">Sortie (kg)</th><th class="right">Rendement</th><th>Date</th><th>Statut</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in phases" :key="p.id">
              <td class="strong">{{ p.phase }}</td>
              <td>{{ eqCode(p) }}</td>
              <td class="right">{{ fmt(p.quantite_entree) }}</td>
              <td class="right">{{ fmt(p.quantite_sortie) }}</td>
              <td class="right" :class="rdt(p.quantite_entree, p.quantite_sortie) != null && rdt(p.quantite_entree, p.quantite_sortie) < 95 ? 'rdt-bas' : ''">{{ fmtPct(rdt(p.quantite_entree, p.quantite_sortie)) }}</td>
              <td>{{ fmtDate(p.date_phase) }}</td>
              <td><span class="badge sm" :class="classeStatut(p.statut)">{{ p.statut }}</span></td>
            </tr>
            <tr v-if="!phases.length"><td colspan="7" class="empty">Aucune phase saisie pour ce lot.</td></tr>
          </tbody>
        </table>
      </section>

      <!-- CONDITIONNEMENT -->
      <section class="block">
        <div class="block-head">
          <h3>Conditionnement</h3>
          <div class="ch-right">
            <span v-if="totalBoites != null" class="rdt-tag">Total : <strong>{{ fmt(totalBoites) }} boîtes</strong></span>
            <button v-if="conditionnements.length" class="btn-toggle no-print" @click="showCond = !showCond">
              {{ showCond ? '▲ Masquer' : '▼ Afficher' }} les lignes ({{ conditionnements.length }})
            </button>
          </div>
        </div>
        <p v-if="!conditionnements.length" class="empty-inline">Aucun conditionnement saisi pour ce lot.</p>
        <table v-else v-show="showCond" class="grid cond-grid">
          <thead>
            <tr><th>Date</th><th>Ligne</th><th class="right">Reçu (kg)</th><th class="right">Boîtes</th><th class="right">Rendement</th><th class="right">Rendement global</th><th>Statut</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in conditionnements" :key="c.id">
              <td>{{ fmtDate(c.date_conditionnement) }}</td>
              <td>{{ eqCode(c) }}</td>
              <td class="right">{{ fmt(c.quantite_entree) }}</td>
              <td class="right strong">{{ fmt(boitesC(c)) }}</td>
              <td class="right" :class="rdtCondC(c) != null && rdtCondC(c) < 95 ? 'rdt-bas' : ''">{{ fmtPct(rdtCondC(c)) }}</td>
              <td class="right" :class="rdtGlobalC(c) != null && rdtGlobalC(c) < 90 ? 'rdt-bas' : ''">{{ fmtPct(rdtGlobalC(c)) }}</td>
              <td><span class="badge sm" :class="classeStatut(c.statut)">{{ c.statut }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- BILAN BOÎTES -->
      <section class="block">
        <h3>Bilan des boîtes — vrac → produit fini</h3>
        <div class="bilan">
          <div class="bilan-box">
            <span class="bilan-ic" :style="TINTS.violet"><svg viewBox="0 0 24 24" v-html="ICONS.pill"></svg></span>
            <div class="bilan-val">{{ boitesVrac != null ? fmt(boitesVrac) : '—' }}</div>
            <div class="bilan-lbl">Boîtes vrac<template v-if="phaseVrac"> — sortie {{ phaseVrac.phase }}</template></div>
          </div>
          <span class="bilan-op">→</span>
          <div class="bilan-box">
            <span class="bilan-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span>
            <div class="bilan-val">{{ totalBoites != null ? fmt(totalBoites) : '—' }}</div>
            <div class="bilan-lbl">Boîtes produit fini — conditionnement</div>
          </div>
          <span class="bilan-op">=</span>
          <div class="bilan-box">
            <span class="bilan-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.trendDown"></svg></span>
            <div class="bilan-val">{{ ecartBoites != null ? fmt(ecartBoites) : '—' }}<span v-if="ecartPct != null" class="bilan-pct"> ({{ fmtPct(ecartPct) }})</span></div>
            <div class="bilan-lbl">Écart — freinte conditionnement</div>
          </div>
        </div>
        <p class="bilan-note">
          Boîtes vrac = sortie de la dernière phase de fabrication (kg) × 1 000 000 ÷ poids unitaire ({{ mm ? fmt(mm) + ' mg' : '—' }}) ÷ unités/boîte ({{ upb || '—' }}).
          Boîtes produit fini = quantités conditionnées ÷ unités/boîte.
        </p>
      </section>

      <!-- SYNTHESE -->
      <section class="block synthese">
        <h3>Synthèse</h3>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(theoBoites) }}</div></div><div class="kpi-lbl">Boîtes théoriques</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(totalBoites) }}</div></div><div class="kpi-lbl">Boîtes produites</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><div class="kpi-val">{{ fmtPct(rendementCondTotal) }}</div></div><div class="kpi-lbl">Rendement conditionnement</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.emerald"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><div class="kpi-val accent">{{ fmtPct(rendementGlobal) }}</div></div><div class="kpi-lbl">Rendement global</div></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.dl-page { color: #1b2733; }
.dl-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 4px 0 18px; flex-wrap: wrap; }
.dl-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.dl-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.controls { display: flex; align-items: center; gap: 10px; }
.controls select { font-size: 14px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 500; color: #1b2733; min-width: 280px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }
.hint-select { color: #64748b; font-size: 14px; padding: 8px 2px; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: #0c5f59; }

.dossier { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 26px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.doc-title { display: flex; align-items: center; gap: 12px; padding-bottom: 16px; border-bottom: 2px solid #0f2a33; margin-bottom: 8px; }
.doc-title h2 { margin: 0; font-size: 22px; }

.block { padding: 18px 0; border-bottom: 1px solid #eef2f6; }
.block:last-child { border-bottom: 0; padding-bottom: 0; }
.block h3 { margin: 0 0 14px; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: #0f766e; }
.block-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.block-head h3 { margin: 0; }
.rdt-tag { font-size: 13px; color: #475569; }
.rdt-tag strong { color: #0f766e; }

.info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px 22px; font-size: 14px; }
.info-grid .lbl, .comment .lbl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; margin-bottom: 3px; }
.comment { margin-top: 16px; font-size: 14px; }

table.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
table.grid th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 7px 9px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 8px 9px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.right { text-align: right; }
.strong { font-weight: 700; }
.empty { color: #94a3b8; text-align: center; padding: 14px; font-style: italic; }
.rdt-bas { color: #b91c1c; font-weight: 700; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.badge.sm { font-size: 11px; padding: 1px 8px; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 14px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

@media (max-width: 820px) {
  .info-grid { grid-template-columns: 1fr 1fr; }
  .kpi-row { grid-template-columns: 1fr 1fr; }
  .controls select { min-width: 0; flex: 1; }
}
@media print {
  .no-print { display: none !important; }
  .dossier { border: 0; box-shadow: none; padding: 0; }
}
.lot-picker { display: flex; flex-direction: column; gap: 6px; min-width: 320px; }
.lot-search { font-size: 14px; padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; width: 100%; box-sizing: border-box; }
.lot-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.bilan { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap; }
.bilan-box { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
.bilan-ic { width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px; }
.bilan-ic svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.bilan-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #1b2733; }
.bilan-pct { font-size: 14px; color: #64748b; font-weight: 600; }
.bilan-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
.bilan-op { display: flex; align-items: center; font-size: 22px; font-weight: 700; color: #cbd5e1; }
.bilan-note { font-size: 12px; color: #94a3b8; margin: 12px 0 0; line-height: 1.5; }
.ch-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.btn-toggle { background: #fff; border: 1px solid #cbd5e1; color: #0f766e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
.btn-toggle:hover { background: #f0fdfa; border-color: #0f766e; }
.empty-inline { color: #94a3b8; font-size: 13px; margin: 4px 0 0; }
@media print { .cond-grid { display: table !important; } }
.lot-filters { display: flex; gap: 6px; }
.lot-filters select { min-width: 0; flex: 1; font-size: 13px; padding: 8px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 500; }
</style>
