<template>
  <div class="ordo">
    <div class="ordo-head">
      <div>
        <div class="oh-eyebrow">Planification atelier</div>
        <h1 class="oh-title">Ordonnancement — simulateur</h1>
        <p class="oh-sub">Sélectionne des lots, ils sont répartis sur les lignes de conditionnement de la semaine.</p>
      </div>
      <div class="oh-regime">
        <label>Régime de la semaine</label>
        <select v-model.number="regimeH">
          <option :value="40">1×8 (40 h/ligne)</option>
          <option :value="80">2×8 (80 h/ligne)</option>
          <option :value="120">3×8 (120 h/ligne)</option>
        </select>
      </div>
    </div>

    <!-- Ajout d'un lot -->
    <section class="card">
      <div class="add-row">
        <div class="add-field grow">
          <label>Produit</label>
          <div class="prod-pick">
            <input type="search" v-model="rechercheProduit" class="prod-search" placeholder="Filtrer par code ou désignation…" />
            <select v-model="selProduit">
              <option value="">— Choisir un produit ({{ produitsFiltres.length }}) —</option>
              <option v-for="p in produitsFiltres" :key="p.id" :value="p.id">{{ p.code_pf }} · {{ p.designation }}</option>
            </select>
          </div>
        </div>
        <div class="add-field">
          <label>Quantité (boîtes)</label>
          <input type="number" min="1" v-model="selBoites" placeholder="ex. 50000" @keyup.enter="ajouter" />
        </div>
        <button class="btn-add" @click="ajouter" :disabled="!selProduit || !(Number(selBoites) > 0)">Ajouter le lot</button>
      </div>
      <p v-if="chargement" class="muted">Chargement des produits et cadences…</p>
    </section>

    <!-- Lots sélectionnés -->
    <section v-if="lots.length" class="card">
      <h2 class="card-title">Lots à ordonnancer ({{ lots.length }})</h2>
      <div class="tbl-wrap">
        <table class="grid">
          <thead><tr><th>Produit</th><th class="ta-r">Boîtes</th><th>Ligne conditionnement</th><th class="ta-r">Durée</th><th class="ta-r">CA</th><th></th></tr></thead>
          <tbody>
            <tr v-for="d in detailLots" :key="d.id">
              <td><span class="lot-dot" :style="{ background: d.couleur }"></span><strong>{{ d.code }}</strong> <span class="lot-desig">{{ d.desig }}</span></td>
              <td class="ta-r">{{ fmt(d.boites) }}</td>
              <td><span :class="{ 'lot-warn': !d.ligneNom }">{{ d.ligneNom || 'aucune ligne cadencée' }}</span></td>
              <td class="ta-r">{{ d.duree != null ? d.duree.toFixed(1) + ' h' : '—' }}</td>
              <td class="ta-r">{{ fmtDA(d.ca) }}</td>
              <td class="ta-r"><button class="lnk-del" @click="retirer(d.id)" title="Retirer">✕</button></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="tot">
              <td>Total</td>
              <td class="ta-r">{{ fmt(totalBoites) }}</td>
              <td></td>
              <td class="ta-r">{{ totalHeures.toFixed(1) }} h</td>
              <td class="ta-r">{{ fmtDA(totalCA) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- Frise semaine par ligne -->
    <section v-if="lots.length" class="card">
      <h2 class="card-title">Frise de la semaine — lignes de conditionnement</h2>
      <div class="gantt">
        <div v-for="l in plan.lignes" :key="l.id" class="gline">
          <div class="gline-head">
            <span class="gline-nom">{{ l.nom }}</span>
            <span class="gline-load" :class="{ over: l.heures > regimeH }">{{ l.heures.toFixed(1) }} h / {{ regimeH }} h · {{ Math.round(l.heures / regimeH * 100) }} %</span>
          </div>
          <div class="gtrack">
            <div v-for="s in l.lots" :key="s.id" class="gseg" :style="{ left: (s.debut / echelle * 100) + '%', width: (s.duree / echelle * 100) + '%', background: s.couleur }" :title="s.code + ' — ' + fmt(s.boites) + ' bts · ' + s.duree.toFixed(1) + ' h'">
              <span class="gseg-tx">{{ s.code }}</span>
            </div>
            <div class="gcap" :style="{ left: (regimeH / echelle * 100) + '%' }" title="Capacité de la semaine"></div>
          </div>
        </div>
        <div v-if="!plan.lignes.length" class="muted">Aucune ligne de conditionnement trouvée.</div>
      </div>
      <div class="gantt-legend">
        <span class="lg-cap"></span> Capacité semaine ({{ regimeH }} h) · les segments au-delà du repère sont en surcharge.
      </div>

      <div v-if="plan.nonPlanifies.length" class="np">
        <strong>⚠ Non planifiés</strong> — pas de ligne de conditionnement cadencée pour :
        <span v-for="n in plan.nonPlanifies" :key="n.id" class="np-chip">{{ n.code }}</span>
      </div>
    </section>

    <!-- Synthèse -->
    <section v-if="lots.length" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ fmtDA(totalCA) }}</div><div class="km-lbl">CA total de la semaine</div></div>
      <div class="kpi-mini"><div class="km-val">{{ totalHeures.toFixed(0) }} h</div><div class="km-lbl">Heures de conditionnement</div></div>
      <div class="kpi-mini"><div class="km-val">{{ lots.length }}</div><div class="km-lbl">Lots</div></div>
      <div class="kpi-mini"><div class="km-val" :class="{ 'km-bad': lignesSurchargees > 0 }">{{ lignesSurchargees }}</div><div class="km-lbl">Ligne(s) en surcharge</div></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const PALETTE = ['#0f766e', '#4338ca', '#c2410c', '#047857', '#7c3aed', '#0369a1', '#b91c1c', '#a16207', '#be185d', '#15803d']

