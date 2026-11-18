<template>
  <div class="ordo">
    <div class="ordo-head">
      <div>
        <div class="oh-eyebrow">Planification fabrication</div>
        <h1 class="oh-title">Ordonnancement — besoin conditionnement</h1>
        <p class="oh-sub">Les lots sont ordonnancés par <strong>date de besoin conditionnement la plus proche</strong> (début de conditionnement estimé) et placés sur les ateliers selon leur <strong>cadence de fabrication</strong>. Pour chaque lot : date limite de début à ne pas dépasser + marge → risque de non-atteinte de l'objectif.</p>
      </div>
    </div>

    <!-- Paramètres + sources -->
    <section class="card">
      <div class="add-grid">
        <div class="add-field">
          <label>Date de départ</label>
          <input type="date" v-model="dateDepart" />
        </div>
        <div class="add-field chk-wk">
          <label>Week-end</label>
          <label class="wk"><input type="checkbox" v-model="skipWeekend" /> Ne pas compter le week-end</label>
        </div>
        <div class="add-field grow">
          <label>Ajouter un produit (optionnel)</label>
          <input type="search" v-model="rechercheProduit" class="prod-search" placeholder="Filtrer par code ou désignation…" />
          <select v-model="selProduit">
            <option value="">— Choisir un produit ({{ produitsAffiches.length }}) —</option>
            <option v-for="p in produitsAffiches" :key="p.id" :value="p.id">{{ p.code_pf }} · {{ p.designation }}</option>
          </select>
        </div>
        <div class="add-field"><label>Quantité (boîtes)</label><input type="number" min="1" v-model="selBoites" @keyup.enter="ajouter" /></div>
        <button class="btn-add" @click="ajouter" :disabled="!selProduit || !(Number(selBoites) > 0)">Ajouter</button>
      </div>
      <div class="add-import">
        <button class="btn-import excel" @click="declencherImportPlan">⬆ Importer le plan conditionnement (Excel)</button>
        <span class="import-hint">colonnes « Code », « Taille », « Début est. » → un lot par ligne, ordonnancé par échéance</span>
        <input ref="fichierPlan" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="importerPlanExcel" />
      </div>
      <p v-if="msgImport" class="msg-import">{{ msgImport }}</p>
      <p v-if="chargement" class="muted">Chargement…</p>
    </section>

    <!-- Planning de fabrication par atelier (en haut) -->
    <section v-if="planParAtelier.length || suiviPhases.length" class="card">
      <div class="card-head-row">
        <h2 class="card-title">Planning de fabrication par phase et équipement</h2>
        <div class="head-ctrls">
          <label class="av-chk" title="Chaque étape déjà faite (par lot et par atelier) libère la capacité de son équipement ; les étapes planifiées les jours/mois suivants remontent pour la combler.">
            <input type="checkbox" v-model="avancer" /> Avancer le restant
          </label>
          <label class="av-chk" title="Dès qu'une machine se libère, on y place le prochain lot disponible — en avançant des lots des mois suivants — pour combler les temps morts et tendre vers 100% d'occupation.">
            <input type="checkbox" v-model="produireAvance" /> Produire en avance
          </label>
          <div class="range-sel">
            <button :class="{ on: horizonSel === 0 }" @click="horizonSel = 0">Tout</button>
            <button :class="{ on: horizonSel === 1 }" @click="horizonSel = 1">Mois en cours</button>
            <button :class="{ on: horizonSel === 2 }" @click="horizonSel = 2">2 mois</button>
            <button :class="{ on: horizonSel === 3 }" @click="horizonSel = 3">3 mois</button>
          </div>
        </div>
      </div>
      <p class="muted" style="margin:0 0 14px"><template v-if="avancer">Les étapes déjà faites (par lot et par atelier) sont retirées et <strong>la capacité libérée avance les étapes suivantes</strong>. </template>Pastille : <span class="leg-dot st-ok"></span> à temps · <span class="leg-dot st-tight"></span> tendu · <span class="leg-dot st-late"></span> en retard<template v-if="!avancer"> · <span class="leg-sq lot-done-leg"></span> étape terminée (grisée)</template>.</p>
      <div v-if="!planParPhaseVue.length" class="muted">Aucun lot à fabriquer sur cette période.</div>
      <div v-for="ph in planParPhaseVue" :key="ph.phase" class="phase-group">
        <div class="phase-head"><span class="at-phase">{{ ph.phase }}</span><span class="ph-sub">{{ ph.equips.length }} équipement{{ ph.equips.length > 1 ? 's' : '' }} · {{ ph.nLots }} lot{{ ph.nLots > 1 ? 's' : '' }}</span></div>
        <div v-for="a in ph.equips" :key="a.equip" class="eq-board">
          <div class="eq-head">
            <div class="eq-id"><strong>{{ a.equip }}</strong><span v-if="a.atelier" class="eq-atelier">{{ a.atelier }}</span></div>
            <div class="eq-occ" :class="chargeClass(a.occ)">Occupation {{ a.occ }} %</div>
          </div>
          <div class="eq-kpis">
            <div class="eqk"><div class="eqk-l">Lots</div><div class="eqk-v">{{ a.lots.length }}</div><div class="eqk-s">{{ fmt(a.boites) }} bts<span v-if="a.nFini"> · {{ a.nFini }} fini(s)</span></div></div>
            <div class="eqk"><div class="eqk-l">Produits</div><div class="eqk-v">{{ a.nProd }}</div><div class="eqk-s">campagne{{ a.nProd > 1 ? 's' : '' }}</div></div>
            <div class="eqk"><div class="eqk-l">Période</div><div class="eqk-v eqk-sm">{{ fmtDateShort(a.premier) }} → {{ fmtDateShort(a.dernier) }}</div><div class="eqk-s">{{ a.busy }} j occupés</div></div>
            <div class="eqk" :class="{ 'eqk-bad': a.nLate > 0 }"><div class="eqk-l">En retard</div><div class="eqk-v">{{ a.nLate }}</div><div class="eqk-s">{{ a.nTight }} tendu{{ a.nTight > 1 ? 's' : '' }}</div></div>
          </div>
          <div v-for="p in a.produits" :key="p.code" class="prod-group">
            <div class="pg-label">
              <span class="pg-bar" :style="{ background: p.couleur }"></span>
              <div class="pg-txt"><strong>{{ p.code }}</strong> <span class="lot-desig">{{ p.desig }}</span><div class="pg-sub">{{ p.lots.length }} lot{{ p.lots.length > 1 ? 's' : '' }} · {{ fmt(p.boites) }} bts<span v-if="p.cad" class="pg-cad"> · cadence {{ fmt(p.cad) }}/h</span> · {{ fmtDateShort(p.premier) }} → {{ fmtDateShort(p.dernier) }}</div></div>
            </div>
            <div class="lot-cards">
              <template v-for="(l, i) in p.lots" :key="i">
                <div v-if="l.moisBreak" class="mois-sep">{{ moisCourt(l.entree) }}</div>
                <div class="lot-card" :class="[l.statut, { 'lot-done': l.fini, 'lot-enc': l.enCours && !l.fini }]" :title="p.code + ' · ' + l.desig + '\nLot ' + (l.numeroLot || '—') + ' · ' + fmt(l.boites) + ' boîtes\nCadence : ' + (l.cad ? fmt(l.cad) + '/h' : '—') + '\nFab : ' + fmtDate(l.entree) + ' → ' + fmtDate(l.sortie) + '\nBesoin cond. : ' + (l.besoin ? fmtDate(l.besoin) : '—') + (l.margeJ != null ? ' (marge ' + l.margeJ + ' j)' : '') + (l.fini ? '\n✓ Lot terminé' : (l.enCours ? '\n● En cours' : ''))">
                  <div class="lc-top"><span class="lc-idx">{{ i + 1 }}</span><span class="lc-num">{{ l.numeroLot || '—' }}</span><span v-if="l.fini" class="lc-fini" title="Lot terminé">✓</span><span v-else class="lc-dot" :class="[l.statut, { 'dot-enc': l.enCours }]"></span></div>
                  <div class="lc-prod">{{ fmt(l.boites) }} bts</div>
                  <div class="lc-line">⚙ {{ fmtDateShort(l.entree) }} → {{ fmtDateShort(l.sortie) }}</div>
                  <div class="lc-line lc-need" :class="{ 'lc-late': l.late && !l.fini }">◷ {{ l.besoin ? fmtDateShort(l.besoin) : '—' }}</div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Occupation des ateliers de fabrication -->
    <section v-if="planning.length && chargeSimple.rows.length" class="card">
      <h2 class="card-title">Occupation des ateliers de fabrication</h2>
      <p class="muted" style="margin:0 0 12px">Taux d'occupation de chaque atelier sur l'horizon du plan ({{ chargeSimple.horizon }} jours). L'atelier le plus chargé est le <strong>goulot</strong> : c'est lui qui cadence le débit.</p>
      <div class="charge-list">
        <div v-for="(a, i) in chargeSimple.rows" :key="i" class="charge-row" :class="{ 'charge-bottleneck': i === 0 }">
          <div class="ch-lbl"><span class="ch-phase">{{ a.phase }}</span> <span class="ch-eq">{{ a.equip }}</span><span v-if="i === 0" class="ch-gl">goulot</span></div>
          <div class="ch-track"><div class="ch-fill" :class="chargeClass(a.occ)" :style="{ width: Math.min(100, a.occ) + '%' }"></div></div>
          <div class="ch-pct">{{ a.occ }} %</div>
          <div class="ch-meta">{{ a.lots }} lot{{ a.lots > 1 ? 's' : '' }} · {{ a.busy }} j occupé{{ a.busy > 1 ? 's' : '' }}</div>
        </div>
      </div>
    </section>

    <!-- Résumé du plan -->
    <section v-if="groupes.length" class="card plan-sum">
      <div class="card-head-row">
        <h2 class="card-title">Plan — {{ nbProduits }} produit(s) · {{ groupesFab.length }} lot(s) à fabriquer<span v-if="nbConditionnes > 0" class="plan-excl"> · {{ nbConditionnes }} déjà conditionné(s) exclu(s)</span><span v-if="nbFinisExclus > 0" class="plan-excl"> · {{ nbFinisExclus }} étape(s) faite(s) — capacité avancée</span></h2>
        <button class="btn-reset" @click="remiseAZero">Remise à zéro</button>
      </div>
    </section>

    <!-- KPI risque -->
    <section v-if="planning.length" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ kpiOrdo.total }}</div><div class="km-lbl">Lots planifiés</div></div>
      <div class="kpi-mini"><div class="km-val" style="color:#047857">{{ kpiOrdo.nTemps }}</div><div class="km-lbl">À temps</div></div>
      <div class="kpi-mini" :class="{ 'km-warn': kpiOrdo.nRetard > 0 }"><div class="km-val">{{ kpiOrdo.nRetard }}</div><div class="km-lbl">À risque (retard)</div></div>
      <div class="kpi-mini" :class="{ 'km-tendu': kpiOrdo.nTendus > 0 }"><div class="km-val">{{ kpiOrdo.nTendus }}</div><div class="km-lbl">Tendus (≤ 2 j)</div></div>
      <div class="kpi-mini"><div class="km-val">{{ kpiOrdo.taux }} %</div><div class="km-lbl">Taux à temps</div></div>
      <div class="kpi-mini"><div class="km-val">{{ fmtDate(dateIdx(finGlobale)) }}</div><div class="km-lbl">Fin de fabrication</div></div>
    </section>

    <!-- Bandeau risque -->
    <section v-if="planning.length" class="card" :class="kpiOrdo.nRetard > 0 ? 'risk-bad' : 'risk-ok'">
      <p v-if="kpiOrdo.nRetard > 0" class="risk-txt">
        ⚠ <strong>{{ kpiOrdo.nRetard }} lot(s) à risque</strong> : la fabrication se termine <strong>après</strong> la date de besoin conditionnement avec la date de départ et la capacité actuelles.
        Pour résorber : avancer la date de départ, réquisitionner le week-end, ou alléger la charge de l'atelier goulot ({{ chargeSimple.rows.length ? chargeSimple.rows[0].equip : '—' }}).
      </p>
      <p v-else class="risk-txt">✓ <strong>Tous les lots sont fabriqués à temps</strong> pour leur besoin conditionnement, avec la date de départ et la capacité actuelles.</p>
    </section>

    <!-- Ordre de priorité de fabrication (démonstration de la logique) -->
    <section v-if="planning.length" class="card">
      <h2 class="card-title">Ordre de priorité de fabrication — par date de début conditionnement</h2>
      <p class="muted" style="margin:0 0 14px">Règle : la fabrication est priorisée selon la <strong>date de début de conditionnement estimée la plus proche</strong> (EDD). Le lot dont le conditionnement démarre le plus tôt est fabriqué en premier ; cet ordre alimente la planification des ateliers ci-dessous.</p>

      <div class="logic-flow">
        <div class="lf-step"><span class="lf-n">1</span><div class="lf-txt"><strong>Besoin conditionnement</strong><span>Date de début de conditionnement estimée (importée) de chaque lot.</span></div></div>
        <div class="lf-arrow">→</div>
        <div class="lf-step"><span class="lf-n">2</span><div class="lf-txt"><strong>Priorité (EDD)</strong><span>Tri par échéance la plus proche : plus le besoin est tôt, plus la priorité est haute.</span></div></div>
        <div class="lf-arrow">→</div>
        <div class="lf-step"><span class="lf-n">3</span><div class="lf-txt"><strong>Placement ateliers</strong><span>Chaque lot est placé sur ses ateliers selon la cadence et la capacité.</span></div></div>
        <div class="lf-arrow">→</div>
        <div class="lf-step"><span class="lf-n">4</span><div class="lf-txt"><strong>Risque</strong><span>Marge = fin de fabrication vs besoin ; en retard si la fabrication finit après.</span></div></div>
      </div>

      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              <th class="ta-c">Priorité</th>
              <th>Produit</th>
              <th class="ta-c">N° Lot</th>
              <th class="ta-r">Boîtes</th>
              <th class="ta-c">Début conditionnement<br><span class="th-sub">besoin — référence</span></th>
              <th class="ta-r">Durée fab</th>
              <th class="ta-c">Limite début fab</th>
              <th class="ta-c">Début fab planifié</th>
              <th class="ta-c">Fin fab planifiée</th>
              <th class="ta-r">Marge</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in tableauOrdo" :key="i" :class="{ 'row-late': r.enRetard }">
              <td class="ta-c ordo-rang">{{ i + 1 }}</td>
              <td><strong>{{ r.code }}</strong> <span class="lot-desig">{{ r.desig }}</span></td>
              <td class="ta-c"><span v-if="r.numeroLot" class="lot-num">{{ r.numeroLot }}</span><span v-else class="muted">—</span></td>
              <td class="ta-r">{{ fmt(r.boites) }}</td>
              <td class="ta-c ordo-date ordo-besoin">{{ r.besoin ? fmtDate(r.besoin) : '—' }}</td>
              <td class="ta-r">{{ r.dureeJ }} j</td>
              <td class="ta-c ordo-limite"><span v-if="r.echPassee" class="lim-pass" title="Besoin déjà passé — en retard dès le départ">dépassée</span><span v-else-if="r.dateLimite" :class="{ 'lim-tight': r.limiteDepassee }" :title="r.limiteDepassee ? 'Début planifié après la limite — risque' : 'Dernière date pour démarrer à temps'">{{ fmtDate(r.dateLimite) }}</span><span v-else class="muted">—</span></td>
              <td class="ta-c ordo-date">{{ r.debut ? fmtDate(r.debut) : '—' }}</td>
              <td class="ta-c ordo-date" :class="{ 'sortie-late': r.enRetard }">{{ r.fin ? fmtDate(r.fin) : '—' }}</td>
              <td class="ta-r"><span class="marge" :class="margeClass(r.marge)">{{ margeTxt(r.marge) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:8px"><span class="marge m-late">rouge</span> en retard · <span class="marge m-tight">orange</span> tendu (≤ 2 j) · <span class="marge m-ok">vert</span> confortable. <strong>Limite début fab</strong> = besoin − durée fab (rétro-planning) : au-delà, l'objectif ne peut plus être tenu.</p>
    </section>

    <!-- Phases non planifiées (cadence manquante) -->
    <section v-if="phasesManquantes.length" class="card warn-card">
      <h2 class="card-title">⚠ Phases sans cadence ({{ phasesManquantes.length }})</h2>
      <p class="warn-txt">Ces phases de gamme n'ont <strong>pas d'équipement cadencé</strong> pour le produit → elles sont ignorées (durée sous-estimée). Ajoute la cadence dans le volet <strong>Cadences</strong>.</p>
      <ul class="manq-list">
        <li v-for="m in phasesManquantes" :key="m.code + m.phase" class="manq-item" @click="allerCadences(m)"><strong>{{ m.code }}</strong> <span class="lot-desig">{{ m.desig }}</span> — <span class="manq-ph">{{ m.phase }}</span> <span class="manq-go">→ définir la cadence</span></li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const routerOrd = useRouter()
function allerCadences(m) { routerOrd.push({ path: '/cadences', query: { produit: m.code } }) }

const PALETTE = ['#0f766e', '#4338ca', '#c2410c', '#047857', '#7c3aed', '#0369a1', '#b91c1c', '#a16207', '#be185d', '#15803d']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k

const produits = ref([]), equipements = ref([]), cadences = ref([]), chargement = ref(true)
const ateliers = ref([]), ofs = ref([]), suiviPhases = ref([])   // réalisation (historique des opérations + dispo par atelier)
const vueMode = ref('prev')   // 'prev' = prévision (ordonnancement) | 'real' = réalisation (réel)
const avancer = ref(true)     // avancer le restant : les lots déjà fabriqués libèrent leur capacité, les lots suivants remontent
const produireAvance = ref(true)   // produire en avance : combler les temps morts des équipements avec les lots suivants
const groupes = ref([])   // { id, produitId, totalBoites, boitesParLot, nbLots, numeroLot, dateFixe, dateEcheance }
const dateDepart = ref(new Date().toISOString().slice(0, 10))
const skipWeekend = ref(false)   // l'usine tourne 7 j/7 (3×8 semaine + 2×8 week-end)
const hpj = 24                    // 3×8 = 24 h/j
const selProduit = ref(''), rechercheProduit = ref(''), selBoites = ref('')
let seq = 1
const msgImport = ref('')

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') }
function fmtDate(d) { return d ? d.toLocaleDateString('fr-FR') : '' }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  const [rp, re, rc, ra, ro, rs] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite, taille_lot, poids_lot_kg, gamme').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode')),
    fetchAllPaged(() => supabase.from('ateliers').select('id, code, nom').eq('actif', true)),
    fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, statut, produit_id, date_lancement, date_fin_fabrication, produits(code_pf, designation)').eq('actif', true)),
    fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, quantite_entree, quantite_sortie, date_debut, date_phase, statut, equipement_id').eq('actif', true))
  ])
  produits.value = rp; equipements.value = re; cadences.value = rc; ateliers.value = ra; ofs.value = ro; suiviPhases.value = rs; chargement.value = false
  chargerLocal()
})

