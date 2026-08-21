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
async function fetchAllPaged(makeQuery) { const page = 1000; let from = 0, all = []; while (true) { const { data, error } = await makeQuery().range(from, from + page - 1); if (error || !data || !data.length) break; all = all.concat(data); if (data.length < page) break; from += page } return all }

const nomGroupe = ref(route.query.nom ? String(route.query.nom) : '')
const codesGroupe = ref(route.query.codes ? String(route.query.codes).split(',').map(c => c.trim()).filter(Boolean) : [])
const postesRegime = ref(route.query.postes ? Number(route.query.postes) : 0)
const weRegime = ref(route.query.we === '1')
const reg4Regime = ref(route.query.reg4 === '1')
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
  if (codesGroupe.value.length) { const set = new Set(codesGroupe.value); return equipements.value.filter(e => set.has(e.code)) }
  const cible = baseNom(nomGroupe.value).toLowerCase().trim()
  if (!cible) return []
  let list = equipements.value.filter(e => baseNom(e.nom || e.code).toLowerCase() === cible)
  if (!list.length) list = equipements.value.filter(e => { const n = (e.nom || '').toLowerCase(); return n && (n.includes(cible) || cible.includes(n)) })
  return list
})
const idsGroupe = computed(() => new Set(equipsGroupe.value.map(e => e.id)))
const nbMachines = computed(() => equipsGroupe.value.length || 1)

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
function cadenceDe(eqId, pid) { const c = cadences.value.find(c => c.equipement_id === eqId && c.produit_id === pid); return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' } }
// meilleure cadence du groupe pour un produit
function cadenceGroupe(pid) { let best = 0; for (const e of equipsGroupe.value) { const v = cadenceDe(e.id, pid).value; if (v > best) best = v } return best }
const repEq = computed(() => equipsGroupe.value[0] || {})
function poidsLot(p) { const calc = num(p.taille_lot) * num(p.unites_par_boite) * num(p.poids_unitaire_mg) / 1e6; return calc > 0 ? calc : num(p.poids_lot_kg) }
function heuresProduit(pid, boites) {
  const p = prodById.value[pid]; if (!p || boites <= 0) return { prod: 0, nett: 0, total: 0 }
  const cad = cadenceGroupe(pid); if (cad <= 0) return { prod: 0, nett: 0, total: 0 }
  const plk = poidsLot(p), tl = num(p.taille_lot)
  if (!(tl > 0 && plk > 0)) return { prod: 0, nett: 0, total: 0 }
  const prod = (boites * plk / tl) / cad
  const nbLots = Math.ceil(boites / tl)
  const e = repEq.value
  const nett = nbLots * num(e.vdlp) + num(e.vdlt) + num(e.reglage)
  return { prod, nett, total: prod + nett }
}

async function charger() {
  chargement.value = true
  const [re, rp, rc, rt, rpl, rof] = await Promise.all([
    fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)),
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, unites_par_boite, taille_lot, poids_lot_kg, poids_unitaire_mg').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('*')),
    fetchAllPaged(() => supabase.from('trs_postes').select('*, equipements(code, nom), produits(code_pf, designation)').gte('date', annee.value + '-01-01').lte('date', annee.value + '-12-31')),
    fetchAllPaged(() => supabase.from('plan_production').select('produit_id, annee, mois, quantite_planifiee').eq('annee', annee.value)),
    fetchAllPaged(() => supabase.from('ordres_fabrication').select('produit_id, boites_fabriquees, date_fin_fabrication, statut'))
  ])
  equipements.value = re || []
  produits.value = rp || []
  cadences.value = rc || []
  postes.value = rt || []
  plan.value = rpl || []
  ofs.value = rof || []
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
const planParProduitMois = computed(() => { const m = {}; for (const r of plan.value) { const pid = r.produit_id, mo = num(r.mois) - 1; if (!m[pid]) m[pid] = Array(12).fill(0); if (mo >= 0 && mo < 12) m[pid][mo] += num(r.quantite_planifiee) } return m })
const postesEquip = computed(() => { if (postesRegime.value > 0) return postesRegime.value; const e = equipsGroupe.value[0] || {}; return num(e.postes, 3) })
const regimeLabel = computed(() => { if (reg4Regime.value) return '4×8 · 24/7'; const po = postesEquip.value; const base = po >= 3 ? '3×8' : (po === 2 ? '2×8' : '1×8'); return weRegime.value ? base + ' + WE' : base })
function joursOuvresMoisN(mo) { const d = new Date(annee.value, mo, 1); let n = 0; const facteurWE = reg4Regime.value ? 1 : (weRegime.value ? Math.min(1, 2 / (postesEquip.value || 3)) : 0); while (d.getMonth() === mo) { const wd = d.getDay(); if (wd === 0 || wd === 6) n += facteurWE; else n += 1; d.setDate(d.getDate() + 1) } return n }
const occupationParMois = computed(() => {
  const out = Array(12).fill(null)
  const auj = new Date(); const moisActuel = auj.getMonth(); const anneeActuelle = auj.getFullYear()
  const capaJour = postesEquip.value * 8 * nbMachines.value
  for (let mo = 0; mo < 12; mo++) {
    if (annee.value === anneeActuelle && mo < moisActuel) continue
    if (annee.value < anneeActuelle) continue
    let heures = 0
    for (const p of produits.value) {
      const cad = cadenceGroupe(p.id); if (cad <= 0) continue
      const planB = (planParProduitMois.value[p.id] || [])[mo] || 0
      if (planB <= 0) continue
      heures += heuresProduit(p.id, planB).total
    }
    const jm = joursOuvresMoisN(mo)
    const capaMois = jm * capaJour
    out[mo] = capaMois > 0 ? heures / capaMois : 0
  }
  return out
})
const moisSel = ref(null)
const detailMois = computed(() => {
  if (moisSel.value == null) return null
  const mo = moisSel.value
  const capaJour = postesEquip.value * 8 * nbMachines.value
  const jm = joursOuvresMoisN(mo)
  const capaMois = jm * capaJour
  const rows = []
  for (const p of produits.value) {
    const cad = cadenceGroupe(p.id); if (cad <= 0) continue
    const planB = (planParProduitMois.value[p.id] || [])[mo] || 0
    if (planB <= 0) continue
    const tl = num(p.taille_lot)
    const h = heuresProduit(p.id, planB)
    rows.push({ code: p.code_pf, desig: p.designation, plan: planB, lots: tl > 0 ? planB / tl : 0, tl, plk: poidsLot(p), cad, prod: h.prod, nett: h.nett, heures: h.total })
  }
  rows.sort((a, b) => b.heures - a.heures)
  const totalH = rows.reduce((a, r) => a + r.heures, 0)
  const totalProd = rows.reduce((a, r) => a + r.prod, 0)
  const totalNett = rows.reduce((a, r) => a + r.nett, 0)
  return { mo, label: MOIS[mo], rows, totalH, totalProd, totalNett, capaMois, jm, taux: capaMois > 0 ? totalH / capaMois : 0 }
})
const realiseParProduit = computed(() => {
  const m = {}
  for (const o of ofs.value) { const d = o.date_fin_fabrication ? new Date(o.date_fin_fabrication) : null; if (d && d.getFullYear() === annee.value) m[o.produit_id] = (m[o.produit_id] || 0) + num(o.boites_fabriquees) }
  return m
})
const produitProduitPoste = computed(() => { const m = {}; for (const s of postesGroupe.value) if (s.produit_id) m[s.produit_id] = (m[s.produit_id] || 0) + num(s.production_realisee); return m })

