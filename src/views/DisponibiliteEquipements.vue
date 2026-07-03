<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import { ICONS, TINTS } from '../icons.js'

const equipements = ref([])
const ateliers = ref([])
const ofs = ref([])
const conds = ref([])
const erreur = ref('')
const chargement = ref(true)
const recherche = ref('')

const anneeSel = ref(new Date().getFullYear())
const enCoursOnly = ref(true)

// Phases de fabrication -> colonne de rendement dans ordres_fabrication.
// Un lot "passe" par une phase si le rendement de cette phase est renseigné.
// Gamme de fabrication : ordre logique des phases.
const PHASES = [
  { key: 'pesee',           ordre: 1, label: 'Pesée',               ic: ICONS.hash,     tint: TINTS.slate },
  { key: 'granulation',     ordre: 2, label: 'Granulation',         ic: ICONS.flask,    tint: TINTS.teal },
  { key: 'sechage',         ordre: 3, label: 'Séchage',             ic: ICONS.activity, tint: TINTS.cyan },
  { key: 'melange',         ordre: 4, label: 'Mélange',             ic: ICONS.layers,   tint: TINTS.blue },
  { key: 'compression',     ordre: 5, label: 'Compression',         ic: ICONS.pill,     tint: TINTS.violet },
  { key: 'remplissage',     ordre: 6, label: 'Remplissage gélules', ic: ICONS.package,  tint: TINTS.indigo },
  { key: 'pelliculage',     ordre: 7, label: 'Pelliculage',         ic: ICONS.target,   tint: TINTS.amber },
  { key: 'conditionnement', ordre: 8, label: 'Conditionnement',     ic: ICONS.box,      tint: TINTS.green },
]

// Déduit la phase à partir du type d'équipement (robuste aux variantes de libellé).
function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}

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
  chargement.value = true
  erreur.value = ''

  const ra = await supabase.from('ateliers').select('id, code, nom').eq('actif', true).order('code')
  if (ra.error) { erreur.value = ra.error.message; chargement.value = false; return }
  ateliers.value = ra.data || []

  const re = await supabase.from('equipements').select('id, code, nom, type, atelier_id').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; chargement.value = false; return }
  equipements.value = re.data || []

  const rof = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, quantite_theorique, date_lancement, date_fin_fabrication, rdt_granulation, rdt_melange, rdt_compression, rdt_pelliculage, produits(code_pf, designation, forme)')
    .eq('actif', true))
  if (rof.error) { erreur.value = rof.error.message; chargement.value = false; return }
  ofs.value = rof.data || []

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id').eq('actif', true))
  if (rc.error) { erreur.value = rc.error.message; chargement.value = false; return }
  conds.value = rc.data || []

  chargement.value = false
}

function anneeDe(o) {
  return o.date_fin_fabrication ? new Date(o.date_fin_fabrication).getFullYear() : null
}

const anneesDispo = computed(() => {
  const s = new Set()
  for (const o of ofs.value) { const a = anneeDe(o); if (a) s.add(a) }
  s.add(new Date().getFullYear())
  return Array.from(s).sort((a, b) => b - a)
})

// Lots retenus selon l'année de fabrication (0 = toutes).
const lotsAnnee = computed(() => {
  if (anneeSel.value === 0) return ofs.value
  return ofs.value.filter(o => anneeDe(o) === anneeSel.value)
})

// Produits en cours : au moins un lot lancé mais non terminé (état courant, toutes années).
const produitsEnCours = computed(() => {
  const s = new Set()
  for (const o of ofs.value) {
    if (o.produits && o.date_lancement && !o.date_fin_fabrication) s.add(o.produits.code_pf)
  }
  return s
})

// Lots conditionnés (au moins un enregistrement de conditionnement).
const ordresConditionnes = computed(() => {
  const s = new Set()
  for (const c of conds.value) s.add(c.ordre_id)
  return s
})

// Pour chaque phase : { code_pf -> { code, desig, lots, boites } }
const produitsParPhase = computed(() => {
  const res = {}
  for (const ph of PHASES) res[ph.key] = {}
  const add = (key, o, p) => {
    const m = res[key]
    if (!m[p.code_pf]) m[p.code_pf] = { code: p.code_pf, desig: p.designation || '', lots: 0, boites: 0 }
    m[p.code_pf].lots++
    m[p.code_pf].boites += Number(o.quantite_theorique || 0)
  }
  const estGelule = (p) => /gélule|gelule|capsule/.test((p.forme || '').toLowerCase())
  for (const o of lotsAnnee.value) {
    const p = o.produits
    if (!p) continue
    add('pesee', o, p)                                                   // tout lot fabriqué est pesé
    if (o.rdt_granulation != null) { add('granulation', o, p); add('sechage', o, p) }
    if (o.rdt_melange != null) add('melange', o, p)
    if (o.rdt_compression != null) add(estGelule(p) ? 'remplissage' : 'compression', o, p)
    if (o.rdt_pelliculage != null) add('pelliculage', o, p)
    if (ordresConditionnes.value.has(o.id)) add('conditionnement', o, p)
  }
  return res
})