const produits = ref([])
const equipements = ref([])
const cadences = ref([])
const chargement = ref(true)

const lots = ref([])              // { id, produitId, boites }
const selProduit = ref('')
const rechercheProduit = ref('')
const selBoites = ref('')
const regimeH = ref(120)
let seq = 1

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') }
function fmtDA(n) {
  const v = Number(n) || 0
  return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA' : Math.round(v).toLocaleString('fr-FR') + ' DA'
}

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) {
    const r = await make().range(from, from + size - 1)
    if (r.error) return all
    all = all.concat(r.data || [])
    if (!r.data || r.data.length < size) break
    from += size
  }
  return all
}

onMounted(async () => {
  const [rp, re, rc] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode'))
  ])
  produits.value = rp
  equipements.value = re
  cadences.value = rc
  chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}

const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})
const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const condLignes = computed(() => equipements.value.filter(e => phaseDeType(e.type) === 'conditionnement'))
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) m[c.equipement_id + '|' + c.produit_id] = Number(c.cadence_nominale || 0); return m })
const couleurLot = (id) => PALETTE[(id - 1) % PALETTE.length]

function ajouter() {
  if (!selProduit.value || !(Number(selBoites.value) > 0)) return
  lots.value.push({ id: seq++, produitId: selProduit.value, boites: Number(selBoites.value) })
  selBoites.value = ''
}
function retirer(id) { lots.value = lots.value.filter(l => l.id !== id) }

// Affectation gloutonne équilibrée : chaque lot va sur la ligne cadencée la moins chargée.
const plan = computed(() => {
  const lignes = condLignes.value.map(l => ({ id: l.id, nom: l.nom || l.code, heures: 0, lots: [] }))
  const nonPlanifies = []
  for (const lt of lots.value) {
    const p = prodById.value[lt.produitId]; if (!p) continue
    const boites = Number(lt.boites || 0)
    const units = boites * Number(p.unites_par_boite || 1)
    const compat = lignes.filter(l => cadMap.value[l.id + '|' + lt.produitId] > 0)
    if (!compat.length) { nonPlanifies.push({ id: lt.id, code: p.code_pf }); continue }
    compat.sort((a, b) => a.heures - b.heures)
    const cible = compat[0]
    const cad = cadMap.value[cible.id + '|' + lt.produitId]
    const duree = cad > 0 ? units / cad : 0
    cible.lots.push({ id: lt.id, code: p.code_pf, boites, duree, debut: cible.heures, couleur: couleurLot(lt.id) })
    cible.heures += duree
  }
  return { lignes, nonPlanifies }
})

