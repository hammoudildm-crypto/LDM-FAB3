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
      <div class="p-grp"><label>VDLT — nettoyage général (h)<input type="number" min="0" step="0.5" v-model.number="vdlt" /></label></div>
      <div class="p-grp"><label>VDLP — nettoyage partiel (h)<input type="number" min="0" step="0.5" v-model.number="vdlp" /></label></div>
      <div class="p-grp"><label>Holding — validité campagne (jours)<input type="number" min="0" step="1" v-model.number="holdingJ" /></label></div>
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
          </div>
          <div class="g-track" :style="{ width: totalW + 'px' }">
            <!-- bandes jours -->
            <div v-for="d in jours" :key="'b'+d.i" class="g-dband" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <!-- barres -->
            <div v-for="(t, i) in row.tasks" :key="i" class="g-bar" :class="'g-' + t.type"
                 :style="barStyle(t)" :title="titre(t)">
              <span class="g-lbl">{{ t.type === 'lot' ? t.prod.code_pf : (t.type.startsWith('gen') ? 'NG' : 'NP') }}</span>
            </div>
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
      fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id, actif').eq('actif', true)),
      fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot, unites_par_boite, gamme').eq('actif', true))
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
const FAB = /pes|gran|s[ée]ch|m[ée]lang|compress|rempliss|g[eé]lul|pellicul|enrob/i
const estFab = (type) => FAB.test(String(type || ''))

// Durée d'un lot (h) selon la cadence
function dureeLotH(prod, cad) {
  const c = Number(cad.cadence_nominale) || 0
  const u = (cad.unite_cadence || '').toLowerCase()
  const boites = Number(prod.taille_lot) || 0
  const unites = boites * (Number(prod.unites_par_boite) || 1)
  if (c > 0) {
    if (/bo[iî]te/.test(u)) return boites / c
    if (/unit|comprim|g[eé]lul|tube|sachet|\bcp\b/.test(u)) return unites / c
    if (/heure|\bh\b|temps|cycle/.test(u)) return c
    // par défaut : cadence en unités/h
    return unites > 0 ? unites / c : c
  }
  return 8 // repli : 8 h / lot
}

const addH = (d, h) => new Date(d.getTime() + h * 3600000)

// Moteur d'ordonnancement
const planning = computed(() => {
  const t0 = new Date(dateDepart.value + 'T06:00:00')
  const rows = []
  const equipsFab = equipements.value.filter(e => estFab(e.type)).sort((a, b) => String(a.code).localeCompare(String(b.code)))
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
    const tasks = []
    let cursor = new Date(t0)
    for (const camp of campagnes) {
      // Nettoyage général au début de campagne
      tasks.push({ type: 'gen', start: new Date(cursor), end: addH(cursor, vdlt.value) })
      cursor = addH(cursor, vdlt.value)
      let campStart = new Date(cursor)
      for (let i = 0; i < camp.nbLots; i++) {
        // Holding dépassé -> nettoyage général et redémarrage campagne
        if ((cursor - campStart) / 3600000 > holdingH.value) {
          tasks.push({ type: 'genH', start: new Date(cursor), end: addH(cursor, vdlt.value) })
          cursor = addH(cursor, vdlt.value)
          campStart = new Date(cursor)
        }
        const fin = addH(cursor, camp.dLot)
        tasks.push({ type: 'lot', prod: camp.prod, n: i + 1, start: new Date(cursor), end: fin })
        cursor = fin
        // Nettoyage partiel entre lots du même produit (sauf après le dernier)
        if (i < camp.nbLots - 1) {
          tasks.push({ type: 'part', start: new Date(cursor), end: addH(cursor, vdlp.value) })
          cursor = addH(cursor, vdlp.value)
        }
      }
    }
    rows.push({ eq, tasks, fin: cursor })
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
    out.push({ i, left, w: 24 * pxH.value, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) })
  }
  return out
})

// Position des barres
function barStyle(t) {
  const left = ((t.start - t0.value) / 3600000) * pxH.value
  const w = Math.max(2, ((t.end - t.start) / 3600000) * pxH.value)
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
.g-track { position: relative; height: 34px; }
.g-dband { position: absolute; top: 0; bottom: 0; border-left: 1px solid #f1f5f9; box-sizing: border-box; }
.g-bar { position: absolute; top: 4px; height: 26px; border-radius: 4px; border: 1px solid; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; cursor: default; }
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