// Top 10 produits sur la ligne : produits ayant une cadence sur le groupe, triés par plan
const top5 = computed(() => {
  const rows = []
  for (const p of produits.value) {
    const cad = cadenceGroupe(p.id)
    if (cad <= 0) continue
    const planB = planParProduit.value[p.id] || 0
    const realB = realiseParProduit.value[p.id] || 0
    const posteB = produitProduitPoste.value[p.id] || 0
    rows.push({ code: p.code_pf, desig: p.designation, cad, plan: planB, real: realB, poste: posteB, taux: planB > 0 ? Math.min(999, realB / planB * 100) : null })
  }
  rows.sort((a, b) => (b.plan || b.poste) - (a.plan || a.poste))
  return rows.slice(0, 5)
})

// --- Occupation restante (quantité restante ÷ jours restants) ---
function joursOuvresRestants() {
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  const fin = new Date(annee.value, 11, 31)
  if (auj.getFullYear() > annee.value) return 0
  const po = postesEquip.value
  const facteurWE = reg4Regime.value ? 1 : (weRegime.value ? Math.min(1, 2 / (po || 3)) : 0)
  let d = new Date(Math.max(auj.getTime(), new Date(annee.value, 0, 1).getTime())); let n = 0
  while (d <= fin) { const wd = d.getDay(); if (wd === 0 || wd === 6) n += facteurWE; else n += 1; d = new Date(d.getTime() + 86400000) }
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
    heures += heuresProduit(p.id, reste).total
  }
  const chargeJ = (postesEquip.value * 8 * nbMachines.value) > 0 ? heures / (postesEquip.value * 8 * nbMachines.value) : 0
  const jrsRest = joursOuvresRestants()
  const capaRest = jrsRest * nbMachines.value
  return { boitesRestantes, chargeJ, jrsRest, taux: capaRest > 0 ? chargeJ / jrsRest : 0 }
})