const detailLots = computed(() => lots.value.map(lt => {
  const p = prodById.value[lt.produitId] || {}
  const boites = Number(lt.boites || 0)
  const units = boites * Number(p.unites_par_boite || 1)
  // retrouver la ligne affectée
  let ligneNom = null, duree = null
  for (const l of plan.value.lignes) {
    const s = l.lots.find(x => x.id === lt.id)
    if (s) { ligneNom = l.nom; duree = s.duree; break }
  }
  return { id: lt.id, code: p.code_pf || '?', desig: p.designation || '', boites, ca: boites * Number(p.pcsu || 0), ligneNom, duree, couleur: couleurLot(lt.id) }
}))

const totalCA = computed(() => detailLots.value.reduce((s, d) => s + d.ca, 0))
const totalBoites = computed(() => detailLots.value.reduce((s, d) => s + d.boites, 0))
const totalHeures = computed(() => plan.value.lignes.reduce((s, l) => s + l.heures, 0))
const lignesSurchargees = computed(() => plan.value.lignes.filter(l => l.heures > regimeH.value).length)
const echelle = computed(() => Math.max(regimeH.value, ...plan.value.lignes.map(l => l.heures), 1))
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
.muted { font-size: 13px; color: #94a3b8; }

.add-row { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.add-field { display: flex; flex-direction: column; gap: 4px; }
.add-field.grow { flex: 1; min-width: 260px; }
.add-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.add-field select, .add-field input { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.prod-pick { display: flex; flex-direction: column; gap: 6px; }
.prod-search { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; width: 100%; }
.btn-add { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 18px; cursor: pointer; }
.btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.grid th, .grid td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; text-align: left; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; }
.lot-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; vertical-align: middle; }
.lot-desig { color: #94a3b8; font-size: 12px; }
.lot-warn { color: #b45309; font-weight: 600; }
.tot td { font-weight: 800; border-top: 2px solid #e2e8f0; background: #f8fafc; }
.lnk-del { background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 14px; }
.lnk-del:hover { color: #b91c1c; }

.gantt { display: flex; flex-direction: column; gap: 12px; }
.gline-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.gline-nom { font-size: 13px; font-weight: 700; color: #334155; }
.gline-load { font-size: 12px; font-weight: 700; color: #64748b; }
.gline-load.over { color: #b91c1c; }
.gtrack { position: relative; height: 30px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.gseg { position: absolute; top: 0; height: 100%; display: flex; align-items: center; padding: 0 6px; box-sizing: border-box; border-right: 1px solid rgba(255,255,255,.6); overflow: hidden; }
.gseg-tx { font-size: 11px; font-weight: 700; color: #fff; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
.gcap { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #0f172a; z-index: 2; }
.gcap::after { content: ""; position: absolute; top: 0; left: -3px; border: 4px solid transparent; border-top-color: #0f172a; }
.gantt-legend { font-size: 12px; color: #64748b; margin-top: 12px; display: flex; align-items: center; gap: 7px; }
.lg-cap { display: inline-block; width: 2px; height: 14px; background: #0f172a; }

.np { margin-top: 14px; font-size: 13px; color: #92400e; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 9px; padding: 10px 13px; }
.np-chip { display: inline-block; margin-left: 6px; padding: 2px 9px; background: #fef3c7; border-radius: 999px; font-weight: 600; font-size: 12px; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-val.km-bad { color: #b91c1c; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
</style>
