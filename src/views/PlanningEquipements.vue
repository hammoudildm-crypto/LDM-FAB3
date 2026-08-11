<template>
  <div class="pe-page">
    <div class="pe-head">
      <h1>Planning des équipements — Fabrication</h1>
      <p class="sub">Ordonnancement 24 h/24 sur 3 shifts (06–14 · 14–22 · 22–06), selon les cadences et les campagnes de nettoyage.</p>
    </div>

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <!-- Paramètres -->
    <section class="card params">
      <div class="p-grp"><label>Départ<input type="date" v-model="dateDepart" /></label></div>
      <div class="p-grp"><label>VDLT défaut (h)<input type="number" min="0" step="0.5" v-model.number="vdlt" /></label></div>
      <div class="p-grp"><label>VDLP défaut (h)<input type="number" min="0" step="0.5" v-model.number="vdlp" /></label></div>
      <div class="p-grp"><label>Holding défaut (j)<input type="number" min="0" step="1" v-model.number="holdingJ" /></label></div>
      <div class="p-grp" style="align-self:center;font-size:11px;color:#94a3b8;max-width:220px">VDLT/VDLP/Holding viennent des paramètres par équipement (page Cadences). Les défauts ne servent qu'en absence de valeur.</div>
      <div class="p-grp"><label>Année PDP<select v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select></label></div>
      <div class="p-grp"><label>Zoom<input type="range" min="1.5" max="10" step="0.5" v-model.number="pxH" /></label></div>
    </section>

    <!-- Légende -->
    <div class="legende">
      <span class="lg"><i class="sw sw-lot"></i>Lot (couleur = produit)</span>
      <span class="lg"><i class="sw sw-gen"></i>Nettoyage général (NG)</span>
      <span class="lg"><i class="sw sw-part"></i>Nettoyage partiel (NP)</span>
    </div>

    <div v-if="chargement" class="empty">Chargement…</div>
    <div v-else-if="!planning.length" class="empty">Aucun équipement de fabrication avec des cadences et un PDP pour {{ annee }}.</div>

    <!-- Gantt -->
    <section v-else class="card gantt-card">
      <div class="gantt">
        <!-- entête temps -->
        <div class="g-header">
          <div class="g-eqcol g-eqhead">Équipement</div>
          <div class="g-track g-timeline" :style="{ width: totalW + 'px' }">
            <div v-for="d in jours" :key="d.i" class="g-dcol" :style="{ left: d.left + 'px', width: d.w + 'px' }">
              <div class="g-dlbl">{{ d.label }}</div>
              <div class="g-shifts">
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">06</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">14</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">22</span>
              </div>
            </div>
          </div>
        </div>
        <!-- lignes -->
        <div v-for="row in planning" :key="row.eq.id" class="g-row">
          <div class="g-eqcol" :title="row.eq.nom">
            <div class="g-eqcode">{{ row.eq.code }}</div>
            <div class="g-eqnom">{{ row.eq.nom }}</div>
            <div class="g-eqfin">fin : {{ fmtJH(row.fin) }}</div>
            <label class="g-eqwe"><input type="checkbox" v-model="weekendEquip[row.eq.id]" /> week-ends</label>
          </div>
          <div class="g-track" :style="{ width: totalW + 'px' }">
            <!-- bandes jours -->
            <div v-for="d in jours" :key="'b'+d.i" class="g-dband" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <!-- bandes week-end (si l'équipement ne travaille pas le week-end) -->
            <template v-if="!weekendEquip[row.eq.id]">
              <div v-for="d in joursWeekend" :key="'w'+d.i" class="g-weekend" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            </template>
            <!-- barres (par segment) -->
            <template v-for="(t, i) in row.tasks">
              <div v-for="(seg, j) in t.segments" :key="i + '-' + j" class="g-bar" :class="'g-' + t.type"
                   :style="barStyleSeg(seg, t)" :title="titre(t)">
                <span v-if="j === 0" class="g-lbl">{{ t.type === 'lot' ? t.prod.code_pf : (t.type.startsWith('gen') ? 'NG' : 'NP') }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Récap -->
    <section v-if="!chargement && planning.length" class="card recap">
      <h3>Synthèse</h3>
      <div class="recap-grid">
        <div class="rc"><span class="rc-v">{{ planning.length }}</span><span class="rc-l">Équipements planifiés</span></div>
        <div class="rc"><span class="rc-v">{{ totalLots }}</span><span class="rc-l">Lots ordonnancés</span></div>
        <div class="rc"><span class="rc-v">{{ totalNG }}</span><span class="rc-l">Nettoyages généraux</span></div>
        <div class="rc"><span class="rc-v">{{ totalNP }}</span><span class="rc-l">Nettoyages partiels</span></div>
        <div class="rc"><span class="rc-v">{{ fmtJH(finGlobale) }}</span><span class="rc-l">Fin la plus tardive</span></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const chargement = ref(true)
const erreur = ref('')

// Paramètres (valeurs fixes réglables)
const today = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const dateDepart = ref(iso(today))
const vdlt = ref(8)        // nettoyage général (h)
const vdlp = ref(2)        // nettoyage partiel (h)
const holdingJ = ref(7)    // validité campagne (jours)
const annee = ref(today.getFullYear())
const pxH = ref(4)         // pixels par heure (zoom)
const weekendEquip = reactive({}) // par équipement : true = week-ends inclus

const holdingH = computed(() => Number(holdingJ.value) * 24)

// Données
const planRaw = ref([])
const cadences = ref([])
const equipements = ref([])
const produits = ref([])

async function fetchAllPaged(qb) {
  const size = 1000; let from = 0; const out = []
  while (true) {
    const { data, error } = await qb().range(from, from + size - 1)
    if (error) return { error }
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return { data: out }
}

onMounted(async () => {
  try {
    const [rp, rc, re, rpr] = await Promise.all([
      fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produit_id')),
      fetchAllPaged(() => supabase.from('cadences_produit').select('cadence_nominale, unite_cadence, mode, equipement_id, produit_id')),
      fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id, actif, vdlt, vdlp, dht, reglage, postes').eq('actif', true)),
      fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot, unites_par_boite, poids_unitaire_mg, gamme').eq('actif', true))
    ])
    if (rp.error || rc.error || re.error || rpr.error) { erreur.value = (rp.error || rc.error || re.error || rpr.error).message; return }
    planRaw.value = rp.data; cadences.value = rc.data; equipements.value = re.data; produits.value = rpr.data
  } catch (e) { erreur.value = String(e) } finally { chargement.value = false }
})

// Années dispo
const annees = computed(() => {
  const s = new Set(planRaw.value.map(r => Number(r.annee)).filter(Boolean))
  s.add(today.getFullYear())
  return [...s].sort((a, b) => b - a)
})

// Index produits + PDP quantité par produit pour l'année
const produitsById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const pdpQty = computed(() => {
  const m = {}
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    m[r.produit_id] = (m[r.produit_id] || 0) + Number(r.quantite_planifiee || 0)
  }
  return m
})

// Types fabrication
const FAB = /pes[ée]|balance|bascule|granul|s[ée]ch|m[ée]lang|compress|presse|compri|g[ée]lule|remplis|encapsul|capsul|pellicul|enrob|coat|drag[ée]/i
const estFab = (type) => FAB.test(String(type || ''))
// Ordre des phases (pour trier les équipements)
function phaseOrdre(type) {
  const t = String(type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 1
  if (/granul/.test(t)) return 2
  if (/s[ée]ch/.test(t)) return 3
  if (/m[ée]lang/.test(t)) return 4
  if (/compress|presse|compri/.test(t)) return 5
  if (/g[ée]lule|remplis|encapsul|capsul/.test(t)) return 6
  if (/pellicul|enrob|coat|drag[ée]/.test(t)) return 7
  return 99
}

// Poids d'un lot en Kg (taille_lot boîtes × unités/boîte × poids unitaire mg)
function poidsLotKg(prod) {
  const boites = Number(prod.taille_lot) || 0
  const upb = Number(prod.unites_par_boite) || 0
  const pmg = Number(prod.poids_unitaire_mg) || 0
  return (boites * upb * pmg) / 1e6 // mg -> Kg
}
// Durée d'un lot (h) : cadence en Kg/h
function dureeLotH(prod, cad) {
  const c = Number(cad.cadence_nominale) || 0 // Kg/h
  if (c <= 0) return 8 // repli : 8 h / lot
  const kg = poidsLotKg(prod)
  return kg > 0 ? kg / c : 8
}

const addH = (d, h) => new Date(d.getTime() + h * 3600000)

// --- Gestion des week-ends (vendredi=5, samedi=6) ---
function sauterWeekend(d, weInc) {
  if (weInc) return new Date(d)
  const c = new Date(d)
  while (c.getDay() === 5 || c.getDay() === 6) { c.setDate(c.getDate() + 1); c.setHours(0, 0, 0, 0) }
  return c
}
function prochainWeekend(d, weInc) {
  if (weInc) return new Date(d.getTime() + 1e13)
  const c = new Date(d); c.setHours(0, 0, 0, 0)
  let g = 0
  while (c.getDay() !== 5 && g++ < 14) c.setDate(c.getDate() + 1)
  return c
}
// Place une tâche de durée dureeH en sautant les week-ends -> segments + fin
function placer(start, dureeH, weInc) {
  let cursor = sauterWeekend(new Date(start), weInc)
  let reste = dureeH; const segments = []; let g = 0
  while (reste > 0.001 && g++ < 400) {
    const we = prochainWeekend(cursor, weInc)
    const dispo = (we - cursor) / 3600000
    if (dispo >= reste) { segments.push({ start: new Date(cursor), end: addH(cursor, reste) }); cursor = addH(cursor, reste); reste = 0 }
    else { if (dispo > 0.001) segments.push({ start: new Date(cursor), end: new Date(we) }); reste -= Math.max(0, dispo); cursor = sauterWeekend(new Date(we), weInc) }
  }
  if (!segments.length) segments.push({ start: new Date(start), end: new Date(start) })
  return { segments, end: cursor }
}
function planifierTaches(campagnes, tDep, weInc, pVdlt, pVdlp, pHoldingH) {
  const tasks = []
  let cursor = sauterWeekend(new Date(tDep), weInc)
  const push = (type, dureeH, extra) => {
    const pl = placer(cursor, dureeH, weInc)
    tasks.push({ type, ...(extra || {}), segments: pl.segments, start: pl.segments[0].start, end: pl.end })
    cursor = pl.end
  }
  for (const camp of campagnes) {
    push('gen', pVdlt)
    let campStart = new Date(cursor)
    for (let i = 0; i < camp.nbLots; i++) {
      if ((cursor - campStart) / 3600000 > pHoldingH) { push('genH', pVdlt); campStart = new Date(cursor) }
      push('lot', camp.dLot, { prod: camp.prod, n: i + 1 })
      if (i < camp.nbLots - 1) push('part', pVdlp)
    }
  }
  return { tasks, fin: cursor }
}

// Moteur d'ordonnancement
const planning = computed(() => {
  const t0 = new Date(dateDepart.value + 'T06:00:00')
  const rows = []
  const equipsFab = equipements.value.filter(e => estFab(e.type)).sort((a, b) => (phaseOrdre(a.type) - phaseOrdre(b.type)) || String(a.code).localeCompare(String(b.code)))
  for (const eq of equipsFab) {
    const cads = cadences.value.filter(c => c.equipement_id === eq.id)
    const campagnes = []
    for (const c of cads) {
      const prod = produitsById.value[c.produit_id]
      if (!prod) continue
      const qty = pdpQty.value[c.produit_id] || 0
      const tl = Number(prod.taille_lot) || 0
      const nbLots = tl > 0 ? Math.round(qty / tl) : 0
      if (nbLots <= 0) continue
      campagnes.push({ prod, nbLots, dLot: Math.max(0.25, dureeLotH(prod, c)) })
    }
    if (!campagnes.length) continue
    campagnes.sort((a, b) => String(a.prod.code_pf).localeCompare(String(b.prod.code_pf)))
    const eqVdlt = (eq.vdlt != null && eq.vdlt !== '') ? Number(eq.vdlt) : vdlt.value
    const eqVdlp = (eq.vdlp != null && eq.vdlp !== '') ? Number(eq.vdlp) : vdlp.value
    const eqHoldingH = (eq.dht != null && eq.dht !== '') ? Number(eq.dht) : holdingH.value
    const r = planifierTaches(campagnes, t0, !!weekendEquip[eq.id], eqVdlt, eqVdlp, eqHoldingH)
    rows.push({ eq, tasks: r.tasks, fin: r.fin })
  }
  return rows
})

// Bornes temps
const t0 = computed(() => new Date(dateDepart.value + 'T06:00:00'))
const finGlobale = computed(() => {
  let m = t0.value
  for (const r of planning.value) if (r.fin > m) m = r.fin
  return m
})
const totalHeures = computed(() => Math.max(24, Math.ceil((finGlobale.value - t0.value) / 3600000) + 8))
const totalW = computed(() => totalHeures.value * pxH.value)

// Jours (colonnes)
const jours = computed(() => {
  const out = []
  const start = new Date(t0.value); start.setHours(0, 0, 0, 0)
  const n = Math.ceil(totalHeures.value / 24) + 1
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const left = ((d - t0.value) / 3600000) * pxH.value
    out.push({ i, left, w: 24 * pxH.value, weekend: d.getDay() === 5 || d.getDay() === 6, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) })
  }
  return out
})
const joursWeekend = computed(() => jours.value.filter(d => d.weekend))

// Position des barres (par segment)
function barStyleSeg(seg, t) {
  const left = ((seg.start - t0.value) / 3600000) * pxH.value
  const w = Math.max(2, ((seg.end - seg.start) / 3600000) * pxH.value)
  const s = { left: left + 'px', width: w + 'px' }
  if (t.type === 'lot') { const c = couleurProd(t.prod.code_pf); s.background = c.bg; s.borderColor = c.bd }
  return s
}

// Couleur par produit (stable)
const palette = [
  ['#dbeafe', '#3b82f6'], ['#dcfce7', '#22c55e'], ['#fef9c3', '#eab308'], ['#fae8ff', '#d946ef'],
  ['#ffedd5', '#f97316'], ['#cffafe', '#06b6d4'], ['#e0e7ff', '#6366f1'], ['#fee2e2', '#ef4444'],
  ['#d1fae5', '#10b981'], ['#ede9fe', '#8b5cf6']
]
function couleurProd(code) {
  let h = 0; const s = String(code || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const [bg, bd] = palette[h % palette.length]
  return { bg, bd }
}

// Helpers affichage
const fmtJH = (d) => d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
function titre(t) {
  const p = fmtJH(t.start) + ' → ' + fmtJH(t.end)
  if (t.type === 'lot') return t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + t.n + '  •  ' + p
  if (t.type === 'gen') return 'Nettoyage général (début campagne)  •  ' + p
  if (t.type === 'genH') return 'Nettoyage général (holding dépassé)  •  ' + p
  return 'Nettoyage partiel  •  ' + p
}

// Récap
const totalLots = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'lot').length, 0))
const totalNG = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length, 0))
const totalNP = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'part').length, 0))
</script>

