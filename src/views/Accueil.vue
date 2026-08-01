<template>
  <div class="portail" :class="{ dark }">
    <header class="portail-head">
      <div class="ph-left">
        <div class="ph-eyebrow">Espace de travail</div>
        <h1 class="ph-title">Bonjour <span class="wave">👋</span></h1>
        <p class="ph-sub">{{ dateJour }}</p>
      </div>
      <div class="ph-right">
        <div class="ph-live"><span class="live-dot"></span> Indicateurs en direct</div>
        <button class="theme-btn" @click="toggleDark" :title="dark ? 'Passer en clair' : 'Passer en sombre'">{{ dark ? '☀' : '🌙' }}</button>
      </div>
    </header>

    <div class="portail-grid">
      <article v-for="c in cartes" :key="c.key" class="pcard" :style="{ '--c': c.couleur, '--cd': c.fonce, '--cl': c.clair }">
        <div class="pcard-kpi">
          <div class="kpi-info">
            <div class="kpi-eyebrow">{{ c.eyebrow }}</div>
            <div class="kpi-titre">{{ c.titre }}</div>
            <div class="kpi-metric">{{ c.metric }}</div>
          </div>
          <div class="kpi-num">
            <div class="kpi-val"><template v-if="chargement">…</template><template v-else-if="c.pct != null">{{ Math.round(c.pct) }}<span>%</span></template><template v-else>—</template></div>
            <div class="kpi-sub">{{ c.sub }}</div>
          </div>
        </div>
        <nav class="pcard-links">
          <RouterLink v-for="l in c.links" :key="l[0]" :to="l[0]" class="plink">{{ l[1] }}</RouterLink>
        </nav>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../supabase'

const anneeCourante = new Date().getFullYear()
const dateJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const dark = ref(false)
try { dark.value = localStorage.getItem('accueil_dark') === '1' } catch (e) {}
function toggleDark() { dark.value = !dark.value; try { localStorage.setItem('accueil_dark', dark.value ? '1' : '0') } catch (e) {} }

const ordres = ref([])
const plan = ref([])
const trsRows = ref([])
const cadences = ref([])
const chargement = ref(true)

const C = 2 * Math.PI * 52
function offset(pct) {
  const p = pct == null ? 0 : Math.max(0, Math.min(100, pct))
  return C - (C * p) / 100
}

async function fetchAllPaged(make) {
  const size = 1000
  let from = 0, all = []
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
  const [ro, rp, rt, rc] = await Promise.all([
    fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, statut, boites_fabriquees, date_lancement, date_fin_fabrication, ddl_verifie, ddl_aq_verifie')),
    fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee')),
    fetchAllPaged(() => supabase.from('trs_postes').select('equipement_id, produit_id, date, temps_ouverture_min, arret_panne_min, arret_format_min, arret_nettoyage_min, arret_reglage_min, arret_maintenance_min, arret_attente_min, arret_autre_min, production_realisee, rebuts, actif')),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, mode, cadence_nominale'))
  ])
  ordres.value = ro
  plan.value = rp
  trsRows.value = rt
  cadences.value = rc
  chargement.value = false
})

// 1) Réalisation du plan annuel : boîtes fabriquées / boîtes planifiées.
const reaPlan = computed(() => {
  const fab = ordres.value
    .filter(o => o.date_fin_fabrication && new Date(o.date_fin_fabrication).getFullYear() === anneeCourante)
    .reduce((s, o) => s + Number(o.boites_fabriquees || 0), 0)
  const pl = plan.value
    .filter(p => Number(p.annee) === anneeCourante)
    .reduce((s, p) => s + Number(p.quantite_planifiee || 0), 0)
  return pl > 0 ? Math.min(100, (fab / pl) * 100) : null
})

// 2) Avancement fabrication : lots terminés ou libérés / lots lancés (année).
const avancementFab = computed(() => {
  const lances = ordres.value.filter(o => o.date_lancement && new Date(o.date_lancement).getFullYear() === anneeCourante)
  if (!lances.length) return null
  const finis = lances.filter(o => o.statut === 'Terminé' || o.statut === 'Libéré').length
  return (finis / lances.length) * 100
})

