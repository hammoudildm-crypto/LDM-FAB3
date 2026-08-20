<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOTIFS = [
  ['panne', 'arret_panne_min', 'Panne', '#ef4444'],
  ['format', 'arret_format_min', 'Format', '#f59e0b'],
  ['nettoyage', 'arret_nettoyage_min', 'Nettoyage', '#0f766e'],
  ['reglage', 'arret_reglage_min', 'Réglage', '#8b5cf6'],
  ['maintenance', 'arret_maintenance_min', 'Maintenance', '#6366f1'],
  ['attente', 'arret_attente_min', 'Attente', '#94a3b8'],
  ['autre', 'arret_autre_min', 'Autre', '#cbd5e1']
]
function num(v, d = 0) { const n = Number(v); return isFinite(n) ? n : d }

const nomGroupe = ref(route.query.nom ? String(route.query.nom) : '')
const annee = ref(route.query.annee ? Number(route.query.annee) : new Date().getFullYear())
const chargement = ref(true)

const equipements = ref([])
const produits = ref([])
const cadences = ref([])
const postes = ref([])
const plan = ref([])
const ofs = ref([])

const PREFIXE_OP = /^(op[ée]rateur|op\.?|poste)\s+/i
function baseNom(nom) {
  const n = String(nom || '').trim().replace(PREFIXE_OP, '')
  return n.replace(/\s+(\d{1,2})\s*$/, (m, d) => (Number(d) <= 20 ? '' : m)).trim()
}

// Équipements du groupe (même nom de base)
const equipsGroupe = computed(() => {
  const cible = baseNom(nomGroupe.value).toLowerCase()
  return equipements.value.filter(e => baseNom(e.nom || e.code).toLowerCase() === cible)
})
const idsGroupe = computed(() => new Set(equipsGroupe.value.map(e => e.id)))
const nbMachines = computed(() => equipsGroupe.value.length || 1)

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
function cadenceDe(eqId, pid) { const c = cadences.value.find(c => c.equipement_id === eqId && c.produit_id === pid); return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' } }
// meilleure cadence du groupe pour un produit
function cadenceGroupe(pid) { let best = 0; for (const e of equipsGroupe.value) { const v = cadenceDe(e.id, pid).value; if (v > best) best = v } return best }

async function charger() {
  chargement.value = true
  const [re, rp, rc, rt, rpl, rof] = await Promise.all([
    supabase.from('equipements').select('*').eq('actif', true),
    supabase.from('produits').select('id, code_pf, designation, unites_par_boite, taille_lot, poids_lot_kg, poids_unitaire_mg').eq('actif', true),
    supabase.from('cadences_produit').select('*'),
    supabase.from('trs_postes').select('*, equipements(code, nom), produits(code_pf, designation)').gte('date', annee.value + '-01-01').lte('date', annee.value + '-12-31'),
    supabase.from('plan_production').select('produit_id, annee, mois, quantite_planifiee').eq('annee', annee.value),
    supabase.from('ordres_fabrication').select('produit_id, boites_fabriquees, date_fin_fabrication, statut')
  ])
  equipements.value = re.data || []
  produits.value = rp.data || []
  cadences.value = rc.data || []
  postes.value = (rt.data || []).filter(s => idsGroupe.value.has(s.equipement_id) || true) // filtré plus bas
  plan.value = rpl.data || []
  ofs.value = rof.data || []
  chargement.value = false
}
onMounted(charger)

// --- TRS ---
const postesGroupe = computed(() => postes.value.filter(s => idsGroupe.value.has(s.equipement_id)))
const trs = computed(() => {
  let ouverture = 0, fonct = 0, theo = 0, prodPerf = 0, prodQual = 0, rebutsQual = 0
  for (const s of postesGroupe.value) {
    const to = num(s.temps_ouverture_min)
    let arr = 0; for (const m of MOTIFS) arr += num(s[m[1]])
    const tf = Math.max(0, to - arr)
    ouverture += to; fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.value > 0) { theo += (tf / 60) * cd.value; prodPerf += num(s.production_realisee); prodQual += num(s.production_realisee); rebutsQual += num(s.rebuts) }
  }
  const dispo = ouverture ? fonct / ouverture : 0
  const perf = theo ? Math.min(1, prodPerf / theo) : 0
  const qualite = prodQual ? Math.max(0, (prodQual - rebutsQual) / prodQual) : 0
  return { dispo, perf, qualite, global: dispo * perf * qualite, ouverture, fonct, aPostes: postesGroupe.value.length }
})
const trsParMois = computed(() => {
  const parM = {}
  for (const s of postesGroupe.value) {
    const mo = new Date(s.date).getMonth()
    if (!parM[mo]) parM[mo] = { ouv: 0, fonct: 0, theo: 0, prod: 0, qual: 0, reb: 0 }
    const a = parM[mo]; const to = num(s.temps_ouverture_min)
    let arr = 0; for (const m of MOTIFS) arr += num(s[m[1]])
    const tf = Math.max(0, to - arr); a.ouv += to; a.fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prod += num(s.production_realisee); a.qual += num(s.production_realisee); a.reb += num(s.rebuts) }
  }
  const out = Array(12).fill(0)
  for (let mo = 0; mo < 12; mo++) { const a = parM[mo]; if (!a) continue; const d = a.ouv ? a.fonct / a.ouv : 0; const p = a.theo ? Math.min(1, a.prod / a.theo) : 0; const q = a.qual ? Math.max(0, (a.qual - a.reb) / a.qual) : 0; out[mo] = +(d * p * q * 100).toFixed(1) }
  return out
})
const arretsGroupe = computed(() => {
  const m = { panne: 0, format: 0, nettoyage: 0, reglage: 0, maintenance: 0, attente: 0, autre: 0 }
  for (const s of postesGroupe.value) for (const mo of MOTIFS) m[mo[0]] += num(s[mo[1]])
  const tot = Object.values(m).reduce((a, b) => a + b, 0)
  return MOTIFS.map(mo => ({ key: mo[0], label: mo[2], color: mo[3], min: m[mo[0]], pct: tot ? m[mo[0]] / tot * 100 : 0 })).filter(x => x.min > 0).sort((a, b) => b.min - a.min)
})