function pct(v) { return (v * 100).toFixed(1) }
function clsTaux(t) { if (t > 1) return 'x'; if (t > 0.9) return 'r'; if (t >= 0.7) return 'a'; return 'g' }
function retour() { router.push({ path: '/capacite' }) }
function ouvrirProduit(code) { if (code) router.push({ path: '/referentiels', query: { produit: code } }) }
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
        <div class="ed-kpi"><div class="ed-kv">{{ Math.round(occupationRestante.jrsRest) }} j</div><div class="ed-kl">Jours ouvrés restants · <b class="ed-reg">{{ regimeLabel }}</b></div></div>
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
                <span class="ed-mv">{{ t > 0 ? t : '' }}</span>
                <div class="ed-bararea"><div class="ed-mbar" :style="{ height: Math.min(100, t) + '%' }"></div></div>
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

        <!-- Top 5 produits + évolution mois restants -->
        <section class="ed-card">
          <h2 class="ed-ct">🏆 Top 5 produits sur la ligne</h2>
          <p v-if="!top5.length" class="ed-muted">Aucun produit avec cadence/plan sur cet équipement.</p>
          <table v-else class="ed-tbl">
            <thead><tr><th>#</th><th>Produit</th><th class="r">Plan (bts)</th><th class="r">Réalisé</th><th class="r">Cadence</th><th class="r">Avanc.</th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in top5" :key="p.code">
                <td class="ed-rank">{{ i + 1 }}</td>
                <td><b class="ed-plien" @click="ouvrirProduit(p.code)" title="Vérifier la fiche produit (Référentiels)">{{ p.code }}</b><span class="ed-pdesig"> — {{ p.desig }}</span></td>
                <td class="r">{{ p.plan.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ p.real.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ p.cad.toLocaleString('fr-FR') }}</td>
                <td class="r"><span v-if="p.taux != null" class="ed-badge" :class="'t-' + clsTaux(p.taux / 100)">{{ p.taux.toFixed(0) }} %</span><span v-else>—</span></td>
              </tr>
            </tbody>
          </table>
          <div class="ed-sub">📈 Occupation prévisionnelle — mois restants</div>
          <div class="ed-mchart tall">
            <div v-for="(t, i) in occupationParMois" :key="i" class="ed-mcol" :class="{ 'ed-clic': t != null }" @click="t != null && (moisSel = i)" :title="MOIS[i] + ' : ' + (t == null ? 'écoulé' : (t * 100).toFixed(0) + ' % — cliquer pour le détail')">
              <span class="ed-mv" :class="t == null ? '' : 't-' + clsTaux(t)">{{ t == null ? '' : (t * 100).toFixed(0) }}</span>
              <div class="ed-bararea"><div class="ed-refl2"></div><div class="ed-mbar" :class="t == null ? 'gone' : 'b-' + clsTaux(t)" :style="{ height: t == null ? '2px' : Math.min(120, t * 100) + '%' }"></div></div>
              <span class="ed-mm">{{ MOIS[i].charAt(0) }}</span>
            </div>
          </div>
          <p class="ed-hint">Barres grises = mois écoulés. Trait = 100 %. <b>Clique une barre</b> pour voir les produits qui chargent ce mois.</p>
        </section>
      </div>

      <!-- Occupation restante détaillée -->
      <section class="ed-card">
        <h2 class="ed-ct">📅 Occupation prévisionnelle — reste de l'année</h2>
        <div class="ed-occ">
          <div class="ed-occ-b"><div class="ed-occ-v">{{ Math.round(occupationRestante.boitesRestantes).toLocaleString('fr-FR') }}</div><div class="ed-occ-l">Boîtes restantes à fabriquer</div></div>
          <div class="ed-occ-b"><div class="ed-occ-v">{{ occupationRestante.chargeJ.toFixed(1) }} j</div><div class="ed-occ-l">Charge restante (machine)</div></div>
          <div class="ed-occ-b"><div class="ed-occ-v">{{ Math.round(occupationRestante.jrsRest) }} j</div><div class="ed-occ-l">Jours ouvrés restants</div></div>
          <div class="ed-occ-b hi"><div class="ed-occ-v" :class="'t-' + clsTaux(occupationRestante.taux)">{{ pct(occupationRestante.taux) }} %</div><div class="ed-occ-l">Taux d'occupation prévisionnel</div></div>
        </div>
        <div class="ed-occ-bar"><div class="ed-occ-fill" :class="'t-' + clsTaux(occupationRestante.taux)" :style="{ width: Math.min(100, occupationRestante.taux * 100) + '%' }"></div></div>
        <p v-if="occupationRestante.taux > 1" class="ed-alert">⚠️ Charge restante supérieure à la capacité restante — cet équipement ne pourra pas absorber le reste du plan d'ici la fin de l'année au régime actuel.</p>
      </section>

      <div v-if="detailMois" class="ed-mov" @click="moisSel = null">
        <div class="ed-mod" @click.stop>
          <div class="ed-mod-h">
            <div><b>{{ detailMois.label }} {{ annee }}</b> · occupation <span :class="'t-' + clsTaux(detailMois.taux)">{{ (detailMois.taux * 100).toFixed(0) }} %</span></div>
            <button class="ed-mod-x" @click="moisSel = null">✕</button>
          </div>
          <p class="ed-mod-s"><b>{{ Math.round(detailMois.totalH) }} h</b> = {{ Math.round(detailMois.totalProd) }} h production + {{ Math.round(detailMois.totalNett) }} h nettoyage (VDLP/VDLT/réglage) · capacité {{ Math.round(detailMois.jm) }} j × {{ postesEquip * 8 }} h × {{ nbMachines }} machine(s) = {{ Math.round(detailMois.capaMois) }} h</p>
          <table v-if="detailMois.rows.length" class="ed-tbl">
            <thead><tr><th>Produit</th><th class="r">Plan (bts)</th><th class="r">Lots</th><th class="r">Taille lot (bts)</th><th class="r">Poids lot (kg)</th><th class="r">Cadence</th><th class="r">Prod (h)</th><th class="r">Nett (h)</th><th class="r">Total (h)</th><th class="r">Part</th></tr></thead>
            <tbody>
              <tr v-for="r in detailMois.rows" :key="r.code">
                <td><b class="ed-plien" @click="ouvrirProduit(r.code)" title="Vérifier la fiche produit (Référentiels)">{{ r.code }}</b><span class="ed-pdesig"> — {{ r.desig }}</span></td>
                <td class="r">{{ r.plan.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ r.lots.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
                <td class="r">{{ r.tl.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ r.plk.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
                <td class="r">{{ r.cad.toLocaleString('fr-FR') }}</td>
                <td class="r">{{ Math.round(r.prod) }}</td>
                <td class="r" :title="'VDLP × lots + VDLT + réglage'">{{ Math.round(r.nett) }}</td>
                <td class="r"><b>{{ Math.round(r.heures) }}</b></td>
                <td class="r">{{ detailMois.totalH > 0 ? (r.heures / detailMois.totalH * 100).toFixed(0) : 0 }} %</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="ed-muted">Aucun produit planifié ce mois.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ed { color: #1b2733; }
.ed-top { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
.ed-back { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 14px; font: inherit; font-weight: 600; font-size: 13px; color: #475569; cursor: pointer; }
.ed-back:hover { background: #e2e8f0; }
.ed-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.ed-title { margin: 1px 0 0; font-size: 19px; font-weight: 800; color: #1a2233; }
.ed-nm { font-size: 15px; color: #64748b; font-weight: 700; }
.ed-load { color: #94a3b8; }

.ed-kpis { display: flex; gap: 10px; margin-bottom: 10px; }
.ed-kpi { flex: 1; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; text-align: center; }
.ed-kv { font-size: 20px; font-weight: 800; color: #1e293b; line-height: 1.1; }
.ed-kl { font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 2px; }
.ed-reg { color: #0f766e; font-weight: 800; }

.ed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.ed-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; }
.ed-ct { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #1a2233; }
.ed-muted { color: #94a3b8; font-size: 11px; margin: 0 0 7px; line-height: 1.35; }
.ed-sub { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin: 9px 0 5px; }

.ed-trs3 { display: flex; align-items: stretch; gap: 6px; }
.ed-tb { flex: 1; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 6px 4px; text-align: center; }
.ed-tb.big { background: #f0fdfa; border-color: #99f6e4; }
.ed-tbv { font-size: 15px; font-weight: 800; color: #1e293b; }
.ed-tbl { font-size: 9px; color: #64748b; font-weight: 600; margin-top: 1px; }
.ed-op { align-self: center; font-size: 18px; font-weight: 800; color: #cbd5e1; }

.ed-mchart { display: flex; align-items: flex-end; gap: 3px; height: 66px; padding-top: 2px; border-bottom: 1px solid #e2e8f0; }
.ed-mcol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
.ed-mv { font-size: 8px; font-weight: 800; color: #475569; line-height: 1; height: 10px; }
.ed-bararea { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; position: relative; }
.ed-refl2 { position: absolute; left: 0; right: 0; top: 16.7%; border-top: 1px dashed #cbd5e1; }
.ed-mbar { width: 70%; min-height: 2px; background: #6366f1; border-radius: 3px 3px 0 0; }
.ed-mchart.tall { height: 84px; position: relative; padding-top: 2px; }
.ed-refline { position: absolute; left: 0; right: 0; top: calc(12px + (70px - 12px) * (1 - 100/120)); border-top: 1px dashed #cbd5e1; }
.ed-mbar.gone { background: #e2e8f0; }
.ed-mbar.b-g { background: #16a34a; } .ed-mbar.b-a { background: #f59e0b; } .ed-mbar.b-r { background: #ef4444; } .ed-mbar.b-x { background: #991b1b; }
.ed-hint { font-size: 9.5px; color: #94a3b8; margin: 5px 0 0; }
.ed-clic { cursor: pointer; }
.ed-clic:hover .ed-mbar { filter: brightness(1.1); outline: 2px solid rgba(99,102,241,.35); outline-offset: 1px; }
.ed-mov { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.ed-mod { background: #fff; border-radius: 14px; width: min(900px, 100%); max-height: 82vh; overflow: auto; box-shadow: 0 20px 50px rgba(0,0,0,.3); padding: 16px 18px; }
.ed-mod-h { display: flex; align-items: center; justify-content: space-between; font-size: 15px; color: #1a2233; margin-bottom: 4px; }
.ed-mod-x { background: none; border: 0; font-size: 18px; color: #94a3b8; cursor: pointer; }
.ed-mod-s { font-size: 11.5px; color: #64748b; margin: 0 0 10px; }
.ed-mm { font-size: 9px; color: #94a3b8; margin-top: 2px; }

.ed-arrets { display: flex; flex-direction: column; gap: 3px; }
.ed-arr { display: flex; align-items: center; gap: 7px; font-size: 10.5px; }
.ed-arr-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.ed-arr-lbl { flex: 0 0 84px; color: #475569; font-weight: 600; }
.ed-arr-bar { flex: 1; height: 8px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.ed-arr-fill { display: block; height: 100%; border-radius: 5px; }
.ed-arr-v { flex: 0 0 62px; text-align: right; font-weight: 700; color: #334155; font-size: 11px; }

.ed-tbl { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.ed-tbl th { text-align: left; font-size: 9px; color: #64748b; font-weight: 700; padding: 3px 6px; border-bottom: 1px solid #e2e8f0; }
.ed-tbl th.r, .ed-tbl td.r { text-align: right; }
.ed-tbl td { padding: 2px 6px; border-bottom: 1px solid #f1f5f9; }
.ed-rank { font-weight: 800; color: #6366f1; }
.ed-pdesig { color: #94a3b8; }
.ed-plien { color: #4338ca; cursor: pointer; }
.ed-plien:hover { text-decoration: underline; }
.ed-badge { font-weight: 800; font-size: 11px; border-radius: 5px; padding: 1px 7px; }

.ed-occ { display: flex; gap: 10px; margin-bottom: 8px; }
.ed-occ-b { flex: 1; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 12px; text-align: center; }
.ed-occ-b.hi { background: #f0fdfa; border-color: #99f6e4; }
.ed-occ-v { font-size: 17px; font-weight: 800; color: #1e293b; }
.ed-occ-l { font-size: 10px; color: #64748b; font-weight: 600; margin-top: 2px; }
.ed-occ-bar { height: 12px; background: #f1f5f9; border-radius: 7px; overflow: hidden; }
.ed-occ-fill { height: 100%; border-radius: 7px; }
.ed-alert { margin: 12px 0 0; font-size: 12.5px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 9px 12px; }

.t-g { color: #16a34a; } .t-a { color: #d97706; } .t-r { color: #dc2626; } .t-x { color: #991b1b; }
.ed-badge.t-g { background: #dcfce7; color: #15803d; } .ed-badge.t-a { background: #fef9c3; color: #a16207; } .ed-badge.t-r { background: #fee2e2; color: #b91c1c; } .ed-badge.t-x { background: #7f1d1d; color: #fff; }
.ed-mbar, .ed-occ-fill.t-x { }
.ed-occ-fill.t-g { background: #16a34a; } .ed-occ-fill.t-a { background: #f59e0b; } .ed-occ-fill.t-r { background: #ef4444; } .ed-occ-fill.t-x { background: #991b1b; }
@media (max-width: 860px) { .ed-grid { grid-template-columns: 1fr; } .ed-kpis, .ed-occ { flex-wrap: wrap; } .ed-kpi, .ed-occ-b { flex-basis: 46%; } }
</style>
