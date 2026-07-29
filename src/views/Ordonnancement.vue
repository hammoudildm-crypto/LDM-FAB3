<template>
  <div class="ordo">
    <div class="ordo-head">
      <div>
        <div class="oh-eyebrow">Planification atelier</div>
        <h1 class="oh-title">Ordonnancement — simulateur</h1>
        <p class="oh-sub">Gamme complète datée : chaque lot enchaîne ses phases jusqu'au conditionnement.</p>
      </div>
    </div>

    <!-- Paramètres -->
    <section class="card">
      <div class="add-grid">
        <div class="add-field">
          <label>Date de départ</label>
          <input type="date" v-model="dateDepart" />
        </div>
        <div class="add-field">
          <label>Régime</label>
          <select v-model.number="hpj">
            <option :value="8">1×8 (8 h/j)</option>
            <option :value="16">2×8 (16 h/j)</option>
            <option :value="24">3×8 (24 h/j)</option>
          </select>
        </div>
        <div class="add-field chk-wk">
          <label>Week-end</label>
          <label class="wk"><input type="checkbox" v-model="skipWeekend" /> Ne pas travailler le week-end</label>
        </div>
      </div>
    </section>

    <!-- Ajout de produits -->
    <section class="card">
      <div class="add-grid">
        <div class="add-field grow">
          <label>Produit</label>
          <input type="search" v-model="rechercheProduit" class="prod-search" placeholder="Filtrer par code ou désignation…" />
          <select v-model="selProduit">
            <option value="">— Choisir un produit ({{ produitsAffiches.length }}) —</option>
            <option v-for="p in produitsAffiches" :key="p.id" :value="p.id">{{ p.code_pf }} · {{ p.designation }}</option>
          </select>
        </div>
        <div class="add-field"><label>Quantité / lot (boîtes)</label><input type="number" min="1" v-model="selBoites" /></div>
        <div class="add-field"><label>Nombre de lots</label><input type="number" min="1" v-model="selNb" @keyup.enter="ajouter" /></div>
        <button class="btn-add" @click="ajouter" :disabled="!selProduit || !(Number(selBoites) > 0) || !(Number(selNb) > 0)">Ajouter</button>
      </div>
      <p v-if="chargement" class="muted">Chargement…</p>
      <p v-else-if="selProduit && !gammeProduit(selProduit).length" class="muted warn">Aucune phase cadencée trouvée pour ce produit (gamme ou cadences manquantes).</p>
    </section>

    <!-- Groupes ajoutés -->
    <section v-if="groupes.length" class="card">
      <h2 class="card-title">Produits ({{ groupes.length }}) · {{ lotsDeployes.length }} lots au total</h2>
      <div class="tbl-wrap">
        <table class="grid">
          <thead><tr><th>Produit</th><th class="ta-r">Boîtes/lot</th><th class="ta-r">Lots</th><th>Gamme</th><th class="ta-r">CA</th><th></th></tr></thead>
          <tbody>
            <tr v-for="g in groupesDetail" :key="g.id">
              <td><span class="lot-dot" :style="{ background: g.couleur }"></span><strong>{{ g.code }}</strong> <span class="lot-desig">{{ g.desig }}</span></td>
              <td class="ta-r">{{ fmt(g.boites) }}</td>
              <td class="ta-r">{{ g.nb }}</td>
              <td class="gamme-cell">{{ g.gammeNoms }}</td>
              <td class="ta-r">{{ fmtDA(g.ca) }}</td>
              <td class="ta-r"><button class="lnk-del" @click="retirer(g.id)">✕</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="tot"><td>Total</td><td></td><td class="ta-r">{{ lotsDeployes.length }}</td><td></td><td class="ta-r">{{ fmtDA(totalCA) }}</td><td></td></tr></tfoot>
        </table>
      </div>
    </section>

    <!-- Planning daté -->
    <section v-if="planning.length" class="card">
      <h2 class="card-title">Planning — {{ fmtDate(dateIdx(0)) }} → {{ fmtDate(dateIdx(finGlobale)) }}</h2>
      <div class="tbl-wrap">
        <table class="grid plan">
          <thead>
            <tr>
              <th>N°</th><th>Produit</th><th class="ta-r">Boîtes</th>
              <th v-for="k in colonnes" :key="k" colspan="2" class="ph-h">{{ PHASE_NOM[k] }}</th>
            </tr>
            <tr class="sub">
              <th></th><th></th><th></th>
              <template v-for="k in colonnes" :key="k"><th class="dd">Début</th><th class="dd">Fin</th></template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in planning" :key="r.id">
              <td class="num">{{ r.num }}</td>
              <td><span class="lot-dot" :style="{ background: r.couleur }"></span>{{ r.code }}</td>
              <td class="ta-r">{{ fmt(r.boites) }}</td>
              <template v-for="k in colonnes" :key="k">
                <td class="dcell">{{ r.phases[k] ? fmtDate(dateIdx(r.phases[k].start)) : '' }}</td>
                <td class="dcell fin">{{ r.phases[k] ? fmtDate(dateIdx(r.phases[k].end)) : '' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="gantt-legend">Chaque phase démarre après la précédente du lot ET quand l'équipement se libère. Durée = (boîtes × unités/boîte) ÷ cadence, convertie en jours ({{ hpj }} h/j).</p>
    </section>

    <section v-if="groupes.length" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ fmtDA(totalCA) }}</div><div class="km-lbl">CA total</div></div>
      <div class="kpi-mini"><div class="km-val">{{ lotsDeployes.length }}</div><div class="km-lbl">Lots</div></div>
      <div class="kpi-mini"><div class="km-val">{{ finGlobale + 1 }} j</div><div class="km-lbl">Jours ouvrés</div></div>
      <div class="kpi-mini"><div class="km-val">{{ fmtDate(dateIdx(finGlobale)) }}</div><div class="km-lbl">Fin de planning</div></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const PALETTE = ['#0f766e', '#4338ca', '#c2410c', '#047857', '#7c3aed', '#0369a1', '#b91c1c', '#a16207', '#be185d', '#15803d']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const PHASE_ORDRE = ['pesee', 'granulation', 'sechage', 'melange', 'compression', 'remplissage', 'pelliculage', 'conditionnement']
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k