// --- Plan / réalisé par produit ---
const planParProduit = computed(() => { const m = {}; for (const r of plan.value) m[r.produit_id] = (m[r.produit_id] || 0) + num(r.quantite_planifiee); return m })
const realiseParProduit = computed(() => {
  const m = {}
  for (const o of ofs.value) { const d = o.date_fin_fabrication ? new Date(o.date_fin_fabrication) : null; if (d && d.getFullYear() === annee.value) m[o.produit_id] = (m[o.produit_id] || 0) + num(o.boites_fabriquees) }
  return m
})
const produitProduitPoste = computed(() => { const m = {}; for (const s of postesGroupe.value) if (s.produit_id) m[s.produit_id] = (m[s.produit_id] || 0) + num(s.production_realisee); return m })

// Top 10 produits sur la ligne : produits ayant une cadence sur le groupe, triés par plan
const top10 = computed(() => {
  const rows = []
  for (const p of produits.value) {
    const cad = cadenceGroupe(p.id)
    if (cad <= 0) continue
    const planB = planParProduit.value[p.id] || 0
    const realB = realiseParProduit.value[p.id] || 0
    const posteB = produitProduitPoste.value[p.id] || 0
    if (planB <= 0 && realB <= 0 && posteB <= 0) continue
    rows.push({ code: p.code_pf, desig: p.designation, cad, plan: planB, real: realB, poste: posteB, taux: planB > 0 ? Math.min(999, realB / planB * 100) : null })
  }
  rows.sort((a, b) => (b.plan || b.poste) - (a.plan || a.poste))
  return rows.slice(0, 10)
})