// Ateliers -> équipements enrichis (phase + produits + totaux), filtrés par recherche.
const vue = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  const match = (e, prods) => {
    if (!q) return true
    if ((e.code || '').toLowerCase().includes(q)) return true
    if ((e.nom || '').toLowerCase().includes(q)) return true
    if ((e.type || '').toLowerCase().includes(q)) return true
    return prods.some(p => p.code.toLowerCase().includes(q) || p.desig.toLowerCase().includes(q))
  }
  return ateliers.value.map(a => {
    const eqs = equipements.value
      .filter(e => e.atelier_id === a.id)
      .map(e => {
        const ph = PHASES.find(x => x.key === phaseDeType(e.type)) || null
        let prods = ph ? Object.values(produitsParPhase.value[ph.key]).sort((x, y) => y.boites - x.boites) : []
        if (enCoursOnly.value) prods = prods.filter(p => produitsEnCours.value.has(p.code))
        return {
          ...e, phase: ph, prods,
          totalLots: prods.reduce((s, p) => s + p.lots, 0),
          totalBoites: prods.reduce((s, p) => s + p.boites, 0),
        }
      })
      .filter(e => match(e, e.prods))
    eqs.sort((x, y) => (x.phase ? x.phase.ordre : 99) - (y.phase ? y.phase.ordre : 99))
    const minOrdre = eqs.reduce((m, e) => Math.min(m, e.phase ? e.phase.ordre : 99), 99)
    return { ...a, eqs, minOrdre }
  }).filter(a => a.eqs.length > 0).sort((a, b) => a.minOrdre - b.minOrdre)
})

// KPIs globaux
const nbAteliers = computed(() => vue.value.length)
const nbEquipements = computed(() => equipements.value.length)
const nbProduitsDistincts = computed(() => {
  const s = new Set()
  for (const ph of PHASES) for (const c of Object.keys(produitsParPhase.value[ph.key])) {
    if (!enCoursOnly.value || produitsEnCours.value.has(c)) s.add(c)
  }
  return s.size
})

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtC(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return Number(n).toLocaleString('fr-FR', { notation: 'compact', maximumSignificantDigits: 2 })
  return Number(n).toLocaleString('fr-FR')
}

const kpis = computed(() => [
  { v: fmt(nbAteliers.value),         l: 'Ateliers',              tint: TINTS.indigo, ic: ICONS.factory },
  { v: fmt(nbEquipements.value),      l: 'Équipements',           tint: TINTS.blue,   ic: ICONS.gauge },
  { v: fmt(nbProduitsDistincts.value),l: enCoursOnly.value ? 'Produits en cours' : 'Produits fabriqués', tint: TINTS.teal, ic: ICONS.pill },
])

onMounted(async () => {
  const r = await supabase.auth.getSession()
  if (r.data && r.data.session) await charger()
  else chargement.value = false
})
</script>