const produits = ref([]), equipements = ref([]), cadences = ref([]), chargement = ref(true)
const groupes = ref([])   // { id, produitId, boites, nbLots }
const dateDepart = ref(new Date().toISOString().slice(0, 10))
const skipWeekend = ref(true)
const hpj = ref(24)
const selProduit = ref(''), rechercheProduit = ref(''), selBoites = ref(''), selNb = ref(1)
let seq = 1

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') }
function fmtDA(n) { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA' : Math.round(v).toLocaleString('fr-FR') + ' DA' }
function fmtDate(d) { return d ? d.toLocaleDateString('fr-FR') : '' }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  const [rp, re, rc] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite, gamme').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)),
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
function phaseKeyFromName(name) {
  const t = String(name || '').toLowerCase().trim()
  if (NOM_KEY[t]) return NOM_KEY[t]
  if (/pes/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|capsul/.test(t)) return 'remplissage'
  if (/compress|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) m[c.equipement_id + '|' + c.produit_id] = Number(c.cadence_nominale || 0); return m })
const couleur = (i) => PALETTE[i % PALETTE.length]

const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const produitsAffiches = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})

// Séquence de phases d'un produit = gamme (mappée en clés) + conditionnement final.
function gammeProduit(produitId) {
  const p = prodById.value[produitId]
  const g = (p && Array.isArray(p.gamme)) ? p.gamme : []
  const keys = []
  for (const n of g) { const k = phaseKeyFromName(n); if (k && k !== 'conditionnement' && !keys.includes(k)) keys.push(k) }
  keys.push('conditionnement')
  return keys
}
function gammeNoms(produitId) { return gammeProduit(produitId).map(k => PHASE_NOM[k]).join(' → ') }

function ajouter() {
  if (!selProduit.value || !(Number(selBoites.value) > 0) || !(Number(selNb.value) > 0)) return
  groupes.value.push({ id: seq++, produitId: selProduit.value, boites: Number(selBoites.value), nbLots: Math.min(60, Number(selNb.value)) })
}
function retirer(id) { groupes.value = groupes.value.filter(g => g.id !== id) }

// Déploiement en lots individuels (numérotés par produit).
const lotsDeployes = computed(() => {
  const out = []
  groupes.value.forEach((g, gi) => {
    for (let i = 1; i <= g.nbLots; i++) out.push({ id: g.id * 1000 + i, produitId: g.produitId, boites: g.boites, num: i, couleur: couleur(gi) })
  })
  return out
})

function dureeJours(equipId, produitId, boites) {
  const p = prodById.value[produitId]; if (!p) return 1
  const cad = cadMap.value[equipId + '|' + produitId]
  if (!(cad > 0)) return 1
  const heures = boites / cad   // cadence en boîtes/h
  return Math.max(1, Math.ceil(heures / hpj.value))
}