// --- Occupation restante (quantité restante ÷ jours restants) ---
function joursOuvresRestants() {
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  const fin = new Date(annee.value, 11, 31)
  if (auj.getFullYear() > annee.value) return 0
  let d = new Date(Math.max(auj.getTime(), new Date(annee.value, 0, 1).getTime())); let n = 0
  while (d <= fin) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; d = new Date(d.getTime() + 86400000) }
  return n
}
const occupationRestante = computed(() => {
  let heures = 0, boitesRestantes = 0
  for (const p of produits.value) {
    const cad = cadenceGroupe(p.id); if (cad <= 0) continue
    const planB = planParProduit.value[p.id] || 0
    const realB = realiseParProduit.value[p.id] || 0
    const reste = Math.max(0, planB - realB)
    if (reste <= 0) continue
    boitesRestantes += reste
    const plk = num(p.poids_lot_kg) || (num(p.taille_lot) * num(p.unites_par_boite) * num(p.poids_unitaire_mg) / 1e6)
    const tl = num(p.taille_lot)
    if (tl > 0 && plk > 0) { const kg = reste * plk / tl; heures += kg / cad }
  }
  const chargeJ = heures / 24 / nbMachines.value
  const jrsRest = joursOuvresRestants()
  const capaRest = jrsRest * nbMachines.value
  return { boitesRestantes, chargeJ, jrsRest, taux: capaRest > 0 ? chargeJ / jrsRest : 0 }
})

function pct(v) { return (v * 100).toFixed(1) }
function clsTaux(t) { if (t > 1) return 'x'; if (t > 0.9) return 'r'; if (t >= 0.7) return 'a'; return 'g' }
function retour() { router.push({ path: '/capacite' }) }
</script>

