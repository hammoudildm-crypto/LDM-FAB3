<template>
  <div class="pe-page">
    <div class="pe-head">
      <h1>Planning des équipements — Fabrication</h1>
      <p class="sub">Ordonnancement 24 h/24 sur 3 shifts (06–14 · 14–22 · 22–06). Clique sur un équipement pour alimenter son panier de produits (nombre de lots saisi manuellement). Durées et nettoyages selon les cadences et paramètres par équipement.</p>
    </div>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="panierErreur" class="alert">{{ panierErreur }}</p>

    <!-- Paramètres -->
    <section class="card params">
      <div class="p-grp"><label>Départ<input type="date" v-model="dateDepart" /></label></div>
      <div class="p-grp"><label>Affichage</label>
        <div class="vue-btns">
          <button type="button" class="vue-btn" :class="{ on: pxH >= 15 }" @click="pxH = 20">Jour</button>
          <button type="button" class="vue-btn" :class="{ on: pxH >= 2.5 && pxH < 15 }" @click="pxH = 3.5">Semaine</button>
          <button type="button" class="vue-btn" :class="{ on: pxH < 2.5 }" @click="pxH = 0.8">Mois</button>
        </div>
      </div>
      <div class="p-grp"><label>Zoom<input type="range" min="0.5" max="24" step="0.5" v-model.number="pxH" /></label></div>
    </section>

    <!-- Légende -->
    <div class="legende">
      <span class="lg"><i class="sw sw-lot"></i>Lot (couleur = produit)</span>
      <span class="lg"><i class="sw sw-gen"></i>Nettoyage général (NG)</span>
      <span class="lg"><i class="sw sw-part"></i>Nettoyage partiel (NP)</span>
    </div>

    <section v-if="!chargement && planning.length" class="card recap">
      <h3>Synthèse</h3>
      <div class="recap-grid">
        <div class="rc"><span class="rc-v">{{ planning.length }}</span><span class="rc-l">Équipements planifiés</span></div>
        <div class="rc"><span class="rc-v">{{ totalLots }}</span><span class="rc-l">Lots ordonnancés</span></div>
        <div class="rc"><span class="rc-v">{{ totalNG }}</span><span class="rc-l">Nettoyages généraux</span></div>
        <div class="rc"><span class="rc-v">{{ totalNP }}</span><span class="rc-l">Nettoyages partiels</span></div>
        <div class="rc"><span class="rc-v">{{ fmtJH(finGlobale) }}</span><span class="rc-l">Fin la plus tardive</span></div>
      </div>
    </section>

    <div v-if="chargement" class="empty">Chargement…</div>
    <div v-else-if="!planning.length" class="empty">Aucun équipement de fabrication trouvé.</div>

    <!-- Gantt -->
    <section v-else class="card gantt-card">
      <div class="gantt">
        <!-- entête temps -->
        <div class="g-header">
          <div class="g-eqcol g-eqhead">Équipement</div>
          <div class="g-track g-timeline" :style="{ width: totalW + 'px' }">
            <div v-for="d in jours" :key="d.i" class="g-dcol" :style="{ left: d.left + 'px', width: d.w + 'px' }">
              <div class="g-dlbl">{{ d.label }}</div>
              <div class="g-shifts">
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">06</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">14</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">22</span>
              </div>
            </div>
          </div>
        </div>
        <!-- lignes -->
        <div v-for="row in planning" :key="row.eq.id" class="g-row">
          <div class="g-eqcol" :title="'Cliquer pour gérer le panier — ' + row.eq.nom" @click="ouvrirPanier(row.eq)">
            <div class="g-eqcode">{{ row.eq.code }} <span v-if="(panierEquip[row.eq.id] || []).length" class="g-pan">🧺 {{ (panierEquip[row.eq.id] || []).length }}</span></div>
            <div class="g-eqnom">{{ row.eq.nom }}</div>
            <div class="g-eqfin">fin : {{ fmtJH(row.fin) }}</div>
            <label class="g-eqwe" @click.stop><input type="checkbox" v-model="weekendEquip[row.eq.id]" /> week-ends</label>
          </div>
          <div class="g-track" :style="{ width: totalW + 'px' }">
            <!-- bandes jours -->
            <div v-for="d in jours" :key="'b'+d.i" class="g-dband" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <!-- bandes week-end (si l'équipement ne travaille pas le week-end) -->
            <template v-if="!weekendEquip[row.eq.id]">
              <div v-for="d in joursWeekend" :key="'w'+d.i" class="g-weekend" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            </template>
            <!-- barres (par segment) -->
            <template v-for="(t, i) in row.tasks">
              <div v-for="(seg, j) in t.segments" :key="i + '-' + j" class="g-bar"
                   :class="[('g-' + t.type), { 'g-drag': t.type === 'lot', 'g-dragging': dragInfo && t.type === 'lot' && dragInfo.eqId === row.eq.id && dragInfo.uid === t.uid }]"
                   :style="barStyleSeg(seg, t)" :title="t.type === 'lot' ? (titre(t) + '  •  glisser ce lot pour réordonner') : titre(t)"
                   :draggable="t.type === 'lot' ? 'true' : 'false'"
                   @dragstart="t.type === 'lot' ? dragStart(row.eq.id, t.uid) : null"
                   @dragover.prevent
                   @drop="t.type === 'lot' ? dropSur(row.eq.id, t.uid) : null">
                <span v-if="j === 0" class="g-lbl">{{ t.type === 'lot' ? t.prod.code_pf : (t.type.startsWith('gen') ? 'NG' : 'NP') }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- Récap -->

    <!-- Panier par équipement -->
    <div v-if="panierOuvert" class="pan-overlay" @click="panierOuvert = null">
      <div class="pan-box" @click.stop>
        <div class="pan-head">
          <div><b>Panier — {{ panierOuvert.code }}</b> <span class="pan-nom">{{ panierOuvert.nom }}</span></div>
          <div class="pan-head-btns">
            <button class="pan-vider" @click="viderPanier" :disabled="!(panierEquip[panierOuvert.id] || []).length">Vider</button>
            <button class="pan-close" @click="panierOuvert = null">✕</button>
          </div>
        </div>
        <div class="pan-cfg">
          <label class="pan-reg">Régime :
            <select :value="regimeEquip[panierOuvert.id] || '3x8'" @change="setRegime($event.target.value)">
              <option value="3x8">3×8 — 24 h/24</option>
              <option value="2x8">2×8 — 06 h–22 h</option>
            </select>
          </label>
        </div>
        <div class="pan-requis" v-if="!weekendEquip[panierOuvert.id]">
          <div class="pan-req-head">Réquisitions week-end (dates travaillées) :</div>
          <div class="pan-req-list">
            <span v-for="dt in (requisEquip[panierOuvert.id] || [])" :key="dt" class="pan-req-chip">{{ dt }} <button @click="retirerRequis(dt)">✕</button></span>
            <span v-if="!(requisEquip[panierOuvert.id] || []).length" class="pan-none">Aucune.</span>
          </div>
          <div class="pan-req-add">
            <input type="date" v-model="requisDate" class="pan-reqdate" />
            <button class="vue-btn" @click="ajouterRequis">Ajouter</button>
          </div>
        </div>
        <div class="pan-list">
          <div v-for="(grp, gi) in campagnesPanier" :key="gi" class="pan-item">
            <span class="pan-idx">{{ gi + 1 }}</span>
            <span class="pan-pnom">{{ produitNom(grp.pid) }} <b>× {{ grp.count }} lot(s)</b></span>
            <button class="pan-btn del" @click="retirerGroupe(grp)">✕</button>
          </div>
          <div v-if="!campagnesPanier.length" class="pan-vide">Panier vide.</div>
        </div>
        <p class="pan-hint2">Réordonne les lots <b>un par un en les glissant sur le Gantt</b>. Nettoyage recalculé : même produit → partiel ; produit différent ou validité dépassée → général.</p>
        <div class="pan-add">
          <div class="pan-add-row">
            <input v-model="rechProd" placeholder="Rechercher un produit…" class="pan-search" />
            <label class="pan-nbadd">Lots <input type="number" min="1" step="1" v-model.number="nbAjout" class="pan-nb" /></label>
          </div>
          <div class="pan-prods">
            <button v-for="p in produitsAjoutables" :key="p.id" class="pan-chip" @click="ajouterPanier(p.id)" :title="p.designation + ' — ajoute ' + nbAjout + ' lot(s)'">{{ p.code_pf }}</button>
            <span v-if="!produitsAjoutables.length" class="pan-none">Aucun produit.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const chargement = ref(true)
const erreur = ref('')

// Paramètres (valeurs fixes réglables)
const today = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const dateDepart = ref(iso(today))
const vdlt = ref(8)        // nettoyage général (h)
const vdlp = ref(2)        // nettoyage partiel (h)
const holdingJ = ref(7)    // validité campagne (jours)
const annee = ref(today.getFullYear())
const pxH = ref(4)         // pixels par heure (zoom)
const weekendEquip = reactive({}) // par équipement : true = tous les week-ends inclus
const regimeEquip = reactive({})  // par équipement : '2x8' ou '3x8'
const requisEquip = reactive({})  // par équipement : dates week-end travaillées

const holdingH = computed(() => Number(holdingJ.value) * 24)

// Données
const planRaw = ref([])
const cadences = ref([])
const equipements = ref([])
const produits = ref([])

async function fetchAllPaged(qb) {
  const size = 1000; let from = 0; const out = []
  while (true) {
    const { data, error } = await qb().range(from, from + size - 1)
    if (error) return { error }
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return { data: out }
}

onMounted(async () => {
  try {
    const [rp, rc, re, rpr, rpan] = await Promise.all([
      fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produit_id')),
      fetchAllPaged(() => supabase.from('cadences_produit').select('cadence_nominale, unite_cadence, mode, equipement_id, produit_id')),
      fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id, actif, vdlt, vdlp, dht, reglage, postes').eq('actif', true)),
      fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot, unites_par_boite, poids_unitaire_mg, gamme').eq('actif', true)),
      fetchAllPaged(() => supabase.from('planning_panier').select('equipement_id, produits, regime, requis'))
    ])
    if (rp.error || rc.error || re.error || rpr.error) { erreur.value = (rp.error || rc.error || re.error || rpr.error).message; return }
    planRaw.value = rp.data; cadences.value = rc.data; equipements.value = re.data; produits.value = rpr.data
    if (rpan && !rpan.error && rpan.data) for (const row of rpan.data) {
      const arr = Array.isArray(row.produits) ? row.produits : []
      const flat = []
      for (const x of arr) {
        if (x && typeof x === 'object' && x.uid) flat.push({ pid: x.pid, uid: x.uid })
        else if (x && typeof x === 'object') { const n = Math.max(1, Number(x.nb) || 1); for (let k = 0; k < n; k++) flat.push({ pid: x.pid, uid: uidGen() }) }
        else flat.push({ pid: x, uid: uidGen() })
      }
      panierEquip[row.equipement_id] = flat
      if (row.regime) regimeEquip[row.equipement_id] = row.regime
      if (Array.isArray(row.requis)) requisEquip[row.equipement_id] = row.requis
    }
  } catch (e) { erreur.value = String(e) } finally { chargement.value = false }
})

// Années dispo
const annees = computed(() => {
  const s = new Set(planRaw.value.map(r => Number(r.annee)).filter(Boolean))
  s.add(today.getFullYear())
  return [...s].sort((a, b) => b - a)
})

// Index produits + PDP quantité par produit pour l'année
const produitsById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const pdpQty = computed(() => {
  const m = {}
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    m[r.produit_id] = (m[r.produit_id] || 0) + Number(r.quantite_planifiee || 0)
  }
  return m
})

// Types fabrication
const FAB = /pes[ée]|balance|bascule|granul|s[ée]ch|m[ée]lang|compress|presse|compri|g[ée]lule|remplis|encapsul|capsul|pellicul|enrob|coat|drag[ée]/i
const estFab = (type) => FAB.test(String(type || ''))
// Ordre des phases (pour trier les équipements)
function phaseOrdre(type) {
  const t = String(type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 1
  if (/granul/.test(t)) return 2
  if (/s[ée]ch/.test(t)) return 3
  if (/m[ée]lang/.test(t)) return 4
  if (/compress|presse|compri/.test(t)) return 5
  if (/g[ée]lule|remplis|encapsul|capsul/.test(t)) return 6
  if (/pellicul|enrob|coat|drag[ée]/.test(t)) return 7
  return 99
}

// Poids d'un lot en Kg (taille_lot boîtes × unités/boîte × poids unitaire mg)
function poidsLotKg(prod) {
  const boites = Number(prod.taille_lot) || 0
  const upb = Number(prod.unites_par_boite) || 0
  const pmg = Number(prod.poids_unitaire_mg) || 0
  return (boites * upb * pmg) / 1e6 // mg -> Kg
}
// Durée d'un lot (h) : cadence en Kg/h
function dureeLotH(prod, cad) {
  const c = Number(cad.cadence_nominale) || 0 // Kg/h
  if (c <= 0) return 8 // repli : 8 h / lot
  const kg = poidsLotKg(prod)
  return kg > 0 ? kg / c : 8
}

const addH = (d, h) => new Date(d.getTime() + h * 3600000)

// --- Gestion des week-ends (vendredi=5, samedi=6) ---
const isoL = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + j }
// Jour ouvré ? (week-end ven/sam sauf si weAll ou date réquisitionnée)
function jourOuvre(d, weAll, requis) {
  const j = d.getDay()
  if (j === 5 || j === 6) return weAll || (requis && requis.has(isoL(d)))
  return true
}
// Prochain instant ouvré (respecte régime 2x8 = 06-22, et jours ouvrés)
function prochainOuvre(d, regime, weAll, requis) {
  const c = new Date(d); let g = 0
  while (g++ < 3000) {
    if (!jourOuvre(c, weAll, requis)) { c.setDate(c.getDate() + 1); c.setHours(regime === '2x8' ? 6 : 0, 0, 0, 0); continue }
    if (regime === '2x8') {
      const h = c.getHours() + c.getMinutes() / 60
      if (h < 6) { c.setHours(6, 0, 0, 0); continue }
      if (h >= 22) { c.setDate(c.getDate() + 1); c.setHours(6, 0, 0, 0); continue }
    }
    return c
  }
  return c
}
// Fin de la plage ouvrée courante
function finOuvre(d, regime, weAll, requis) {
  if (regime === '2x8') { const f = new Date(d); f.setHours(22, 0, 0, 0); return f }
  const nc = new Date(d); nc.setHours(0, 0, 0, 0); nc.setDate(nc.getDate() + 1)
  let g = 0
  while (g++ < 21 && jourOuvre(nc, weAll, requis)) nc.setDate(nc.getDate() + 1)
  return nc
}
// Place une tâche de durée dureeH selon régime + jours ouvrés -> segments + fin
function placer(start, dureeH, regime, weAll, requis) {
  let cursor = prochainOuvre(new Date(start), regime, weAll, requis)
  let reste = dureeH; const segments = []; let g = 0
  while (reste > 0.001 && g++ < 3000) {
    const fin = finOuvre(cursor, regime, weAll, requis)
    const dispo = (fin - cursor) / 3600000
    if (dispo >= reste) { segments.push({ start: new Date(cursor), end: addH(cursor, reste) }); cursor = addH(cursor, reste); reste = 0 }
    else { if (dispo > 0.001) segments.push({ start: new Date(cursor), end: new Date(fin) }); reste -= Math.max(0, dispo); cursor = prochainOuvre(new Date(fin), regime, weAll, requis) }
  }
  if (!segments.length) segments.push({ start: new Date(start), end: new Date(start) })
  return { segments, end: cursor }
}
function planifierTaches(lots, tDep, regime, weAll, requis, pVdlt, pVdlp, pHoldingH) {
  const tasks = []
  let cursor = prochainOuvre(new Date(tDep), regime, weAll, requis)
  const push = (type, dureeH, extra) => {
    const pl = placer(cursor, dureeH, regime, weAll, requis)
    tasks.push({ type, ...(extra || {}), segments: pl.segments, start: pl.segments[0].start, end: pl.end })
    cursor = pl.end
  }
  let lastPid = null, lastGen = null
  const cpt = {}
  for (const lot of lots) {
    const holdingDep = lastGen && (cursor - lastGen) / 3600000 > pHoldingH
    let cln
    if (lastPid === null || lot.pid !== lastPid) cln = 'gen'   // 1er lot ou produit différent -> nettoyage général
    else if (holdingDep) cln = 'genH'                          // validité campagne dépassée -> nettoyage général
    else cln = 'part'                                          // même produit -> nettoyage partiel
    if (cln === 'gen' || cln === 'genH') { push(cln, pVdlt); lastGen = new Date(cursor) }
    else push('part', pVdlp)
    cpt[lot.pid] = (cpt[lot.pid] || 0) + 1
    push('lot', lot.dLot, { prod: lot.prod, n: cpt[lot.pid], uid: lot.uid })
    lastPid = lot.pid
  }
  return { tasks, fin: cursor }
}

// Moteur d'ordonnancement
// --- Panier par équipement (produits à planifier + ordre) ---
const panierEquip = reactive({})
const panierOuvert = ref(null)
const rechProd = ref('')
// Glisser-déposer des campagnes sur le Gantt
const dragInfo = ref(null)
function dragStart(eqId, uid) { dragInfo.value = { eqId, uid } }
function dropSur(eqId, uid) {
  const d = dragInfo.value; dragInfo.value = null
  if (!d || d.eqId !== eqId || d.uid === uid) return
  const arr = panierEquip[eqId]; if (!arr) return
  const from = arr.findIndex(i => i.uid === d.uid); if (from < 0) return
  const [moved] = arr.splice(from, 1)
  const to = arr.findIndex(i => i.uid === uid)
  if (to < 0) arr.push(moved); else arr.splice(to, 0, moved)
  sauverPanier(eqId)
}
const panierErreur = ref('')
async function sauverPanier(id) {
  try {
    const r = await supabase.from('planning_panier').upsert({ equipement_id: id, produits: panierEquip[id] || [], regime: regimeEquip[id] || '3x8', requis: requisEquip[id] || [], updated_at: new Date().toISOString() }, { onConflict: 'equipement_id' })
    panierErreur.value = r.error ? ('Panier non sauvegardé : ' + r.error.message + ' — crée la table planning_panier (voir SQL).') : ''
  } catch (e) { panierErreur.value = 'Panier non sauvegardé : ' + String(e) }
}
let uidCounter = 0
function uidGen() { return 'l' + Date.now().toString(36) + (uidCounter++) }
const nbAjout = ref(1)
function ouvrirPanier(eq) { panierOuvert.value = eq; rechProd.value = ''; nbAjout.value = 1 }
function viderPanier() { if (!panierOuvert.value) return; if (!confirm('Vider le panier de cet équipement ?')) return; const id = panierOuvert.value.id; panierEquip[id] = []; sauverPanier(id) }
function ajouterPanier(pid) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; if (!panierEquip[id]) panierEquip[id] = []; const n = Math.max(1, Number(nbAjout.value) || 1); for (let k = 0; k < n; k++) panierEquip[id].push({ pid, uid: uidGen() }); sauverPanier(id) }
function retirerGroupe(grp) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; const set = new Set(grp.uids); panierEquip[id] = (panierEquip[id] || []).filter(i => !set.has(i.uid)); sauverPanier(id) }
const requisDate = ref('')
function setRegime(v) { if (!panierOuvert.value) return; regimeEquip[panierOuvert.value.id] = v; sauverPanier(panierOuvert.value.id) }
function ajouterRequis() { if (!panierOuvert.value || !requisDate.value) return; const id = panierOuvert.value.id; if (!requisEquip[id]) requisEquip[id] = []; if (!requisEquip[id].includes(requisDate.value)) requisEquip[id].push(requisDate.value); requisEquip[id].sort(); requisDate.value = ''; sauverPanier(id) }
function retirerRequis(dt) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; requisEquip[id] = (requisEquip[id] || []).filter(d => d !== dt); sauverPanier(id) }
function produitNom(pid) { const p = produitsById.value[pid]; return p ? (p.code_pf + ' — ' + p.designation) : String(pid) }
const campagnesPanier = computed(() => {
  if (!panierOuvert.value) return []
  const arr = panierEquip[panierOuvert.value.id] || []
  const groups = []
  for (const item of arr) {
    const last = groups[groups.length - 1]
    if (last && last.pid === item.pid) { last.count++; last.uids.push(item.uid) }
    else groups.push({ pid: item.pid, count: 1, uids: [item.uid] })
  }
  return groups
})
const produitsAjoutables = computed(() => {
  if (!panierOuvert.value) return []
  const q = rechProd.value.trim().toLowerCase()
  return produits.value.filter(p => (!q || (p.code_pf + ' ' + (p.designation || '')).toLowerCase().includes(q))).slice(0, 40)
})