// Calendrier de jours ouvrés à partir de la date de départ.
const joursOuvres = computed(() => {
  const out = []; const d = new Date(dateDepart.value + 'T00:00:00')
  let guard = 0
  while (out.length < 900 && guard < 2000) {
    const wd = d.getDay()
    if (!skipWeekend.value || (wd !== 0 && wd !== 6)) out.push(new Date(d))
    d.setDate(d.getDate() + 1); guard++
  }
  return out
})
function dateIdx(idx) { const a = joursOuvres.value; return a.length ? a[Math.max(0, Math.min(idx, a.length - 1))] : null }

// Ordonnancement : chaque lot enchaîne sa gamme, chaque phase après la précédente ET la libération de l'équipement.
const planning = computed(() => {
  const slots = {}   // equipId -> tableau des prochains jours libres (1 entrée par machine)
  function slotsDe(e) {
    if (!slots[e.id]) { const n = Math.max(1, Math.floor(Number(e.nb_machines) || 1)); slots[e.id] = new Array(n).fill(0) }
    return slots[e.id]
  }
  const rows = []
  for (const lt of lotsDeployes.value) {
    const seqPh = gammeProduit(lt.produitId)
    const p = prodById.value[lt.produitId] || {}
    let prevEnd = -1
    const phases = {}
    for (const k of seqPh) {
      const compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + lt.produitId] > 0)
      if (!compat.length) continue
      // machine (équipement + créneau) qui se libère le plus tôt
      let eq = null, si = -1, libre = Infinity
      for (const e of compat) { const arr = slotsDe(e); for (let i = 0; i < arr.length; i++) if (arr[i] < libre) { libre = arr[i]; eq = e; si = i } }
      const duree = dureeJours(eq.id, lt.produitId, lt.boites)
      const start = Math.max(prevEnd + 1, slotsDe(eq)[si] || 0)
      const end = start + duree - 1
      phases[k] = { start, end, equip: eq.nom || eq.code }
      slotsDe(eq)[si] = end + 1
      prevEnd = end
    }
    rows.push({ id: lt.id, num: lt.num, code: p.code_pf, boites: lt.boites, couleur: lt.couleur, phases })
  }
  return rows
})

const colonnes = computed(() => {
  const used = new Set()
  for (const r of planning.value) for (const k in r.phases) used.add(k)
  return PHASE_ORDRE.filter(k => used.has(k))
})
const finGlobale = computed(() => {
  let m = 0
  for (const r of planning.value) for (const k in r.phases) m = Math.max(m, r.phases[k].end)
  return m
})

const groupesDetail = computed(() => groupes.value.map((g, gi) => {
  const p = prodById.value[g.produitId] || {}
  return { id: g.id, code: p.code_pf || '?', desig: p.designation || '', boites: g.boites, nb: g.nbLots, gammeNoms: gammeNoms(g.produitId), ca: g.boites * g.nbLots * Number(p.pcsu || 0), couleur: couleur(gi) }
}))
const totalCA = computed(() => groupesDetail.value.reduce((s, g) => s + g.ca, 0))
</script>

<style scoped>
.ordo { max-width: 1240px; margin: 0 auto; padding: 6px 4px 24px; }
.ordo-head { margin-bottom: 20px; }
.oh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.oh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.oh-sub { font-size: 13.5px; color: #64748b; }

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
.wk { font-size: 13px; color: #334155; font-weight: 500; display: inline-flex; align-items: center; gap: 7px; padding: 7px 0; text-transform: none; letter-spacing: 0; }
.btn-add { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 18px; cursor: pointer; }
.btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th, .grid td { padding: 7px 10px; border-bottom: 1px solid #eef2f6; text-align: left; white-space: nowrap; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; }
.lot-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; vertical-align: middle; }
.lot-desig { color: #94a3b8; font-size: 12px; }
.gamme-cell { font-size: 12px; color: #475569; white-space: normal; }
.tot td { font-weight: 800; border-top: 2px solid #e2e8f0; background: #f8fafc; }
.lnk-del { background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 14px; }
.lnk-del:hover { color: #b91c1c; }

.plan th.ph-h { text-align: center; background: #f1f5f9; border-left: 2px solid #e2e8f0; }
.plan tr.sub th.dd { font-size: 10.5px; color: #94a3b8; font-weight: 600; }
.plan td.num { color: #94a3b8; font-weight: 700; }
.plan td.dcell { font-size: 12px; color: #334155; }
.plan td.dcell.fin { color: #64748b; border-right: 2px solid #f1f5f9; }

.gantt-legend { font-size: 12px; color: #64748b; margin-top: 12px; font-style: italic; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } .add-field.grow { min-width: 100%; } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 20px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
</style>
