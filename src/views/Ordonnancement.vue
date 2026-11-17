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

    <!-- Résumé du plan -->
    <section v-if="groupes.length" class="card plan-sum">
      <div class="card-head-row">
        <h2 class="card-title">Plan — {{ nbProduits }} produit(s) · {{ groupes.length }} lot(s)</h2>
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

    <!-- Ordonnancement proposé (table combinée) -->
    <section v-if="planning.length" class="card">
      <h2 class="card-title">Ordonnancement proposé — par besoin conditionnement</h2>
      <p class="muted" style="margin:0 0 12px">
        Ordre = besoin le plus proche d'abord (EDD). <strong>Durée fab</strong> = temps de gamme selon la cadence atelier.
        <strong>Limite début</strong> = dernière date pour lancer la fabrication sans dépasser le besoin (rétro-planning). <strong>Marge</strong> = jours entre la fin de fabrication proposée et le besoin.
      </p>
      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr>
              <th class="ta-c">#</th>
              <th>Produit / Lot</th>
              <th class="ta-r">Boîtes</th>
              <th class="ta-c">Besoin cond.</th>
              <th class="ta-c">Atelier cond.</th>
              <th class="ta-r">Durée fab</th>
              <th class="ta-c">Début fab proposé</th>
              <th class="ta-c">Fin fab proposée</th>
              <th class="ta-c">Limite début</th>
              <th class="ta-r">Marge</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in tableauOrdo" :key="i" :class="{ 'row-late': r.enRetard }">
              <td class="ta-c ordo-rang">{{ i + 1 }}</td>
              <td>
                <strong>{{ r.code }}</strong> <span class="lot-desig">{{ r.desig }}</span>
                <span v-if="r.numeroLot" class="lot-num">Lot {{ r.numeroLot }}</span>
              </td>
              <td class="ta-r">{{ fmt(r.boites) }}</td>
              <td class="ta-c">{{ r.besoin ? fmtDate(r.besoin) : '—' }}</td>
              <td class="ta-c lot-desig">{{ r.atelierCond || '—' }}</td>
              <td class="ta-r">{{ r.dureeJ }} j</td>
              <td class="ta-c ordo-date">{{ r.debut ? fmtDate(r.debut) : '—' }}</td>
              <td class="ta-c ordo-date" :class="{ 'sortie-late': r.enRetard }">{{ r.fin ? fmtDate(r.fin) : '—' }}</td>
              <td class="ta-c ordo-limite">
                <span v-if="r.echPassee" class="lim-pass" title="Le besoin est déjà passé — lot en retard dès le départ">dépassée</span>
                <span v-else-if="r.dateLimite" :class="{ 'lim-tight': r.limiteDepassee }" :title="r.limiteDepassee ? 'Début proposé après la date limite — risque de retard' : 'Dernière date pour démarrer à temps'">{{ fmtDate(r.dateLimite) }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td class="ta-r"><span class="marge" :class="margeClass(r.marge)">{{ margeTxt(r.marge) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted" style="margin-top:8px">
        <span class="marge m-late">rouge</span> = en retard (fab finie après le besoin) · <span class="marge m-tight">orange</span> = tendu (≤ 2 j) · <span class="marge m-ok">vert</span> = confortable.
      </p>
    </section>

    <!-- Charge par atelier (goulot) -->
    <section v-if="planning.length && chargeSimple.rows.length" class="card">
      <h2 class="card-title">Charge par atelier — repérer le goulot</h2>
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
  const [rp, re, rc] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite, taille_lot, poids_lot_kg, gamme').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode'))
  ])
  produits.value = rp; equipements.value = re; cadences.value = rc; chargement.value = false
  chargerLocal()
})

