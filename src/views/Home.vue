<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const annee = new Date().getFullYear()
const session = ref(null)
const erreur = ref('')

const nbProduits = ref(0)
const lots = ref([])
const planTotal = ref(0)
const conditionnements = ref([])
const phases = ref([])

const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

async function charger() {
  erreur.value = ''

  const rp = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true)
  if (!rp.error) nbProduits.value = rp.count || 0

  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, quantite_theorique, produits(designation)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rpp = await supabase.from('plan_production').select('quantite_planifiee').eq('annee', annee)
  if (!rpp.error) planTotal.value = rpp.data.reduce((s, x) => s + Number(x.quantite_planifiee || 0), 0)

  const rc = await supabase.from('conditionnement')
    .select('ordre_id, quantite_entree, quantite_conditionnee, date_conditionnement, ordres_fabrication(produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, pcsu))')
    .eq('actif', true)
  if (!rc.error) conditionnements.value = rc.data

  const rph = await supabase.from('suivi_phases')
    .select('ordre_id, quantite_entree, quantite_sortie, date_phase, id')
    .eq('actif', true).order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (!rph.error) phases.value = rph.data
}

// --- Helpers ---
function boitesOf(c) {
  const upb = c.ordres_fabrication && c.ordres_fabrication.produits ? Number(c.ordres_fabrication.produits.unites_par_boite || 0) : 0
  if (c.quantite_conditionnee == null || upb === 0) return 0
  return Math.floor(Number(c.quantite_conditionnee) / upb)
}
function prodDe(c) { return c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null }

// --- Lots ---
const nbLots = computed(() => lots.value.length)
const lotsParStatut = computed(() => {
  const m = {}
  for (const s of STATUTS) m[s] = 0
  for (const l of lots.value) { if (m[l.statut] != null) m[l.statut]++; else m[l.statut] = 1 }
  return m
})
const lotsEnCours = computed(() => lotsParStatut.value['En cours'] || 0)
const lotsLiberes = computed(() => lotsParStatut.value['Libéré'] || 0)
const derniersLots = computed(() => lots.value.slice(0, 6))

// --- Conditionnement / volumes ---
const totalBoites = computed(() => conditionnements.value.reduce((s, c) => s + boitesOf(c), 0))
const caRealise = computed(() => {
  let t = 0
  for (const c of conditionnements.value) {
    const p = prodDe(c)
    t += boitesOf(c) * (p ? Number(p.pcsu || 0) : 0)
  }
  return t
})
const pctPlanRealise = computed(() => planTotal.value > 0 ? (totalBoites.value / planTotal.value) * 100 : null)

// --- Rendements ---
const rendementCndtMoyen = computed(() => {
  let boites = 0, eq = 0
  for (const c of conditionnements.value) {
    const p = prodDe(c)
    if (!p) continue
    const mm = Number(p.poids_unitaire_mg || 0)
    const upb = Number(p.unites_par_boite || 0)
    const kg = Number(c.quantite_entree || 0)
    if (c.quantite_conditionnee == null || kg === 0 || mm === 0 || upb === 0) continue
    boites += Math.floor(Number(c.quantite_conditionnee) / upb)
    eq += (kg * 1e6) / mm / upb
  }
  return eq > 0 ? (boites / eq) * 100 : null
})
const phasesParLot = computed(() => {
  const m = {}
  for (const p of phases.value) { (m[p.ordre_id] = m[p.ordre_id] || []).push(p) }
  return m
})
const rendementFabMoyen = computed(() => {
  let somme = 0, n = 0
  const m = phasesParLot.value
  for (const k in m) {
    let r = 1, c = 0
    for (const p of m[k]) {
      const e = Number(p.quantite_entree || 0), s = p.quantite_sortie
      if (e > 0 && s != null) { r *= Number(s) / e; c++ }
    }
    if (c) { somme += r * 100; n++ }
  }
  return n ? somme / n : null
})
const rendementGlobalMoyen = computed(() => {
  const boxesByLot = {}
  for (const c of conditionnements.value) boxesByLot[c.ordre_id] = (boxesByLot[c.ordre_id] || 0) + boitesOf(c)
  let prod = 0, theo = 0
  for (const l of lots.value) {
    const b = boxesByLot[l.id]
    if (b == null) continue
    const t = Number(l.quantite_theorique || 0)
    if (t <= 0) continue
    prod += b; theo += t
  }
  return theo > 0 ? (prod / theo) * 100 : null
})

