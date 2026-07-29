<template>
  <div class="portail">
    <header class="portail-head">
      <div>
        <div class="ph-eyebrow">Espace de travail</div>
        <h1 class="ph-title">Bonjour 👋</h1>
        <p class="ph-sub">{{ dateJour }} · indicateurs en direct</p>
      </div>
    </header>

    <div class="portail-grid">
      <RouterLink v-for="c in cartes" :key="c.key" :to="c.to" class="pcard" :style="{ '--c': c.couleur }">
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="52" />
            <circle class="ring-fg" cx="60" cy="60" r="52" :style="{ stroke: c.couleur, strokeDashoffset: offset(c.pct) }" />
          </svg>
          <div class="ring-center">
            <div class="ring-pct" :style="{ color: c.couleur }">
              <template v-if="chargement">…</template>
              <template v-else-if="c.pct != null">{{ Math.round(c.pct) }}<span>%</span></template>
              <template v-else>—</template>
            </div>
            <div class="ring-sub">{{ c.sub }}</div>
          </div>
        </div>
        <div class="pcard-body">
          <div class="pcard-eyebrow">{{ c.eyebrow }}</div>
          <div class="pcard-title">{{ c.titre }}</div>
          <div class="pcard-metric">{{ c.metric }}</div>
          <div class="pcard-chips">
            <span v-for="ch in c.chips" :key="ch" class="chip">{{ ch }}</span>
          </div>
          <span class="pcard-cta">Ouvrir
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../supabase'

const anneeCourante = new Date().getFullYear()
const dateJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

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
  { key: 'tdb', to: '/', couleur: '#0f766e', eyebrow: "Vue d'ensemble", titre: 'Tableau de bord', metric: 'Réalisation du plan annuel — fabrication', sub: 'du plan', pct: reaPlan.value, chips: ['Production', 'Qualité', 'Finance'] },
  { key: 'consult', to: '/dispo-equipements', couleur: '#4338ca', eyebrow: 'Suivi & données', titre: 'Consultation', metric: 'Avancement fabrication — lots terminés / lancés', sub: 'avancés', pct: avancementFab.value, chips: ['Disponibilité ateliers', 'Suivi TRS', 'Avancement lots'] },
  { key: 'prod', to: '/ordres', couleur: '#c2410c', eyebrow: 'Saisie atelier', titre: 'Production & saisie', metric: 'TRS global de la semaine', sub: 'TRS', pct: trsGlobal.value, chips: ['Ordres', 'Suivi', 'Conditionnement', 'DDL'] },
  { key: 'admin', to: '/habilitations', couleur: '#047857', eyebrow: 'Paramètres & accès', titre: 'Administration', metric: 'Dossiers de lot vérifiés (Production)', sub: 'vérifiés', pct: dossiersVerifies.value, chips: ['Habilitations', 'Effectifs', 'Référentiels'] }
])
</script>

<style scoped>
.portail { max-width: 1120px; margin: 0 auto; padding: 8px 4px 24px; }

.portail-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 24px; }
.ph-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.ph-title { font-size: 26px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.ph-sub { font-size: 13.5px; color: #64748b; text-transform: capitalize; }

.portail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; }
@media (max-width: 760px) { .portail-grid { grid-template-columns: 1fr; } }

.pcard {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
  padding: 24px 26px 22px; position: relative; overflow: hidden;
  display: grid; grid-template-columns: auto 1fr; gap: 22px; align-items: center;
  text-decoration: none; color: inherit;
  transition: box-shadow .2s, transform .2s;
}
.pcard::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--c); }
.pcard:hover { box-shadow: 0 14px 34px rgba(15,42,51,.13); transform: translateY(-3px); }

.ring-wrap { position: relative; width: 132px; height: 132px; flex: none; }
.ring { width: 132px; height: 132px; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: #eef2f6; stroke-width: 11; }
.ring-fg { fill: none; stroke-width: 11; stroke-linecap: round; stroke-dasharray: 326.7; transition: stroke-dashoffset 1.4s cubic-bezier(.34,.9,.3,1); }
.ring-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.ring-pct { font-size: 33px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.ring-pct span { font-size: 16px; font-weight: 700; margin-left: 1px; }
.ring-sub { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-top: 5px; }

.pcard-body { min-width: 0; }
.pcard-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--c); margin-bottom: 3px; }
.pcard-title { font-size: 20px; font-weight: 800; letter-spacing: -.01em; color: #1a2233; margin-bottom: 4px; }
.pcard-metric { font-size: 13px; color: #64748b; margin-bottom: 12px; }
.pcard-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.chip { font-size: 12px; font-weight: 600; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 10px; }
.pcard-cta { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--c); }
.pcard-cta svg { width: 15px; height: 15px; transition: transform .2s; }
.pcard:hover .pcard-cta svg { transform: translateX(4px); }
</style>
