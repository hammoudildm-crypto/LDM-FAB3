<template>
  <div class="tb">
    <header class="tb-head">
      <div>
        <h1 class="tb-title">Tableau de bord</h1>
        <p class="tb-sub">Production par catégorie et par lot — boîtes & chiffre d'affaires</p>
      </div>
      <div class="tb-year">
        <label>Année</label>
        <select v-model.number="annee">
          <option v-for="a in annees" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
    </header>

    <!-- Onglets Fabrication / Conditionnement -->
    <div class="tb-tabs">
      <button type="button" :class="{ on: onglet === 'fab' }" class="tb-tab fab" @click="onglet = 'fab'">Fabrication</button>
      <button type="button" :class="{ on: onglet === 'cond' }" class="tb-tab cond" @click="onglet = 'cond'">Conditionnement</button>
    </div>

    <!-- Synthèse -->
    <div class="tb-kpis">
      <div class="tb-kpi"><span class="k-lbl">Plan (boîtes)</span><span class="k-val">{{ totPlan ? fmt(totPlan) : '—' }}</span></div>
      <div class="tb-kpi"><span class="k-lbl">{{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }}</span><span class="k-val">{{ fmt(totBoites) }}</span></div>
      <div class="tb-kpi"><span class="k-lbl">Taux</span><span class="k-val" :class="tauxGlobal != null && tauxGlobal < 100 ? 'v-bas' : ''">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</span></div>
      <div class="tb-kpi"><span class="k-lbl">Chiffre d'affaires</span><span class="k-val">{{ fmtCA(totCA) }}</span></div>
    </div>

    <div class="tb-mois-lbl">Mois en cours — {{ nomMois }} {{ annee }}</div>
    <div class="tb-kpis">
      <div class="tb-kpi tb-kpi-m"><span class="k-lbl">Plan (boîtes)</span><span class="k-val">{{ totPlanMois ? fmt(totPlanMois) : '—' }}</span></div>
      <div class="tb-kpi tb-kpi-m"><span class="k-lbl">{{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }}</span><span class="k-val">{{ fmt(totBoitesMois) }}</span></div>
      <div class="tb-kpi tb-kpi-m"><span class="k-lbl">Taux</span><span class="k-val" :class="tauxGlobalMois != null && tauxGlobalMois < 100 ? 'v-bas' : ''">{{ tauxGlobalMois != null ? tauxGlobalMois + '%' : '—' }}</span></div>
      <div class="tb-kpi tb-kpi-m"><span class="k-lbl">Chiffre d'affaires</span><span class="k-val">{{ fmtCA(totCAMois) }}</span></div>
    </div>

    <!-- Regroupement -->
    <div class="tb-grp">
      <span class="grp-lbl">Regrouper par :</span>
      <button v-for="g in groupesVisibles" :key="g.k" type="button" :class="{ on: grp === g.k }" @click="grp = g.k">{{ g.lbl }}</button>
    </div>

    <!-- Tableau -->
    <div class="tb-card">
      <div v-if="chargement" class="tb-empty">Chargement…</div>
      <div v-else-if="!donnees.length" class="tb-empty">Aucune donnée de {{ onglet === 'fab' ? 'fabrication' : 'conditionnement' }} pour {{ annee }}.</div>
      <table v-else class="tb-table">
        <thead>
          <tr>
            <th>{{ libGroupe }}</th>
            <th class="num">Plan</th>
            <th class="num">{{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }}</th>
            <th class="num">Taux</th>
            <th class="num">Lots</th>
            <th class="num">Chiffre d'affaires</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in donnees" :key="r.cle">
            <td class="g-nom">{{ r.cle }}</td>
            <td class="num">{{ r.plan ? fmt(r.plan) : '—' }}</td>
            <td class="num">{{ fmt(r.boites) }}</td>
            <td class="num"><span v-if="r.taux != null" class="taux" :class="r.taux >= 100 ? 'ok' : 'bas'">{{ r.taux }}%</span><span v-else class="muted">—</span></td>
            <td class="num">{{ fmt(r.lots) }}</td>
            <td class="num ca">{{ fmtCA(r.ca) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="tot">
            <td>Total {{ annee }}</td>
            <td class="num">{{ totPlan ? fmt(totPlan) : '—' }}</td>
            <td class="num">{{ fmt(totBoites) }}</td>
            <td class="num">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</td>
            <td class="num">{{ fmt(totLots) }}</td>
            <td class="num ca">{{ fmtCA(totCA) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const num = (v) => Number(v) || 0
const fmt = (v) => Math.round(num(v)).toLocaleString('fr-FR')
const fmtCA = (v) => v > 0 ? Math.round(num(v)).toLocaleString('fr-FR') + ' DA' : '—'

async function fetchAllPaged(make) {
  const out = []; let from = 0; const size = 1000
  while (true) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return out
}

const CANON_FAB = ['Pesée', 'Granulation', 'Mélange', 'Compression', 'Pelliculage']
function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/gran|s[ée]ch/.test(t)) return 'granulation'
  if (/pes/.test(t)) return 'pesee'
  if (/m[ée]lang/.test(t)) return 'melange'
  if (/compress/.test(t)) return 'compression'
  if (/rempliss|g[ée]lul/.test(t)) return 'remplissage'
  if (/pellicul|enrob/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}
const PHASE_LBL = { pesee: 'Pesée', granulation: 'Granulation / Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage gélules', pelliculage: 'Pelliculage' }
const FAB_PH = new Set(['pesee', 'granulation', 'melange', 'compression', 'remplissage', 'pelliculage'])
const estFabType = (type) => FAB_PH.has(phaseKey(type))
const onglet = ref('fab')       // fab | cond
const grp = ref('lab')          // lab | forme | produit | lot
const annee = ref(new Date().getFullYear())
const chargement = ref(true)
const groupes = [
  { k: 'lab', lbl: 'Laboratoire' }, { k: 'forme', lbl: 'Forme' },
  { k: 'produit', lbl: 'Produit' }, { k: 'equip', lbl: 'Équipement' }, { k: 'phase', lbl: 'Phase' }
]
const groupesVisibles = computed(() => groupes.filter(g => g.k !== 'phase' || onglet.value === 'fab'))
const LIB = { lab: 'Laboratoire', forme: 'Forme galénique', produit: 'Produit', equip: 'Équipement' }
const libGroupe = computed(() => LIB[grp.value])
const phasesByOf = computed(() => {
  const m = {}
  for (const sp of suiviRaw.value) {
    if (sp.statut !== 'Terminé') continue
    const k = phaseKey(sp.phase); if (!k || k === 'conditionnement') continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = new Set()
    m[sp.ordre_id].add(k)
  }
  return m
})
// Équipements de FABRICATION par OF (via les phases saisies, hors conditionnement)
const equipsByOf = computed(() => {
  const m = {}
  for (const sp of suiviRaw.value) {
    if (sp.statut !== 'Terminé') continue
    const k = phaseKey(sp.phase); if (!k || k === 'conditionnement') continue
    const nom = sp.equipements ? sp.equipements.nom : null
    if (!nom) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = new Set()
    m[sp.ordre_id].add(nom)
  }
  return m
})
watch(onglet, () => { if (onglet.value === 'cond' && grp.value === 'phase') grp.value = 'equip' })

const fabRaw = ref([]); const condRaw = ref([]); const planRaw = ref([]); const suiviRaw = ref([])
onMounted(async () => {
  try {
    const [rf, rc, rp, rs] = await Promise.all([
      fetchAllPaged(() => supabase.from('ordres_fabrication')
        .select('id, numero_lot, boites_fabriquees, date_fin_fabrication, equipements(nom), produits(gamme, code_pf, designation, pcsu, taille_lot, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('conditionnement')
        .select('quantite_conditionnee, date_conditionnement, equipements(nom, type), ordres_fabrication(numero_lot, date_fin_fabrication, produits(code_pf, designation, pcsu, taille_lot, unites_par_boite, donneurs_ordre(nom)))')),
      fetchAllPaged(() => supabase.from('plan_production')
        .select('annee, mois, quantite_planifiee, equipements(nom, type), produits(gamme, code_pf, designation, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, equipements(nom)'))
    ])
    fabRaw.value = rf; condRaw.value = rc; planRaw.value = rp; suiviRaw.value = rs
  } catch (e) { console.error(e) } finally { chargement.value = false }
})

const anYear = (d) => d ? new Date(d).getFullYear() : null

const fabData = computed(() => {
  const arr = fabRaw.value
    .filter(o => o.date_fin_fabrication && anYear(o.date_fin_fabrication) === annee.value)
    .map(o => ({ id: o.id, lot: o.numero_lot, equip: o.equipements ? o.equipements.nom : null, boites: o.boites_fabriquees, produit: o.produits }))
  // Produits « direct conditionnement » (sans fabrication) : conditionné compté comme fabriqué
  for (const c of condRaw.value) {
    const of = c.ordres_fabrication
    if (!of || of.date_fin_fabrication) continue
    if (!c.date_conditionnement || anYear(c.date_conditionnement) !== annee.value) continue
    const p = of.produits; const upb = p ? num(p.unites_par_boite) : 0
    arr.push({ id: null, lot: of.numero_lot, equip: c.equipements ? c.equipements.nom : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p })
  }
  return arr
})

const condData = computed(() => condRaw.value
  .filter(c => c.date_conditionnement && anYear(c.date_conditionnement) === annee.value)
  .map(c => {
    const of = c.ordres_fabrication; const p = of ? of.produits : null
    const upb = p ? num(p.unites_par_boite) : 0
    return { lot: of ? of.numero_lot : null, equip: c.equipements ? c.equipements.nom : null, equipType: c.equipements ? c.equipements.type : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p }
  }))

const annees = computed(() => {
  const s = new Set()
  fabRaw.value.forEach(o => { const y = anYear(o.date_fin_fabrication); if (y) s.add(y) })
  condRaw.value.forEach(c => { const y = anYear(c.date_conditionnement); if (y) s.add(y) })
  s.add(new Date().getFullYear())
  return [...s].sort((a, b) => b - a)
})

function formeDe(desig) {
  const d = (desig || '').toLowerCase()
  if (/g[ée]lule|caps/.test(d)) return 'Gélule'
  if (/comprim|\bcp\b|\bc\.?p\.?\b|pellicul|dispers|effervesc|\bcpr?\b/.test(d)) return 'Comprimé'
  if (/sachet|poudre|granul/.test(d)) return 'Sachet / Poudre'
  if (/sirop|solut|susp|goutte|\bml\b|\bfl\b/.test(d)) return 'Liquide'
  if (/pommade|cr[èe]me|\bgel\b|topique|onguent/.test(d)) return 'Topique'
  if (/suppos|ovule/.test(d)) return 'Suppositoire / Ovule'
  return 'Autre'
}
function cleProduit(p) {
  if (!p) return null
  if (grp.value === 'lab') return (p.donneurs_ordre && p.donneurs_ordre.nom) || 'Non attribué'
  if (grp.value === 'forme') return formeDe(p.designation)
  if (grp.value === 'produit') return (p.code_pf || '?') + ' — ' + (p.designation || '')
  return null
}
function cleGroupe(r) { return grp.value === 'equip' ? (r.equip || 'Non attribué') : (cleProduit(r.produit) || 'Non attribué') }
const planParGroupe = computed(() => {
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    if (parPhase) {
      const p = r.produits; if (!p) continue
      const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : []
      const seen = new Set()
      for (const phn of gamme) { const k = phaseKey(phn); if (!k || k === 'conditionnement' || seen.has(k)) continue; seen.add(k)
        const cle = PHASE_LBL[k] || k
        acc[cle] = (acc[cle] || 0) + num(r.quantite_planifiee)
      }
    } else {
      const cle = grp.value === 'equip' ? (r.equipements ? r.equipements.nom : null) : cleProduit(r.produits)
      if (cle == null) continue
      if (onglet.value === 'cond' && grp.value === 'equip' && r.equipements && estFabType(r.equipements.type)) continue
      acc[cle] = (acc[cle] || 0) + num(r.quantite_planifiee)
    }
  }
  return acc
})

const donnees = computed(() => {
  const src = onglet.value === 'fab' ? fabData.value : condData.value
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  const parEquipFab = onglet.value === 'fab' && grp.value === 'equip'
  const add = (cle, b, t, pc) => { if (!acc[cle]) acc[cle] = { cle, boites: 0, lots: 0, ca: 0 }; acc[cle].boites += b; acc[cle].lots += t > 0 ? b / t : 0; acc[cle].ca += b * pc }
  for (const r of src) {
    if (!r.produit || !(num(r.boites) > 0)) continue
    const b = num(r.boites), t = num(r.produit.taille_lot), pc = num(r.produit.pcsu)
    if (parPhase) {
      const phs = phasesByOf.value[r.id]; if (!phs) continue
      for (const k of phs) add(PHASE_LBL[k] || k, b, t, pc)
    } else if (parEquipFab) {
      const eqs = equipsByOf.value[r.id]
      if (!eqs || !eqs.size) { add('Non attribué (fab)', b, t, pc); continue }
      for (const nom of eqs) add(nom, b, t, pc)
    } else {
      if (onglet.value === 'cond' && grp.value === 'equip' && estFabType(r.equipType)) continue
      add(cleGroupe(r), b, t, pc)
    }
  }
  const pg = planParGroupe.value
  return Object.values(acc).map(g => {
    const plan = pg[g.cle] || 0
    return { ...g, lots: Math.round(g.lots), plan, taux: plan > 0 ? Math.round(g.boites / plan * 100) : null }
  }).sort((a, b) => b.boites - a.boites)
})

const totBoites = computed(() => donnees.value.reduce((s, g) => s + g.boites, 0))
const totLots = computed(() => donnees.value.reduce((s, g) => s + g.lots, 0))
const totCA = computed(() => donnees.value.reduce((s, g) => s + g.ca, 0))
const maxBoites = computed(() => Math.max(1, ...donnees.value.map(g => g.boites)))
const totPlan = computed(() => donnees.value.reduce((s, g) => s + g.plan, 0))
const tauxGlobal = computed(() => totPlan.value > 0 ? Math.round(totBoites.value / totPlan.value * 100) : null)
// --- Mois en cours ---
const moisCourant = new Date().getMonth() + 1
const anMonth = (d) => d ? new Date(d).getMonth() + 1 : null
const nomMois = computed(() => new Date(annee.value, moisCourant - 1, 1).toLocaleDateString('fr-FR', { month: 'long' }))
const fabDataMois = computed(() => {
  const arr = fabRaw.value.filter(o => o.date_fin_fabrication && anYear(o.date_fin_fabrication) === annee.value && anMonth(o.date_fin_fabrication) === moisCourant).map(o => ({ boites: o.boites_fabriquees, produit: o.produits }))
  for (const c of condRaw.value) {
    const of = c.ordres_fabrication
    if (!of || of.date_fin_fabrication) continue
    if (!c.date_conditionnement || anYear(c.date_conditionnement) !== annee.value || anMonth(c.date_conditionnement) !== moisCourant) continue
    const p = of.produits; const upb = p ? num(p.unites_par_boite) : 0
    arr.push({ boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p })
  }
  return arr
})
const condDataMois = computed(() => condRaw.value.filter(c => c.date_conditionnement && anYear(c.date_conditionnement) === annee.value && anMonth(c.date_conditionnement) === moisCourant).map(c => { const of = c.ordres_fabrication; const pp = of ? of.produits : null; const upb = pp ? num(pp.unites_par_boite) : 0; return { boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: pp } }))
const srcMois = computed(() => onglet.value === 'fab' ? fabDataMois.value : condDataMois.value)
const totBoitesMois = computed(() => srcMois.value.reduce((s, r) => s + num(r.boites), 0))
const totCAMois = computed(() => srcMois.value.reduce((s, r) => s + num(r.boites) * (r.produit ? num(r.produit.pcsu) : 0), 0))
const totPlanMois = computed(() => { let tot = 0; for (const r of planRaw.value) { if (Number(r.annee) === annee.value && Number(r.mois) === moisCourant) tot += num(r.quantite_planifiee) } return tot })
const tauxGlobalMois = computed(() => totPlanMois.value > 0 ? Math.round(totBoitesMois.value / totPlanMois.value * 100) : null)
</script>

<style scoped>
.tb { padding: 26px 34px 50px; max-width: 1180px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
.tb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.tb-title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
.tb-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
.tb-year { display: flex; align-items: center; gap: 8px; }
.tb-year label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.tb-year select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; }

.tb-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.tb-tab { flex: 1; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; padding: 13px; cursor: pointer; color: #64748b; transition: all .18s ease; }
.tb-tab.fab.on { background: #14b8a6; border-color: #14b8a6; color: #fff; box-shadow: 0 8px 20px rgba(20,184,166,.28); }
.tb-tab.cond.on { background: #0ea5e9; border-color: #0ea5e9; color: #fff; box-shadow: 0 8px 20px rgba(14,165,233,.28); }

.tb-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.tb-kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 14px rgba(30,41,59,.05); }
.k-lbl { font-size: 12px; font-weight: 700; color: #64748b; }
.k-val { font-size: 22px; font-weight: 800; color: #0f172a; }
.tb-mois-lbl { font-size: 12px; font-weight: 800; color: #0f766e; margin: 4px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.tb-kpi-m { border-left: 3px solid #14b8a6; }

.tb-grp { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.grp-lbl { font-size: 12px; font-weight: 700; color: #64748b; margin-right: 4px; }
.tb-grp button { background: #fff; border: 1px solid #cbd5e1; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 15px; cursor: pointer; color: #475569; }
.tb-grp button.on { background: #0f172a; border-color: #0f172a; color: #fff; }

.tb-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 6px 6px; box-shadow: 0 8px 22px rgba(30,41,59,.06); overflow: hidden; }
.tb-empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 14px; }
.tb-table { width: 100%; border-collapse: collapse; }
.tb-table thead th { text-align: left; font-size: 11.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #64748b; padding: 12px 16px; border-bottom: 2px solid #f1f5f9; }
.tb-table thead th.num { text-align: right; }
.tb-table tbody td { padding: 11px 16px; font-size: 13.5px; border-bottom: 1px solid #f5f7fa; }
.tb-table tbody tr:hover td { background: #f8fafc; }
.g-nom { font-weight: 600; color: #1e293b; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.ca { font-weight: 700; color: #0f766e; }
.taux { font-weight: 800; }
.taux.ok { color: #15803d; }
.taux.bas { color: #dc2626; }
.muted { color: #cbd5e1; }
.k-val.v-bas { color: #dc2626; }
.w-bar { width: 150px; }
.bar { display: block; height: 8px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
.bar-in { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
.tb-table tfoot .tot td { font-weight: 800; padding: 13px 16px; border-top: 2px solid #e2e8f0; background: #f8fafc; }

@media (max-width: 820px) {
  .tb { padding: 18px; } .tb-kpis { grid-template-columns: repeat(2, 1fr); }
  .w-bar { display: none; }
}
/* Compact */
.tb { padding: 12px 20px 20px; }
.tb-head { margin-bottom: 10px; }
.tb-title { font-size: 18px; }
.tb-sub { font-size: 11px; margin-top: 2px; }
.tb-year select { padding: 6px 10px; font-size: 13px; }
.tb-tabs { gap: 6px; margin-bottom: 10px; }
.tb-tab { font-size: 13px; padding: 9px; }
.tb-kpis { gap: 10px; margin-bottom: 12px; }
.tb-kpi { padding: 10px 14px; }
.tb-kpi .k-val, .tb-kpi b, .tb-kpi strong { font-size: 19px; }
.tb-grp { margin-bottom: 10px; }
.tb-grp button { font-size: 11.5px; padding: 5px 12px; }
.tb-table thead th { padding: 7px 12px; font-size: 10.5px; }
.tb-table tbody td { padding: 6px 12px; font-size: 12px; }
.tb-table tfoot .tot td { padding: 7px 12px; }
.tb-empty { padding: 26px; font-size: 13px; }
/* Ultra compact */
.tb { padding: 8px 14px 14px; }
.tb-title { font-size: 15px; }
.tb-sub { display: none; }
.tb-head { margin-bottom: 6px; }
.tb-year select { padding: 5px 8px; font-size: 12px; }
.tb-tabs { gap: 6px; margin-bottom: 8px; }
.tb-tab { font-size: 12px; padding: 7px; border-radius: 9px; }
.tb-kpis { gap: 8px; margin-bottom: 8px; }
.tb-kpi { padding: 7px 11px; border-radius: 11px; gap: 2px; }
.tb-kpi .k-val { font-size: 16px; }
.tb-kpi .k-lbl { font-size: 9.5px; }
.tb-grp { margin-bottom: 7px; }
.tb-grp button { font-size: 10.5px; padding: 4px 10px; }
.tb-table thead th { padding: 5px 10px; font-size: 10px; }
.tb-table tbody td { padding: 4px 10px; font-size: 11px; }
.tb-table tfoot .tot td { padding: 5px 10px; }
.tb-empty { padding: 18px; font-size: 12px; }
</style>