<template>
  <div class="de-page">
    <PageHeader title="Disponibilité des produits par équipement" tone="cyan"
      subtitle="Pour chaque équipement (selon sa phase), les produits qui y sont fabriqués — nombre de lots et volumes.">
      <label class="annee-sel">Année de fabrication
        <select v-model.number="anneeSel">
          <option :value="0">Toutes années</option>
          <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="erreur" class="err">{{ erreur }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="flow">
        <template v-for="(ph, i) in PHASES" :key="ph.key">
          <span class="flow-step" :style="ph.tint"><span class="flow-ic"><svg viewBox="0 0 24 24" v-html="ph.ic"></svg></span>{{ ph.label }}</span>
          <span v-if="i < PHASES.length - 1" class="flow-arrow">→</span>
        </template>
      </div>

      <div class="kpi-grid k3">
        <div class="kpi" v-for="(k, i) in kpis" :key="i">
          <div class="kpi-top">
            <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
            <div class="kpi-val">{{ k.v }}</div>
          </div>
          <div class="kpi-lbl">{{ k.l }}</div>
        </div>
      </div>

      <div class="searchbar">
        <input v-model="recherche" type="text" placeholder="Rechercher un équipement, un type ou un produit…" />
        <label class="chk"><input type="checkbox" v-model="enCoursOnly" /> Uniquement les produits en cours</label>
      </div>

      <p class="note">
        Un produit apparaît sous un équipement dès qu'un de ses lots passe par la phase correspondante.
        Les équipements d'un même type partagent la même liste (la machine exacte n'est pas tracée par lot).
        Un produit est « en cours » s'il a au moins un lot lancé et non terminé.
      </p>

      <p v-if="vue.length === 0" class="muted">Aucun équipement ne correspond.</p>

      <section v-for="a in vue" :key="a.id" class="atelier">
        <h2 class="atelier-titre">{{ a.code }} — {{ a.nom }}</h2>
        <div class="eq-grid">
          <div v-for="e in a.eqs" :key="e.id" class="card eq-card">
            <div class="eq-head">
              <div class="eq-ident">
                <span class="eq-ic" :style="e.phase ? e.phase.tint : { background: '#f1f5f9', color: '#94a3b8' }">
                  <svg viewBox="0 0 24 24" v-html="e.phase ? e.phase.ic : ICONS.gauge"></svg>
                </span>
                <div>
                  <div class="eq-code">{{ e.code }}</div>
                  <div class="eq-nom">{{ e.nom }}</div>
                </div>
              </div>
              <span v-if="e.phase" class="phase-badge" :style="e.phase.tint">{{ e.phase.label }}</span>
              <span v-else class="phase-badge muted-badge">type non reconnu</span>
            </div>

            <div class="eq-stats">
              <span><strong>{{ fmt(e.prods.length) }}</strong> produits</span>
              <span><strong>{{ fmt(e.totalLots) }}</strong> lots</span>
              <span><strong>{{ fmtC(e.totalBoites) }}</strong> boîtes</span>
            </div>

            <div v-if="e.prods.length" class="prod-scroll">
              <table class="grid">
                <thead>
                  <tr><th>Produit</th><th class="num">Lots</th><th class="num">Boîtes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="p in e.prods" :key="p.code">
                    <td><span class="pf">{{ p.code }}</span> <span class="pd">{{ p.desig }}</span></td>
                    <td class="num">{{ fmt(p.lots) }}</td>
                    <td class="num">{{ fmt(p.boites) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="empty">
              {{ e.phase ? (enCoursOnly ? 'Aucun produit en cours sur cette phase.' : 'Aucun produit sur cette phase pour l\'année sélectionnée.') : 'Type non associé à une phase (Granulation, Mélange, Compression, Pelliculage, Conditionnement).' }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.de-page { color: #1b2733; }
.de-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.de-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 4px; }
.annee-sel select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; }
.err { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; }
.muted { color: #94a3b8; }
.note { color: #64748b; font-size: 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 12px; margin: 0 0 16px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 14px; }
.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.searchbar { margin-bottom: 14px; }
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 16px; }
.flow-step { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px; }
.flow-ic { display: inline-flex; }
.flow-ic svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.flow-arrow { color: #cbd5e1; font-weight: 700; }
.searchbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.searchbar input[type=text] { flex: 1; min-width: 240px; max-width: 460px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #475569; cursor: pointer; white-space: nowrap; }
.chk input { width: 15px; height: 15px; cursor: pointer; }

.atelier { margin-bottom: 26px; }
.atelier-titre { font-size: 16px; margin: 0 0 12px; color: #0f172a; border-left: 3px solid #0f766e; padding-left: 10px; }
.eq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.eq-card { display: flex; flex-direction: column; }
.eq-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.eq-ident { display: flex; align-items: center; gap: 10px; min-width: 0; }
.eq-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.eq-ic svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.eq-code { font-weight: 700; font-size: 15px; }
.eq-nom { font-size: 12px; color: #64748b; }
.phase-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.muted-badge { background: #f1f5f9; color: #94a3b8; }

.eq-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #64748b; padding: 8px 0 10px; border-top: 1px solid #f1f5f9; }
.eq-stats strong { color: #0f172a; font-size: 14px; }

.prod-scroll { max-height: 280px; overflow-y: auto; border: 1px solid #eef2f6; border-radius: 8px; }
.grid { width: 100%; border-collapse: collapse; }
.grid th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.grid td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.grid tr:last-child td { border-bottom: none; }
.num { text-align: right; white-space: nowrap; }
.pf { font-weight: 600; color: #0f766e; }
.pd { color: #475569; }
.empty { font-size: 12px; color: #94a3b8; margin: 4px 0 0; }
</style>
