<template>
  <div class="cad">
    <div class="cad-head">
      <div>
        <div class="cadh-eyebrow">Référentiel</div>
        <h1 class="cadh-title">Cadences & paramètres par équipement</h1>
        <p class="cadh-sub">Les machines identiques sont regroupées : cadence et paramètres saisis une fois, appliqués à toutes les fiches du groupe.</p>
      </div>
    </div>

    <div class="cad-tabs">
      <button type="button" :class="{ on: vueMode === 'matrice' }" @click="vueMode = 'matrice'">Matrice cadences</button>
      <button type="button" :class="{ on: vueMode === 'params' }" @click="vueMode = 'params'">Paramètres de temps</button>
    </div>

<template v-if="vueMode === 'matrice'">
      <section class="card mat-card">
        <div class="mat-head">
          <input type="search" v-model="filtre" class="prod-search-big" placeholder="Filtrer les produits (code ou désignation)…" />
          <select v-model="filtreEq" class="eq-select">
            <option value="">Tous les équipements</option>
            <option v-for="g in groupes" :key="g.key" :value="g.nom">{{ g.nom }}</option>
          </select>
          <span v-if="filtreEq" class="eq-count">{{ produitsMatrice.length }} produit(s) avec cadence</span>
          <span class="mat-count">{{ produitsMatrice.length }} produit(s) × {{ groupes.length }} équipement(s) — saisissez la cadence directement dans les cases</span>
          <span v-if="msgMat" class="mat-msg">{{ msgMat }}</span>
        </div>
        <div class="mat-scroll">
          <table class="mat-table">
            <thead>
              <tr>
                <th class="mat-corner">Produit</th>
                <th v-for="g in groupesAffiches" :key="g.key" class="mat-col" :class="'ph-' + (g.phase || 'x')">
                  {{ g.nom }}<div class="mat-unit">{{ uniteGroupe(g) }}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in produitsMatrice" :key="p.id">
                <td class="mat-prod"><span class="mat-code">{{ p.code_pf }}</span><span class="mat-des">{{ p.designation }}</span></td>
                <td v-for="g in groupesAffiches" :key="g.key" class="mat-cell" :class="{ vide: !cadenceCell(p.id, g) }"><input type="number" step="any" min="0" class="mat-in" :value="cadenceCell(p.id, g) || ''" @change="sauverCellule(p.id, g, $event.target.value)" @keyup.enter="$event.target.blur()" placeholder="·" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <template v-if="vueMode === 'params'">
      <section class="card mat-card">
        <div class="mat-head">
          <span class="mat-count">{{ groupes.length }} équipement(s) — saisissez les paramètres de temps directement (heures)</span>
          <span v-if="msgMat" class="mat-msg">{{ msgMat }}</span>
        </div>
        <div class="mat-scroll">
          <table class="mat-table">
            <thead>
              <tr>
                <th class="mat-corner">Équipement</th>
                <th v-for="c in COLS_PARAM" :key="c.k" class="mat-col2">{{ c.l }}<div class="mat-unit">{{ c.u || '—' }}</div></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in groupes" :key="g.key">
                <td class="mat-prod" :class="'ph-' + (g.phase || 'x')"><span class="mat-code">{{ g.nom }}</span><span class="mat-des">{{ PHASE_LBL[g.phase] || '' }}</span></td>
                <td v-for="c in COLS_PARAM" :key="c.k" class="mat-cell"><input type="number" step="any" min="0" class="mat-in" :value="paramCell(g, c.k)" @change="sauverParam(g, c.k, $event.target.value)" @keyup.enter="$event.target.blur()" placeholder="·" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'

const routeCad = useRoute()

const produits = ref([]), equipements = ref([]), ateliers = ref([]), cadences = ref([])
const chargement = ref(true), sauvegarde = ref(false), sauvegardeP = ref(false)
const selGroupe = ref(''), filtre = ref(''), filtreEq = ref('')
const message = ref(''), messageErr = ref(false), messageP = ref(''), messagePErr = ref(false)

