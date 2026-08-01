<template>
  <div class="cap">
    <div class="cap-head">
      <div>
        <div class="ch-eyebrow">Charge & capacité</div>
        <h1 class="ch-title">Suivi de capacité des équipements</h1>
        <p class="ch-sub">Occupation par équipement, selon la gamme des produits du plan directeur et les cadences.</p>
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
      <h2 class="card-title">Occupation annuelle par équipement · {{ joursAnnee }} jours ouvrés</h2>
      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              <th>Équipement</th><th>Phase</th><th class="ta-c">Unité</th><th class="ta-c">Machines</th><th class="ta-c">h/j effectif</th>
              <th class="ta-r">Charge globale (j)</th><th class="ta-r">Charge / machine (j)</th><th class="ta-r">Capacité (j)</th><th class="taux-h">Taux d'occupation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in lignes" :key="r.id" :class="{ vide: r.chargeJ === 0 }">
              <td><strong>{{ r.nom }}</strong></td>
              <td><span class="phase-tag">{{ r.phaseLabel || PHASE_NOM[r.phase] || r.phase }}</span></td>
              <td class="ta-c unite">{{ r.estCond ? 'boîtes/h' : 'kg/h' }}</td>
              <td class="ta-c">{{ r.machines }}</td>
              <td class="ta-c hj">{{ r.hj.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r glob">{{ r.chargeGlobaleJ.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
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
      <p class="note">Fabrication : charge = kg ÷ cadence (kg/h), kg = boîtes × poids du lot ÷ taille de lot. Conditionnement : charge = boîtes ÷ cadence (boîtes/h). Un produit ne charge une phase que si elle figure dans sa gamme (le conditionnement s'ajoute toujours). <strong>Charge globale</strong> = charge totale de la phase (tous produits) ; <strong>Charge / machine</strong> = charge globale ÷ nombre de machines identiques — c'est elle qui donne le taux. <template v-if="inclureNett">+ nettoyage (VDLP/lot) + nettoyage général & réglage (VDLT + REGLAGE / campagne).</template></p>
    </section>

    <section v-if="!chargement && lignes.some(r => r.chargeJ > 0)" class="card">
      <h2 class="card-title">Taux d'occupation mensuel</h2>
      <div class="tbl-wrap">
        <table class="grid matrice">
          <thead><tr><th class="sticky-c">Équipement</th><th v-for="(m, i) in MOIS" :key="i" class="ta-c">{{ m }}</th></tr></thead>
          <tbody>
            <tr v-for="r in lignes" :key="r.id" v-show="r.chargeJ > 0">
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
      <div class="kpi-mini"><div class="km-val">{{ nbGoulots }}</div><div class="km-lbl">Équipements &gt; 90 %</div></div>
      <div class="kpi-mini"><div class="km-val">{{ nbSurcharge }}</div><div class="km-lbl">En surcharge</div></div>
      <div class="kpi-mini"><div class="km-val">{{ joursAnnee }}</div><div class="km-lbl">Jours ouvrés {{ annee }}</div></div>
    </section>

    <section v-if="!chargement && produitsSansCadence.length" class="card avert">
      <h2 class="card-title">Produits planifiés sans cadence</h2>
      <p class="note">Plan {{ annee }} mais aucune cadence — non comptés. À renseigner dans <strong>Cadences</strong>.</p>
      <div class="chips"><span v-for="(p, i) in produitsSansCadence.slice(0, 30)" :key="i" class="chip">{{ p }}</span><span v-if="produitsSansCadence.length > 30" class="chip more">+{{ produitsSansCadence.length - 30 }}</span></div>
    </section>

    <section v-if="!chargement && produitsSansPoids.length" class="card avert">
      <h2 class="card-title">Produits de fabrication sans poids de lot</h2>
      <p class="note">Ces produits ont une phase de fabrication planifiée (cadence en kg/h) mais aucun <strong>poids de lot (kg)</strong> — leur charge de fabrication n'est pas comptée. Exécute le SQL <em>poids_lot_kg</em> ou renseigne le poids.</p>
      <div class="chips"><span v-for="(p, i) in produitsSansPoids.slice(0, 30)" :key="i" class="chip">{{ p }}</span><span v-if="produitsSansPoids.length > 30" class="chip more">+{{ produitsSansPoids.length - 30 }}</span></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k

const produits = ref([]), equipements = ref([]), cadences = ref([]), plans = ref([])
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
  produits.value = await fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, unites_par_boite, taille_lot, poids_lot_kg, gamme').eq('actif', true))
  equipements.value = await fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true))
  cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale'))
  plans.value = await fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, produit_id'))
  chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/s[ée]ch/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
function phaseKeyFromName(name) {
  const t = String(name || '').toLowerCase().trim()
  if (NOM_KEY[t]) return NOM_KEY[t]
  if (/pes/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/s[ée]ch/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|capsul/.test(t)) return 'remplissage'
  if (/compress|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}
// Ordre de la gamme de fabrication (pour trier les ateliers)
const ORDRE_GAMME = { pesee: 1, granulation: 2, sechage: 3, melange: 4, compression: 5, remplissage: 6, pelliculage: 7, conditionnement: 8 }
function num(v, def) { const n = Number(v); return (v === null || v === undefined || isNaN(n)) ? def : n }
function libelle(e) { const c = e.code ? String(e.code) : '', n = e.nom ? String(e.nom) : ''; return { code: c || n, nom: c && n ? n : '' } }

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) { const v = Number(c.cadence_nominale || 0); if (v > 0) m[c.equipement_id + '|' + c.produit_id] = v } return m })
const equipAvecCadence = computed(() => { const s = new Set(); for (const c of cadences.value) if (Number(c.cadence_nominale) > 0) s.add(c.equipement_id); return s })
const gammeKeys = computed(() => { const m = {}; for (const p of produits.value) { const set = new Set(); const g = Array.isArray(p.gamme) ? p.gamme : []; for (const n of g) { const k = phaseKeyFromName(n); if (k) set.add(k) } m[p.id] = set } return m })

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