watch([groupes, dateDepart, skipWeekend, avancer, produireAvance], sauvegarderLocal, { deep: true })

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/p[eé]llicul|enrob|coat|drag/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
function phaseKeyFromName(name) {
  const t = String(name || '').toLowerCase().trim()
  if (NOM_KEY[t]) return NOM_KEY[t]
  if (/pes/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|capsul/.test(t)) return 'remplissage'
  if (/compress|compri/.test(t)) return 'compression'
  if (/p[eé]llicul|enrob|drag/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) m[c.equipement_id + '|' + c.produit_id] = Number(c.cadence_nominale || 0); return m })
const couleur = (i) => PALETTE[i % PALETTE.length]

const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const produitsAffiches = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})

// Séquence de phases de FABRICATION d'un produit (le conditionnement est l'échéance, pas ordonnancé ici).
function gammeProduit(produitId) {
  const p = prodById.value[produitId]
  const g = (p && Array.isArray(p.gamme)) ? p.gamme : []
  const keys = []
  for (const n of g) { const k = phaseKeyFromName(n); if (k && k !== 'conditionnement' && !keys.includes(k)) keys.push(k) }
  return keys
}
// Exclusion des lots déjà conditionnés : si le début de conditionnement est passé,
// le vrac est fait → le lot n'entre pas dans le planning de fabrication.
const ajd = computed(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}` })
const groupesFab = computed(() => groupes.value.filter(g => !g.dateEcheance || String(g.dateEcheance) >= ajd.value))
const nbConditionnes = computed(() => groupes.value.length - groupesFab.value.length)
const nbFinisExclus = computed(() => { if (!avancer.value) return 0; let n = 0; for (const g of groupesFab.value) { if (!g.numeroLot) continue; const lot = String(g.numeroLot).trim(); for (const k of gammeProduit(g.produitId)) if (etapeFini(lot, k)) n++ } return n })
const nbProduits = computed(() => new Set(groupesFab.value.map(g => g.produitId)).size)

function ajouter() {
  if (!selProduit.value || !(Number(selBoites.value) > 0)) return
  const p = prodById.value[selProduit.value] || {}
  const tl = Number(p.taille_lot) || 0
  const total = Number(selBoites.value)
  const nb = tl > 0 ? Math.min(60, Math.ceil(total / tl)) : 1
  groupes.value.push({ id: seq++, numeroLot: null, produitId: selProduit.value, totalBoites: total, boitesParLot: tl > 0 ? tl : total, nbLots: nb, dateFixe: null, dateEcheance: null })
  selBoites.value = ''
}

// --- Persistance locale ---
const LS_KEY = 'ldm_ordo_scenario_v2'
function sauvegarderLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ groupes: groupes.value, dateDepart: dateDepart.value, skipWeekend: skipWeekend.value, avancer: avancer.value, produireAvance: produireAvance.value, seq })) } catch (e) {}
}
function chargerLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return
    const d = JSON.parse(raw)
    if (Array.isArray(d.groupes)) groupes.value = d.groupes
    if (d.dateDepart) dateDepart.value = d.dateDepart
    if (typeof d.skipWeekend === 'boolean') skipWeekend.value = d.skipWeekend
    if (typeof d.avancer === 'boolean') avancer.value = d.avancer
    if (typeof d.produireAvance === 'boolean') produireAvance.value = d.produireAvance
    if (d.seq) seq = Math.max(seq, Number(d.seq) || 1)
  } catch (e) {}
}
function remiseAZero() {
  if (!confirm('Vider le plan (lots importés et ajoutés) ? Cette action est définitive.')) return
  groupes.value = []
  try { localStorage.removeItem(LS_KEY) } catch (e) {}
}

// --- Import du plan Excel (Code + Taille + Début est. → échéance conditionnement) ---
const fichierPlan = ref(null)
let xlsxPromise = null
function chargerXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (xlsxPromise) return xlsxPromise
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX)
    s.onerror = () => reject(new Error('Chargement de la librairie Excel impossible (hors ligne ?)'))
    document.head.appendChild(s)
  })
  return xlsxPromise
}
function declencherImportPlan() { msgImport.value = ''; if (fichierPlan.value) fichierPlan.value.click() }
const toDateImp = (v) => {
  if (v instanceof Date && !isNaN(v)) return v
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? null : d }
  if (typeof v === 'string') { const s = v.trim(); const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (m) { let y = +m[3]; if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1]); return isNaN(d) ? null : d } const d = new Date(s); return isNaN(d) ? null : d }
  return null
}
async function importerPlanExcel(e) {
  const file = e.target.files && e.target.files[0]; if (e.target) e.target.value = ''
  if (!file) return
  msgImport.value = 'Lecture du plan…'
  try {
    const XLSX = await chargerXLSX()
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
    const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
    const parCode = {}
    for (const p of produits.value) if (p.code_pf) parCode[String(p.code_pf).trim().toLowerCase()] = p.id
    const feuilles = []
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false })
      if (!rows.length) continue
      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const head = Array.from(rows[r] || [], norm)
        const iCode = head.indexOf('code'); const iTaille = head.indexOf('taille')
        const iDebut = head.findIndex(h => (h || '').startsWith('debut est'))
        if (iCode >= 0 && iTaille >= 0 && iDebut >= 0) { const iLot = head.findIndex(h => (h || '').includes('lot')); feuilles.push({ rows, hi: r, iCode, iTaille, iDebut, iLot }); break }
      }
    }
    if (!feuilles.length) { msgImport.value = 'Aucune feuille reconnue (colonnes attendues : « Code », « Taille », « Début est. »).'; return }
    let nAjout = 0; const nonReconnus = new Set(); const dejaLots = new Set(groupes.value.map(g => g.numeroLot).filter(Boolean))
    for (const F of feuilles) {
      for (let i = F.hi + 1; i < F.rows.length; i++) {
        const row = F.rows[i]; if (!row) continue
        const code = String(row[F.iCode] == null ? '' : row[F.iCode]).trim(); if (!code) continue
        const t = Number(String(row[F.iTaille] == null ? '' : row[F.iTaille]).replace(/\s/g, '').replace(',', '.')); if (!t || isNaN(t) || t <= 0) continue
        const pid = parCode[code.toLowerCase()]
        if (!pid) { if (nonReconnus.size < 10) nonReconnus.add(code); continue }
        const p = prodById.value[pid]; if (!p) continue
        const numeroLot = F.iLot >= 0 && row[F.iLot] != null ? String(row[F.iLot]).trim() : null
        if (numeroLot && dejaLots.has(numeroLot)) continue
        if (numeroLot) dejaLots.add(numeroLot)
        const d = toDateImp(row[F.iDebut]); const ds = d ? d.toISOString().slice(0, 10) : null
        groupes.value.push({ id: seq++, numeroLot, produitId: p.id, totalBoites: Math.round(t), boitesParLot: Math.round(t), nbLots: 1, dateFixe: null, dateEcheance: ds })
        nAjout++
      }
    }
    msgImport.value = nAjout ? (nAjout + ' lot(s) importé(s) — ordonnancés par besoin conditionnement. Vérifie les lots à risque.' + (nonReconnus.size ? ' Codes non reconnus : ' + [...nonReconnus].join(', ') : '')) : 'Aucun lot reconnu (ou déjà importés).'
  } catch (err) { msgImport.value = 'Import impossible : ' + (err.message || err) }
}

// Durée de fabrication d'un lot (jours ouvrés) = somme des phases de gamme sur l'équipement le plus rapide.
function dureeJours(equip, produitId, boites) {
  const p = prodById.value[produitId]; if (!p) return 1
  const cad = cadMap.value[equip.id + '|' + produitId]
  if (!(cad > 0)) return 1
  const tl = Number(p.taille_lot) || 0, plk = Number(p.poids_lot_kg) || 0
  let qty = boites
  if (tl > 0 && plk > 0) qty = boites * plk / tl   // fabrication : kg ÷ (kg/h)
  return Math.max(1, Math.ceil((qty / cad) / hpj))
}
function dureeGroupe(g) {
  let total = 0
  for (const k of gammeProduit(g.produitId)) {
    const compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + g.produitId] > 0)
    if (!compat.length) continue
    let best = Infinity
    for (const e of compat) { const d = dureeJours(e, g.produitId, g.totalBoites); if (d < best) best = d }
    if (best < Infinity) total += best
  }
  return Math.max(1, total)
}
function atelierCondProduit(produitId) {
  const compat = equipements.value.filter(e => phaseDeType(e.type) === 'conditionnement' && cadMap.value[e.id + '|' + produitId] > 0)
  if (!compat.length) return null
  compat.sort((a, b) => (cadMap.value[b.id + '|' + produitId] || 0) - (cadMap.value[a.id + '|' + produitId] || 0))
  return compat[0].nom || compat[0].code || null
}

// Calendrier de jours ouvrés depuis la date de départ.
const joursOuvres = computed(() => {
  const out = []; const d = new Date(dateDepart.value + 'T00:00:00'); let guard = 0
  while (out.length < 1200 && guard < 2500) {
    const wd = d.getDay()
    if (!skipWeekend.value || (wd !== 0 && wd !== 6)) out.push(new Date(d))
    d.setDate(d.getDate() + 1); guard++
  }
  return out
})
function dateIdx(idx) { const a = joursOuvres.value; return a.length ? a[Math.max(0, Math.min(idx, a.length - 1))] : null }
function idxDeDate(ds) { if (!ds) return 0; const a = joursOuvres.value, t = new Date(ds + 'T00:00:00'); for (let i = 0; i < a.length; i++) if (a[i] >= t) return i; return 0 }
// Index du dernier jour ouvré <= date (−1 si la date précède le départ).
function idxAvant(d) { const a = joursOuvres.value; let res = -1; for (let i = 0; i < a.length; i++) { if (a[i] <= d) res = i; else break } return res }

// Déploiement : un lot par groupe (ordonné par échéance la plus proche = EDD).
const echVal = (g) => g.dateEcheance ? new Date(g.dateEcheance + 'T00:00:00').getTime() : Infinity
const lotsDeployes = computed(() => {
  const out = []
  const ordered = groupesFab.value.map((g, gi) => ({ g, gi })).sort((a, b) => (echVal(a.g) - echVal(b.g)) || (a.gi - b.gi))
  for (const { g, gi } of ordered) {
    if (avancer.value && g.numeroLot) { const sr = lotReelMap.value[String(g.numeroLot).trim()]; if (sr && sr.fini) continue }   // lot déjà fabriqué : capacité libérée, on laisse remonter les suivants
    let reste = g.totalBoites
    for (let i = 1; i <= g.nbLots; i++) {
      const b = Math.min(g.boitesParLot, reste); reste -= b
      out.push({ id: g.id * 1000 + i, groupeId: g.id, produitId: g.produitId, boites: b, num: i, numeroLot: g.numeroLot, couleur: couleur(gi), dateFixe: g.dateFixe, dateEcheance: g.dateEcheance || null })
    }
  }
  return out
})

// Placement réel : chaque lot enchaîne ses phases ; chaque phase démarre après la précédente ET la libération de l'équipement.
function simuler(lots) {
  const slots = {}
  const slotsDe = (e) => { if (!slots[e.id]) { const n = Math.max(1, Math.floor(Number(e.nb_machines) || 1)); slots[e.id] = new Array(n).fill(0) } return slots[e.id] }
  const rows = []
  for (const lt of lots) {
    const seqPh = gammeProduit(lt.produitId)
    const p = prodById.value[lt.produitId] || {}
    let prevEnd = lt.dateFixe ? Math.max(-1, idxDeDate(lt.dateFixe) - 1) : -1
    const phases = {}
    for (const k of seqPh) {
      if (avancer.value && lt.numeroLot && etapeFini(String(lt.numeroLot).trim(), k)) continue   // étape déjà faite sur son atelier → ne consomme plus de capacité
      const compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + lt.produitId] > 0)
      if (!compat.length) continue
      let eq = null, si = -1, libre = Infinity
      for (const e of compat) { const arr = slotsDe(e); for (let i = 0; i < arr.length; i++) if (arr[i] < libre) { libre = arr[i]; eq = e; si = i } }
      const duree = dureeJours(eq, lt.produitId, lt.boites)
      const start = Math.max(prevEnd + 1, slotsDe(eq)[si] || 0)
      const end = start + duree - 1
      phases[k] = { start, end, equip: eq.nom || eq.code, eqId: eq.id, slots: Math.max(1, Math.floor(Number(eq.nb_machines) || 1)), cad: cadMap.value[eq.id + '|' + lt.produitId] || 0 }
      slotsDe(eq)[si] = end + 1
      prevEnd = end
    }
    const ks = Object.keys(phases)
    const debutFab = ks.length ? Math.min(...ks.map(k => phases[k].start)) : null
    const finFab = ks.length ? Math.max(...ks.map(k => phases[k].end)) : null
    rows.push({ id: lt.id, num: lt.num, numeroLot: lt.numeroLot, produitId: lt.produitId, code: p.code_pf, desig: p.designation, boites: lt.boites, couleur: lt.couleur, phases, debutFab, finFab, dateEcheance: lt.dateEcheance || null, atelierCond: atelierCondProduit(lt.produitId) })
  }
  return rows
}
// Ordonnanceur « flux » (produire en avance) : dès qu'une machine se libère, on y place le lot disponible
// qui peut démarrer le plus tôt (départage par échéance). Les temps morts sont comblés par les lots suivants.
function simulerFlux(lots) {
  const slots = {}
  const slotsDe = (e) => { if (!slots[e.id]) slots[e.id] = new Array(Math.max(1, Math.floor(Number(e.nb_machines) || 1))).fill(0); return slots[e.id] }
  const compatCache = {}
  const getCompat = (produitId, k) => { const key = produitId + '|' + k; if (!compatCache[key]) compatCache[key] = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + produitId] > 0); return compatCache[key] }
  const L = lots.map(lt => {
    let seq = gammeProduit(lt.produitId)
    if (avancer.value && lt.numeroLot) { const ln = String(lt.numeroLot).trim(); seq = seq.filter(k => !etapeFini(ln, k)) }
    return { lt, seq, idx: 0, ready: lt.dateFixe ? idxDeDate(lt.dateFixe) : 0, phases: {}, ech: lt.dateEcheance ? new Date(lt.dateEcheance + 'T00:00:00').getTime() : Infinity }
  })
  let remaining = L.reduce((s, o) => s + o.seq.length, 0), guard = 0
  while (remaining > 0 && guard < 300000) {
    guard++
    let best = null
    for (const o of L) {
      if (o.idx >= o.seq.length) continue
      const k = o.seq[o.idx]
      const compat = getCompat(o.lt.produitId, k)
      if (!compat.length) { o.idx++; remaining--; continue }
      let eq = null, si = -1, start = Infinity
      for (const e of compat) { const arr = slotsDe(e); for (let i = 0; i < arr.length; i++) { const s = Math.max(o.ready, arr[i]); if (s < start) { start = s; eq = e; si = i } } }
      if (!eq) continue
      if (!best || start < best.start || (start === best.start && (o.ech < best.ech || (o.ech === best.ech && o.lt.id < best.o.lt.id)))) best = { o, k, eq, si, start, ech: o.ech }
    }
    if (!best) break
    const dur = dureeJours(best.eq, best.o.lt.produitId, best.o.lt.boites)
    const start = best.start, end = start + dur - 1
    best.o.phases[best.k] = { start, end, equip: best.eq.nom || best.eq.code, eqId: best.eq.id, slots: Math.max(1, Math.floor(Number(best.eq.nb_machines) || 1)), cad: cadMap.value[best.eq.id + '|' + best.o.lt.produitId] || 0 }
    slotsDe(best.eq)[best.si] = end + 1
    best.o.ready = end + 1
    best.o.idx++
    remaining--
  }
  const rows = []
  for (const o of L) {
    const p = prodById.value[o.lt.produitId] || {}
    const ks = Object.keys(o.phases)
    const debutFab = ks.length ? Math.min(...ks.map(k => o.phases[k].start)) : null
    const finFab = ks.length ? Math.max(...ks.map(k => o.phases[k].end)) : null
    rows.push({ id: o.lt.id, num: o.lt.num, numeroLot: o.lt.numeroLot, produitId: o.lt.produitId, code: p.code_pf, desig: p.designation, boites: o.lt.boites, couleur: o.lt.couleur, phases: o.phases, debutFab, finFab, dateEcheance: o.lt.dateEcheance || null, atelierCond: atelierCondProduit(o.lt.produitId) })
  }
  return rows
}
const planning = computed(() => (produireAvance.value ? simulerFlux : simuler)(lotsDeployes.value))
const finGlobale = computed(() => { let m = 0; for (const r of planning.value) for (const k in r.phases) m = Math.max(m, r.phases[k].end); return m })

// Table combinée : ordre proposé + risque par lot.
const tableauOrdo = computed(() => {
  const gById = {}; for (const g of groupesFab.value) gById[g.id] = g
  const rows = []
  for (const r of planning.value) {
    const g = gById[Math.floor(r.id / 1000)]; if (!g) continue
    const besoin = g.dateEcheance ? new Date(g.dateEcheance + 'T00:00:00') : null
    const dureeJ = dureeGroupe(g)
    const debut = r.debutFab != null ? dateIdx(r.debutFab) : null
    const fin = r.finFab != null ? dateIdx(r.finFab) : null
    let dateLimite = null, echPassee = false, limiteDepassee = false
    if (besoin) {
      const ib = idxAvant(besoin)
      if (ib < 0) { echPassee = true }
      else { const il = ib - (dureeJ - 1); dateLimite = il >= 0 ? dateIdx(il) : dateIdx(0); if (il < 0) echPassee = true }
      if (dateLimite && debut && debut > dateLimite) limiteDepassee = true
    }
    const marge = (besoin && fin) ? Math.round((besoin - fin) / 86400000) : null
    rows.push({ code: r.code, desig: r.desig, numeroLot: r.numeroLot, boites: r.boites, besoin, dureeJ, debut, fin, dateLimite, echPassee, limiteDepassee, marge, enRetard: marge != null && marge < 0, atelierCond: r.atelierCond })
  }
  rows.sort((a, b) => (a.besoin ? a.besoin.getTime() : 8.64e15) - (b.besoin ? b.besoin.getTime() : 8.64e15) || (a.marge ?? 1e9) - (b.marge ?? 1e9))
  return rows
})
function margeClass(m) { if (m == null) return ''; if (m < 0) return 'm-late'; if (m <= 2) return 'm-tight'; return 'm-ok' }
function margeTxt(m) { if (m == null) return '—'; if (m < 0) return m + ' j'; if (m === 0) return 'juste'; return '+' + m + ' j' }

const kpiOrdo = computed(() => {
  const rows = tableauOrdo.value
  const avec = rows.filter(r => r.marge != null)
  const retard = avec.filter(r => r.marge < 0).length
  const tendus = avec.filter(r => r.marge >= 0 && r.marge <= 2).length
  return { total: rows.length, nRetard: retard, nTendus: tendus, nTemps: avec.length - retard, taux: avec.length ? Math.round((avec.length - retard) / avec.length * 100) : 100 }
})

// Charge par atelier (occupation sur l'horizon) → goulot.
const chargeSimple = computed(() => {
  const m = {}
  let gmin = Infinity, gmax = -Infinity
  for (const r of planning.value) for (const k in r.phases) {
    const ph = r.phases[k]; const cle = (PHASE_NOM[k] || k) + '§' + ph.equip
    if (ph.start < gmin) gmin = ph.start; if (ph.end > gmax) gmax = ph.end
    if (!m[cle]) m[cle] = { phase: PHASE_NOM[k] || k, equip: ph.equip, busy: 0, lots: 0, slots: ph.slots || 1 }
    m[cle].busy += ph.end - ph.start + 1; m[cle].lots++
  }
  const horizon = (gmax >= gmin) ? (gmax - gmin + 1) : 1
  const rows = Object.values(m).map(a => ({ ...a, occ: horizon > 0 ? Math.min(100, Math.round(a.busy / (horizon * (a.slots || 1)) * 100)) : 0 })).sort((x, y) => y.occ - x.occ || y.busy - x.busy)
  return { rows, horizon }
})
function chargeClass(o) { if (o >= 100) return 'ch-over'; if (o >= 85) return 'ch-high'; if (o >= 50) return 'ch-mid'; return 'ch-low' }

// Plan prévisionnel par atelier : pour chaque équipement, les lots dans l'ordre (entrée → sortie).
const ORDRE_PH = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage', 'Pelliculage']
const planParAtelier = computed(() => {
  const by = {}
  for (const r of planning.value) {
    for (const k in r.phases) {
      const ph = r.phases[k]
      const eq = eqById.value[ph.eqId]
      const atel = (eq && eq.atelier_id != null) ? atelierById.value[eq.atelier_id] : null
      const phaseNom = PHASE_NOM[k] || k
      const cle = ph.equip + '§' + phaseNom   // un bloc par équipement (dans sa phase)
      if (!by[cle]) by[cle] = { phase: phaseNom, phaseKey: k, equip: ph.equip, eqId: ph.eqId, atelier: atel, slots: ph.slots || 1, lots: [] }
      by[cle].lots.push({ code: r.code, desig: r.desig, produitId: r.produitId, numeroLot: r.numeroLot, phaseKey: k, equip: ph.equip, cad: ph.cad || 0, boites: r.boites, couleur: r.couleur, entree: dateIdx(ph.start), sortie: dateIdx(ph.end), startIdx: ph.start, endIdx: ph.end, besoin: r.dateEcheance ? new Date(r.dateEcheance + 'T00:00:00') : null })
    }
  }
  const list = Object.values(by)
  for (const a of list) {
    a.lots.sort((x, y) => x.startIdx - y.startIdx)
    let prevEnd = null; a.busy = 0
    for (const l of a.lots) { l.gap = (prevEnd != null && l.startIdx > prevEnd + 1) ? (l.startIdx - prevEnd - 1) : 0; a.busy += l.endIdx - l.startIdx + 1; prevEnd = l.endIdx; l.margeJ = (l.besoin && l.sortie) ? Math.round((l.besoin - l.sortie) / 86400000) : null; l.late = l.margeJ != null && l.margeJ < 0; l.statut = l.margeJ == null ? 'st-none' : (l.margeJ < 0 ? 'st-late' : (l.margeJ <= 2 ? 'st-tight' : 'st-ok')); const lot = (l.numeroLot && l.phaseKey) ? String(l.numeroLot).trim() : null; const er = lot ? etapeReelMap.value[lot + '|' + l.phaseKey] : null; l.fini = lot ? etapeFini(lot, l.phaseKey) : false; l.enCours = !l.fini && !!(er && er.enCours) }
    a.premier = a.lots.length ? a.lots[0].entree : null
    a.dernier = a.lots.length ? a.lots[a.lots.length - 1].sortie : null
    a.nbSlots = a.slots || 1
  }
  return list.sort((a, b) => (ORDRE_PH.indexOf(a.phase) - ORDRE_PH.indexOf(b.phase)) || String(a.equip).localeCompare(String(b.equip)))
})
// Filtre d'horizon (comme ORBIT : mois en cours / 2 / 3 mois) + regroupement par équipement.
const horizonSel = ref(0)
const fenetre = computed(() => {
  if (!horizonSel.value) return null
  const n = new Date()
  return { debut: new Date(n.getFullYear(), n.getMonth(), 1), fin: new Date(n.getFullYear(), n.getMonth() + horizonSel.value, 0, 23, 59, 59) }
})
const planParAtelierVue = computed(() => {
  const f = fenetre.value
  let list = planParAtelier.value
  if (f) list = list.map(a => ({ ...a, lots: a.lots.filter(l => l.sortie >= f.debut && l.entree <= f.fin) })).filter(a => a.lots.length)
  // Horizon d'occupation = jours ouvrés de la période réellement affichée (fenêtre choisie, sinon étendue des lots affichés).
  let gmin = Infinity, gmax = -Infinity
  for (const a of list) for (const l of a.lots) { if (l.startIdx < gmin) gmin = l.startIdx; if (l.endIdx > gmax) gmax = l.endIdx }
  const spanDisp = (gmax >= gmin) ? (gmax - gmin + 1) : 1
  const horizon = f ? (joursOuvres.value.filter(d => d >= f.debut && d <= f.fin).length || spanDisp) : spanDisp
  return list.map(a => {
    const lots = a.lots; const nbSlots = a.nbSlots || 1
    const boites = lots.reduce((s, l) => s + (l.boites || 0), 0)
    const busy = lots.reduce((s, l) => s + (l.endIdx - l.startIdx + 1), 0)
    const nLate = lots.filter(l => l.statut === 'st-late' && !l.fini).length
    const nTight = lots.filter(l => l.statut === 'st-tight' && !l.fini).length
    const nFini = lots.filter(l => l.fini).length
    const premier = lots.length ? lots[0].entree : null
    const dernier = lots.length ? lots[lots.length - 1].sortie : null
    // Regroupement par produit (campagne), dans l'ordre d'apparition.
    const byP = new Map()
    for (const l of lots) { if (!byP.has(l.code)) byP.set(l.code, { code: l.code, desig: l.desig, couleur: l.couleur, produitId: l.produitId, cad: l.cad || 0, lots: [], boites: 0 }); const g = byP.get(l.code); g.lots.push(l); g.boites += l.boites || 0 }
    const produits = [...byP.values()].map(g => {
      g.premier = g.lots[0].entree; g.dernier = g.lots[g.lots.length - 1].sortie
      g.besoinMin = g.lots.reduce((m, l) => (l.besoin && (!m || l.besoin < m)) ? l.besoin : m, null)
      return g
    }).sort((a, b) => (a.premier ? a.premier.getTime() : 8.64e15) - (b.premier ? b.premier.getTime() : 8.64e15) || ((a.besoinMin ? a.besoinMin.getTime() : 8.64e15) - (b.besoinMin ? b.besoinMin.getTime() : 8.64e15)))
    // Ruptures de mois calculées après tri, dans l'ordre d'affichage des lots de chaque campagne.
    for (const g of produits) { let pm = null; for (const l of g.lots) { const m = l.entree ? (l.entree.getMonth() + '-' + l.entree.getFullYear()) : null; l.moisBreak = (pm != null && m !== pm); pm = m } }
    return { phase: a.phase, phaseKey: a.phaseKey, equip: a.equip, atelier: a.atelier, eqId: a.eqId, lots, boites, busy, occ: horizon > 0 ? Math.min(100, Math.round(busy / (horizon * nbSlots) * 100)) : 0, nLate, nTight, nFini, premier, dernier, nProd: produits.length, produits }
  })
})
// Regroupement par PHASE : chaque phase → ses équipements (planning par équipement selon la cadence).
const planParPhaseVue = computed(() => {
  const by = new Map()
  for (const a of planParAtelierVue.value) { if (!by.has(a.phase)) by.set(a.phase, { phase: a.phase, equips: [], nLots: 0 }); const g = by.get(a.phase); g.equips.push(a); g.nLots += a.lots.length }
  return [...by.values()].sort((x, y) => ORDRE_PH.indexOf(x.phase) - ORDRE_PH.indexOf(y.phase))
})
function fmtDateShort(d) { return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '' }
function moisCourt(d) { return d ? d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '' }

// --- Réalisation (réel) : historique des opérations par équipement / atelier ---
const atelierById = computed(() => { const m = {}; for (const a of ateliers.value) m[a.id] = a.nom || a.code; return m })
const eqById = computed(() => { const m = {}; for (const e of equipements.value) m[e.id] = e; return m })
const ofById = computed(() => { const m = {}; for (const o of ofs.value) { const pr = o.produits || prodById.value[o.produit_id] || {}; m[o.id] = { lot: o.numero_lot || '—', code: pr.code_pf || '?', desig: pr.designation || '' } } return m })
// Statut réel d'un lot (par N° de lot) : terminé si la fabrication est finie.
const lotReelMap = computed(() => { const m = {}; for (const o of ofs.value) { if (!o.numero_lot) continue; const k = String(o.numero_lot).trim(); const fini = !!o.date_fin_fabrication; m[k] = { fini, enCours: !fini && (!!o.date_lancement || /cours|lanc|demarr/i.test(o.statut || '')) } } return m })
// Statut réel par ÉTAPE (phase) d'un lot — fin de l'étape sur son atelier (historique des opérations).
const etapeReelMap = computed(() => {
  const ofLot = {}; for (const o of ofs.value) if (o.numero_lot) ofLot[o.id] = String(o.numero_lot).trim()
  const m = {}
  for (const r of suiviPhases.value) {
    const lot = ofLot[r.ordre_id]; if (!lot) continue
    const k = phaseKeyFromName(r.phase); if (!k || k === 'conditionnement') continue
    const fini = !!r.date_phase || /termin|fini|clotur|achev/i.test(r.statut || '')
    const enCours = !fini && (!!r.date_debut || /cours|lanc|demarr/i.test(r.statut || ''))
    const key = lot + '|' + k, prev = m[key]
    if (!prev) m[key] = { fini, enCours }
    else if (fini) { prev.fini = true; prev.enCours = false } else if (enCours && !prev.fini) prev.enCours = true
  }
  return m
})
// Une étape est faite si son suivi de phase est terminé, ou si l'OF entier est fini (repli).
function etapeFini(lot, k) { const e = etapeReelMap.value[lot + '|' + k]; if (e && e.fini) return true; const w = lotReelMap.value[lot]; return !!(w && w.fini) }
function phaseCourtNom(p) { const k = phaseKeyFromName(p); return k ? PHASE_NOM[k] : p }
function realStatut(s) { const t = (s || '').toLowerCase(); if (/termin|fini|clotur|achev/.test(t)) return 're-fin'; if (/cours|encours|en_cours|lanc|demarr/.test(t)) return 're-enc'; return 're-oth' }
function realStatutTxt(s) { const c = realStatut(s); return c === 're-fin' ? 'Terminé' : c === 're-enc' ? 'En cours' : (s || '—') }
function dOp(o) { const d = o.fin || o.debut; return d ? d.getTime() : 0 }
// Fenêtre réalisation : rétrospective (mois en cours / 2 / 3 derniers mois).
const fenetreReal = computed(() => {
  if (!horizonSel.value) return null
  const n = new Date()
  return { debut: new Date(n.getFullYear(), n.getMonth() - (horizonSel.value - 1), 1), fin: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59) }
})
const realisationParEquip = computed(() => {
  const f = fenetreReal.value
  const byEq = {}
  for (const r of suiviPhases.value) {
    const eqId = r.equipement_id; if (!eqId) continue
    const eq = eqById.value[eqId]; if (!eq) continue
    const k = phaseDeType(eq.type); if (!k || k === 'conditionnement') continue   // fabrication seulement
    const dRef = r.date_phase || r.date_debut; const dd = dRef ? new Date(dRef) : null
    if (f && (!dd || dd < f.debut || dd > f.fin)) continue
    if (!byEq[eqId]) byEq[eqId] = { equip: eq.nom || eq.code, atelier: atelierById.value[eq.atelier_id] || '—', phase: PHASE_NOM[k] || eq.type, ops: [] }
    const of = ofById.value[r.ordre_id] || {}
    byEq[eqId].ops.push({ lot: of.lot, code: of.code, desig: of.desig, phase: r.phase, debut: r.date_debut ? new Date(r.date_debut) : null, fin: r.date_phase ? new Date(r.date_phase) : null, qteS: Number(r.quantite_sortie) || 0, qteE: Number(r.quantite_entree) || 0, statut: r.statut, sc: realStatut(r.statut) })
  }
  const list = Object.values(byEq)
  for (const a of list) {
    a.ops.sort((x, y) => dOp(x) - dOp(y))
    a.nLots = new Set(a.ops.map(o => o.lot)).size
    a.nOps = a.ops.length
    a.nEnc = a.ops.filter(o => o.sc === 're-enc').length
    a.nFin = a.ops.filter(o => o.sc === 're-fin').length
    const ds = a.ops.map(dOp).filter(Boolean)
    a.premier = ds.length ? new Date(Math.min(...ds)) : null
    a.dernier = ds.length ? new Date(Math.max(...ds)) : null
  }
  return list.sort((a, b) => String(a.atelier).localeCompare(String(b.atelier)) || (ORDRE_PH.indexOf(a.phase) - ORDRE_PH.indexOf(b.phase)) || String(a.equip).localeCompare(String(b.equip)))
})

// Phases de gamme sans équipement cadencé.
const phasesManquantes = computed(() => {
  const out = [], seen = new Set()
  for (const g of groupesFab.value) {
    const p = prodById.value[g.produitId] || {}
    for (const k of gammeProduit(g.produitId)) {
      const ok = equipements.value.some(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + g.produitId] > 0)
      if (!ok) { const key = g.produitId + '|' + k; if (!seen.has(key)) { seen.add(key); out.push({ code: p.code_pf, desig: p.designation, phase: PHASE_NOM[k] }) } }
    }
  }
  return out
})
</script>

<style scoped>
.ordo { max-width: 1240px; margin: 0 auto; padding: 6px 4px 24px; }
.ordo-head { margin-bottom: 20px; }
.oh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.oh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.oh-sub { font-size: 13.5px; color: #64748b; max-width: 980px; line-height: 1.5; }

.card { background: #fff; border: 1px solid #e6e9f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { font-size: 15px; font-weight: 700; color: #1a2233; margin: 0 0 4px; }
.card-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.muted { color: #64748b; font-size: 12.5px; }

.add-grid { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: flex-end; }
.add-field { display: flex; flex-direction: column; gap: 4px; }
.add-field.grow { flex: 1 1 280px; min-width: 240px; }
.add-field label { font-size: 11px; font-weight: 600; color: #475569; }
.add-field input, .add-field select { border: 1px solid #d5dae3; border-radius: 9px; padding: 8px 10px; font-size: 13px; background: #fff; }
.add-field input[type=number] { width: 120px; }
.prod-search { margin-bottom: 6px; }
.chk-wk .wk { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #334155; font-weight: 500; white-space: nowrap; }
.btn-add { background: #0f766e; color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; height: 38px; }
.btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }
.add-import { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.btn-import { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 9px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-import.excel { background: #eef2ff; color: #3730a3; border-color: #c7d2fe; }
.import-hint { font-size: 11.5px; color: #94a3b8; }
.msg-import { margin: 10px 0 0; font-size: 12.5px; color: #0f766e; font-weight: 500; }
.btn-reset { background: #fff; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.plan-sum { padding: 14px 20px; }
.plan-excl { font-weight: 500; color: #94a3b8; font-size: 12.5px; }

.kpi-line { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.kpi-mini { flex: 1 1 140px; background: #fff; border: 1px solid #e6e9f0; border-radius: 12px; padding: 12px 14px; text-align: center; }
.kpi-mini.km-warn { background: #fef2f2; border-color: #fecaca; }
.kpi-mini.km-tendu { background: #fff7ed; border-color: #fed7aa; }
.km-val { font-size: 20px; font-weight: 800; color: #1a2233; }
.km-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }

.risk-ok { background: #ecfdf5; border-color: #a7f3d0; }
.risk-bad { background: #fef2f2; border-color: #fecaca; }
.risk-txt { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }

.logic-flow { display: flex; align-items: stretch; gap: 6px; flex-wrap: wrap; margin: 0 0 16px; }
.lf-step { flex: 1 1 180px; min-width: 160px; display: flex; gap: 9px; align-items: flex-start; background: #f8fafc; border: 1px solid #eef1f6; border-radius: 10px; padding: 10px 12px; }
.lf-n { flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%; background: #0f766e; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.lf-txt { display: flex; flex-direction: column; gap: 2px; }
.lf-txt strong { font-size: 12.5px; color: #1a2233; }
.lf-txt span { font-size: 11px; color: #64748b; line-height: 1.35; }
.lf-arrow { align-self: center; color: #0f766e; font-weight: 800; font-size: 16px; }
.th-sub { font-weight: 500; font-size: 10px; color: #0f766e; text-transform: none; }
.ordo-besoin { font-weight: 700; color: #0f766e; }
@media (max-width: 760px) { .lf-arrow { display: none; } }
.tbl-wrap { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 12.5px; }
table.grid th { text-align: left; font-weight: 600; color: #475569; padding: 7px 10px; border-bottom: 2px solid #e6e9f0; white-space: nowrap; background: #f8fafc; }
table.grid td { padding: 7px 10px; border-bottom: 1px solid #eef1f6; color: #1f2937; }
.ta-c { text-align: center; } .ta-r { text-align: right; }
.row-late td { background: #fef2f2; }
.ordo-rang { font-weight: 700; color: #0f766e; }
.lot-desig { color: #64748b; }
.lot-num { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 600; color: #3730a3; background: #eef2ff; border-radius: 5px; padding: 1px 6px; }
.ordo-date { font-variant-numeric: tabular-nums; }
.sortie-late { color: #b91c1c; font-weight: 600; }
.ordo-limite { font-variant-numeric: tabular-nums; }
.lim-pass { color: #b91c1c; font-weight: 600; }
.lim-tight { color: #c2410c; font-weight: 600; }
.marge { display: inline-block; font-weight: 700; border-radius: 6px; padding: 1px 8px; font-size: 12px; }
.marge.m-late { background: #fee2e2; color: #b91c1c; }
.marge.m-tight { background: #ffedd5; color: #c2410c; }
.marge.m-ok { background: #dcfce7; color: #047857; }

.charge-list { display: flex; flex-direction: column; gap: 8px; }
.charge-row { display: grid; grid-template-columns: 240px 1fr 54px auto; align-items: center; gap: 12px; padding: 6px 8px; border-radius: 9px; }
.charge-row.charge-bottleneck { background: #fff7ed; }
.ch-lbl { font-size: 12px; color: #334155; }
.ch-phase { font-weight: 600; }
.ch-eq { color: #64748b; }
.ch-gl { margin-left: 6px; font-size: 10px; font-weight: 700; color: #c2410c; background: #ffedd5; border-radius: 5px; padding: 1px 6px; text-transform: uppercase; }
.ch-track { background: #eef1f6; border-radius: 6px; height: 12px; overflow: hidden; }
.ch-fill { height: 100%; border-radius: 6px; }
.ch-fill.ch-over { background: #b91c1c; } .ch-fill.ch-high { background: #ea580c; } .ch-fill.ch-mid { background: #0f766e; } .ch-fill.ch-low { background: #94a3b8; }
.ch-pct { font-size: 12px; font-weight: 700; color: #1a2233; text-align: right; }
.ch-meta { font-size: 11px; color: #94a3b8; white-space: nowrap; }

.at-phase { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #0f766e; background: #ecfdf5; border-radius: 5px; padding: 2px 7px; }
.lot-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

/* Planning par équipement — files de lots (style tableau de production) */
.range-sel { display: inline-flex; background: #f1f5f9; border-radius: 8px; padding: 2px; gap: 2px; }
.range-sel button { border: none; background: transparent; font-size: 11.5px; font-weight: 600; color: #64748b; padding: 5px 10px; border-radius: 6px; cursor: pointer; }
.range-sel button.on { background: #fff; color: #0f766e; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.leg-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; vertical-align: middle; margin: 0 1px; }
.leg-dot.st-ok { background: #10b981; } .leg-dot.st-tight { background: #f59e0b; } .leg-dot.st-late { background: #ef4444; }
.phase-group { margin-bottom: 20px; }
.phase-head { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e6e9f0; }
.phase-head .at-phase { font-size: 12px; padding: 3px 10px; }
.ph-sub { font-size: 11.5px; color: #94a3b8; }
.phase-group .eq-board { margin-left: 10px; }
.pg-cad { color: #0f766e; font-weight: 600; }
.eq-board { border: 1px solid #eef1f6; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }
.eq-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #eef1f6; }
.eq-id { display: flex; align-items: center; gap: 8px; }
.eq-id strong { font-size: 13px; color: #1a2233; }
.eq-occ { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; white-space: nowrap; }
.eq-occ.ch-over, .eq-occ.ch-high { background: #fef2f2; color: #b91c1c; }
.eq-occ.ch-mid { background: #ecfdf5; color: #047857; }
.eq-occ.ch-low { background: #f1f5f9; color: #64748b; }
.eq-kpis { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; background: #fcfdfe; border-bottom: 1px solid #eef1f6; }
.eqk { flex: 1 1 120px; min-width: 108px; border: 1px solid #eef1f6; border-radius: 8px; padding: 7px 10px; background: #fff; }
.eqk-bad { background: #fef2f2; border-color: #fecaca; }
.eqk-l { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.eqk-v { font-size: 17px; font-weight: 800; color: #1a2233; margin-top: 1px; }
.eqk-v.eqk-sm { font-size: 12px; font-variant-numeric: tabular-nums; }
.eqk-s { font-size: 10px; color: #94a3b8; margin-top: 1px; }
.prod-group { display: grid; grid-template-columns: 200px 1fr; border-bottom: 1px solid #f1f4f9; }
.prod-group:last-child { border-bottom: none; }
.pg-label { display: flex; gap: 8px; padding: 10px 12px; border-right: 1px solid #eef1f6; background: #fff; }
.pg-bar { width: 3px; border-radius: 2px; flex: 0 0 3px; }
.pg-txt strong { font-size: 12px; color: #1a2233; }
.pg-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; font-variant-numeric: tabular-nums; }
.lot-cards { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; align-items: stretch; }
@media (max-width: 720px) { .prod-group { grid-template-columns: 1fr; } .pg-label { border-right: none; border-bottom: 1px solid #eef1f6; } }
.mois-sep { display: flex; align-items: center; font-size: 10px; font-weight: 700; color: #0f766e; background: #ecfdf5; border-radius: 5px; padding: 2px 7px; text-transform: capitalize; }
.lot-card { width: 128px; border: 1px solid #e6e9f0; border-left-width: 3px; border-radius: 8px; padding: 7px 9px; background: #fff; cursor: default; }
.lot-card.st-ok { border-left-color: #10b981; }
.lot-card.st-tight { border-left-color: #f59e0b; }
.lot-card.st-late { border-left-color: #ef4444; background: #fef2f2; }
.lot-card.st-none { border-left-color: #cbd5e1; }
.lc-top { display: flex; align-items: center; gap: 5px; }
.lc-idx { font-size: 10px; color: #94a3b8; font-weight: 700; }
.lc-num { font-size: 14px; font-weight: 800; color: #1a2233; letter-spacing: -.01em; }
.lc-dot { margin-left: auto; width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
.lc-dot.st-ok { background: #10b981; } .lc-dot.st-tight { background: #f59e0b; } .lc-dot.st-late { background: #ef4444; }
.lc-prod { font-size: 10.5px; color: #475569; font-weight: 600; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lc-line { font-size: 10px; color: #64748b; margin-top: 3px; font-variant-numeric: tabular-nums; }
.lc-need.lc-late { color: #b91c1c; font-weight: 700; }
/* Réalisation (réel) */
.head-ctrls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.av-chk { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #334155; white-space: nowrap; cursor: pointer; background: #f1f5f9; border-radius: 8px; padding: 5px 10px; }
.av-chk input { accent-color: #0f766e; }
.eq-atelier { font-size: 11px; color: #94a3b8; }
.eq-machines { font-size: 11px; color: #94a3b8; }
.eq-machines::before { content: '⚙ '; }
.re-enc-badge { background: #dbeafe; color: #1d4ed8; }
.lot-card.re-fin { border-left-color: #10b981; }
.lot-card.re-enc { border-left-color: #3b82f6; background: #eff6ff; }
.lot-card.re-oth { border-left-color: #cbd5e1; }
.leg-dot.re-fin { background: #10b981; } .leg-dot.re-enc { background: #3b82f6; }
.lc-badge { margin-left: auto; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 5px; white-space: nowrap; }
.lc-badge.re-fin { background: #dcfce7; color: #047857; }
.lc-badge.re-enc { background: #dbeafe; color: #1d4ed8; }
.lc-badge.re-oth { background: #f1f5f9; color: #64748b; }
/* Lot terminé (grisé) / en cours sur la vue prévision */
.lot-card.lot-done { opacity: .5; background: #f1f5f9; border-left-color: #cbd5e1 !important; }
.lot-card.lot-done .lc-num { color: #64748b; }
.lot-card.lot-enc { border-left-color: #3b82f6; }
.lc-fini { margin-left: auto; width: 15px; height: 15px; border-radius: 50%; background: #10b981; color: #fff; font-size: 9px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
.lc-dot.dot-enc { background: #3b82f6; }
.leg-sq { display: inline-block; width: 10px; height: 10px; border-radius: 3px; vertical-align: middle; margin: 0 1px; }
.leg-sq.lot-done-leg { background: #cbd5e1; }

.warn-card { background: #fff7ed; border-color: #fed7aa; }
.warn-txt { font-size: 12.5px; color: #9a3412; margin: 0 0 8px; }
.manq-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.manq-item { font-size: 12.5px; color: #334155; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.manq-item:hover { background: #fff; }
.manq-ph { font-weight: 600; color: #c2410c; }
.manq-go { font-size: 11px; color: #0f766e; }
</style>
