<template>
  <div class="ordo">
    <div class="ordo-head">
      <div>
        <div class="oh-eyebrow">Planification atelier</div>
        <h1 class="oh-title">Ordonnancement — simulateur</h1>
        <p class="oh-sub">Sélection manuelle des équipements. Le conditionnement d'un lot démarre après sa fabrication.</p>
      </div>
      <div class="oh-regime">
        <label>Régime de la semaine</label>
        <select v-model.number="regimeH">
          <option :value="40">1×8 (40 h)</option>
          <option :value="80">2×8 (80 h)</option>
          <option :value="120">3×8 (120 h)</option>
        </select>
      </div>
    </div>

    <section class="card">
      <div class="add-grid">
        <div class="add-field grow">
          <label>Produit</label>
          <input type="search" v-model="rechercheProduit" class="prod-search" placeholder="Filtrer par code ou désignation…" />
          <select v-model="selProduit" @change="onProduit">
            <option value="">— Choisir un produit ({{ produitsFiltres.length }}) —</option>
            <option v-for="p in produitsFiltres" :key="p.id" :value="p.id">{{ p.code_pf }} · {{ p.designation }}</option>
          </select>
        </div>
        <div class="add-field">
          <label>Quantité (boîtes)</label>
          <input type="number" min="1" v-model="selBoites" @keyup.enter="ajouter" />
        </div>
        <div class="add-field">
          <label>Équipement fabrication</label>
          <select v-model="selFab">
            <option value="">— Choisir —</option>
            <option v-for="e in fabEquipsProduit" :key="e.id" :value="e.id">{{ e.label }}</option>
          </select>
        </div>
        <div class="add-field">
          <label>Ligne conditionnement</label>
          <select v-model="selCond">
            <option value="">— Choisir —</option>
            <option v-for="e in condEquipsProduit" :key="e.id" :value="e.id">{{ e.nom || e.code }}</option>
          </select>
        </div>
        <button class="btn-add" @click="ajouter" :disabled="!peutAjouter">Ajouter</button>
      </div>
      <p v-if="chargement" class="muted">Chargement…</p>
      <p v-else-if="selProduit && !fabEquipsProduit.length" class="muted warn">Aucun équipement de fabrication cadencé pour ce produit.</p>
      <p v-else-if="selProduit && !condEquipsProduit.length" class="muted warn">Aucune ligne de conditionnement cadencée pour ce produit.</p>
    </section>

    <section v-if="lots.length" class="card">
      <h2 class="card-title">Lots à ordonnancer ({{ lots.length }})</h2>
      <div class="tbl-wrap">
        <table class="grid">
          <thead><tr><th>Produit</th><th class="ta-r">Boîtes</th><th>Fabrication</th><th>Conditionnement</th><th class="ta-r">CA</th><th></th></tr></thead>
          <tbody>
            <tr v-for="d in detailLots" :key="d.id">
              <td><span class="lot-dot" :style="{ background: d.couleur }"></span><strong>{{ d.code }}</strong> <span class="lot-desig">{{ d.desig }}</span></td>
              <td class="ta-r">{{ fmt(d.boites) }}</td>
              <td>{{ d.fabNom }} <span class="lot-desig">· {{ d.dureeFab.toFixed(1) }} h</span></td>
              <td>{{ d.condNom }} <span class="lot-desig">· {{ d.dureeCond.toFixed(1) }} h</span></td>
              <td class="ta-r">{{ fmtDA(d.ca) }}</td>
              <td class="ta-r"><button class="lnk-del" @click="retirer(d.id)">✕</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="tot"><td>Total</td><td class="ta-r">{{ fmt(totalBoites) }}</td><td></td><td></td><td class="ta-r">{{ fmtDA(totalCA) }}</td><td></td></tr></tfoot>
        </table>
      </div>
    </section>

    <section v-if="lots.length" class="card">
      <h2 class="card-title">Frise de la semaine</h2>

      <div class="sec-title"><span class="sec-tag fab">Fabrication</span></div>
      <div class="gantt">
        <div v-for="l in plan.fab" :key="l.id" class="gline">
          <div class="gline-head"><span class="gline-nom">{{ l.nom }}</span><span class="gline-load" :class="{ over: l.fin > regimeH }">{{ l.fin.toFixed(1) }} h · {{ Math.round(l.fin / regimeH * 100) }} %</span></div>
          <div class="gtrack">
            <div v-for="s in l.lots" :key="s.id" class="gseg" :style="{ left: (s.debut / echelle * 100) + '%', width: (s.duree / echelle * 100) + '%', background: s.couleur }" :title="s.code + ' · ' + s.duree.toFixed(1) + ' h'"><span class="gseg-tx">{{ s.code }}</span></div>
            <div class="gcap" :style="{ left: (regimeH / echelle * 100) + '%' }"></div>
          </div>
        </div>
        <div v-if="!plan.fab.length" class="muted">Aucun équipement de fabrication utilisé.</div>
      </div>

      <div class="sec-title cond"><span class="sec-tag cond">Conditionnement</span> <span class="sec-note">démarre après la fabrication du lot</span></div>
      <div class="gantt">
        <div v-for="l in plan.cond" :key="l.id" class="gline">
          <div class="gline-head"><span class="gline-nom">{{ l.nom }}</span><span class="gline-load" :class="{ over: l.fin > regimeH }">{{ l.fin.toFixed(1) }} h · {{ Math.round(l.fin / regimeH * 100) }} %</span></div>
          <div class="gtrack">
            <div v-for="s in l.lots" :key="s.id" class="gseg" :style="{ left: (s.debut / echelle * 100) + '%', width: (s.duree / echelle * 100) + '%', background: s.couleur }" :title="s.code + ' · ' + s.duree.toFixed(1) + ' h' + (s.attente > 0.05 ? ' · attend la fab (' + s.attente.toFixed(1) + ' h)' : '')"><span class="gseg-tx">{{ s.code }}</span></div>
            <div class="gcap" :style="{ left: (regimeH / echelle * 100) + '%' }"></div>
          </div>
        </div>
        <div v-if="!plan.cond.length" class="muted">Aucune ligne de conditionnement utilisée.</div>
      </div>

      <div class="gantt-legend"><span class="lg-cap"></span> Repère = capacité semaine ({{ regimeH }} h). Un trou avant un bloc de conditionnement = attente de la fin de fabrication.</div>
    </section>

    <section v-if="lots.length" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ fmtDA(totalCA) }}</div><div class="km-lbl">CA total semaine</div></div>
      <div class="kpi-mini"><div class="km-val">{{ finFabMax.toFixed(0) }} h</div><div class="km-lbl">Fin fabrication (au plus tard)</div></div>
      <div class="kpi-mini"><div class="km-val">{{ finCondMax.toFixed(0) }} h</div><div class="km-lbl">Fin conditionnement</div></div>
      <div class="kpi-mini"><div class="km-val" :class="{ 'km-bad': surcharge > 0 }">{{ surcharge }}</div><div class="km-lbl">Équipement(s) en surcharge</div></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const PALETTE = ['#0f766e', '#4338ca', '#c2410c', '#047857', '#7c3aed', '#0369a1', '#b91c1c', '#a16207', '#be185d', '#15803d']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage Gélules', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }

const produits = ref([]), equipements = ref([]), cadences = ref([]), chargement = ref(true)
const lots = ref([])   // { id, produitId, boites, fabEquipId, condEquipId }
const selProduit = ref(''), rechercheProduit = ref(''), selBoites = ref(''), selFab = ref(''), selCond = ref('')
const regimeH = ref(120)
let seq = 1

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') }
function fmtDA(n) { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA' : Math.round(v).toLocaleString('fr-FR') + ' DA' }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  const [rp, re, rc] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode'))
  ])
  produits.value = rp; equipements.value = re; cadences.value = rc; chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const equipById = computed(() => { const m = {}; for (const e of equipements.value) m[e.id] = e; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) m[c.equipement_id + '|' + c.produit_id] = Number(c.cadence_nominale || 0); return m })
const couleurLot = (id) => PALETTE[(id - 1) % PALETTE.length]

const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})

// Équipements cadencés pour le produit sélectionné (fabrication vs conditionnement).
const fabEquipsProduit = computed(() => {
  if (!selProduit.value) return []
  return equipements.value.filter(e => { const ph = phaseDeType(e.type); return ph && ph !== 'conditionnement' && cadMap.value[e.id + '|' + selProduit.value] > 0 })
    .map(e => ({ id: e.id, label: (e.nom || e.code) + ' (' + (PHASE_NOM[phaseDeType(e.type)] || '?') + ')' }))
})
const condEquipsProduit = computed(() => {
  if (!selProduit.value) return []
  return equipements.value.filter(e => phaseDeType(e.type) === 'conditionnement' && cadMap.value[e.id + '|' + selProduit.value] > 0)
})

function onProduit() { selFab.value = ''; selCond.value = '' }
const peutAjouter = computed(() => selProduit.value && Number(selBoites.value) > 0 && selFab.value && selCond.value)
function ajouter() {
  if (!peutAjouter.value) return
  lots.value.push({ id: seq++, produitId: selProduit.value, boites: Number(selBoites.value), fabEquipId: selFab.value, condEquipId: selCond.value })
  selBoites.value = ''
}
function retirer(id) { lots.value = lots.value.filter(l => l.id !== id) }

function dureeDe(equipId, produitId, boites) {
  const p = prodById.value[produitId]; if (!p) return 0
  const cad = cadMap.value[equipId + '|' + produitId]
  const units = boites * Number(p.unites_par_boite || 1)
  return cad > 0 ? units / cad : 0
}