watch([groupes, dateDepart, skipWeekend], sauvegarderLocal, { deep: true })

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
const nbProduits = computed(() => new Set(groupes.value.map(g => g.produitId)).size)

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
  try { localStorage.setItem(LS_KEY, JSON.stringify({ groupes: groupes.value, dateDepart: dateDepart.value, skipWeekend: skipWeekend.value, seq })) } catch (e) {}
}
function chargerLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return
    const d = JSON.parse(raw)
    if (Array.isArray(d.groupes)) groupes.value = d.groupes
    if (d.dateDepart) dateDepart.value = d.dateDepart
    if (typeof d.skipWeekend === 'boolean') skipWeekend.value = d.skipWeekend
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
  const ordered = groupes.value.map((g, gi) => ({ g, gi })).sort((a, b) => (echVal(a.g) - echVal(b.g)) || (a.gi - b.gi))
  for (const { g, gi } of ordered) {
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
      const compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + lt.produitId] > 0)
      if (!compat.length) continue
      let eq = null, si = -1, libre = Infinity
      for (const e of compat) { const arr = slotsDe(e); for (let i = 0; i < arr.length; i++) if (arr[i] < libre) { libre = arr[i]; eq = e; si = i } }
      const duree = dureeJours(eq, lt.produitId, lt.boites)
      const start = Math.max(prevEnd + 1, slotsDe(eq)[si] || 0)
      const end = start + duree - 1
      phases[k] = { start, end, equip: eq.nom || eq.code }
      slotsDe(eq)[si] = end + 1
      prevEnd = end
    }
    const ks = Object.keys(phases)
    const debutFab = ks.length ? Math.min(...ks.map(k => phases[k].start)) : null
    const finFab = ks.length ? Math.max(...ks.map(k => phases[k].end)) : null
    rows.push({ id: lt.id, num: lt.num, numeroLot: lt.numeroLot, code: p.code_pf, desig: p.designation, boites: lt.boites, couleur: lt.couleur, phases, debutFab, finFab, dateEcheance: lt.dateEcheance || null, atelierCond: atelierCondProduit(lt.produitId) })
  }
  return rows
}
const planning = computed(() => simuler(lotsDeployes.value))
const finGlobale = computed(() => { let m = 0; for (const r of planning.value) for (const k in r.phases) m = Math.max(m, r.phases[k].end); return m })

// Table combinée : ordre proposé + risque par lot.
const tableauOrdo = computed(() => {
  const gById = {}; for (const g of groupes.value) gById[g.id] = g
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
  const horizon = finGlobale.value + 1
  const m = {}
  for (const r of planning.value) for (const k in r.phases) {
    const ph = r.phases[k]; const cle = (PHASE_NOM[k] || k) + '§' + ph.equip
    if (!m[cle]) m[cle] = { phase: PHASE_NOM[k] || k, equip: ph.equip, busy: 0, lots: 0 }
    m[cle].busy += ph.end - ph.start + 1; m[cle].lots++
  }
  const rows = Object.values(m).map(a => ({ ...a, occ: horizon > 0 ? Math.round(a.busy / horizon * 100) : 0 })).sort((x, y) => y.occ - x.occ || y.busy - x.busy)
  return { rows, horizon }
})
function chargeClass(o) { if (o >= 100) return 'ch-over'; if (o >= 85) return 'ch-high'; if (o >= 50) return 'ch-mid'; return 'ch-low' }

// Phases de gamme sans équipement cadencé.
const phasesManquantes = computed(() => {
  const out = [], seen = new Set()
  for (const g of groupes.value) {
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

.kpi-line { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.kpi-mini { flex: 1 1 140px; background: #fff; border: 1px solid #e6e9f0; border-radius: 12px; padding: 12px 14px; text-align: center; }
.kpi-mini.km-warn { background: #fef2f2; border-color: #fecaca; }
.kpi-mini.km-tendu { background: #fff7ed; border-color: #fed7aa; }
.km-val { font-size: 20px; font-weight: 800; color: #1a2233; }
.km-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }

.risk-ok { background: #ecfdf5; border-color: #a7f3d0; }
.risk-bad { background: #fef2f2; border-color: #fecaca; }
.risk-txt { margin: 0; font-size: 13px; color: #334155; line-height: 1.5; }

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

.warn-card { background: #fff7ed; border-color: #fed7aa; }
.warn-txt { font-size: 12.5px; color: #9a3412; margin: 0 0 8px; }
.manq-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.manq-item { font-size: 12.5px; color: #334155; cursor: pointer; padding: 4px 6px; border-radius: 6px; }
.manq-item:hover { background: #fff; }
.manq-ph { font-weight: 600; color: #c2410c; }
.manq-go { font-size: 11px; color: #0f766e; }
</style>