const cadEdit = reactive({})
let original = {}
const paramEdit = reactive({ nb_machines: 1, postes: 3, tep: 8, dht: 0, vdlp: 0, vdlt: 0, reglage: 0 })
let paramOrig = {}
const CHAMPS_P = ['nb_machines', 'postes', 'tep', 'dht', 'vdlp', 'vdlt', 'reglage']
const DEF_P = { nb_machines: 1, postes: 3, tep: 8, dht: 0, vdlp: 0, vdlt: 0, reglage: 0 }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}
async function chargerCadences() { cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('id, equipement_id, produit_id, cadence_nominale, mode')) }
async function chargerEquip() { equipements.value = await fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)) }

onMounted(() => { if (routeCad.query.produit) filtre.value = String(routeCad.query.produit) })
onMounted(async () => {
  produits.value = await fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot').eq('actif', true))
  ateliers.value = await fetchAllPaged(() => supabase.from('ateliers').select('id, code, nom').eq('actif', true))
  await chargerEquip()
  await chargerCadences()
  chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul|séch|sech/.test(t)) return 'granulation'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
const ORDRE_GAMME = { pesee: 1, granulation: 2, melange: 3, compression: 4, remplissage: 5, pelliculage: 6, conditionnement: 7 }
function baseNom(nom) {
  return String(nom || '').trim().replace(/\s+(\d{1,2})\s*$/, (m, n) => (Number(n) <= 20 ? '' : m)).trim()
}
function num(v, def) { const n = Number(v); return (v === null || v === undefined || isNaN(n)) ? def : n }

const atelierById = computed(() => { const m = {}; for (const a of ateliers.value) m[a.id] = a; return m })
const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const vueMode = ref('matrice')
function cadenceCell(pid, grp) {
  let v = 0
  for (const e of grp.equips) { const c = cadences.value.find(c => c.equipement_id === e.id && c.produit_id === pid); if (c && Number(c.cadence_nominale) > v) v = Number(c.cadence_nominale) }
  return v
}
function uniteGroupe(grp) { return grp.phase === 'conditionnement' ? 'bts/h' : 'kg/h' }
const fmtCad = (v) => Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
function ouvrirGroupe(g) { selGroupe.value = g.key; chargerEditeur(); vueMode.value = 'editeur' }
const groupeFiltreEq = computed(() => filtreEq.value ? (groupes.value.find(g => g.nom === filtreEq.value) || null) : null)
const produitsMatrice = computed(() => {
  const q = filtre.value.trim().toLowerCase()
  let list = produitsTries.value
  if (q) list = list.filter(p => String(p.code_pf || '').toLowerCase().includes(q) || String(p.designation || '').toLowerCase().includes(q))
  const gs = groupeFiltreEq.value
  if (gs) list = list.filter(p => cadenceCell(p.id, gs) > 0)
  return list
})
const msgMat = ref('')
async function sauverCellule(pid, grp, valeur) {
  const v = String(valeur).trim()
  const nv = v === '' ? 0 : Number(v)
  if (isNaN(nv) || nv < 0) { msgMat.value = 'Valeur invalide'; setTimeout(() => { msgMat.value = '' }, 1800); return }
  try {
    for (const e of grp.equips) {
      const existing = cadences.value.find(c => c.equipement_id === e.id && c.produit_id === pid)
      if (nv > 0 && existing) { const r = await supabase.from('cadences_produit').update({ cadence_nominale: nv }).eq('id', existing.id); if (r.error) throw r.error; existing.cadence_nominale = nv }
      else if (nv > 0) { const r = await supabase.from('cadences_produit').insert({ equipement_id: e.id, produit_id: pid, cadence_nominale: nv }).select('id').single(); if (r.error) throw r.error; if (r.data) cadences.value.push({ id: r.data.id, equipement_id: e.id, produit_id: pid, cadence_nominale: nv }) }
      else if (nv === 0 && existing) { const r = await supabase.from('cadences_produit').delete().eq('id', existing.id); if (r.error) throw r.error; const i = cadences.value.indexOf(existing); if (i >= 0) cadences.value.splice(i, 1) }
    }
    msgMat.value = 'Enregistré ✓'; setTimeout(() => { msgMat.value = '' }, 1800)
  } catch (err) { msgMat.value = 'Erreur : ' + (err.message || err) }
}
const COLS_PARAM = [
  { k: 'nb_machines', l: 'Machines', u: '' },
  { k: 'postes', l: 'Postes', u: '' },
  { k: 'tep', l: 'TEP', u: 'h/poste' },
  { k: 'vdlp', l: 'VDLP', u: 'h' },
  { k: 'vdlt', l: 'VDLT', u: 'h' },
  { k: 'reglage', l: 'Réglage', u: 'h' },
  { k: 'dht', l: 'Holding', u: 'j' }
]
const PHASE_LBL = { pesee: 'Pesée', granulation: 'Granulation et Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
function paramCell(grp, k) { const e = grp.equips[0]; return e && e[k] != null ? e[k] : '' }
async function sauverParam(grp, k, valeur) {
  const v = String(valeur).trim()
  const nv = v === '' ? (k === 'nb_machines' || k === 'postes' ? 1 : 0) : Number(v)
  if (isNaN(nv) || nv < 0) { msgMat.value = 'Valeur invalide'; setTimeout(() => { msgMat.value = '' }, 1800); return }
  const ids = grp.equips.map(e => e.id)
  const r = await supabase.from('equipements').update({ [k]: nv }).in('id', ids)
  if (r.error) { msgMat.value = 'Erreur : ' + r.error.message; return }
  for (const e of grp.equips) e[k] = nv
  msgMat.value = 'Enregistré ✓'; setTimeout(() => { msgMat.value = '' }, 1800)
}

// Regroupement des équipements identiques : même phase (type) + même nom de base
const groupesAffiches = computed(() => filtreEq.value ? groupes.value.filter(g => g.nom === filtreEq.value) : groupes.value)
const groupes = computed(() => {
  const eqs = equipements.value.slice()
  const kp = (e) => phaseDeType(e.type) || ('t:' + (e.type || '?'))
  const compte = {}
  for (const e of eqs) {
    const nom = (e.nom || e.code || '—').trim()
    const bk = kp(e) + '|' + baseNom(nom).toLowerCase()
    if (!compte[bk]) compte[bk] = new Set()
    compte[bk].add(nom.toLowerCase())
  }
  const g = {}
  for (const e of eqs) {
    const nom = (e.nom || e.code || '—').trim()
    const base = baseNom(nom)
    const partage = (compte[kp(e) + '|' + base.toLowerCase()] || new Set()).size >= 2
    const label = partage ? base : nom
    const key = kp(e) + '|' + label.toLowerCase()
    if (!g[key]) g[key] = { key, nom: label, phase: phaseDeType(e.type), atelier_id: e.atelier_id, equips: [] }
    g[key].equips.push(e)
  }
  return Object.values(g).sort((a, b) => (ORDRE_GAMME[a.phase] || 99) - (ORDRE_GAMME[b.phase] || 99) || (a.nom || '').localeCompare(b.nom || ''))
})
const groupesParAtelier = computed(() => {
  const g = {}
  for (const grp of groupes.value) {
    const aid = grp.atelier_id || 'sans'
    if (!g[aid]) g[aid] = { aid, nom: (atelierById.value[aid] && atelierById.value[aid].nom) || 'Sans atelier', groupes: [], phaseMin: 99 }
    g[aid].groupes.push(grp)
    const o = ORDRE_GAMME[grp.phase] || 99
    if (o < g[aid].phaseMin) g[aid].phaseMin = o
  }
  return Object.values(g).sort((a, b) => (a.phaseMin - b.phaseMin) || a.nom.localeCompare(b.nom))
})

const groupeSel = computed(() => groupes.value.find(g => g.key === selGroupe.value) || null)
const equipsSel = computed(() => groupeSel.value ? groupeSel.value.equips : [])
const groupeNom = computed(() => groupeSel.value ? groupeSel.value.nom : '')
const nbFiches = computed(() => equipsSel.value.length)
const previewTotalMachines = computed(() => (Number(paramEdit.nb_machines) || 1) * nbFiches.value)
const totalMachinesReel = computed(() => equipsSel.value.reduce((s, e) => s + Math.max(1, num(e.nb_machines, 1)), 0))
const phaseCourante = computed(() => groupeSel.value ? groupeSel.value.phase : null)
const estCond = computed(() => phaseCourante.value === 'conditionnement')
const uniteHint = computed(() => estCond.value ? 'boîtes / heure (conditionnement)' : 'kg / heure (fabrication)')
const uniteCourte = computed(() => estCond.value ? 'boîtes/h' : 'kg/h')

function chargerEditeur() {
  for (const k of Object.keys(cadEdit)) delete cadEdit[k]
  original = {}; message.value = ''; messageP.value = ''
  const eqs = equipsSel.value
  if (!eqs.length) return
  // cadences : valeur du groupe = max sur les fiches
  for (const p of produits.value) {
    let v = 0
    for (const e of eqs) { const c = cadences.value.find(c => c.equipement_id === e.id && c.produit_id === p.id); if (c && Number(c.cadence_nominale) > v) v = Number(c.cadence_nominale) }
    if (v > 0) { cadEdit[p.id] = String(v); original[p.id] = v }
  }
  // paramètres : fiche représentative
  const rep = eqs[0] || {}
  paramOrig = {}
  for (const k of CHAMPS_P) { const val = (rep[k] === null || rep[k] === undefined) ? DEF_P[k] : Number(rep[k]); paramEdit[k] = val; paramOrig[k] = val }
  chargerTRSReel(eqs.map(e => e.id))
}

const produitsAffiches = computed(() => {
  const q = filtre.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})
const nbRenseignees = computed(() => produits.value.filter(p => Number(cadEdit[p.id]) > 0).length)
function estModifie(pid) { return (Number(cadEdit[pid]) || 0) !== (original[pid] || 0) }
const nbChangements = computed(() => produits.value.filter(p => estModifie(p.id)).length)
const paramsModifies = computed(() => CHAMPS_P.some(k => (Number(paramEdit[k]) || 0) !== (paramOrig[k] || 0)))

async function enregistrer() {
  if (!nbChangements.value) return
  sauvegarde.value = true; message.value = ''; messageErr.value = false
  let nUp = 0, nIns = 0, nDel = 0
  try {
    for (const p of produits.value) {
      const nv = Number(cadEdit[p.id]) || 0, ov = original[p.id] || 0
      if (nv === ov) continue
      for (const e of equipsSel.value) {
        const existing = cadences.value.find(c => c.equipement_id === e.id && c.produit_id === p.id)
        if (nv > 0 && existing) { const r = await supabase.from('cadences_produit').update({ cadence_nominale: nv }).eq('id', existing.id); if (r.error) throw r.error; nUp++ }
        else if (nv > 0) { const r = await supabase.from('cadences_produit').insert({ equipement_id: e.id, produit_id: p.id, cadence_nominale: nv }); if (r.error) throw r.error; nIns++ }
        else if (nv === 0 && existing) { const r = await supabase.from('cadences_produit').delete().eq('id', existing.id); if (r.error) throw r.error; nDel++ }
      }
    }
    await chargerCadences(); chargerEditeur()
    message.value = `Enregistré sur ${equipsSel.value.length} fiche(s) : ${nUp} mise(s) à jour, ${nIns} ajout(s), ${nDel} suppression(s).`
  } catch (e) { messageErr.value = true; message.value = 'Erreur : ' + (e.message || e) } finally { sauvegarde.value = false }
}

async function enregistrerParams() {
  if (!paramsModifies.value) return
  sauvegardeP.value = true; messageP.value = ''; messagePErr.value = false
  const patch = {}
  for (const k of CHAMPS_P) patch[k] = Number(paramEdit[k]) || 0
  try {
    for (const e of equipsSel.value) { const r = await supabase.from('equipements').update(patch).eq('id', e.id); if (r.error) throw r.error }
    await chargerEquip(); chargerEditeur()
    messageP.value = `Paramètres enregistrés sur ${equipsSel.value.length} fiche(s).`
  } catch (e) { messagePErr.value = true; messageP.value = 'Erreur : ' + (e.message || e) + ' — as-tu exécuté le SQL d\'ajout des colonnes ?' } finally { sauvegardeP.value = false }
}

// TRS réel mesuré (agrégé sur toutes les fiches du groupe)
const MOTIFS_TRS = ['arret_panne_min', 'arret_format_min', 'arret_nettoyage_min', 'arret_reglage_min', 'arret_maintenance_min', 'arret_attente_min', 'arret_autre_min']
const trsReel = ref(null)
const trsChargementReel = ref(false)
function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' }
}
async function chargerTRSReel(equipIds) {
  trsReel.value = null
  if (!equipIds || !equipIds.length) return
  trsChargementReel.value = true
  const rows = await fetchAllPaged(() => supabase.from('trs_postes').select('*').eq('actif', true).in('equipement_id', equipIds))
  trsChargementReel.value = false
  if (!rows.length) return
  let ouverture = 0, fonct = 0, theo = 0, prodPerf = 0, ecoule = 0, fonctPerf = 0, prodQual = 0, rebutsQual = 0, du = null, au = null
  for (const s of rows) {
    const to = Number(s.temps_ouverture_min) || 0
    let arr = 0; for (const m of MOTIFS_TRS) arr += Number(s[m]) || 0
    const tf = Math.max(0, to - arr)
    ouverture += to; fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { ecoule += Number(s.production_realisee) || 0; fonctPerf += tf }
    else if (cd.value > 0) { theo += (tf / 60) * cd.value; prodPerf += Number(s.production_realisee) || 0; prodQual += Number(s.production_realisee) || 0; rebutsQual += Number(s.rebuts) || 0 }
    if (s.date) { if (!du || s.date < du) du = s.date; if (!au || s.date > au) au = s.date }
  }
  const dispo = ouverture ? fonct / ouverture : 0
  const perf = theo ? Math.min(1, prodPerf / theo) : (fonctPerf ? Math.min(1, ecoule / fonctPerf) : 0)
  const qualite = prodQual ? Math.max(0, (prodQual - rebutsQual) / prodQual) : 1
  trsReel.value = { dispo, perf, qualite, trs: dispo * perf * qualite, nbPostes: rows.length, du, au }
}
function fmtD(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function trsCls(t) { return t >= 0.85 ? 'tr-g' : t >= 0.6 ? 'tr-a' : 'tr-r' }

// Récapitulatif par groupe
const recapGroupes = computed(() => groupes.value.map(g => {
  const prods = new Set()
  for (const e of g.equips) for (const c of cadences.value) if (c.equipement_id === e.id && Number(c.cadence_nominale) > 0) prods.add(c.produit_id)
  return { key: g.key, nom: g.nom, n: prods.size }
}).filter(x => x.n > 0).sort((a, b) => b.n - a.n))
</script>

<style scoped>
.cad { max-width: 1080px; margin: 0 auto; padding: 6px 4px 24px; }
.cad-head { margin-bottom: 20px; }
.cadh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.cadh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.cadh-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0 0 14px; }
.muted { font-size: 13px; color: #94a3b8; margin: 6px 0 0; }

.ctrl { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.cf { display: flex; flex-direction: column; gap: 5px; }
.cf.grow { flex: 1; min-width: 260px; }
.cf label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.cf select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.unite { padding: 8px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; font-size: 13px; font-weight: 600; color: #0f766e; white-space: nowrap; }

.params { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 760px) { .params { grid-template-columns: 1fr; } }
.pgroup { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 14px; }
.pg-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #0f766e; margin-bottom: 12px; }
.pg-fields { display: flex; flex-wrap: wrap; gap: 12px; }
.pfield { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 130px; }
.pfield span { font-size: 12px; font-weight: 600; color: #334155; }
.pfield em { font-style: normal; color: #94a3b8; font-weight: 400; font-size: 11px; }
.pfield input { margin-top: auto; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; }
.trs-disp { margin-top: auto; padding: 7px 10px; border: 1px solid #99f6e4; border-radius: 7px; font-size: 15px; font-weight: 800; text-align: right; background: #f0fdfa; }
.trs-disp.tr-g { color: #15803d; } .trs-disp.tr-a { color: #b45309; } .trs-disp.tr-r { color: #b91c1c; }
.trs-disp.trs-muted { color: #cbd5e1; font-weight: 600; background: #f8fafc; border-color: #eef2f6; }
.trs-cap { font-size: 12px; color: #334155; margin-top: 10px; }
.trs-cap.none { color: #94a3b8; }

.grp-info { margin-top: 16px; font-size: 12.5px; color: #334155; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 9px; padding: 9px 12px; }
.mach-disp { margin-top: auto; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 15px; font-weight: 800; text-align: right; color: #0f766e; background: #f0fdfa; }
.grp-info.warn { background: #fffbeb; border-color: #fcd34d; color: #92400e; }

.ed-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.prod-search { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; min-width: 220px; }
.prod-search-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.prod-search-big { flex: 1; max-width: 460px; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; }
.cad-tabs { display: flex; gap: 8px; margin: 0 0 16px; }
.cad-tabs button { background: #fff; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; padding: 9px 18px; cursor: pointer; color: #475569; }
.cad-tabs button.on { background: #0f766e; color: #fff; border-color: #0f766e; }
.mat-head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.mat-count { font-size: 13px; color: #64748b; }
.mat-scroll { overflow: auto; max-height: 72vh; border: 1px solid #e2e8f0; border-radius: 10px; }
.mat-table { border-collapse: separate; border-spacing: 0; font-size: 12.5px; }
.mat-table th, .mat-table td { padding: 7px 11px; white-space: nowrap; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }
.mat-corner { position: sticky; left: 0; top: 0; z-index: 4; background: #f1f5f9; text-align: left; font-weight: 700; }
.mat-col { position: sticky; top: 0; z-index: 2; background: #f1f5f9; cursor: default; text-align: center; font-weight: 700; color: #334155; min-width: 92px; }
.mat-col:hover { background: #ccfbf1; }
.mat-col2 { position: sticky; top: 0; z-index: 2; background: #f1f5f9; text-align: center; font-weight: 700; color: #334155; min-width: 84px; }
.mat-unit { font-size: 10px; font-weight: 500; color: #94a3b8; margin-top: 1px; }
.mat-prod { position: sticky; left: 0; z-index: 1; background: #fff; }
.mat-code { font-family: ui-monospace, monospace; font-weight: 700; color: #0f766e; display: block; }
.mat-des { font-size: 11px; color: #64748b; display: block; }
.mat-cell { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
.mat-cell.vide { color: #cbd5e1; font-weight: 400; text-align: center; }
.mat-cell { padding: 3px 5px; }
.mat-in { width: 76px; padding: 5px 7px; border: 1px solid transparent; border-radius: 6px; font: inherit; font-size: 12.5px; text-align: right; background: transparent; font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
.mat-in:hover { border-color: #cbd5e1; background: #fff; }
.mat-in:focus { outline: none; border-color: #0f766e; background: #fff; box-shadow: 0 0 0 2px rgba(15,118,110,.15); }
.mat-msg { font-size: 13px; font-weight: 700; color: #15803d; }
.mat-table tbody tr:hover td { background: #f8fafc; }
.mat-table tbody tr:hover .mat-prod { background: #f0fdfa; }
.ph-granulation { border-top: 3px solid #0f766e; } .ph-melange { border-top: 3px solid #4338ca; } .ph-compression { border-top: 3px solid #c2410c; } .ph-pelliculage { border-top: 3px solid #7c3aed; } .ph-conditionnement { border-top: 3px solid #0891b2; } .ph-remplissage { border-top: 3px solid #ca8a04; } .ph-pesee { border-top: 3px solid #64748b; }
.prod-search-big:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.eq-select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; min-width: 260px; background: #fff; color: #0f172a; }
.eq-select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.eq-count { font-size: 12px; font-weight: 700; color: #0f766e; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 11px; white-space: nowrap; }
.ps-count { font-size: 13px; color: #64748b; font-weight: 600; }
.no-res { text-align: center; color: #94a3b8; padding: 18px; font-size: 13.5px; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th, .grid td { padding: 7px 10px; border-bottom: 1px solid #eef2f6; text-align: left; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; } .ta-c { text-align: center; }
.desig { color: #94a3b8; font-size: 12px; }
.grid tr.modif { background: #fffbeb; }
.cad-inp { width: 120px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; }
.cad-inp.rempli { border-color: #0f766e; background: #f0fdfa; font-weight: 600; }

.save-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #eef2f6; }
.pending { font-size: 13px; font-weight: 600; color: #b45309; }
.pending.ok { color: #94a3b8; }
.btn-save { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 20px; cursor: pointer; }
.btn-save:disabled { background: #cbd5e1; cursor: not-allowed; }
.msg { font-size: 13px; color: #15803d; margin-top: 12px; font-weight: 600; }
.msg.err { color: #b91c1c; }

.recap { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 14px; }
.recap-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 9px; }
.ri-nom { font-size: 13px; font-weight: 600; color: #334155; }
.ri-cnt { font-size: 13px; font-weight: 800; color: #0f766e; background: #f0fdfa; border-radius: 6px; padding: 2px 9px; }
</style>