<template>
  <div class="ed">
    <div class="ed-top">
      <button class="ed-back" @click="retour">← Retour capacité</button>
      <div>
        <div class="ed-eyebrow">Fiche équipement · {{ annee }}</div>
        <h1 class="ed-title">{{ nomGroupe }} <span v-if="nbMachines > 1" class="ed-nm">×{{ nbMachines }}</span></h1>
      </div>
    </div>

    <p v-if="chargement" class="ed-load">Chargement…</p>

    <template v-else>
      <!-- Bandeau KPI -->
      <div class="ed-kpis">
        <div class="ed-kpi"><div class="ed-kv" :class="'t-' + clsTaux(trs.global)">{{ trs.aPostes ? pct(trs.global) + ' %' : '—' }}</div><div class="ed-kl">TRS global</div></div>
        <div class="ed-kpi"><div class="ed-kv" :class="'t-' + clsTaux(occupationRestante.taux)">{{ pct(occupationRestante.taux) }} %</div><div class="ed-kl">Occupation du reste d'année</div></div>
        <div class="ed-kpi"><div class="ed-kv">{{ occupationRestante.chargeJ.toFixed(1) }} j</div><div class="ed-kl">Charge restante</div></div>
        <div class="ed-kpi"><div class="ed-kv">{{ occupationRestante.jrsRest }} j</div><div class="ed-kl">Jours ouvrés restants</div></div>
      </div>

      <div class="ed-grid">
        <!-- TRS -->
        <section class="ed-card">
          <h2 class="ed-ct">🎯 TRS — Taux de Rendement Synthétique</h2>
          <p v-if="!trs.aPostes" class="ed-muted">Aucune saisie TRS pour {{ annee }} sur cet équipement.</p>
          <template v-else>
            <div class="ed-trs3">
              <div class="ed-tb"><div class="ed-tbv">{{ pct(trs.dispo) }} %</div><div class="ed-tbl">Disponibilité</div></div>
              <div class="ed-op">×</div>
              <div class="ed-tb"><div class="ed-tbv">{{ pct(trs.perf) }} %</div><div class="ed-tbl">Performance</div></div>
              <div class="ed-op">×</div>
              <div class="ed-tb"><div class="ed-tbv">{{ pct(trs.qualite) }} %</div><div class="ed-tbl">Qualité</div></div>
              <div class="ed-op">=</div>
              <div class="ed-tb big" :class="'t-' + clsTaux(trs.global)"><div class="ed-tbv">{{ pct(trs.global) }} %</div><div class="ed-tbl">TRS</div></div>
            </div>

            <div class="ed-sub">Évolution mensuelle du TRS</div>
            <div class="ed-mchart">
              <div v-for="(t, i) in trsParMois" :key="i" class="ed-mcol" :title="MOIS[i] + ' : ' + t + ' %'">
                <div class="ed-mbar" :style="{ height: Math.min(100, t) + '%' }"></div>
                <span class="ed-mm">{{ MOIS[i].charAt(0) }}</span>
              </div>
            </div>

            <div v-if="arretsGroupe.length" class="ed-sub">Répartition des arrêts</div>
            <div v-if="arretsGroupe.length" class="ed-arrets">
              <div v-for="a in arretsGroupe" :key="a.key" class="ed-arr">
                <span class="ed-arr-dot" :style="{ background: a.color }"></span>
                <span class="ed-arr-lbl">{{ a.label }}</span>
                <span class="ed-arr-bar"><span class="ed-arr-fill" :style="{ width: a.pct + '%', background: a.color }"></span></span>
                <span class="ed-arr-v">{{ Math.round(a.min) }} min</span>
              </div>
            </div>
          </template>
        </section>

        <!-- Top 10 produits -->
        <section class="ed-card">
          <h2 class="ed-ct">🏆 Top 10 produits sur la ligne</h2>
          <p v-if="!top10.length" class="ed-muted">Aucun produit avec cadence/plan sur cet équipement.</p>
          <table v-else class="ed-tbl">
            <thead><tr><th>#</th><th>Produit</th><th class="r">Plan (bts)</th><th class="r">Réalisé</th><th class="r">Cadence</th><th class="r">Avancement</th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in top10" :key="p.code">
                <td class="ed-rank">{{ i + 1 }}</td>
                <td><b>{{ p.code }}</b><span class="ed-pdesig"> — {{ p.desig }}</span></td>
                <td class="r">{{ p.plan.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ p.real.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ p.cad.toLocaleString('fr-FR') }}</td>
                <td class="r"><span v-if="p.taux != null" class="ed-badge" :class="'t-' + clsTaux(p.taux / 100)">{{ p.taux.toFixed(0) }} %</span><span v-else>—</span></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <!-- Occupation restante détaillée -->
      <section class="ed-card">
        <h2 class="ed-ct">📅 Occupation prévisionnelle — reste de l'année</h2>
        <p class="ed-muted">Calcul : quantité <b>restant à fabriquer</b> (plan {{ annee }} − déjà réalisé) convertie en heures via la cadence, rapportée aux <b>jours ouvrés restants</b> jusqu'au 31/12.</p>
        <div class="ed-occ">
          <div class="ed-occ-b"><div class="ed-occ-v">{{ Math.round(occupationRestante.boitesRestantes).toLocaleString('fr-FR') }}</div><div class="ed-occ-l">Boîtes restantes à fabriquer</div></div>
          <div class="ed-occ-b"><div class="ed-occ-v">{{ occupationRestante.chargeJ.toFixed(1) }} j</div><div class="ed-occ-l">Charge restante (machine)</div></div>
          <div class="ed-occ-b"><div class="ed-occ-v">{{ occupationRestante.jrsRest }} j</div><div class="ed-occ-l">Jours ouvrés restants</div></div>
          <div class="ed-occ-b hi"><div class="ed-occ-v" :class="'t-' + clsTaux(occupationRestante.taux)">{{ pct(occupationRestante.taux) }} %</div><div class="ed-occ-l">Taux d'occupation prévisionnel</div></div>
        </div>
        <div class="ed-occ-bar"><div class="ed-occ-fill" :class="'t-' + clsTaux(occupationRestante.taux)" :style="{ width: Math.min(100, occupationRestante.taux * 100) + '%' }"></div></div>
        <p v-if="occupationRestante.taux > 1" class="ed-alert">⚠️ Charge restante supérieure à la capacité restante — cet équipement ne pourra pas absorber le reste du plan d'ici la fin de l'année au régime actuel.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ed { color: #1b2733; }
.ed-top { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.ed-back { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 600; font-size: 13px; color: #475569; cursor: pointer; }
.ed-back:hover { background: #e2e8f0; }
.ed-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.ed-title { margin: 2px 0 0; font-size: 24px; font-weight: 800; color: #1a2233; }
.ed-nm { font-size: 15px; color: #64748b; font-weight: 700; }
.ed-load { color: #94a3b8; }

.ed-kpis { display: flex; gap: 12px; margin-bottom: 16px; }
.ed-kpi { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; text-align: center; }
.ed-kv { font-size: 26px; font-weight: 800; color: #1e293b; line-height: 1.1; }
.ed-kl { font-size: 11.5px; color: #64748b; font-weight: 600; margin-top: 3px; }

.ed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.ed-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; }
.ed-ct { margin: 0 0 14px; font-size: 15px; font-weight: 800; color: #1a2233; }
.ed-muted { color: #94a3b8; font-size: 13px; margin: 0 0 10px; line-height: 1.45; }
.ed-sub { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin: 16px 0 8px; }

.ed-trs3 { display: flex; align-items: stretch; gap: 6px; }
.ed-tb { flex: 1; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 10px 6px; text-align: center; }
.ed-tb.big { background: #f0fdfa; border-color: #99f6e4; }
.ed-tbv { font-size: 19px; font-weight: 800; color: #1e293b; }
.ed-tbl { font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px; }
.ed-op { align-self: center; font-size: 18px; font-weight: 800; color: #cbd5e1; }

.ed-mchart { display: flex; align-items: flex-end; gap: 4px; height: 90px; padding-top: 4px; border-bottom: 1px solid #e2e8f0; }
.ed-mcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.ed-mbar { width: 70%; min-height: 2px; background: #6366f1; border-radius: 3px 3px 0 0; }
.ed-mm { font-size: 9px; color: #94a3b8; margin-top: 2px; }

.ed-arrets { display: flex; flex-direction: column; gap: 6px; }
.ed-arr { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ed-arr-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.ed-arr-lbl { flex: 0 0 84px; color: #475569; font-weight: 600; }
.ed-arr-bar { flex: 1; height: 8px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.ed-arr-fill { display: block; height: 100%; border-radius: 5px; }
.ed-arr-v { flex: 0 0 62px; text-align: right; font-weight: 700; color: #334155; font-size: 11px; }

.ed-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ed-tbl th { text-align: left; font-size: 10.5px; color: #64748b; font-weight: 700; padding: 5px 7px; border-bottom: 1px solid #e2e8f0; }
.ed-tbl th.r, .ed-tbl td.r { text-align: right; }
.ed-tbl td { padding: 5px 7px; border-bottom: 1px solid #f1f5f9; }
.ed-rank { font-weight: 800; color: #6366f1; }
.ed-pdesig { color: #94a3b8; }
.ed-badge { font-weight: 800; font-size: 11px; border-radius: 5px; padding: 1px 7px; }

.ed-occ { display: flex; gap: 12px; margin-bottom: 12px; }
.ed-occ-b { flex: 1; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 12px 14px; text-align: center; }
.ed-occ-b.hi { background: #f0fdfa; border-color: #99f6e4; }
.ed-occ-v { font-size: 22px; font-weight: 800; color: #1e293b; }
.ed-occ-l { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 3px; }
.ed-occ-bar { height: 12px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.ed-occ-fill { height: 100%; border-radius: 7px; }
.ed-alert { margin: 12px 0 0; font-size: 12.5px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 9px 12px; }

.t-g { color: #16a34a; } .t-a { color: #d97706; } .t-r { color: #dc2626; } .t-x { color: #991b1b; }
.ed-badge.t-g { background: #dcfce7; color: #15803d; } .ed-badge.t-a { background: #fef9c3; color: #a16207; } .ed-badge.t-r { background: #fee2e2; color: #b91c1c; } .ed-badge.t-x { background: #7f1d1d; color: #fff; }
.ed-mbar, .ed-occ-fill.t-x { }
.ed-occ-fill.t-g { background: #16a34a; } .ed-occ-fill.t-a { background: #f59e0b; } .ed-occ-fill.t-r { background: #ef4444; } .ed-occ-fill.t-x { background: #991b1b; }
@media (max-width: 860px) { .ed-grid { grid-template-columns: 1fr; } .ed-kpis, .ed-occ { flex-wrap: wrap; } .ed-kpi, .ed-occ-b { flex-basis: 46%; } }
</style>