const planning = computed(() => {
  const t0 = new Date(dateDepart.value + 'T06:00:00')
  const rows = []
  const equipsFab = equipements.value.filter(e => estFab(e.type)).sort((a, b) => (phaseOrdre(a.type) - phaseOrdre(b.type)) || String(a.code).localeCompare(String(b.code)))
  for (const eq of equipsFab) {
    const pan = panierEquip[eq.id]
    let lots = []
    if (pan && pan.length) {
      for (const item of pan) {
        const prod = produitsById.value[item.pid]; if (!prod) continue
        const cad = cadences.value.find(c => c.equipement_id === eq.id && c.produit_id === item.pid)
        lots.push({ pid: item.pid, uid: item.uid, prod, dLot: cad ? Math.max(0.25, dureeLotH(prod, cad)) : 8 })
      }
    }
    const eqVdlt = (eq.vdlt != null && eq.vdlt !== '') ? Number(eq.vdlt) : vdlt.value
    const eqVdlp = (eq.vdlp != null && eq.vdlp !== '') ? Number(eq.vdlp) : vdlp.value
    const eqHoldingH = (eq.dht != null && eq.dht !== '') ? Number(eq.dht) * 24 : holdingH.value
    const regime = regimeEquip[eq.id] || '3x8'
    const requis = new Set(requisEquip[eq.id] || [])
    const r = planifierTaches(lots, t0, regime, !!weekendEquip[eq.id], requis, eqVdlt, eqVdlp, eqHoldingH)
    rows.push({ eq, tasks: r.tasks, fin: r.fin })
  }
  return rows
})