function joursOuvresMois(an, moisIdx) { const d = new Date(an, moisIdx, 1); let n = 0; while (d.getMonth() === moisIdx) { const wd = d.getDay(); if (avecWE.value || (wd !== 0 && wd !== 6)) n++; d.setDate(d.getDate() + 1) } return n }
const joursParMois = computed(() => MOIS.map((_, i) => joursOuvresMois(annee.value, i)))
const joursAnnee = computed(() => joursParMois.value.reduce((s, n) => s + n, 0))

// Nom d'unité : retire le préfixe d'opération (ex "Granulation COMASA" / "Séchage COMASA" -> "COMASA")
// puis un indice d'unité en fin (<= 20), sans toucher aux numéros de modèle (FE55, TR100, 520...).
const PREFIXE_OP = /^(granulation|s[ée]chage|s[ée]choir|m[ée]lange|pes[ée]e|compression|remplissage|encapsulation|pelliculage|enrobage|conditionnement)\s+/i
function baseNom(nom) {
  const n = String(nom || '').trim().replace(PREFIXE_OP, '')
  return n.replace(/\s+(\d{1,2})\s*$/, (m, d) => (Number(d) <= 20 ? '' : m)).trim()
}
// Regroupe par unité physique : même nom de base (toutes opérations confondues) -> une seule ligne.
// Une unité multi-opérations (COMASA = granulation + séchage) cumule le temps de ses opérations.
const groupesEquip = computed(() => {
  const eqs = equipements.value.filter(e => equipAvecCadence.value.has(e.id) && phaseDeType(e.type))
  const g = {}
  for (const e of eqs) {
    const nom = (e.nom || e.code || '—').trim()
    const base = baseNom(nom) || nom
    const key = base.toLowerCase()
    if (!g[key]) g[key] = { key, nom: base, equips: [] }
    g[key].equips.push(e)
  }
  return Object.values(g)
})