<style scoped>
.pe-page { color: #1b2733; }
.pe-head h1 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
.pe-head .sub { margin: 3px 0 12px; color: #64748b; font-size: 12px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 12px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

.params { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.p-grp label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: #475569; }
.p-grp input, .p-grp select { font-size: 13px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; color: #1b2733; }
.p-grp input[type=range] { padding: 0; }
.p-grp .chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }

.legende { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; font-size: 11px; color: #475569; }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 14px; height: 12px; border-radius: 3px; display: inline-block; }
.sw-lot { background: #dbeafe; border: 1px solid #3b82f6; }
.sw-gen { background: #7f1d1d; }
.sw-part { background: #cbd5e1; }

.gantt-card { padding: 0; overflow: hidden; }
.gantt { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 320px); }
.g-header { display: flex; position: sticky; top: 0; z-index: 5; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.g-eqcol { flex: 0 0 190px; width: 190px; padding: 6px 10px; border-right: 1px solid #e2e8f0; background: #fff; position: sticky; left: 0; z-index: 3; }
.g-eqhead { display: flex; align-items: center; font-size: 11px; font-weight: 800; color: #475569; background: #f8fafc; }
.g-timeline { position: relative; height: 40px; }
.g-dcol { position: absolute; top: 0; height: 40px; border-left: 1px solid #e2e8f0; box-sizing: border-box; }
.g-dlbl { font-size: 10px; font-weight: 700; color: #334155; padding: 2px 4px; white-space: nowrap; }
.g-shifts { display: flex; }
.g-sh { font-size: 8px; color: #94a3b8; border-left: 1px dashed #e2e8f0; padding-left: 2px; box-sizing: border-box; }

.g-row { display: flex; border-bottom: 1px solid #f1f5f9; }
.g-eqcode { font-size: 11px; font-weight: 800; color: #0f172a; }
.g-eqnom { font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-eqfin { font-size: 8.5px; color: #94a3b8; }
.g-eqwe { display: flex; align-items: center; gap: 3px; font-size: 8px; color: #64748b; margin-top: 1px; cursor: pointer; }
.g-track { position: relative; height: 44px; }
.g-dband { position: absolute; top: 0; bottom: 0; border-left: 1px solid #f1f5f9; box-sizing: border-box; z-index: 0; }
.g-weekend { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 6px, #e9edf3 6px, #e9edf3 12px); z-index: 0; }
.g-bar { position: absolute; top: 4px; height: 26px; border-radius: 4px; border: 1px solid; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; cursor: default; z-index: 1; }
.g-bar.g-lot, .g-bar.g-gen, .g-bar.g-genH, .g-bar.g-part { }
.g-lbl { font-size: 8.5px; font-weight: 700; padding: 0 3px; white-space: nowrap; color: #1e293b; }
.g-gen, .g-genH { background: #7f1d1d; border-color: #7f1d1d; }
.g-gen .g-lbl, .g-genH .g-lbl { color: #fff; }
.g-genH { background: repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 4px, #991b1b 4px, #991b1b 8px); }
.g-part { background: #cbd5e1; border-color: #94a3b8; }
.g-part .g-lbl { color: #334155; }

.recap h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #0f172a; }
.recap-grid { display: flex; flex-wrap: wrap; gap: 22px; }
.rc { display: flex; flex-direction: column; }
.rc-v { font-size: 18px; font-weight: 800; color: #0f172a; }
.rc-l { font-size: 10px; color: #64748b; }
</style>