// Bornes temps
const t0 = computed(() => new Date(dateDepart.value + 'T06:00:00'))
const finGlobale = computed(() => {
  let m = t0.value
  for (const r of planning.value) if (r.fin > m) m = r.fin
  return m
})
const totalHeures = computed(() => Math.max(24, Math.ceil((finGlobale.value - t0.value) / 3600000) + 8))
const totalW = computed(() => totalHeures.value * pxH.value)

// Jours (colonnes)
const jours = computed(() => {
  const out = []
  const start = new Date(t0.value); start.setHours(0, 0, 0, 0)
  const n = Math.ceil(totalHeures.value / 24) + 1
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const left = ((d - t0.value) / 3600000) * pxH.value
    out.push({ i, left, w: 24 * pxH.value, weekend: d.getDay() === 5 || d.getDay() === 6, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) })
  }
  return out
})
const joursWeekend = computed(() => jours.value.filter(d => d.weekend))

// Position des barres (par segment)
function barStyleSeg(seg, t) {
  const left = ((seg.start - t0.value) / 3600000) * pxH.value
  const w = Math.max(2, ((seg.end - seg.start) / 3600000) * pxH.value)
  const s = { left: left + 'px', width: w + 'px' }
  if (t.type === 'lot') { const c = couleurProd(t.prod.code_pf); s.background = c.bg; s.borderColor = c.bd }
  return s
}

