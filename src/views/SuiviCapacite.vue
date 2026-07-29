<template>
  <div class="cap">
    <div class="cap-head">
      <div>
        <div class="ch-eyebrow">Charge & capacité</div>
        <h1 class="ch-title">Suivi de capacité des équipements</h1>
        <p class="ch-sub">Occupation = temps de production (plan ÷ cadences) + nettoyage & réglage, vs capacité disponible.</p>
      </div>
    </div>

    <section class="card">
      <div class="ctrl">
        <div class="cf"><label>Année</label>
          <select v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
        </div>
        <div class="cf"><label>Régime</label>
          <select v-model="regime">
            <option value="auto">Réel (par équipement)</option>
            <option :value="1">1×8 (forcé)</option>
            <option :value="2">2×8 (forcé)</option>
            <option :value="3">3×8 (forcé)</option>
          </select>
        </div>
        <div class="cf chk"><label>Week-end</label>
          <label class="wk"><input type="checkbox" v-model="avecWE" /> Travail le week-end</label>
        </div>
        <div class="cf chk"><label>Nettoyage & réglage</label>
          <label class="wk"><input type="checkbox" v-model="inclureNett" /> Inclure dans la charge</label>
        </div>
        <div class="cf grow legend">
          <span class="lg lg-g">&lt; 70 %</span><span class="lg lg-a">70–90 %</span><span class="lg lg-r">&gt; 90 %</span><span class="lg lg-x">&gt; 100 %</span>
        </div>
      </div>
      <p v-if="chargement" class="muted">Chargement…</p>
      <p v-else-if="!planExiste" class="muted warn">Aucune quantité planifiée pour {{ annee }} dans le plan directeur.</p>
    </section>

    <section v-if="!chargement" class="card">
      <h2 class="card-title">Occupation annuelle par atelier · {{ joursAnnee }} jours ouvrés</h2>
      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              <th>Atelier</th><th class="ta-c">Machines</th><th class="ta-c">h/j effectif</th>
              <th class="ta-r">Charge (j)</th><th class="ta-r">Capacité (j)</th><th class="taux-h">Taux d'occupation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in lignesAnnuelles" :key="r.id" :class="{ vide: r.chargeJ === 0 }">
              <td><strong>{{ r.nom }}</strong> <span class="phase-tag" v-if="r.phase">{{ PHASE_NOM[r.phase] }}</span></td>
              <td class="ta-c">{{ r.machines }}</td>
              <td class="ta-c hj">{{ r.hj.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r">{{ r.chargeJ.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r">{{ r.capaciteJ.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) }}</td>
              <td class="taux-cell">
                <div class="bar-wrap"><div class="bar" :class="cls(r.taux)" :style="{ width: Math.min(100, r.taux * 100) + '%' }"></div></div>
                <span class="taux-val" :class="clsTxt(r.taux)">{{ (r.taux * 100).toFixed(1) }} %</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">h/j effectif = postes × TEP (heures utiles par machine et par jour). Charge = production + <template v-if="inclureNett">nettoyage (VDLP/lot) + nettoyage général & réglage (VDLT + REGLAGE / campagne)</template><template v-else>(nettoyage & réglage exclus)</template>. Taux &gt; 100 % = goulot.</p>
    </section>

    <section v-if="!chargement && lignesAnnuelles.some(r => r.chargeJ > 0)" class="card">
      <h2 class="card-title">Taux d'occupation mensuel</h2>
      <div class="tbl-wrap">
        <table class="grid matrice">
          <thead><tr><th class="sticky-c">Atelier</th><th v-for="(m, i) in MOIS" :key="i" class="ta-c">{{ m }}</th></tr></thead>
          <tbody>
            <tr v-for="r in lignesAnnuelles" :key="r.id" v-show="r.chargeJ > 0">
              <td class="sticky-c"><strong>{{ r.nom }}</strong></td>
              <td v-for="(m, i) in MOIS" :key="i" class="cell-taux" :class="cls(r.tauxMois[i])"><span v-if="r.tauxMois[i] > 0">{{ (r.tauxMois[i] * 100).toFixed(0) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="note">Valeurs en % d'occupation. Cellule vide = pas de charge planifiée.</p>
    </section>

    <section v-if="!chargement" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ (occGlobal * 100).toFixed(0) }} %</div><div class="km-lbl">Occupation moyenne</div></div>
      <div class="kpi-mini"><div class="km-val">{{ nbGoulots }}</div><div class="km-lbl">Ateliers &gt; 90 %</div></div>
      <div class="kpi-mini"><div class="km-val">{{ nbSurcharge }}</div><div class="km-lbl">Ateliers en surcharge</div></div>
      <div class="kpi-mini"><div class="km-val">{{ joursAnnee }}</div><div class="km-lbl">Jours ouvrés {{ annee }}</div></div>
    </section>

    <section v-if="!chargement && ateliersSansCadence.length" class="card avert">
      <h2 class="card-title">Produits planifiés sans cadence</h2>
      <p class="note">Ces produits ont un plan {{ annee }} mais aucune cadence renseignée — non comptés dans la charge. Renseigne-les dans le volet <strong>Cadences</strong>.</p>
      <div class="chips">
        <span v-for="(p, i) in ateliersSansCadence.slice(0, 40)" :key="i" class="chip">{{ p }}</span>
        <span v-if="ateliersSansCadence.length > 40" class="chip more">+{{ ateliersSansCadence.length - 40 }}</span>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }

const produits = ref([]), equipements = ref([]), ateliers = ref([]), cadences = ref([]), plans = ref([])
const chargement = ref(true)
const annee = ref(new Date().getFullYear())
const regime = ref('auto')
const avecWE = ref(false)
const inclureNett = ref(true)

const annees = computed(() => { const s = new Set(plans.value.map(p => p.annee).filter(Boolean)); s.add(new Date().getFullYear()); s.add(annee.value); return [...s].sort((a, b) => b - a) })

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  produits.value = await fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, unites_par_boite, taille_lot').eq('actif', true))
  equipements.value = await fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true))
  ateliers.value = await fetchAllPaged(() => supabase.from('ateliers').select('id, code, nom').eq('actif', true))
  cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale'))
  plans.value = await fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, produit_id'))
  chargement.value = false
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
function num(v, def) { const n = Number(v); return (v === null || v === undefined || isNaN(n)) ? def : n }

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) { const v = Number(c.cadence_nominale || 0); if (v > 0) m[c.equipement_id + '|' + c.produit_id] = v } return m })

const planExiste = computed(() => plans.value.some(p => p.annee === annee.value))
const planAgg = computed(() => {
  const m = {}
  for (const p of plans.value) {
    if (p.annee !== annee.value) continue
    const mo = Number(p.mois || 0); if (mo < 1 || mo > 12) continue
    if (!m[p.produit_id]) m[p.produit_id] = new Array(12).fill(0)
    m[p.produit_id][mo - 1] += Number(p.quantite_planifiee || 0)
  }
  return m
})

const equipParAtelier = computed(() => { const m = {}; for (const e of equipements.value) { if (!e.atelier_id) continue; (m[e.atelier_id] = m[e.atelier_id] || []).push(e) } return m })
// cadence de l'atelier pour un produit (max sur les machines)
const cadAtelierProd = computed(() => {
  const m = {}
  for (const [aid, list] of Object.entries(equipParAtelier.value)) {
    const per = {}
    for (const e of list) for (const p of produits.value) { const c = cadMap.value[e.id + '|' + p.id]; if (c > 0) per[p.id] = Math.max(per[p.id] || 0, c) }
    m[aid] = per
  }
  return m
})
function equipACadence(e) { for (const p of produits.value) if (cadMap.value[e.id + '|' + p.id] > 0) return true; return false }
// paramètres Ratio représentatifs par atelier
const paramsAtelier = computed(() => {
  const m = {}
  for (const [aid, list] of Object.entries(equipParAtelier.value)) {
    let machines = 0
    for (const e of list) machines += num(e.nb_machines, 1) || 1
    const rep = list.find(equipACadence) || list[0] || {}
    const cnt = {}
    for (const e of list) { const k = phaseDeType(e.type); if (k) cnt[k] = (cnt[k] || 0) + 1 }
    let phase = null, bn = 0; for (const [k, n] of Object.entries(cnt)) if (n > bn) { bn = n; phase = k }
    m[aid] = { machines, phase, postes: num(rep.postes, 3), tep: num(rep.tep, 8), vdlp: num(rep.vdlp, 0), vdlt: num(rep.vdlt, 0), reglage: num(rep.reglage, 0) }
  }
  return m
})

function joursOuvresMois(an, moisIdx) { const d = new Date(an, moisIdx, 1); let n = 0; while (d.getMonth() === moisIdx) { const wd = d.getDay(); if (avecWE.value || (wd !== 0 && wd !== 6)) n++; d.setDate(d.getDate() + 1) } return n }
const joursParMois = computed(() => MOIS.map((_, i) => joursOuvresMois(annee.value, i)))
const joursAnnee = computed(() => joursParMois.value.reduce((s, n) => s + n, 0))