const lignes = computed(() => {
  const out = []
  for (const grp of groupesEquip.value) {
    // équipements de l'unité regroupés par opération (phase)
    const parPhase = {}
    for (const e of grp.equips) {
      const ph = phaseDeType(e.type)
      if (!parPhase[ph]) parPhase[ph] = { equips: [], machines: 0 }
      parPhase[ph].equips.push(e)
      parPhase[ph].machines += Math.max(1, num(e.nb_machines, 1))
    }
    const phases = Object.keys(parPhase).sort((a, b) => (ORDRE_GAMME[a] || 99) - (ORDRE_GAMME[b] || 99))
    const machines = Math.max(1, ...phases.map(ph => parPhase[ph].machines))   // nb d'unités physiques
    const rep = grp.equips[0]
    const postes = regime.value === 'auto' ? num(rep.postes, 3) : Number(regime.value)
    const tep = num(rep.tep, 8)
    const vdlp = num(rep.vdlp, 0), vdlt = num(rep.vdlt, 0), reglage = num(rep.reglage, 0)
    const capaJour = postes * tep * machines
    const cadPhase = (ph, pid) => { let c = 0; for (const e of parPhase[ph].equips) { const v = cadMap.value[e.id + '|' + pid]; if (v > 0 && v > c) c = v } return c }
    const tauxMois = []; let chargeJTot = 0
    for (let mi = 0; mi < 12; mi++) {
      let occH = 0
      for (const [pid, tab] of Object.entries(planAgg.value)) {
        const boites = tab[mi]; if (!boites) continue
        const gk = gammeKeys.value[pid]
        const p = prodById.value[pid] || {}
        const tl = num(p.taille_lot, 0), plk = num(p.poids_lot_kg, 0)
        let utilise = false
        for (const ph of phases) {   // cumule le temps de chaque opération de l'unité
          const estCond = ph === 'conditionnement'
          const inGamme = estCond || !gk || gk.size === 0 || gk.has(ph) || (ph === 'sechage' && gk.has('granulation'))
          if (!inGamme) continue
          const cad = cadPhase(ph, pid); if (!(cad > 0)) continue
          let qty
          if (estCond) qty = boites
          else { if (!(tl > 0 && plk > 0)) continue; qty = boites * plk / tl }
          occH += qty / cad
          utilise = true
        }
        if (inclureNett.value && utilise) {
          const nbLots = tl > 0 ? Math.ceil(boites / tl) : 1
          occH += nbLots * vdlp + vdlt + reglage
        }
      }
      const chargeJ = capaJour > 0 ? occH / capaJour : 0
      chargeJTot += chargeJ
      tauxMois.push(joursParMois.value[mi] > 0 ? chargeJ / joursParMois.value[mi] : 0)
    }
    let phaseLabel = phases.map(ph => PHASE_NOM[ph] || ph).join(' / ')
    let nomAffiche = grp.nom
    if (phases.includes('granulation') && phases.includes('sechage')) { phaseLabel = 'Granulation et Séchage'; nomAffiche = 'Granulation et Séchage ' + grp.nom }
    out.push({ id: grp.key, nom: nomAffiche, phase: phases[0], phaseLabel, estCond: phases.includes('conditionnement'), machines, hj: postes * tep, chargeGlobaleJ: chargeJTot * machines, chargeJ: chargeJTot, capaciteJ: joursAnnee.value, taux: joursAnnee.value > 0 ? chargeJTot / joursAnnee.value : 0, tauxMois })
  }
  return out.sort((a, b) => (ORDRE_GAMME[a.phase] || 99) - (ORDRE_GAMME[b.phase] || 99) || b.taux - a.taux)
})

const occGlobal = computed(() => { const w = lignes.value.filter(r => r.chargeJ > 0); return w.length ? w.reduce((s, r) => s + r.taux, 0) / w.length : 0 })
const nbGoulots = computed(() => lignes.value.filter(r => r.taux > 0.9).length)
const nbSurcharge = computed(() => lignes.value.filter(r => r.taux > 1).length)

const produitsSansCadence = computed(() => {
  const s = new Set()
  for (const pid of Object.keys(planAgg.value)) {
    if (!planAgg.value[pid].some(v => v > 0)) continue
    if (!equipements.value.some(e => cadMap.value[e.id + '|' + pid] > 0)) { const p = prodById.value[pid]; if (p) s.add((p.code_pf || '') + ' · ' + (p.designation || '')) }
  }
  return [...s].sort()
})
const produitsSansPoids = computed(() => {
  const s = new Set()
  for (const pid of Object.keys(planAgg.value)) {
    if (!planAgg.value[pid].some(v => v > 0)) continue
    const p = prodById.value[pid]; if (!p) continue
    let besoin = false
    for (const e of equipements.value) { const ph = phaseDeType(e.type); if (ph && ph !== 'conditionnement' && cadMap.value[e.id + '|' + pid] > 0) { besoin = true; break } }
    if (besoin && !(num(p.poids_lot_kg, 0) > 0)) s.add((p.code_pf || '') + ' · ' + (p.designation || ''))
  }
  return [...s].sort()
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
.glob { color: #94a3b8; }
.unite { color: #64748b; font-size: 12px; }
.desig { color: #94a3b8; font-size: 12px; }
.phase-tag { font-size: 11px; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 5px; padding: 1px 7px; font-weight: 600; }

.taux-h { width: 260px; }
.taux-cell { display: flex; align-items: center; gap: 10px; }
.bar-wrap { flex: 1; height: 12px; background: #f1f5f9; border-radius: 7px; overflow: hidden; min-width: 100px; }
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