// Couleur par produit (stable)
const palette = [
  ['#dbeafe', '#3b82f6'], ['#dcfce7', '#22c55e'], ['#fef9c3', '#eab308'], ['#fae8ff', '#d946ef'],
  ['#ffedd5', '#f97316'], ['#cffafe', '#06b6d4'], ['#e0e7ff', '#6366f1'], ['#fee2e2', '#ef4444'],
  ['#d1fae5', '#10b981'], ['#ede9fe', '#8b5cf6']
]
function couleurProd(code) {
  let h = 0; const s = String(code || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const [bg, bd] = palette[h % palette.length]
  return { bg, bd }
}

// Helpers affichage
const fmtJH = (d) => d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
function titre(t) {
  const p = fmtJH(t.start) + ' → ' + fmtJH(t.end)
  if (t.type === 'lot') return t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + t.n + '  •  ' + p
  if (t.type === 'gen') return 'Nettoyage général (début campagne)  •  ' + p
  if (t.type === 'genH') return 'Nettoyage général (holding dépassé)  •  ' + p
  return 'Nettoyage partiel  •  ' + p
}

// Récap
const totalLots = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'lot').length, 0))
const totalNG = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length, 0))
const totalNP = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'part').length, 0))
</script>

<style scoped>
.pe-page { color: #1b2733; }
.pe-head h1 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
.pe-head .sub { margin: 3px 0 12px; color: #64748b; font-size: 12px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 12px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

.params { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.p-grp label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: #475569; }
.p-grp input, .p-grp select { font-size: 13px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; color: #1b2733; }
.p-grp input[type=range] { padding: 0; }
.vue-btns { display: flex; gap: 4px; }
.vue-btn { background: #eef2f7; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; padding: 5px 11px; cursor: pointer; color: #475569; font-weight: 600; }
.vue-btn.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.p-grp .chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }

.legende { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; font-size: 11px; color: #475569; }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 14px; height: 12px; border-radius: 3px; display: inline-block; }
.sw-lot { background: #dbeafe; border: 1px solid #3b82f6; }
.sw-gen { background: #7f1d1d; }
.sw-part { background: #cbd5e1; }

.gantt-card { padding: 0; overflow: hidden; }
.gantt { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 320px); }
.g-header { display: flex; position: sticky; top: 0; z-index: 5; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.g-eqcol { flex: 0 0 190px; width: 190px; padding: 6px 10px; border-right: 1px solid #e2e8f0; background: #fff; position: sticky; left: 0; z-index: 3; }
.g-eqhead { display: flex; align-items: center; font-size: 11px; font-weight: 800; color: #475569; background: #f8fafc; }
.g-timeline { position: relative; height: 40px; }
.g-dcol { position: absolute; top: 0; height: 40px; border-left: 1px solid #e2e8f0; box-sizing: border-box; }
.g-dlbl { font-size: 10px; font-weight: 700; color: #334155; padding: 2px 4px; white-space: nowrap; }
.g-shifts { display: flex; }
.g-sh { font-size: 8px; color: #94a3b8; border-left: 1px dashed #e2e8f0; padding-left: 2px; box-sizing: border-box; }

.g-row { display: flex; border-bottom: 1px solid #f1f5f9; }
.g-eqcode { font-size: 11px; font-weight: 800; color: #0f172a; }
.g-eqnom { font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-eqfin { font-size: 8.5px; color: #94a3b8; }
.g-eqwe { display: flex; align-items: center; gap: 3px; font-size: 8px; color: #64748b; margin-top: 1px; cursor: pointer; }
.g-track { position: relative; height: 44px; }
.g-dband { position: absolute; top: 0; bottom: 0; border-left: 1px solid #f1f5f9; box-sizing: border-box; z-index: 0; }
.g-weekend { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 6px, #e9edf3 6px, #e9edf3 12px); z-index: 0; }
.g-bar { position: absolute; top: 4px; height: 26px; border-radius: 4px; border: 1px solid; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; cursor: default; z-index: 1; }
.g-bar.g-lot, .g-bar.g-gen, .g-bar.g-genH, .g-bar.g-part { }
.g-lbl { font-size: 8.5px; font-weight: 700; padding: 0 3px; white-space: nowrap; color: #1e293b; }
.g-gen, .g-genH { background: #7f1d1d; border-color: #7f1d1d; }
.g-gen .g-lbl, .g-genH .g-lbl { color: #fff; }
.g-genH { background: repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 4px, #991b1b 4px, #991b1b 8px); }
.g-part { background: #cbd5e1; border-color: #94a3b8; }
.g-part .g-lbl { color: #334155; }

.recap h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #0f172a; }
.recap-grid { display: flex; flex-wrap: wrap; gap: 22px; }
.rc { display: flex; flex-direction: column; }
.rc-v { font-size: 18px; font-weight: 800; color: #0f172a; }
.rc-l { font-size: 10px; color: #64748b; }
.g-eqcol { cursor: pointer; }
.g-pan { font-size: 8px; color: #0f766e; font-weight: 700; }
.pan-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
.pan-box { background: #fff; border-radius: 14px; width: 520px; max-width: 92vw; max-height: 82vh; overflow-y: auto; padding: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
.pan-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pan-head b { font-size: 15px; color: #0f172a; }
.pan-nom { font-size: 12px; color: #64748b; }
.pan-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
.pan-head-btns { display: flex; align-items: center; gap: 8px; }
.pan-vider { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 7px; font-size: 12px; padding: 4px 12px; cursor: pointer; font-weight: 600; }
.pan-vider:disabled { opacity: .4; cursor: default; }
.pan-hint { font-size: 11px; color: #94a3b8; margin: 0 0 10px; }
.pan-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.pan-item { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; }
.pan-idx { font-size: 11px; font-weight: 800; color: #5B9BD5; width: 18px; }
.pan-pnom { flex: 1; font-size: 12px; color: #1b2733; }
.pan-nb { width: 52px; padding: 3px 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; text-align: right; }
.pan-nblbl { font-size: 10px; color: #94a3b8; }
.pan-btn { background: #eef2f7; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; padding: 2px 7px; cursor: pointer; }
.pan-btn:disabled { opacity: .35; cursor: default; }
.pan-btn.del { color: #dc2626; }
.pan-vide { font-size: 12px; color: #94a3b8; padding: 8px; text-align: center; }
.pan-add { border-top: 1px solid #e2e8f0; padding-top: 10px; }
.pan-search { width: 100%; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-bottom: 8px; box-sizing: border-box; }
.pan-prods { display: flex; flex-wrap: wrap; gap: 5px; }
.pan-chip { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 12px; font-size: 11px; padding: 3px 10px; cursor: pointer; font-weight: 600; }
.pan-chip:hover { background: #dbeafe; }
.pan-none { font-size: 11px; color: #94a3b8; }
.pan-add-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.pan-add-row .pan-search { margin-bottom: 0; flex: 1; }
.pan-nbadd { font-size: 11px; color: #475569; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.pan-nbadd .pan-nb { width: 52px; }
.pan-hint2 { font-size: 10px; color: #94a3b8; margin: 0 0 10px; }
.pan-cfg { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
.pan-reg { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 5px; }
.pan-reg select { font-size: 12px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.pan-requis { margin-bottom: 10px; }
.pan-req-head { font-size: 11px; color: #64748b; margin-bottom: 5px; font-weight: 600; }
.pan-req-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
.pan-req-chip { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; border-radius: 10px; font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
.pan-req-chip button { background: none; border: none; color: #b45309; cursor: pointer; font-size: 11px; padding: 0; }
.pan-req-add { display: flex; gap: 6px; align-items: center; }
.pan-reqdate { font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.g-drag { cursor: grab; }
.g-drag:active { cursor: grabbing; }
.g-dragging { opacity: .5; outline: 2px dashed #5B9BD5; outline-offset: -1px; }
</style>