// 3) TRS global sur 7 jours (Disponibilité × Performance × Qualité, pondéré par l'ouverture).
const AR = ['arret_panne_min', 'arret_format_min', 'arret_nettoyage_min', 'arret_reglage_min', 'arret_maintenance_min', 'arret_attente_min', 'arret_autre_min']
const trsGlobal = computed(() => {
  const semaine = new Date(); semaine.setDate(semaine.getDate() - 7)
  const cadMap = {}
  for (const c of cadences.value) cadMap[c.equipement_id + '|' + c.produit_id] = c
  let sOuv = 0, sTrs = 0
  for (const t of trsRows.value) {
    if (t.actif === false) continue
    const d = new Date(t.date); if (d < semaine) continue
    const ouverture = Number(t.temps_ouverture_min || 0); if (ouverture <= 0) continue
    const arr = AR.reduce((s, k) => s + Number(t[k] || 0), 0)
    const fonct = Math.max(0, ouverture - arr)
    const dispo = ouverture ? fonct / ouverture : 0
    const cad = cadMap[t.equipement_id + '|' + t.produit_id]
    const prod = Number(t.production_realisee || 0)
    let perf = 0, qual = 1
    if (cad && cad.mode === 'cycle') { perf = fonct ? Math.min(1, prod / fonct) : 0 }
    else if (cad && Number(cad.cadence_nominale) > 0) {
      const theo = (fonct / 60) * Number(cad.cadence_nominale)
      perf = theo ? Math.min(1, prod / theo) : 0
      const reb = Number(t.rebuts || 0)
      qual = prod > 0 ? (prod - reb) / prod : 1
    }
    const trs = dispo * perf * qual
    sOuv += ouverture; sTrs += trs * ouverture
  }
  return sOuv ? (sTrs / sOuv) * 100 : null
})

// 4) Dossiers de lot vérifiés : lots fabriqués dont le DDL Production est vérifié.
const dossiersVerifies = computed(() => {
  const fab = ordres.value.filter(o => o.date_fin_fabrication && new Date(o.date_fin_fabrication).getFullYear() === anneeCourante)
  if (!fab.length) return null
  const ver = fab.filter(o => o.ddl_verifie).length
  return (ver / fab.length) * 100
})

const cartes = computed(() => [
  {
    key: 'tdb', couleur: '#0f766e', clair: '#f0fdfa', fonce: '#0c5f59', eyebrow: "Vue d'ensemble", titre: 'Tableau de bord',
    metric: 'Réalisation du plan annuel', sub: 'du plan', pct: reaPlan.value,
    links: [['/', 'Ouvrir le tableau de bord']]
  },
  {
    key: 'consult', couleur: '#4338ca', clair: '#eef2ff', fonce: '#3730a3', eyebrow: 'Suivi & données', titre: 'Consultation',
    metric: 'Avancement fabrication (lots terminés / lancés)', sub: 'avancés', pct: avancementFab.value,
    links: [
      ['/realisation-plan', 'Réalisation vs Plan'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"],
      ['/dispo-equipements', 'Disponibilité équipements'], ['/avancement', 'Suivi du process'],
      ['/production-atelier', 'Production par atelier'], ['/suivi-trs', 'Suivi TRS'],
      ['/capacite', 'Capacité équipements'], ['/qse', 'Indicateurs QSE'],
      ['/encours', 'En-cours'], ['/dossier', 'Dossier de lot'], ['/audit', "Journal d'audit"]
    ]
  },
  {
    key: 'prod', couleur: '#c2410c', clair: '#fff7ed', fonce: '#9a3412', eyebrow: 'Saisie atelier', titre: 'Production & saisie',
    metric: 'TRS global de la semaine', sub: 'TRS', pct: trsGlobal.value,
    links: [
      ['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication'], ['/suivi', 'Suivi fabrication'],
      ['/conditionnement', 'Conditionnement'], ['/saisie-trs', 'Saisie TRS'],
      ['/verification-ddl', 'DDL Fab — Production'], ['/verification-ddl-aq', 'DDL Fab — AQ'],
      ['/verification-ddl-cond', 'DDL Conditionnement'], ['/effectifs', 'Effectifs']
    ]
  },
  {
    key: 'admin', couleur: '#047857', clair: '#f0fdf4', fonce: '#065f46', eyebrow: 'Paramètres & accès', titre: 'Administration',
    metric: 'Dossiers de lot vérifiés (Production)', sub: 'vérifiés', pct: dossiersVerifies.value,
    links: [['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations']]
  }
])
</script>

<style scoped>
.portail { max-width: 1180px; margin: 0 auto; padding: 10px 4px 28px; }

.portail-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 26px; flex-wrap: wrap; }
.ph-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #0f766e; }
.ph-title { font-size: 30px; font-weight: 800; letter-spacing: -.025em; color: #0f1729; margin: 4px 0 3px; }
.wave { display: inline-block; transform-origin: 70% 70%; animation: wave 2.6s ease-in-out infinite; }
@keyframes wave { 0%,60%,100% { transform: rotate(0); } 10% { transform: rotate(14deg); } 20% { transform: rotate(-8deg); } 30% { transform: rotate(14deg); } 40% { transform: rotate(-4deg); } 50% { transform: rotate(10deg); } }
.ph-sub { font-size: 14px; color: #64748b; text-transform: capitalize; }
.ph-live { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 999px; padding: 7px 15px; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 2s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.5); } 70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }

.portail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
@media (max-width: 880px) { .portail-grid { grid-template-columns: 1fr; } }

.pcard { background: #fff; border: 1px solid #e6ebf1; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(16,24,40,.05); transition: transform .22s cubic-bezier(.34,.9,.3,1), box-shadow .22s; }
.pcard:hover { transform: translateY(-3px); box-shadow: 0 16px 34px -12px rgba(16,24,40,.22); }

.pcard-kpi { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 22px 24px; background: linear-gradient(135deg, var(--c), var(--cd)); color: #fff; }
.kpi-info { min-width: 0; }
.kpi-eyebrow { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; opacity: .82; }
.kpi-titre { font-size: 20px; font-weight: 800; letter-spacing: -.02em; margin: 5px 0 4px; }
.kpi-metric { font-size: 12.5px; opacity: .82; line-height: 1.4; }
.kpi-num { text-align: right; flex: none; }
.kpi-val { font-size: 48px; font-weight: 800; line-height: .95; letter-spacing: -.04em; }
.kpi-val span { font-size: 22px; font-weight: 700; margin-left: 1px; }
.kpi-sub { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; opacity: .82; margin-top: 6px; }

.pcard-links { display: flex; flex-wrap: wrap; gap: 7px; padding: 16px 20px 20px; margin-top: auto; background: var(--cl); }
.plink { display: inline-flex; align-items: center; font-size: 12.5px; font-weight: 600; color: #334155; background: #fff; border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 12px; text-decoration: none; transition: transform .15s, background .15s, border-color .15s, color .15s, box-shadow .15s; }
.plink:hover { background: var(--c); border-color: var(--c); color: #fff; transform: translateY(-1px); box-shadow: 0 5px 12px -4px rgba(16,24,40,.28); }
.plink:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .wave, .live-dot { animation: none; }
  .pcard, .plink { transition: none; }
}

/* Bouton de thème */
.portail { transition: background .3s; }
.ph-right { display: flex; align-items: center; gap: 12px; }
.theme-btn { width: 38px; height: 38px; border-radius: 999px; border: 1px solid #e2e8f0; background: #f1f5f9; font-size: 16px; line-height: 1; cursor: pointer; transition: background .15s, border-color .15s; }
.theme-btn:hover { background: #e2e8f0; }

/* Thème sombre (inspiré Square CRM) */
.portail.dark { background: #0f1220; border-radius: 18px; padding: 22px 20px 30px; min-height: calc(100vh - 120px); }
.portail.dark .ph-title { color: #f1f5f9; }
.portail.dark .ph-sub { color: #94a3b8; }
.portail.dark .theme-btn { background: #232838; border-color: #333a4f; }
.portail.dark .theme-btn:hover { background: #2c3244; }
.portail.dark .pcard { background: #1b1e2b; border-color: #2a2f42; box-shadow: 0 1px 3px rgba(0,0,0,.35); }
.portail.dark .pcard:hover { box-shadow: 0 18px 36px -12px rgba(0,0,0,.55); }
.portail.dark .pcard-links { background: #171a26; }
.portail.dark .plink { background: #232838; color: #cbd5e1; border-color: #333a4f; }
.portail.dark .plink:hover { background: var(--c); border-color: var(--c); color: #fff; }
</style>
