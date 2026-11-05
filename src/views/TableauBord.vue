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

    <!-- Décisions & KPIs transverses de suivi d'activité -->
    <section class="pilot">
      <div v-if="alertes.length" class="decisions">
        <div class="dec-h">⚠ Points d'attention — aide à la décision</div>
        <div class="dec-list">
          <div v-for="(al, i) in alertes" :key="'a' + i" class="dec-item" :class="al.lvl">
            <span class="dec-t">{{ al.t }}</span><span class="dec-d">{{ al.d }}</span>
          </div>
        </div>
      </div>
      <div class="trans-grid">
        <div class="trans-card">
          <div class="trans-dom q">Qualité</div>
          <div class="trans-kpis">
            <div class="tk"><span class="tk-v" :class="devOuvertes ? 'warn' : 'ok'">{{ devOuvertes }}</span><span class="tk-l">Déviations ouvertes</span></div>
            <div class="tk"><span class="tk-v" :class="devCritiques ? 'bad' : 'ok'">{{ devCritiques }}</span><span class="tk-l">dont critiques</span></div>
            <div class="tk"><span class="tk-v" :class="capaRetard ? 'bad' : 'ok'">{{ capaRetard }}</span><span class="tk-l">CAPA en retard</span></div>
          </div>
        </div>
        <div class="trans-card">
          <div class="trans-dom e">Équipements</div>
          <div class="trans-kpis">
            <div class="tk"><span class="tk-v" :class="equipKpi.dispo != null && equipKpi.dispo < 85 ? 'warn' : 'ok'">{{ equipKpi.dispo != null ? equipKpi.dispo + '%' : '—' }}</span><span class="tk-l">Disponibilité</span></div>
            <div class="tk"><span class="tk-v">{{ fmtH(equipKpi.mtbf) }}</span><span class="tk-l">MTBF</span></div>
            <div class="tk"><span class="tk-v">{{ fmtH(equipKpi.mttr) }}</span><span class="tk-l">MTTR</span></div>
          </div>
        </div>
        <div class="trans-card">
          <div class="trans-dom r">Rendement</div>
          <div class="trans-kpis">
            <div class="tk"><span class="tk-v" :class="rendementFab != null && rendementFab < 90 ? 'warn' : 'ok'">{{ rendementFab != null ? rendementFab + '%' : '—' }}</span><span class="tk-l">Fabrication {{ annee }}</span></div>
            <div class="tk"><span class="tk-v" :class="tauxGlobal != null && tauxGlobal < 100 ? 'warn' : 'ok'">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</span><span class="tk-l">Réalisation plan</span></div>
          </div>
        </div>
        <div class="trans-card">
          <div class="trans-dom p">Personnel</div>
          <div class="trans-kpis">
            <div class="tk"><span class="tk-v" :class="formationKpi.taux != null && formationKpi.taux < 90 ? 'warn' : 'ok'">{{ formationKpi.taux != null ? formationKpi.taux + '%' : '—' }}</span><span class="tk-l">Qualification</span></div>
            <div class="tk"><span class="tk-v" :class="formationKpi.expire ? 'bad' : 'ok'">{{ formationKpi.expire }}</span><span class="tk-l">Expirées</span></div>
            <div class="tk"><span class="tk-v" :class="formationKpi.bientot ? 'warn' : 'ok'">{{ formationKpi.bientot }}</span><span class="tk-l">À recycler</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pilotage — graphiques de suivi d'activité -->
    <section class="pilot">
      <div class="pilot-grid">
        <div class="pilot-card wide">
          <div class="pilot-h">
            <span class="pilot-t">Plan vs {{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }} par mois — {{ annee }} <span class="pilot-u">(boîtes)</span></span>
            <span class="pilot-leg"><i class="lg b-plan"></i>Plan<i class="lg b-real"></i>Réalisé</span>
          </div>
          <svg :viewBox="'0 0 ' + graphPR.W + ' ' + graphPR.H" class="pilot-svg" preserveAspectRatio="none">
            <line v-for="(g, i) in graphPR.grid" :key="'g' + i" :x1="graphPR.mL" :x2="graphPR.mL + graphPR.iw" :y1="g.y" :y2="g.y" class="grid" />
            <rect v-for="(b, i) in graphPR.bars" :key="'b' + i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :class="b.cls" rx="2"><title>{{ fmt(b.v) }}</title></rect>
            <text v-for="(l, i) in graphPR.labels" :key="'l' + i" :x="l.x" :y="l.y" class="x-lbl">{{ l.t }}</text>
          </svg>
        </div>
        <div class="pilot-card">
          <div class="pilot-h"><span class="pilot-t">Chiffre d'affaires mensuel <span class="pilot-u">(DA)</span></span></div>
          <svg :viewBox="'0 0 ' + graphCA.W + ' ' + graphCA.H" class="pilot-svg" preserveAspectRatio="none">
            <rect v-for="(b, i) in graphCA.bars" :key="'c' + i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="b-ca" rx="2"><title>{{ fmtCA(b.v) }}</title></rect>
            <text v-for="(l, i) in graphCA.labels" :key="'cl' + i" :x="l.x" :y="l.y" class="x-lbl">{{ l.t }}</text>
          </svg>
        </div>
        <div class="pilot-card">
          <div class="pilot-h"><span class="pilot-t">Top {{ libGroupe }} <span class="pilot-u">(boîtes, {{ annee }})</span></span></div>
          <div class="top-list">
            <div v-for="(d, i) in graphTop" :key="'t' + i" class="top-row">
              <span class="top-nom" :title="d.nom">{{ d.nom }}</span>
              <span class="top-bar"><span class="top-in" :style="{ width: d.pct + '%' }"></span></span>
              <span class="top-val">{{ fmt(d.boites) }}<span v-if="d.taux != null" class="top-taux" :class="d.taux >= 100 ? 'ok' : 'bas'">{{ d.taux }}%</span></span>
            </div>
            <div v-if="!graphTop.length" class="tb-empty">Aucune donnée.</div>
          </div>
        </div>
      </div>
    </section>

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
            <th class="num">Plan (mois)</th>
            <th class="num">Réalisé (mois)</th>
            <th class="num">Taux (mois)</th>
            <th class="num">Lots</th>
            <th class="num">Chiffre d'affaires</th>
            <th class="num">CA (mois)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in donnees" :key="r.cle">
            <td class="g-nom">{{ r.cle }}</td>
            <td class="num">{{ r.plan ? fmt(r.plan) : '—' }}</td>
            <td class="num">{{ fmt(r.boites) }}</td>
            <td class="num"><span v-if="r.taux != null" class="taux" :class="r.taux >= 100 ? 'ok' : 'bas'">{{ r.taux }}%</span><span v-else class="muted">—</span></td>
            <td class="num">{{ r.planMois ? fmt(r.planMois) : '—' }}</td>
            <td class="num">{{ r.boitesMois ? fmt(r.boitesMois) : '—' }}</td>
            <td class="num"><span v-if="r.tauxMois != null" class="taux" :class="r.tauxMois >= 100 ? 'ok' : 'bas'">{{ r.tauxMois }}%</span><span v-else class="muted">—</span></td>
            <td class="num">{{ fmt(r.lots) }}</td>
            <td class="num ca">{{ fmtCA(r.ca) }}</td>
            <td class="num ca">{{ fmtCA(r.caMois) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="tot">
            <td>Total {{ annee }}</td>
            <td class="num">{{ totPlan ? fmt(totPlan) : '—' }}</td>
            <td class="num">{{ fmt(totBoites) }}</td>
            <td class="num">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</td>
            <td class="num">{{ totPlanMois ? fmt(totPlanMois) : '—' }}</td>
            <td class="num">{{ totBoitesMois ? fmt(totBoitesMois) : '—' }}</td>
            <td class="num">{{ tauxGlobalMois != null ? tauxGlobalMois + '%' : '—' }}</td>
            <td class="num">{{ fmt(totLots) }}</td>
            <td class="num ca">{{ fmtCA(totCA) }}</td>
            <td class="num ca">{{ fmtCA(totCAMois) }}</td>
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
const equipRef = ref([])
const cadences = ref([])
function phaseDeType(t) {
  t = (t || '').toLowerCase()
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
function phaseDeEq(e) { return phaseDeType(e.type) || phaseDeType(e.nom) || phaseDeType(e.code) }
function siteDeCode(code) { const c = (code || '').toUpperCase(); if (c.startsWith('PRH')) return 'hormonal'; if (c === 'PR054') return 'semi'; return 'seche' }
// Mêmes équipements que Suivi de capacité (Forme sèche) : référentiel + phase reconnue + site sèche
// Équipements autorisés (mêmes que Suivi de capacité — Forme sèche)
const EQUIP_OK = ['Cabine de pesée', 'Granulation et Séchage COMASA', 'Granulation et Séchage GLATT', 'Mélangeur en V', 'Mélangeur en V 100L', 'Mélangeur GLATT à Bin', '1200i', 'Fe55', 'Gélules', 'Labortechnic', 'GLATT']
const EQUIP_OK_SET = new Set(EQUIP_OK.map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))
const normNom = (n) => (n || '').toLowerCase().replace(/\s+/g, ' ').trim()
// Produit -> équipements, d'après la CADENCE (cadences_produit)
const equipParProduit = computed(() => {
  const nomById = {}
  for (const e of equipRef.value) nomById[e.id] = (e.nom || '').trim()
  const m = {}
  for (const c of cadences.value) {
    if (!(Number(c.cadence_nominale) > 0)) continue
    const nom = nomById[c.equipement_id]; if (!nom || !EQUIP_OK_SET.has(normNom(nom))) continue
    if (!m[c.produit_id]) m[c.produit_id] = new Set()
    m[c.produit_id].add(nom)
  }
  return m
})
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
// Sources transverses (qualité, équipements, RH)
const deviationsRaw = ref([]); const capaRaw = ref([]); const trsRaw = ref([])
const organigrammeRaw = ref([]); const formationsRaw = ref([]); const formEnrRaw = ref([]); const formReqRaw = ref([])
onMounted(async () => {
  try {
    const [rf, rc, rp, rs, re, rcad] = await Promise.all([
      fetchAllPaged(() => supabase.from('ordres_fabrication')
        .select('id, produit_id, numero_lot, boites_fabriquees, quantite_theorique, date_fin_fabrication, equipements(nom), produits(gamme, code_pf, designation, pcsu, taille_lot, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('conditionnement')
        .select('quantite_conditionnee, date_conditionnement, equipements(nom, type), ordres_fabrication(numero_lot, date_fin_fabrication, produits(code_pf, designation, pcsu, taille_lot, unites_par_boite, donneurs_ordre(nom)))')),
      fetchAllPaged(() => supabase.from('plan_production')
        .select('produit_id, annee, mois, quantite_planifiee, equipements(nom, type), produits(gamme, code_pf, designation, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, equipements(nom)')),
      fetchAllPaged(() => supabase.from('equipements').select('id, nom, type, code').eq('actif', true)),
      fetchAllPaged(() => supabase.from('cadences_produit').select('produit_id, equipement_id, cadence_nominale'))
    ])
    fabRaw.value = rf; condRaw.value = rc; planRaw.value = rp; suiviRaw.value = rs; equipRef.value = re.data || []; cadences.value = rcad.data || []
    // KPIs transverses (qualité, équipements, RH) — chaque requête est tolérante :
    // une table absente n'affecte que son propre KPI et ne casse jamais la page.
    const safe = async (make) => { try { return await fetchAllPaged(make) } catch (e) { console.warn('KPI transverse indisponible :', (e && e.message) || e); return [] } }
    const [rdev, rcapa, rtrs, rorg, rform, rfenr, rfreq] = await Promise.all([
      safe(() => supabase.from('deviations').select('statut, criticite, date_dev')),
      safe(() => supabase.from('capa').select('statut, echeance, date_capa')),
      safe(() => supabase.from('trs_postes').select('date, temps_ouverture_min, arret_panne_min, arret_format_min, arret_nettoyage_min, arret_reglage_min, arret_maintenance_min, arret_attente_min, arret_autre_min')),
      safe(() => supabase.from('organigramme').select('id, fonction, actif').eq('actif', true)),
      safe(() => supabase.from('formations').select('id, nom, validite_mois, actif').eq('actif', true)),
      safe(() => supabase.from('formation_enregistrements').select('personne_id, formation_id, date_formation, resultat')),
      safe(() => supabase.from('formation_requise').select('fonction, formation_id'))
    ])
    deviationsRaw.value = rdev; capaRaw.value = rcapa; trsRaw.value = rtrs
    organigrammeRaw.value = rorg; formationsRaw.value = rform; formEnrRaw.value = rfenr; formReqRaw.value = rfreq
  } catch (e) { console.error(e) } finally { chargement.value = false }
})

const anYear = (d) => d ? new Date(d).getFullYear() : null

const fabData = computed(() => {
  const arr = fabRaw.value
    .filter(o => o.date_fin_fabrication && anYear(o.date_fin_fabrication) === annee.value)
    .map(o => ({ id: o.id, produit_id: o.produit_id, lot: o.numero_lot, equip: o.equipements ? o.equipements.nom : null, boites: o.boites_fabriquees, produit: o.produits, mois: anMonth(o.date_fin_fabrication) }))
  // Produits « direct conditionnement » (sans fabrication) : conditionné compté comme fabriqué
  for (const c of condRaw.value) {
    const of = c.ordres_fabrication
    if (!of || of.date_fin_fabrication) continue
    if (!c.date_conditionnement || anYear(c.date_conditionnement) !== annee.value) continue
    const p = of.produits; const upb = p ? num(p.unites_par_boite) : 0
    arr.push({ id: null, lot: of.numero_lot, equip: c.equipements ? c.equipements.nom : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p, mois: anMonth(c.date_conditionnement) })
  }
  return arr
})

const condData = computed(() => condRaw.value
  .filter(c => c.date_conditionnement && anYear(c.date_conditionnement) === annee.value)
  .map(c => {
    const of = c.ordres_fabrication; const p = of ? of.produits : null
    const upb = p ? num(p.unites_par_boite) : 0
    return { lot: of ? of.numero_lot : null, equip: c.equipements ? c.equipements.nom : null, equipType: c.equipements ? c.equipements.type : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p, mois: anMonth(c.date_conditionnement) }
  }))

const annees = computed(() => {
  const s = new Set()
  fabRaw.value.forEach(o => { const y = anYear(o.date_fin_fabrication); if (y) s.add(y) })
  condRaw.value.forEach(c => { const y = anYear(c.date_conditionnement); if (y) s.add(y) })
  s.add(new Date().getFullYear())
  return [...s].sort((a, b) => b - a)
})

function formeDe(p) {
  // 1) d'après la GAMME de fabrication (le vrai procédé)
  const g = (p && Array.isArray(p.gamme)) ? p.gamme.map(x => (x || '').toLowerCase()) : []
  if (g.some(x => /g[ée]lule|remplis|encapsul/.test(x))) return 'Gélule'
  if (g.some(x => /compress|compri/.test(x))) return 'Comprimé'
  if (g.some(x => /pellicul/.test(x))) return 'Comprimé'
  // 2) sinon d'après la désignation
  const d = ((p && p.designation) || '').toLowerCase()
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
  if (grp.value === 'forme') return formeDe(p)
  if (grp.value === 'produit') return (p.code_pf || '?') + ' — ' + (p.designation || '')
  return null
}
function cleGroupe(r) { return grp.value === 'equip' ? (r.equip || 'Non attribué') : (cleProduit(r.produit) || 'Non attribué') }
const machinesParProduit = computed(() => {
  const m = {}
  for (const o of fabRaw.value) {
    const code = o.produits ? o.produits.code_pf : null
    const eqs = equipsByOf.value[o.id]
    if (!code || !eqs) continue
    if (!m[code]) m[code] = new Set()
    for (const nom of eqs) m[code].add(nom)
  }
  return m
})
function planAgg(moisFiltre) {
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  const parEquipFab = onglet.value === 'fab' && grp.value === 'equip'
  const machP = machinesParProduit.value
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    if (moisFiltre != null && Number(r.mois) !== moisFiltre) continue
    const q = num(r.quantite_planifiee)
    if (parPhase) {
      const p = r.produits; if (!p) continue
      const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : []
      const seen = new Set()
      for (const phn of gamme) { const k = phaseKey(phn); if (!k || k === 'conditionnement' || seen.has(k)) continue; seen.add(k); const cle = PHASE_LBL[k] || k; acc[cle] = (acc[cle] || 0) + q }
    } else if (parEquipFab) {
      let machs = equipParProduit.value[r.produit_id]
      if ((!machs || !machs.size) && r.equipements && r.equipements.nom) machs = new Set([r.equipements.nom])
      if (!machs || !machs.size) continue
      for (const nom of machs) { if (EQUIP_OK_SET.has(normNom(nom))) acc[nom] = (acc[nom] || 0) + q }
    } else {
      const cle = grp.value === 'equip' ? (r.equipements ? r.equipements.nom : null) : cleProduit(r.produits)
      if (cle == null) continue
      if (onglet.value === 'cond' && grp.value === 'equip' && r.equipements && estFabType(r.equipements.type)) continue
      acc[cle] = (acc[cle] || 0) + q
    }
  }
  return acc
}
const planParGroupe = computed(() => planAgg(null))
const planParGroupeMois = computed(() => planAgg(moisCourant))

const donnees = computed(() => {
  const src = onglet.value === 'fab' ? fabData.value : condData.value
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  const parEquipFab = onglet.value === 'fab' && grp.value === 'equip'
  const add = (cle, b, t, pc, mo) => { if (!acc[cle]) acc[cle] = { cle, boites: 0, boitesMois: 0, lots: 0, ca: 0, caMois: 0 }; acc[cle].boites += b; if (mo === moisCourant) { acc[cle].boitesMois += b; acc[cle].caMois += b * pc } acc[cle].lots += t > 0 ? b / t : 0; acc[cle].ca += b * pc }
  for (const r of src) {
    if (!r.produit || !(num(r.boites) > 0)) continue
    const b = num(r.boites), t = num(r.produit.taille_lot), pc = num(r.produit.pcsu), mo = r.mois
    if (parPhase) {
      const phs = phasesByOf.value[r.id]; if (!phs) continue
      for (const k of phs) add(PHASE_LBL[k] || k, b, t, pc, mo)
    } else if (parEquipFab) {
      let machs = equipParProduit.value[r.produit_id]
      if (!machs || !machs.size) machs = equipsByOf.value[r.id]
      if ((!machs || !machs.size) && r.equip) machs = new Set([r.equip])
      if (!machs || !machs.size) continue
      for (const nom of machs) { if (EQUIP_OK_SET.has(normNom(nom))) add(nom, b, t, pc, mo) }
    } else {
      if (onglet.value === 'cond' && grp.value === 'equip' && estFabType(r.equipType)) continue
      add(cleGroupe(r), b, t, pc, mo)
    }
  }
  const pg = planParGroupe.value
  const pgm = planParGroupeMois.value
  return Object.values(acc).map(g => {
    const plan = pg[g.cle] || 0
    const planMois = pgm[g.cle] || 0
    return { ...g, lots: Math.round(g.lots), plan, taux: plan > 0 ? Math.round(g.boites / plan * 100) : null, planMois, tauxMois: planMois > 0 ? Math.round(g.boitesMois / planMois * 100) : null }
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

// ===== Pilotage — séries mensuelles & géométrie des graphiques =====
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const serieMensuelle = computed(() => {
  const src = onglet.value === 'fab' ? fabData.value : condData.value
  const real = Array(12).fill(0), ca = Array(12).fill(0), plan = Array(12).fill(0)
  for (const r of src) {
    if (!r.produit || !(num(r.boites) > 0) || !r.mois) continue
    const i = r.mois - 1; real[i] += num(r.boites); ca[i] += num(r.boites) * num(r.produit.pcsu)
  }
  for (let m = 1; m <= 12; m++) { const agg = planAgg(m); plan[m - 1] = Object.values(agg).reduce((s, v) => s + v, 0) }
  return MOIS_COURTS.map((nom, i) => ({ nom, real: real[i], ca: ca[i], plan: plan[i] }))
})
// Barres groupées Plan vs Réalisé (boîtes) par mois
const graphPR = computed(() => {
  const s = serieMensuelle.value
  const W = 760, H = 220, mL = 10, mR = 10, mT = 12, mB = 24
  const iw = W - mL - mR, ih = H - mT - mB, baseY = mT + ih
  const max = Math.max(1, ...s.map(x => Math.max(x.plan, x.real)))
  const step = iw / 12, bw = Math.min(15, step / 3)
  const bars = []
  s.forEach((x, i) => {
    const cx = mL + step * i + step / 2
    const hp = x.plan / max * ih, hr = x.real / max * ih
    bars.push({ x: cx - bw - 2, y: baseY - hp, w: bw, h: hp, cls: 'b-plan', v: x.plan })
    bars.push({ x: cx + 2, y: baseY - hr, w: bw, h: hr, cls: 'b-real', v: x.real })
  })
  const labels = s.map((x, i) => ({ x: mL + step * i + step / 2, y: H - 7, t: x.nom }))
  const grid = [0.25, 0.5, 0.75, 1].map(g => ({ y: baseY - g * ih }))
  return { W, H, mL, iw, bars, labels, grid }
})
// Barres CA mensuel
const graphCA = computed(() => {
  const s = serieMensuelle.value
  const W = 760, H = 200, mL = 10, mR = 10, mT = 12, mB = 24
  const iw = W - mL - mR, ih = H - mT - mB, baseY = mT + ih
  const max = Math.max(1, ...s.map(x => x.ca))
  const step = iw / 12, bw = Math.min(28, step * 0.62)
  const bars = s.map((x, i) => { const cx = mL + step * i + step / 2; const h = x.ca / max * ih; return { x: cx - bw / 2, y: baseY - h, w: bw, h, v: x.ca } })
  const labels = s.map((x, i) => ({ x: mL + step * i + step / 2, y: H - 7, t: x.nom }))
  return { W, H, bars, labels }
})
// Top catégories (selon regroupement actif) par boîtes
const graphTop = computed(() => {
  const top = donnees.value.slice(0, 7)
  const max = Math.max(1, ...top.map(d => d.boites))
  return top.map(d => ({ nom: d.cle, boites: d.boites, pct: d.boites / max * 100, taux: d.taux }))
})

// ===== KPIs transverses pour le pilotage (qualité, équipements, RH) =====
const _today = new Date(new Date().toISOString().slice(0, 10))
const _dans60 = new Date(_today.getTime() + 60 * 86400000)
const normNomF = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
function addMonths(dateStr, m) {
  if (!dateStr || !m) return null
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + Number(m)); return d
}
const fmtH = (h) => h == null ? '—' : (h >= 10 ? Math.round(h) : h.toFixed(1)) + ' h'
// Qualité
const statutKeyCapa = (s) => { const t = (s || '').toLowerCase(); if (/cl[oô]tur/.test(t)) return 'cloturee'; if (/r[ée]alis/.test(t)) return 'realisee'; return 'autre' }
const devOuvertes = computed(() => deviationsRaw.value.filter(d => d.statut !== 'Clôturée').length)
const devCritiques = computed(() => deviationsRaw.value.filter(d => d.criticite === 'Critique' && d.statut !== 'Clôturée').length)
const capaRetard = computed(() => capaRaw.value.filter(c => c.echeance && !['cloturee', 'realisee'].includes(statutKeyCapa(c.statut)) && new Date(c.echeance) < _today).length)
// Équipements — disponibilité, MTBF, MTTR (trs_postes) sur l'année sélectionnée
const equipKpi = computed(() => {
  let ouv = 0, arrets = 0, panne = 0, evPanne = 0
  for (const t of trsRaw.value) {
    if (!t.date || anYear(t.date) !== annee.value) continue
    const o = num(t.temps_ouverture_min); if (!(o > 0)) continue
    const p = num(t.arret_panne_min)
    const a = p + num(t.arret_format_min) + num(t.arret_nettoyage_min) + num(t.arret_reglage_min) + num(t.arret_maintenance_min) + num(t.arret_attente_min) + num(t.arret_autre_min)
    ouv += o; arrets += a; panne += p; if (p > 0) evPanne++
  }
  const fonct = Math.max(0, ouv - arrets)
  return { dispo: ouv > 0 ? Math.round(fonct / ouv * 100) : null, mtbf: evPanne ? fonct / evPanne / 60 : null, mttr: evPanne ? panne / evPanne / 60 : null, evPanne }
})
// Rendement fabrication sur l'année
const rendementFab = computed(() => {
  let theo = 0, prod = 0
  for (const o of fabRaw.value) {
    if (!o.date_fin_fabrication || anYear(o.date_fin_fabrication) !== annee.value) continue
    const t = num(o.quantite_theorique), b = num(o.boites_fabriquees)
    if (t > 0 && b > 0) { theo += t; prod += b }
  }
  return theo > 0 ? Math.round(prod / theo * 100) : null
})
// Formation / qualification (logique Matrice, dédup par nom canonique)
const canonF = computed(() => {
  const cleById = {}, idByCle = {}
  for (const f of formationsRaw.value) { const cle = normNomF(f.nom); cleById[f.id] = cle; if (!(cle in idByCle)) idByCle[cle] = f.id }
  const map = {}, valid = {}
  for (const f of formationsRaw.value) { const c = idByCle[cleById[f.id]]; map[f.id] = c; if (valid[c] == null && f.validite_mois != null) valid[c] = f.validite_mois }
  return { map, valid }
})
const formationKpi = computed(() => {
  const cf = canonF.value
  const reqByFonction = {}
  for (const r of formReqRaw.value) { const c = cf.map[r.formation_id] || r.formation_id; if (!reqByFonction[r.fonction]) reqByFonction[r.fonction] = new Set(); reqByFonction[r.fonction].add(c) }
  const latest = {}
  for (const e of formEnrRaw.value) { const c = cf.map[e.formation_id] || e.formation_id; const k = e.personne_id + '|' + c; if (!latest[k] || String(e.date_formation) > String(latest[k].date_formation)) latest[k] = e }
  let requises = 0, valides = 0, expire = 0, bientot = 0, qualifies = 0, totalPers = 0
  for (const p of organigrammeRaw.value) {
    const reqs = reqByFonction[p.fonction]; if (!reqs || !reqs.size) continue
    totalPers++; let pv = 0
    for (const c of reqs) {
      requises++
      const e = latest[p.id + '|' + c]
      if (!e) continue
      if (e.resultat === 'non acquis') { expire++; continue }
      const exp = addMonths(e.date_formation, cf.valid[c])
      if (exp && exp < _today) { expire++; continue }
      if (exp && exp <= _dans60) { bientot++; continue }
      valides++; pv++
    }
    if (pv === reqs.size) qualifies++
  }
  return { taux: requises ? Math.round(valides / requises * 100) : null, expire, bientot, qualifies, totalPers }
})
// Bandeau de décisions — signaux nécessitant l'attention du manager
const alertes = computed(() => {
  const a = []
  if (capaRetard.value > 0) a.push({ t: capaRetard.value + ' CAPA en retard', d: 'Échéance dépassée — relancer les responsables', lvl: 'high' })
  if (devCritiques.value > 0) a.push({ t: devCritiques.value + ' déviation(s) critique(s) ouverte(s)', d: 'À traiter en priorité', lvl: 'high' })
  if (formationKpi.value.expire > 0) a.push({ t: formationKpi.value.expire + ' qualification(s) expirée(s)', d: 'Personnel à requalifier', lvl: 'high' })
  if (formationKpi.value.bientot > 0) a.push({ t: formationKpi.value.bientot + ' qualification(s) à recycler (< 60 j)', d: 'Planifier le recyclage', lvl: 'mid' })
  if (equipKpi.value.dispo != null && equipKpi.value.dispo < 85) a.push({ t: 'Disponibilité équipements ' + equipKpi.value.dispo + '%', d: "Sous l'objectif (85%) — analyser les arrêts", lvl: 'mid' })
  if (rendementFab.value != null && rendementFab.value < 90) a.push({ t: 'Rendement fabrication ' + rendementFab.value + '%', d: 'Pertes élevées — vérifier les procédés', lvl: 'mid' })
  if (tauxGlobalMois.value != null && tauxGlobalMois.value < 100) a.push({ t: 'Plan du mois réalisé à ' + tauxGlobalMois.value + '%', d: 'Retard sur le planning — ajuster la charge', lvl: 'mid' })
  return a
})
</script>

<style scoped>
.tb { padding: 26px 34px 50px; max-width: 1600px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
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

/* Pilotage — graphiques de suivi d'activité */
.pilot { margin: 2px 0 18px; }
.pilot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.pilot-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 16px; box-shadow: 0 8px 22px rgba(30,41,59,.06); min-width: 0; }
.pilot-card.wide { grid-column: 1 / -1; }
.pilot-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pilot-t { font-size: 13px; font-weight: 800; color: #0f172a; }
.pilot-u { color: #94a3b8; font-weight: 600; font-size: 11.5px; }
.pilot-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #64748b; }
.pilot-leg .lg { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.pilot-leg .lg.b-real { margin-left: 8px; }
.pilot-leg .lg.b-plan { background: #cbd5e1; }
.pilot-leg .lg.b-real { background: #14b8a6; }
.pilot-svg { width: 100%; height: auto; display: block; }
.pilot-svg .grid { stroke: #eef2f7; stroke-width: 1; }
.pilot-svg .b-plan { fill: #cbd5e1; }
.pilot-svg .b-real { fill: #14b8a6; }
.pilot-svg .b-ca { fill: #0ea5e9; }
.pilot-svg .x-lbl { fill: #94a3b8; font-size: 11px; font-weight: 600; text-anchor: middle; }
.top-list { display: flex; flex-direction: column; gap: 9px; padding-top: 2px; }
.top-row { display: grid; grid-template-columns: 116px 1fr auto; align-items: center; gap: 10px; font-size: 12.5px; }
.top-nom { font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top-bar { height: 10px; background: #eef2f7; border-radius: 5px; overflow: hidden; }
.top-in { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
.top-val { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-taux { font-size: 10.5px; font-weight: 800; margin-left: 6px; }
.top-taux.ok { color: #15803d; } .top-taux.bas { color: #dc2626; }
@media (max-width: 820px) { .pilot-grid { grid-template-columns: 1fr; } }

/* Décisions & KPIs transverses */
.decisions { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 12px 15px; margin-bottom: 14px; }
.dec-h { font-size: 12.5px; font-weight: 800; color: #b45309; margin-bottom: 9px; text-transform: uppercase; letter-spacing: .4px; }
.dec-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
.dec-item { display: flex; flex-direction: column; gap: 2px; background: #fff; border: 1px solid #fde4c8; border-left-width: 4px; border-radius: 10px; padding: 8px 12px; }
.dec-item.high { border-left-color: #dc2626; }
.dec-item.mid { border-left-color: #f59e0b; }
.dec-t { font-size: 13px; font-weight: 800; color: #0f172a; }
.dec-d { font-size: 11.5px; color: #64748b; font-weight: 600; }
.trans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.trans-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 13px 15px; box-shadow: 0 8px 22px rgba(30,41,59,.06); }
.trans-dom { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; padding-left: 9px; border-left: 4px solid #94a3b8; }
.trans-dom.q { border-left-color: #a855f7; color: #7c3aed; }
.trans-dom.e { border-left-color: #0ea5e9; color: #0369a1; }
.trans-dom.r { border-left-color: #14b8a6; color: #0f766e; }
.trans-dom.p { border-left-color: #f59e0b; color: #b45309; }
.trans-kpis { display: flex; gap: 12px; flex-wrap: wrap; }
.tk { display: flex; flex-direction: column; gap: 1px; min-width: 58px; }
.tk-v { font-size: 20px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1.1; }
.tk-v.ok { color: #15803d; } .tk-v.warn { color: #d97706; } .tk-v.bad { color: #dc2626; }
.tk-l { font-size: 10.5px; color: #64748b; font-weight: 600; }
@media (max-width: 1100px) { .trans-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .trans-grid { grid-template-columns: 1fr; } }

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
.tb { zoom: 0.75; }
</style>