// Ordonnancement 2 passes : fabrication (par équipement), puis conditionnement (démarre après la fab du lot).
const plan = computed(() => {
  const fabRows = {}, fabFin = {}
  for (const lt of lots.value) {
    const eq = equipById.value[lt.fabEquipId]; if (!eq) continue
    if (!fabRows[eq.id]) fabRows[eq.id] = { id: eq.id, nom: (eq.nom || eq.code) + ' (' + (PHASE_NOM[phaseDeType(eq.type)] || '?') + ')', fin: 0, lots: [] }
    const row = fabRows[eq.id]
    const duree = dureeDe(eq.id, lt.produitId, lt.boites)
    const p = prodById.value[lt.produitId] || {}
    row.lots.push({ id: lt.id, code: p.code_pf, debut: row.fin, duree, couleur: couleurLot(lt.id) })
    fabFin[lt.id] = row.fin + duree
    row.fin += duree
  }
  const condRows = {}
  for (const lt of lots.value) {
    const eq = equipById.value[lt.condEquipId]; if (!eq) continue
    if (!condRows[eq.id]) condRows[eq.id] = { id: eq.id, nom: eq.nom || eq.code, fin: 0, lots: [] }
    const row = condRows[eq.id]
    const duree = dureeDe(eq.id, lt.produitId, lt.boites)
    const debut = Math.max(row.fin, fabFin[lt.id] || 0)
    const p = prodById.value[lt.produitId] || {}
    row.lots.push({ id: lt.id, code: p.code_pf, debut, duree, couleur: couleurLot(lt.id), attente: debut - row.fin })
    row.fin = debut + duree
  }
  return { fab: Object.values(fabRows), cond: Object.values(condRows), fabFin }
})

const detailLots = computed(() => lots.value.map(lt => {
  const p = prodById.value[lt.produitId] || {}
  const fe = equipById.value[lt.fabEquipId] || {}, ce = equipById.value[lt.condEquipId] || {}
  const boites = Number(lt.boites || 0)
  return {
    id: lt.id, code: p.code_pf || '?', desig: p.designation || '', boites, ca: boites * Number(p.pcsu || 0),
    fabNom: (fe.nom || fe.code || '?'), condNom: (ce.nom || ce.code || '?'),
    dureeFab: dureeDe(lt.fabEquipId, lt.produitId, boites), dureeCond: dureeDe(lt.condEquipId, lt.produitId, boites),
    couleur: couleurLot(lt.id)
  }
}))

const totalCA = computed(() => detailLots.value.reduce((s, d) => s + d.ca, 0))
const totalBoites = computed(() => detailLots.value.reduce((s, d) => s + d.boites, 0))
const finFabMax = computed(() => Math.max(0, ...plan.value.fab.map(l => l.fin)))
const finCondMax = computed(() => Math.max(0, ...plan.value.cond.map(l => l.fin)))
const surcharge = computed(() => [...plan.value.fab, ...plan.value.cond].filter(l => l.fin > regimeH.value).length)
const echelle = computed(() => Math.max(regimeH.value, finFabMax.value, finCondMax.value, 1))
</script>

<style scoped>
.ordo { max-width: 1160px; margin: 0 auto; padding: 6px 4px 24px; }
.ordo-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
.oh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.oh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.oh-sub { font-size: 13.5px; color: #64748b; }
.oh-regime { display: flex; flex-direction: column; gap: 4px; }
.oh-regime label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.oh-regime select { padding: 7px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0 0 14px; }
.muted { font-size: 13px; color: #94a3b8; margin: 10px 0 0; }
.muted.warn { color: #b45309; }

.add-grid { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.add-field { display: flex; flex-direction: column; gap: 5px; }
.add-field.grow { flex: 1; min-width: 240px; }
.add-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.add-field select, .add-field input { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.prod-search { margin-bottom: 6px; }
.btn-add { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 18px; cursor: pointer; }
.btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.grid th, .grid td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; text-align: left; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; }
.lot-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; vertical-align: middle; }
.lot-desig { color: #94a3b8; font-size: 12px; }
.tot td { font-weight: 800; border-top: 2px solid #e2e8f0; background: #f8fafc; }
.lnk-del { background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 14px; }
.lnk-del:hover { color: #b91c1c; }

.sec-title { display: flex; align-items: center; gap: 10px; margin: 6px 0 10px; }
.sec-title.cond { margin-top: 22px; }
.sec-tag { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; padding: 3px 10px; border-radius: 999px; }
.sec-tag.fab { background: #cffafe; color: #155e75; }
.sec-tag.cond { background: #ede9fe; color: #5b21b6; }
.sec-note { font-size: 12px; color: #94a3b8; font-style: italic; }

.gantt { display: flex; flex-direction: column; gap: 11px; }
.gline-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.gline-nom { font-size: 13px; font-weight: 700; color: #334155; }
.gline-load { font-size: 12px; font-weight: 700; color: #64748b; }
.gline-load.over { color: #b91c1c; }
.gtrack { position: relative; height: 28px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.gseg { position: absolute; top: 0; height: 100%; display: flex; align-items: center; padding: 0 6px; box-sizing: border-box; border-right: 1px solid rgba(255,255,255,.6); overflow: hidden; }
.gseg-tx { font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.gcap { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #0f172a; z-index: 2; }
.gantt-legend { font-size: 12px; color: #64748b; margin-top: 14px; display: flex; align-items: center; gap: 7px; }
.lg-cap { display: inline-block; width: 2px; height: 14px; background: #0f172a; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } .add-field.grow { min-width: 100%; } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-val.km-bad { color: #b91c1c; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
</style>