// --- En-cours (vrac) ---
const vracEnAttente = computed(() => {
  const lastSortie = {}
  for (const p of phases.value) { if (p.quantite_sortie != null) lastSortie[p.ordre_id] = Number(p.quantite_sortie) }
  const condEntree = {}
  for (const c of conditionnements.value) { if (c.quantite_entree != null) condEntree[c.ordre_id] = (condEntree[c.ordre_id] || 0) + Number(c.quantite_entree) }
  let t = 0
  for (const k in lastSortie) { const v = lastSortie[k] - (condEntree[k] || 0); if (v > 0) t += v }
  return t
})

// --- Production par mois ---
const prodParMois = computed(() => {
  const arr = Array(12).fill(0)
  for (const c of conditionnements.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() !== annee) continue
    arr[d.getMonth()] += boitesOf(c)
  }
  return arr
})
const maxMois = computed(() => Math.max(1, ...prodParMois.value))

// --- Top produits par CA ---
const topProduits = computed(() => {
  const m = {}
  for (const c of conditionnements.value) {
    const p = prodDe(c)
    const cle = p ? p.code_pf : '—'
    if (!m[cle]) m[cle] = { nom: p ? p.designation : '(produit inconnu)', boites: 0, ca: 0 }
    m[cle].boites += boitesOf(c)
    m[cle].ca += boitesOf(c) * (p ? Number(p.pcsu || 0) : 0)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca).slice(0, 5)
})

function pct(n, total) { return total > 0 ? (n / total) * 100 : 0 }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(2) + ' %' }
function fmtDA(n) {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA'
  return Math.round(n).toLocaleString('fr-FR') + ' DA'
}
function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }

onMounted(async () => {
  const r = await supabase.auth.getSession()
  session.value = r.data ? r.data.session : null
  if (session.value) await charger()
})
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <h1>Tableau de bord</h1>
      <p class="sub">Vue d'ensemble de la production — LDM-FAB3</p>
    </header>

    <div v-if="!session" class="welcome">
      <h2>Bienvenue sur LDM-FAB3</h2>
      <p>Connecte-toi pour accéder au tableau de bord et aux modules de production.</p>
      <RouterLink to="/login" class="btn">Se connecter</RouterLink>
    </div>

    <template v-else>
      <p v-if="erreur" class="alert">{{ erreur }}</p>

      <!-- Volumes / activité -->
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">{{ fmt(nbProduits) }}</div><div class="kpi-lbl">Produits actifs</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmt(nbLots) }}</div><div class="kpi-lbl">Lots</div></div>
        <div class="kpi"><div class="kpi-val accent">{{ fmt(lotsEnCours) }}</div><div class="kpi-lbl">Lots en cours</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmt(lotsLiberes) }}</div><div class="kpi-lbl">Lots libérés</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmt(totalBoites) }}</div><div class="kpi-lbl">Boîtes conditionnées</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmt(vracEnAttente) }}</div><div class="kpi-lbl">Vrac en attente (kg)</div></div>
      </div>

      <!-- Performance / finance -->
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementFabMoyen) }}</div><div class="kpi-lbl">Rendement fab. moyen</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementCndtMoyen) }}</div><div class="kpi-lbl">Rendement cond. moyen</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementGlobalMoyen) }}</div><div class="kpi-lbl">Rendement global moyen</div></div>
        <div class="kpi"><div class="kpi-val accent">{{ fmtPct(pctPlanRealise) }}</div><div class="kpi-lbl">Plan {{ annee }} réalisé</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmtDA(caRealise) }}</div><div class="kpi-lbl">CA réalisé</div></div>
        <div class="kpi"><div class="kpi-val">{{ fmt(planTotal) }}</div><div class="kpi-lbl">Plan {{ annee }} (boîtes)</div></div>
      </div>

      <div class="cols">
        <section class="card">
          <h2 class="card-title">Lots par statut</h2>
          <div v-for="s in STATUTS" :key="s" class="bar-row">
            <span class="bar-lbl"><span class="badge" :class="classeStatut(s)">{{ s }}</span></span>
            <div class="bar-track"><div class="bar-fill" :class="classeStatut(s)" :style="{ width: pct(lotsParStatut[s], nbLots) + '%' }"></div></div>
            <span class="bar-num">{{ lotsParStatut[s] }}</span>
          </div>
          <p v-if="!nbLots" class="empty">Aucun lot pour l'instant.</p>
        </section>

        <section class="card">
          <h2 class="card-title">Derniers lots</h2>
          <table class="mini">
            <tbody>
              <tr v-for="l in derniersLots" :key="l.id">
                <td class="mono">{{ l.numero_lot }}</td>
                <td class="desig">{{ l.produits ? l.produits.designation : '—' }}</td>
                <td>{{ fmtDate(l.date_lancement) }}</td>
                <td><span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span></td>
              </tr>
              <tr v-if="!derniersLots.length"><td colspan="4" class="empty">Aucun lot.</td></tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <h2 class="card-title">Production {{ annee }} par mois (boîtes)</h2>
          <div v-for="(v, i) in prodParMois" :key="i" class="bar-row">
            <span class="bar-lbl mois">{{ MOIS[i] }}</span>
            <div class="bar-track"><div class="bar-fill prod" :style="{ width: (v / maxMois * 100) + '%' }"></div></div>
            <span class="bar-num wide">{{ fmt(v) }}</span>
          </div>
          <p v-if="!totalBoites" class="empty">Aucun conditionnement enregistré.</p>
        </section>

        <section class="card">
          <h2 class="card-title">Top produits — chiffre d'affaires</h2>
          <table class="mini">
            <tbody>
              <tr v-for="(p, i) in topProduits" :key="i">
                <td class="rank">{{ i + 1 }}</td>
                <td class="desig">{{ p.nom }}</td>
                <td class="right">{{ fmt(Math.round(p.boites)) }} bts</td>
                <td class="right strong">{{ fmtDA(p.ca) }}</td>
              </tr>
              <tr v-if="!topProduits.length"><td colspan="4" class="empty">Aucun conditionnement enregistré.</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash { color: #1b2733; }
.dash-head { margin: 4px 0 20px; }
.dash-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.dash-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.welcome { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 40px; text-align: center; }
.welcome h2 { margin: 0 0 8px; font-size: 22px; }
.welcome p { color: #64748b; margin: 0 0 18px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 14px; }
.kpi-grid:last-of-type { margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 16px; }

.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.bar-lbl { width: 92px; flex-shrink: 0; }
.bar-lbl.mois { width: 38px; font-size: 12px; font-weight: 600; color: #64748b; }
.bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.bar-fill.st-plan { background: #94a3b8; }
.bar-fill.st-cours { background: #3b82f6; }
.bar-fill.st-fini { background: #14b8a6; }
.bar-fill.st-lib { background: #22c55e; }
.bar-fill.st-rej { background: #ef4444; }
.bar-fill.prod { background: #0f766e; }
.bar-num { width: 36px; text-align: right; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.bar-num.wide { width: 64px; }

.btn { display: inline-block; background: #0f766e; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn:hover { background: #0c5f59; }

table.mini { width: 100%; border-collapse: collapse; font-size: 13px; }
table.mini td { padding: 7px 6px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.right { text-align: right; }
.strong { font-weight: 700; color: #0f766e; }
.rank { width: 22px; text-align: center; font-weight: 700; color: #94a3b8; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .cols { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
