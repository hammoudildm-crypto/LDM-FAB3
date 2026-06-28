<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const anneeCourante = new Date().getFullYear()
const moisCourant = new Date().getMonth()
const anneeSel = ref(anneeCourante)
const ongletActif = ref('production')
const session = ref(null)
const erreur = ref('')

const ANNEES = []
for (let a = anneeCourante - 1; a <= anneeCourante + 5; a++) ANNEES.push(a)
const ONGLETS = [['production', 'Production'], ['qualite', 'Qualité'], ['finance', 'Finance']]
const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const nbProduits = ref(0)
const lots = ref([])
const planData = ref([])
const conditionnements = ref([])
const phases = ref([])

async function charger() {
  erreur.value = ''

  const rp = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true)
  if (!rp.error) nbProduits.value = rp.count || 0

  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, quantite_theorique, produits(designation)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rpp = await supabase.from('plan_production').select('annee, quantite_planifiee, produits(pcsu)')
  if (!rpp.error) planData.value = rpp.data

  const rc = await supabase.from('conditionnement')
    .select('ordre_id, quantite_entree, quantite_conditionnee, date_conditionnement, ordres_fabrication(produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, pcsu, boites_theoriques, donneurs_ordre(nom)))')
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
function pcsuDe(c) { const p = prodDe(c); return p ? Number(p.pcsu || 0) : 0 }
function estCeMois(c) {
  if (!c.date_conditionnement) return false
  const d = new Date(c.date_conditionnement)
  return d.getFullYear() === anneeCourante && d.getMonth() === moisCourant
}

// Conditionnements de l'année sélectionnée
const condAnnee = computed(() => conditionnements.value.filter(c => {
  if (!c.date_conditionnement) return false
  return new Date(c.date_conditionnement).getFullYear() === anneeSel.value
}))

// --- Lots (état courant) ---
const nbLots = computed(() => lots.value.length)
const lotsParStatut = computed(() => {
  const m = {}
  for (const s of STATUTS) m[s] = 0
  for (const l of lots.value) { if (m[l.statut] != null) m[l.statut]++; else m[l.statut] = 1 }
  return m
})
const lotsEnCours = computed(() => lotsParStatut.value['En cours'] || 0)
const lotsLiberes = computed(() => lotsParStatut.value['Libéré'] || 0)
const lotsTermines = computed(() => lotsParStatut.value['Terminé'] || 0)
const tauxLiberation = computed(() => nbLots.value > 0 ? (lotsLiberes.value / nbLots.value) * 100 : null)
const derniersLots = computed(() => lots.value.slice(0, 6))

// --- Plan (année sélectionnée) ---
const planAnnee = computed(() => planData.value.filter(x => x.annee === anneeSel.value))
const planTotal = computed(() => planAnnee.value.reduce((s, x) => s + Number(x.quantite_planifiee || 0), 0))
const caPotentielPlan = computed(() => planAnnee.value.reduce((s, x) => {
  const pcsu = x.produits ? Number(x.produits.pcsu || 0) : 0
  return s + Number(x.quantite_planifiee || 0) * pcsu
}, 0))

// --- Volumes (année sélectionnée) ---
const totalBoites = computed(() => condAnnee.value.reduce((s, c) => s + boitesOf(c), 0))
const boitesRestantes = computed(() => Math.max(0, planTotal.value - totalBoites.value))
const boitesCeMois = computed(() => conditionnements.value.reduce((s, c) => s + (estCeMois(c) ? boitesOf(c) : 0), 0))

// --- Finance (année sélectionnée) ---
const caRealise = computed(() => condAnnee.value.reduce((s, c) => s + boitesOf(c) * pcsuDe(c), 0))
const caCeMois = computed(() => conditionnements.value.reduce((s, c) => s + (estCeMois(c) ? boitesOf(c) * pcsuDe(c) : 0), 0))
const tauxRealisationCA = computed(() => caPotentielPlan.value > 0 ? (caRealise.value / caPotentielPlan.value) * 100 : null)
const prixMoyenBoite = computed(() => totalBoites.value > 0 ? caRealise.value / totalBoites.value : null)
const pctPlanRealise = computed(() => planTotal.value > 0 ? (totalBoites.value / planTotal.value) * 100 : null)