const lignesAnnuelles = computed(() => {
  const out = []
  for (const a of ateliers.value) {
    const par = paramsAtelier.value[a.id] || { machines: 0, phase: null, postes: 3, tep: 8, vdlp: 0, vdlt: 0, reglage: 0 }
    const machines = par.machines
    const postesUsed = regime.value === 'auto' ? par.postes : Number(regime.value)
    const hj = postesUsed * par.tep   // heures utiles / jour / machine
    const capaMachineJour = hj * machines  // heures utiles / jour, atelier
    const cadP = cadAtelierProd.value[a.id] || {}
    const tauxMois = []; let chargeJTot = 0
    for (let mi = 0; mi < 12; mi++) {
      let occH = 0
      for (const [pid, tab] of Object.entries(planAgg.value)) {
        const boites = tab[mi]; if (!boites) continue
        const cad = cadP[pid]; if (!(cad > 0)) continue
        const p = prodById.value[pid] || {}
        occH += boites / cad   // cadence en boîtes/h -> heures = boîtes / cadence
        if (inclureNett.value) {
          const tl = num(p.taille_lot, 0)
          const nbLots = tl > 0 ? Math.ceil(boites / tl) : 1
          occH += nbLots * par.vdlp
          occH += par.vdlt + par.reglage   // une campagne par produit et par mois
        }
      }
      const chargeJ = capaMachineJour > 0 ? occH / capaMachineJour : 0
      chargeJTot += chargeJ
      tauxMois.push(joursParMois.value[mi] > 0 ? chargeJ / joursParMois.value[mi] : 0)
    }
    out.push({ id: a.id, nom: a.nom || a.code, phase: par.phase, machines, hj, chargeJ: chargeJTot, capaciteJ: joursAnnee.value, taux: joursAnnee.value > 0 ? chargeJTot / joursAnnee.value : 0, tauxMois })
  }
  return out.sort((x, y) => y.taux - x.taux)
})

const occGlobal = computed(() => { const w = lignesAnnuelles.value.filter(r => r.chargeJ > 0); return w.length ? w.reduce((s, r) => s + r.taux, 0) / w.length : 0 })
const nbGoulots = computed(() => lignesAnnuelles.value.filter(r => r.taux > 0.9).length)
const nbSurcharge = computed(() => lignesAnnuelles.value.filter(r => r.taux > 1).length)

const ateliersSansCadence = computed(() => {
  const manquants = new Set()
  for (const pid of Object.keys(planAgg.value)) {
    if (!planAgg.value[pid].some(v => v > 0)) continue
    let ok = false
    for (const a of ateliers.value) if ((cadAtelierProd.value[a.id] || {})[pid] > 0) { ok = true; break }
    if (!ok) { const p = prodById.value[pid]; if (p) manquants.add((p.code_pf || '') + ' · ' + (p.designation || '')) }
  }
  return [...manquants].sort()
})

function cls(t) { if (!t) return ''; if (t > 1) return 'x'; if (t > 0.9) return 'r'; if (t >= 0.7) return 'a'; return 'g' }
function clsTxt(t) { return 't-' + (cls(t) || 'g') }
</script>

<style scoped>
.cap { max-width: 1240px; margin: 0 auto; padding: 6px 4px 24px; }
.cap-head { margin-bottom: 20px; }
.ch-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.ch-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.ch-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card.avert { border-color: #fcd34d; background: #fffbeb; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0 0 14px; }
.muted { font-size: 13px; color: #94a3b8; margin: 6px 0 0; }
.muted.warn { color: #b45309; }
.note { font-size: 12px; color: #64748b; margin-top: 12px; font-style: italic; }

.ctrl { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.cf { display: flex; flex-direction: column; gap: 5px; }
.cf.grow { flex: 1; }
.cf label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.cf select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; }
.wk { font-size: 13px; color: #334155; font-weight: 500; display: inline-flex; align-items: center; gap: 7px; padding: 7px 0; text-transform: none; letter-spacing: 0; }
.legend { flex-direction: row; align-items: center; gap: 10px; justify-content: flex-end; }
.lg { font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
.lg-g { background: #dcfce7; color: #15803d; } .lg-a { background: #fef3c7; color: #b45309; } .lg-r { background: #fee2e2; color: #b91c1c; } .lg-x { background: #7f1d1d; color: #fff; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th, .grid td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; text-align: left; white-space: nowrap; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; } .ta-c { text-align: center; }
.grid tr.vide td { color: #cbd5e1; }
.hj { color: #64748b; font-size: 12px; }
.phase-tag { font-size: 10.5px; color: #64748b; background: #f1f5f9; border-radius: 5px; padding: 1px 6px; margin-left: 6px; font-weight: 600; }

.taux-h { width: 300px; }
.taux-cell { display: flex; align-items: center; gap: 10px; }
.bar-wrap { flex: 1; height: 12px; background: #f1f5f9; border-radius: 7px; overflow: hidden; min-width: 110px; }
.bar { height: 100%; border-radius: 7px; }
.bar.g { background: #22c55e; } .bar.a { background: #f59e0b; } .bar.r { background: #ef4444; } .bar.x { background: #7f1d1d; }
.taux-val { font-weight: 700; font-size: 13px; min-width: 52px; text-align: right; }
.t-g { color: #15803d; } .t-a { color: #b45309; } .t-r { color: #b91c1c; } .t-x { color: #7f1d1d; }

.matrice .sticky-c { position: sticky; left: 0; background: #fff; z-index: 1; }
.matrice th { text-align: center; }
.cell-taux { text-align: center; font-weight: 700; font-size: 12px; color: #334155; }
.cell-taux.g { background: #dcfce7; } .cell-taux.a { background: #fef3c7; } .cell-taux.r { background: #fee2e2; } .cell-taux.x { background: #7f1d1d; color: #fff; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } .taux-h { width: auto; } .legend { justify-content: flex-start; } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 11.5px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 6px; padding: 3px 8px; }
.chip.more { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }
</style>