// --- Rendements ---
const rendementCndtMoyen = computed(() => {
  let boites = 0, eq = 0
  for (const c of condAnnee.value) {
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
  for (const c of condAnnee.value) boxesByLot[c.ordre_id] = (boxesByLot[c.ordre_id] || 0) + boitesOf(c)
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
const rendementCondParMois = computed(() => {
  const boxes = Array(12).fill(0), eq = Array(12).fill(0)
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    if (!p) continue
    const mm = Number(p.poids_unitaire_mg || 0), upb = Number(p.unites_par_boite || 0), kg = Number(c.quantite_entree || 0)
    if (c.quantite_conditionnee == null || kg === 0 || mm === 0 || upb === 0) continue
    const mo = new Date(c.date_conditionnement).getMonth()
    boxes[mo] += Math.floor(Number(c.quantite_conditionnee) / upb)
    eq[mo] += (kg * 1e6) / mm / upb
  }
  return boxes.map((b, i) => eq[i] > 0 ? (b / eq[i]) * 100 : null)
})

// --- En-cours (vrac, état courant) ---
const vracEnAttente = computed(() => {
  const lastSortie = {}
  for (const p of phases.value) { if (p.quantite_sortie != null) lastSortie[p.ordre_id] = Number(p.quantite_sortie) }
  const condEntree = {}
  for (const c of conditionnements.value) { if (c.quantite_entree != null) condEntree[c.ordre_id] = (condEntree[c.ordre_id] || 0) + Number(c.quantite_entree) }
  let t = 0
  for (const k in lastSortie) { const v = lastSortie[k] - (condEntree[k] || 0); if (v > 0) t += v }
  return t
})

// --- Production par mois (année) ---
const prodParMois = computed(() => {
  const arr = Array(12).fill(0)
  for (const c of condAnnee.value) arr[new Date(c.date_conditionnement).getMonth()] += boitesOf(c)
  return arr
})
const maxMois = computed(() => Math.max(1, ...prodParMois.value))

// --- Top produits / donneurs / réalisation (année) ---
const topProduits = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const cle = p ? p.code_pf : '—'
    if (!m[cle]) m[cle] = { nom: p ? p.designation : '(produit inconnu)', boites: 0, ca: 0 }
    m[cle].boites += boitesOf(c)
    m[cle].ca += boitesOf(c) * pcsuDe(c)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca).slice(0, 5)
})
const caParDonneur = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const nom = p && p.donneurs_ordre ? p.donneurs_ordre.nom : '—'
    if (!m[nom]) m[nom] = { nom, boites: 0, ca: 0 }
    m[nom].boites += boitesOf(c)
    m[nom].ca += boitesOf(c) * pcsuDe(c)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca)
})
const maxCaDonneur = computed(() => Math.max(1, ...caParDonneur.value.map(d => d.ca)))
const realisationPlan = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const code = p ? p.code_pf : '—'
    if (!m[code]) m[code] = { code, nom: p ? p.designation : '—', produit: 0, cible: p ? Number(p.boites_theoriques || 0) : 0 }
    m[code].produit += boitesOf(c)
  }
  return Object.values(m).filter(x => x.produit > 0)
    .map(x => ({ ...x, pct: x.cible > 0 ? (x.produit / x.cible) * 100 : null }))
    .sort((a, b) => b.produit - a.produit).slice(0, 8)
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
      <div>
        <h1>Tableau de bord</h1>
        <p class="sub">Vue d'ensemble de la production — LDM-FAB3</p>
      </div>
      <label v-if="session" class="annee-sel">Année de référence
        <select v-model.number="anneeSel">
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </header>

    <div v-if="!session" class="welcome">
      <h2>Bienvenue sur LDM-FAB3</h2>
      <p>Connecte-toi pour accéder au tableau de bord et aux modules de production.</p>
      <RouterLink to="/login" class="btn">Se connecter</RouterLink>
    </div>

    <template v-else>
      <p v-if="erreur" class="alert">{{ erreur }}</p>

      <nav class="tabs">
        <button v-for="o in ONGLETS" :key="o[0]" class="tab" :class="{ active: ongletActif === o[0] }" @click="ongletActif = o[0]">{{ o[1] }}</button>
      </nav>

      <!-- ====================== PRODUCTION ====================== -->
      <div v-show="ongletActif === 'production'">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val">{{ fmt(nbProduits) }}</div><div class="kpi-lbl">Produits actifs</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(nbLots) }}</div><div class="kpi-lbl">Lots</div></div>
          <div class="kpi"><div class="kpi-val accent">{{ fmt(lotsEnCours) }}</div><div class="kpi-lbl">Lots en cours</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(totalBoites) }}</div><div class="kpi-lbl">Boîtes conditionnées {{ anneeSel }}</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(vracEnAttente) }}</div><div class="kpi-lbl">Vrac en attente (kg)</div></div>
          <div class="kpi"><div class="kpi-val accent">{{ fmt(boitesCeMois) }}</div><div class="kpi-lbl">Boîtes ce mois</div></div>
        </div>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val">{{ fmt(planTotal) }}</div><div class="kpi-lbl">Plan {{ anneeSel }} (boîtes)</div></div>
          <div class="kpi"><div class="kpi-val accent">{{ fmtPct(pctPlanRealise) }}</div><div class="kpi-lbl">Plan {{ anneeSel }} réalisé</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(boitesRestantes) }}</div><div class="kpi-lbl">Boîtes restantes (plan)</div></div>
        </div>

        <div class="cols">
          <section class="card">
            <h2 class="card-title">Production {{ anneeSel }} par mois (boîtes)</h2>
            <div v-for="(v, i) in prodParMois" :key="i" class="bar-row">
              <span class="bar-lbl mois">{{ MOIS[i] }}</span>
              <div class="bar-track"><div class="bar-fill prod" :style="{ width: (v / maxMois * 100) + '%' }"></div></div>
              <span class="bar-num wide">{{ fmt(v) }}</span>
            </div>
            <p v-if="!totalBoites" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>

          <section class="card">
            <h2 class="card-title">Réalisation du plan — top produits</h2>
            <div v-for="p in realisationPlan" :key="p.code" class="prog-row">
              <div class="prog-head"><span class="prog-nom">{{ p.nom }}</span><span class="prog-pct">{{ fmtPct(p.pct) }}</span></div>
              <div class="bar-track"><div class="bar-fill" :class="(p.pct != null && p.pct >= 100) ? 'st-lib' : 'prod'" :style="{ width: Math.min(100, p.pct || 0) + '%' }"></div></div>
              <div class="prog-sub">{{ fmt(p.produit) }} / {{ p.cible ? fmt(p.cible) : '—' }} boîtes</div>
            </div>
            <p v-if="!realisationPlan.length" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>

          <section class="card span2">
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
        </div>
      </div>

      <!-- ====================== QUALITÉ ====================== -->
      <div v-show="ongletActif === 'qualite'">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val">{{ fmt(lotsTermines) }}</div><div class="kpi-lbl">Lots terminés</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(lotsLiberes) }}</div><div class="kpi-lbl">Lots libérés</div></div>
          <div class="kpi"><div class="kpi-val accent">{{ fmtPct(tauxLiberation) }}</div><div class="kpi-lbl">Taux de libération</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementFabMoyen) }}</div><div class="kpi-lbl">Rendement fab. moyen</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementCndtMoyen) }}</div><div class="kpi-lbl">Rendement cond. moyen</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtPct(rendementGlobalMoyen) }}</div><div class="kpi-lbl">Rendement global moyen</div></div>
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
            <h2 class="card-title">Rendement cond. par mois — {{ anneeSel }}</h2>
            <div v-for="(v, i) in rendementCondParMois" :key="i" class="bar-row">
              <span class="bar-lbl mois">{{ MOIS[i] }}</span>
              <div class="bar-track"><div class="bar-fill" :class="(v != null && v < 95) ? 'st-rej' : 'prod'" :style="{ width: Math.min(100, v || 0) + '%' }"></div></div>
              <span class="bar-num xl">{{ fmtPct(v) }}</span>
            </div>
            <p v-if="rendementCondParMois.every(v => v == null)" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>
        </div>
      </div>

      <!-- ====================== FINANCE ====================== -->
      <div v-show="ongletActif === 'finance'">
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val accent">{{ fmtDA(caRealise) }}</div><div class="kpi-lbl">CA réalisé {{ anneeSel }}</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtDA(caCeMois) }}</div><div class="kpi-lbl">CA ce mois</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtDA(caPotentielPlan) }}</div><div class="kpi-lbl">CA potentiel (plan {{ anneeSel }})</div></div>
          <div class="kpi"><div class="kpi-val accent">{{ fmtPct(tauxRealisationCA) }}</div><div class="kpi-lbl">Réalisation CA</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmtDA(prixMoyenBoite) }}</div><div class="kpi-lbl">Prix moyen / boîte</div></div>
          <div class="kpi"><div class="kpi-val">{{ fmt(totalBoites) }}</div><div class="kpi-lbl">Boîtes conditionnées {{ anneeSel }}</div></div>
        </div>

        <div class="cols">
          <section class="card">
            <h2 class="card-title">Chiffre d'affaires par donneur d'ordre</h2>
            <div v-for="d in caParDonneur" :key="d.nom" class="bar-row">
              <span class="bar-lbl don">{{ d.nom }}</span>
              <div class="bar-track"><div class="bar-fill prod" :style="{ width: (d.ca / maxCaDonneur * 100) + '%' }"></div></div>
              <span class="bar-num xl">{{ fmtDA(d.ca) }}</span>
            </div>
            <p v-if="!caParDonneur.length" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
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
                <tr v-if="!topProduits.length"><td colspan="4" class="empty">Aucun conditionnement en {{ anneeSel }}.</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash { color: #1b2733; }
.dash-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.dash-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.dash-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }

.welcome { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 40px; text-align: center; }
.welcome h2 { margin: 0 0 8px; font-size: 22px; }
.welcome p { color: #64748b; margin: 0 0 18px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.tabs { display: flex; gap: 4px; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; }
.tab { background: none; border: 0; padding: 10px 18px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab:hover { color: #0f766e; }
.tab.active { color: #0f766e; border-bottom-color: #0f766e; }

.kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 14px; }
.kpi-grid:last-of-type { margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card.span2 { grid-column: 1 / -1; }
.card-title { margin: 0 0 14px; font-size: 16px; }

.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; }
.bar-lbl { width: 92px; flex-shrink: 0; }
.bar-lbl.mois { width: 38px; font-size: 12px; font-weight: 600; color: #64748b; }
.bar-lbl.don { width: 112px; font-size: 12px; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.bar-num.xl { width: 78px; font-size: 13px; }

.btn { display: inline-block; background: #0f766e; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn:hover { background: #0c5f59; }

table.mini { width: 100%; border-collapse: collapse; font-size: 13px; }
table.mini td { padding: 7px 6px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.right { text-align: right; }
.strong { font-weight: 700; color: #0f766e; }
.rank { width: 22px; text-align: center; font-weight: 700; color: #94a3b8; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

.prog-row { margin-bottom: 13px; }
.prog-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 5px; }
.prog-nom { font-size: 13px; font-weight: 600; color: #1b2733; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 72%; }
.prog-pct { font-size: 13px; font-weight: 700; color: #0f766e; flex-shrink: 0; }
.prog-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .cols { grid-template-columns: 1fr; }
  .card.span2 { grid-column: auto; }
}
@media (max-width: 560px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
