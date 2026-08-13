<template>
  <div class="pe-page">
    <div class="pe-head">
      <h1>Planning des équipements — Fabrication</h1>
    </div>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="panierErreur" class="alert">{{ panierErreur }}</p>


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
        <div class="rc"><span class="rc-v">{{ totalMP }}</span><span class="rc-l">Arrêt MP (h)</span></div>
        <div class="rc"><span class="rc-v">{{ totalMC }}</span><span class="rc-l">Arrêt MC (h)</span></div>
        <div class="rc"><span class="rc-v">{{ totalAT }}</span><span class="rc-l">Arrêt AT (h)</span></div>
        <div class="rc"><span class="rc-v">{{ fmtJH(finGlobale) }}</span><span class="rc-l">Fin la plus tardive</span></div>
      </div>
      <div class="synth-eq" v-if="synthEquip.length">
        <table class="synth-tbl">
          <thead><tr><th>Équipement</th><th class="right">Lots</th><th class="right">NG</th><th class="right">NP</th><th class="right">MP</th><th class="right">MC</th><th class="right">AT</th><th>Régime</th><th class="right">Fin</th></tr></thead>
          <tbody>
            <tr v-for="e in synthEquip" :key="e.id">
              <td>{{ e.code }} <span class="synth-nom">{{ e.nom }}</span></td>
              <td class="right">{{ e.lots }}</td>
              <td class="right">{{ e.ng }}</td>
              <td class="right">{{ e.np }}</td>
              <td class="right">{{ e.mp || '—' }}</td>
              <td class="right">{{ e.mc || '—' }}</td>
              <td class="right">{{ e.at || '—' }}</td>
              <td>{{ e.regime === '2x8' ? '2×8' : '3×8' }}</td>
              <td class="right nowrap">{{ fmtJH(e.fin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="pe-body">
    <section class="card params params-side">
      <div class="p-grp"><label>Départ</label><div class="dep-row"><input type="date" v-model="dateDepart" /><button type="button" class="vue-btn" @click="dateDepart = iso(new Date())">Auj.</button></div></div>
      <div class="p-grp"><label>Affichage</label>
        <div class="vue-btns">
          <button type="button" class="vue-btn" :class="{ on: pxH >= 15 }" @click="pxH = 20">Jour</button>
          <button type="button" class="vue-btn" :class="{ on: pxH >= 2.5 && pxH < 15 }" @click="pxH = 3.5">Semaine</button>
          <button type="button" class="vue-btn" :class="{ on: pxH < 2.5 }" @click="pxH = 0.8">Mois</button>
        </div>
      </div>
      <div class="p-grp"><label>Zoom<input type="range" min="0.5" max="24" step="0.5" v-model.number="pxH" /></label></div>
      <div class="p-grp"><label>Filtre<input type="text" v-model="filtreTexte" placeholder="code / nom…" /></label></div>
      <div class="p-grp"><label>Phase
        <select v-model="filtrePhase">
          <option value="">Toutes</option>
          <option value="1">Pesée</option>
          <option value="2">Granulation</option>
          <option value="3">Séchage</option>
          <option value="4">Mélange</option>
          <option value="5">Compression</option>
          <option value="6">Remplissage</option>
          <option value="7">Pelliculage</option>
        </select>
      </label></div>
      <div class="p-grp"><label class="chk-inline"><input type="checkbox" v-model="filtreAvecPlan" /> Avec planning</label></div>
    </section>
      <div class="pe-gantt-wrap">
    <div v-if="chargement" class="empty">Chargement…</div>
    <div v-else-if="!planning.length" class="empty">Aucun équipement de fabrication trouvé.</div>

    <!-- Gantt -->
    <section v-else class="card gantt-card">
      <div class="gantt">
        <!-- entête temps -->
        <div class="g-header">
          <div class="g-eqcol g-eqhead">Équipement</div>
          <div class="g-track g-timeline" :style="{ width: totalW + 'px' }">
            <div v-for="d in jours" :key="d.i" class="g-dcol" :class="{ 'g-dcol-dep': d.depart }" :style="{ left: d.left + 'px', width: d.w + 'px' }">
              <div class="g-dlbl">{{ d.label }}<span v-if="d.depart" class="g-dep-lbl"> ▸ Départ</span></div>
              <div class="g-shifts">
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">06</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">14</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">22</span>
              </div>
            </div>
            <div v-if="posMaintenant != null" class="g-now-head" :style="{ left: posMaintenant + 'px' }"><span>{{ heureMaintenant }}</span></div>
          </div>
        </div>
        <!-- lignes -->
        <div v-for="row in planning" :key="row.eq.id" class="g-row">
          <div class="g-eqcol" :title="'Cliquer pour gérer le panier — ' + row.eq.nom" @click="ouvrirPanier(row.eq)">
            <div class="g-eqcode">{{ row.eq.code }} <span class="g-reg" :class="{ r2: (regimeEquip[row.eq.id] || '3x8') === '2x8' }">{{ (regimeEquip[row.eq.id] || '3x8') === '2x8' ? '2×8' : '3×8' }}</span> <span v-if="(panierEquip[row.eq.id] || []).length" class="g-pan">🧺 {{ (panierEquip[row.eq.id] || []).length }}</span></div>
            <div class="g-eqnom">{{ row.eq.nom }}</div>
            <div class="g-eqfin">fin : {{ fmtJH(row.fin) }}</div>
            <label class="g-eqwe" @click.stop><input type="checkbox" v-model="weekendEquip[row.eq.id]" @change="sauverPanier(row.eq.id)" /> week-ends</label>
          </div>
          <div class="g-track" :style="{ width: totalW + 'px' }">
            <!-- bandes jours -->
            <div v-for="d in jours" :key="'b'+d.i" class="g-dband" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <!-- bandes week-end (si l'équipement ne travaille pas le week-end) -->
            <template v-if="!weekendEquip[row.eq.id]">
              <div v-for="d in joursWeekend" :key="'w'+d.i" class="g-weekend" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            </template>
            <div v-for="d in jourDepart" :key="'dep'+d.i" class="g-depart" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <div v-for="(m, mi) in (maintEquip[row.eq.id] || [])" :key="'mnt'+mi" class="g-maint" :class="{ 'g-maint-curr': m.type === 'curr', 'g-maint-tech': m.type === 'tech' }" :style="maintStyle(m)" :title="maintLibelle(m.type) + ' — ' + m.dureeH + ' h'"><span class="g-maint-lbl">{{ maintAbrev(m.type) }}</span></div>
            <div v-if="posMaintenant != null" class="g-now" :style="{ left: posMaintenant + 'px' }"></div>
            <!-- barres (par segment) -->
            <template v-for="(t, i) in row.tasks">
              <div v-for="(seg, j) in t.segments" :key="i + '-' + j" class="g-bar"
                   :class="[('g-' + t.type), { 'g-drag': t.type === 'lot', 'g-dragging': dragInfo && t.type === 'lot' && dragInfo.eqId === row.eq.id && dragInfo.uid === t.uid }]"
                   :style="barStyleSeg(seg, t)" :title="t.type === 'lot' ? (titre(t) + '  •  glisser ce lot pour réordonner') : titre(t)"
                   :draggable="t.type === 'lot' ? 'true' : 'false'"
                   @dragstart="t.type === 'lot' ? dragStart(row.eq.id, t.uid) : null"
                   @dragover.prevent
                   @drop="t.type === 'lot' ? dropSur(row.eq.id, t.uid) : null">
                <span v-if="j === 0" class="g-lbl">{{ t.type === 'lot' ? (t.prod.code_pf + (t.turbNo ? ' T' + t.turbNo : '')) : (t.type.startsWith('gen') ? 'NG' : 'NP') }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>
      </div>
    </div>

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
          <div class="pan-req-head">Réquisitions week-end (date + régime) :</div>
          <div class="pan-req-list">
            <span v-for="req in (requisEquip[panierOuvert.id] || [])" :key="req.d || req" class="pan-req-chip">{{ req.d || req }} <b>{{ (req.r || '3x8') === '2x8' ? '2×8' : '3×8' }}</b> <button @click="retirerRequis(req.d || req)">✕</button></span>
            <span v-if="!(requisEquip[panierOuvert.id] || []).length" class="pan-none">Aucune.</span>
          </div>
          <div class="pan-req-add">
            <input type="date" v-model="requisDate" class="pan-reqdate" />
            <select v-model="requisRegime" class="pan-reqreg"><option value="3x8">3×8</option><option value="2x8">2×8</option></select>
            <button class="vue-btn" @click="ajouterRequis">Ajouter</button>
          </div>
        </div>
        <div class="pan-requis">
          <div class="pan-req-head">Arrêts maintenance (équipement indisponible) :</div>
          <div class="pan-req-list">
            <span v-for="(m, mi) in (maintEquip[panierOuvert.id] || [])" :key="mi" class="pan-req-chip" :class="{ 'pan-maint-curr': m.type === 'curr', 'pan-maint-tech': m.type === 'tech' }">{{ maintNom(m.type) }} · {{ fmtMaint(m.debut) }} · {{ m.dureeH }}h <button @click="retirerMaint(mi)">✕</button></span>
            <span v-if="!(maintEquip[panierOuvert.id] || []).length" class="pan-none">Aucun.</span>
          </div>
          <div class="pan-req-add">
            <select v-model="maintType" class="pan-reqreg"><option value="prev">Préventif</option><option value="curr">Curatif</option><option value="tech">Technique</option></select>
            <input type="datetime-local" v-model="maintDebut" class="pan-reqdate" />
            <input type="number" min="0.25" step="0.25" v-model.number="maintDuree" class="pan-nb" title="Durée (h)" />
            <button class="vue-btn" @click="ajouterMaint">Ajouter</button>
          </div>
        </div>
        <div class="pan-list">
          <div v-for="(item, idx) in (panierEquip[panierOuvert.id] || [])" :key="item.ordreId" class="pan-item">
            <span class="pan-idx">{{ idx + 1 }}</span>
            <span class="pan-pnom"><b>{{ item.lot }}</b> — {{ produitNom(item.pid) }}</span>
            <button class="pan-btn del" @click="retirerLot(idx)">✕</button>
          </div>
          <div v-if="!(panierEquip[panierOuvert.id] || []).length" class="pan-vide">Aucun lot affecté à cet équipement.</div>
        </div>
        <p class="pan-hint2">Lots en attente de cette phase. Réordonne-les en les <b>glissant sur le Gantt</b>.</p>
        <div class="pan-add">
          <input v-model="rechProd" placeholder="Rechercher un lot (n°, produit)…" class="pan-search" />
          <div class="pan-prods">
            <button v-for="l in lotsAjoutables" :key="l.id" class="pan-chip" :class="{ 'pan-chip-plan': l.plan, 'pan-chip-cours': l.cours }" @click="ajouterLot(l)" :title="(l.plan ? 'Planifié — ' : (l.cours ? 'En cours — ' : 'En attente — ')) + l.code + ' — ' + l.desig">{{ l.lot }}</button>
            <span v-if="!lotsAjoutables.length" class="pan-none">Aucun lot en attente pour cette phase.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase'

const chargement = ref(true)
const erreur = ref('')

// Paramètres (valeurs fixes réglables)
const today = new Date()
const iso = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + j }
const dateDepart = ref((() => { try { return localStorage.getItem('pe_depart') || '2026-08-11' } catch (e) { return '2026-08-11' } })())
watch(dateDepart, (v) => { try { if (v) localStorage.setItem('pe_depart', v) } catch (e) {} })
const vdlt = ref(8)        // nettoyage général (h)
const vdlp = ref(2)        // nettoyage partiel (h)
const holdingJ = ref(7)    // validité campagne (jours)
const annee = ref(today.getFullYear())
const pxH = ref(4)         // pixels par heure (zoom)
const filtreTexte = ref('')
const filtrePhase = ref('')
const filtreAvecPlan = ref(false)
const weekendEquip = reactive({}) // par équipement : true = tous les week-ends inclus
const regimeEquip = reactive({})  // par équipement : '2x8' ou '3x8'
const requisEquip = reactive({})  // par équipement : dates week-end travaillées
const maintEquip = reactive({})   // par équipement : arrêts [{type,debut,dureeH}]

const holdingH = computed(() => Number(holdingJ.value) * 24)

// Données
const planRaw = ref([])
const cadences = ref([])
const equipements = ref([])
const produits = ref([])
const ofs = ref([])
const suivi = ref([])

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
    const [rp, rc, re, rpr, rpan, rof, rsu] = await Promise.all([
      fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produit_id')),
      fetchAllPaged(() => supabase.from('cadences_produit').select('cadence_nominale, unite_cadence, mode, equipement_id, produit_id')),
      fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id, actif, vdlt, vdlp, dht, reglage, postes').eq('actif', true)),
      fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot, unites_par_boite, poids_unitaire_mg, gamme').eq('actif', true)),
      fetchAllPaged(() => supabase.from('planning_panier').select('equipement_id, produits')),
      fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, statut, quantite_theorique, date_lancement, date_fin_fabrication, produits(id, code_pf, designation, gamme, taille_lot, unites_par_boite, poids_unitaire_mg)')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, date_phase, date_debut').eq('actif', true))
    ])
    if (rp.error || rc.error || re.error || rpr.error) { erreur.value = (rp.error || rc.error || re.error || rpr.error).message; return }
    planRaw.value = rp.data; cadences.value = rc.data; equipements.value = re.data; produits.value = rpr.data
    if (rof && !rof.error) ofs.value = rof.data
    if (rsu && !rsu.error) suivi.value = rsu.data
    if (rpan && !rpan.error && rpan.data) for (const row of rpan.data) {
      let lotsArr = [], reg = null, req = null
      const pr = row.produits
      if (Array.isArray(pr)) lotsArr = pr
      else if (pr && typeof pr === 'object') { lotsArr = Array.isArray(pr.lots) ? pr.lots : []; reg = pr.regime; req = pr.requis; if (typeof pr.weekend === 'boolean') weekendEquip[row.equipement_id] = pr.weekend; if (Array.isArray(pr.maint)) maintEquip[row.equipement_id] = pr.maint }
      const flat = []
      for (const x of lotsArr) {
        if (x && typeof x === 'object' && x.ordreId) flat.push({ ordreId: x.ordreId, lot: x.lot, pid: x.pid })
      }
      panierEquip[row.equipement_id] = flat
      if (reg) regimeEquip[row.equipement_id] = reg
      if (Array.isArray(req)) requisEquip[row.equipement_id] = req
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
// Statut de chaque phase (1..7) par OF, depuis suivi_phases
const phasesLot = computed(() => {
  const m = {}
  for (const sp of suivi.value) {
    const po = phaseOrdre(sp.phase)
    if (po < 1 || po > 7) continue
    const id = sp.ordre_id
    if (!m[id]) m[id] = {}
    if (!m[id][po] || sp.statut === 'Terminé') m[id][po] = sp.statut
  }
  return m
})
const GAMME_DEF = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage', 'Pelliculage']
// Lots réels en attente par phase (à leur 1re phase de gamme non terminée, non démarrée)
const lotsAttentePhase = computed(() => {
  const q = {}
  for (const o of ofs.value) {
    if (o.statut === 'Libéré' || o.statut === 'Rejeté' || o.date_fin_fabrication) continue
    const prod = o.produits || {}
    const gammeB = (Array.isArray(prod.gamme) && prod.gamme.length) ? prod.gamme : GAMME_DEF
    const phases = [...new Set(gammeB.map(phaseOrdre).filter(x => x >= 1 && x <= 7))].sort((a, b) => a - b)
    if (!phases.length) continue
    const pl = phasesLot.value[o.id] || {}
    const base = { id: o.id, lot: o.numero_lot || '—', pid: prod.id, code: prod.code_pf || '—', desig: prod.designation || '' }
    if (Object.keys(pl).length === 0) {
      // OF sans phase enregistrée (planifié / non démarré) -> proposé sur TOUTES les phases de sa gamme
      const planifie = !o.date_lancement
      for (const po of phases) { if (!q[po]) q[po] = []; q[po].push({ ...base, plan: planifie }) }
    } else {
      // OF en fabrication -> à sa phase courante (1re non terminée), en attente OU en cours
      let cur = null
      for (const po of phases) { if (pl[po] !== 'Terminé') { cur = po; break } }
      if (cur == null) continue
      if (!q[cur]) q[cur] = []
      q[cur].push({ ...base, cours: pl[cur] === 'En cours' })
    }
  }
  return q
})
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
// Nombre de turbines par produit (pelliculage) — éditable ici
const TURBINES = [
  { rx: /panadol.*\b1\s*g/i, n: 21 },
  { rx: /panadol.*extra/i, n: 8 },
  { rx: /panadol.*(rhume|grippe)/i, n: 2 },
  { rx: /lipanthyl.*160/i, n: 6 }
]
function nbTurbines(prod) {
  const t = (prod.designation || '') + ' ' + (prod.code_pf || '')
  for (const x of TURBINES) if (x.rx.test(t)) return x.n
  return 1
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
// requis = Map(dateISO -> régime). Régime effectif du jour d (ou null si chômé).
let maintCourant = []
function maintA(d) { const t = d.getTime(); for (const m of maintCourant) if (t >= m.debut && t < m.fin) return m; return null }
function buildMaintList(arr) {
  const out = []
  for (const m of (arr || [])) {
    if (!m || !m.debut) continue
    const deb = new Date(m.debut).getTime()
    if (isNaN(deb)) continue
    const dur = Math.max(0.25, Number(m.dureeH) || 0)
    out.push({ debut: deb, fin: deb + dur * 3600000, type: m.type || 'prev' })
  }
  return out
}
function regJour(d, regimeEq, weAll, requis) {
  const j = d.getDay()
  if (j === 5 || j === 6) {
    if (weAll) return regimeEq
    return (requis && requis.get(isoL(d))) || null
  }
  return regimeEq
}
function buildRequisMap(arr, regimeEq) {
  const m = new Map()
  for (const x of (arr || [])) {
    if (x && typeof x === 'object' && x.d) m.set(x.d, x.r || regimeEq)
    else if (typeof x === 'string') m.set(x, regimeEq)
  }
  return m
}
// Prochain instant ouvré (régime variable par jour)
function prochainOuvre(d, regimeEq, weAll, requis) {
  const c = new Date(d); let g = 0
  while (g++ < 5000) {
    const m = maintA(c); if (m) { c.setTime(m.fin); continue }
    const reg = regJour(c, regimeEq, weAll, requis)
    if (!reg) { c.setDate(c.getDate() + 1); c.setHours(0, 0, 0, 0); continue }
    if (reg === '2x8') {
      const h = c.getHours() + c.getMinutes() / 60
      if (h < 6) { c.setHours(6, 0, 0, 0); continue }
      if (h >= 22) { c.setDate(c.getDate() + 1); c.setHours(0, 0, 0, 0); continue }
    }
    return c
  }
  return c
}
// Fin de la plage ouvrée courante (régime variable par jour)
function finOuvre(d, regimeEq, weAll, requis) {
  let c = new Date(d); let g = 0; let fin = null
  while (g++ < 40) {
    const reg = regJour(c, regimeEq, weAll, requis)
    if (!reg) { fin = c; break }
    if (reg === '2x8') { const f = new Date(c); f.setHours(22, 0, 0, 0); fin = f; break }
    const lend = new Date(c); lend.setDate(lend.getDate() + 1); lend.setHours(0, 0, 0, 0)
    const regL = regJour(lend, regimeEq, weAll, requis)
    if (regL === '3x8') { c = lend; continue }
    fin = lend; break
  }
  if (!fin) fin = c
  const t = d.getTime()
  for (const m of maintCourant) { if (m.debut > t && m.debut < fin.getTime()) fin = new Date(m.debut) }
  return fin
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
// Placement d'un lot en UN SEUL TENANT si noSplit (aucune coupure nuit en 2x8 ni week-end).
// Si le lot ne tient pas dans la fenêtre courante, on décale au début de la fenêtre suivante.
function placerLot(start, dureeH, regime, weAll, requis, noSplit) {
  let sdeb = prochainOuvre(new Date(start), regime, weAll, requis)
  if (noSplit) {
    let g = 0
    while (g++ < 120) {
      const pl = placer(sdeb, dureeH, regime, weAll, requis)
      if (pl.segments.length <= 1) return pl        // contigu -> OK
      sdeb = new Date(pl.segments[1].start)          // décalage à la fenêtre suivante
    }
  }
  return placer(sdeb, dureeH, regime, weAll, requis)
}
// Instant ouvré ? (régime variable par jour)
function estOuvre(d, regimeEq, weAll, requis) {
  if (maintA(d)) return false
  const reg = regJour(d, regimeEq, weAll, requis)
  if (!reg) return false
  if (reg === '2x8') { const h = d.getHours() + d.getMinutes() / 60; if (h < 6 || h >= 22) return false }
  return true
}
// Début de la plage ouvrée qui se termine à 'd'
function debutPlageAvant(d, regime, weAll, requis) {
  let c = new Date(d.getTime() - 1); let g = 0
  while (!estOuvre(c, regime, weAll, requis) && g++ < 20000) c = new Date(c.getTime() - 60000)
  let deb = new Date(c); g = 0
  while (g++ < 20000) { const t = new Date(deb.getTime() - 60000); if (!estOuvre(t, regime, weAll, requis)) break; deb = t }
  return deb
}
// Recule de dureeH heures ouvrées à partir de 'end' -> instant de début
function reculerOuvre(end, dureeH, regime, weAll, requis) {
  let curEnd = new Date(end); let reste = dureeH; let g = 0
  while (reste > 0.001 && g++ < 300) {
    const deb = debutPlageAvant(curEnd, regime, weAll, requis)
    const dispo = (curEnd - deb) / 3600000
    if (dispo >= reste) return new Date(curEnd.getTime() - reste * 3600000)
    reste -= dispo
    curEnd = new Date(deb.getTime() - 1)
  }
  return curEnd
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
  const from = arr.findIndex(i => i.ordreId === d.uid); if (from < 0) return
  const [moved] = arr.splice(from, 1)
  const to = arr.findIndex(i => i.ordreId === uid)
  if (to < 0) arr.push(moved); else arr.splice(to, 0, moved)
  sauverPanier(eqId)
}
const panierErreur = ref('')
async function sauverPanier(id) {
  try {
    const r = await supabase.from('planning_panier').upsert({ equipement_id: id, produits: { lots: panierEquip[id] || [], regime: regimeEquip[id] || '3x8', requis: requisEquip[id] || [], weekend: !!weekendEquip[id], maint: maintEquip[id] || [] }, updated_at: new Date().toISOString() }, { onConflict: 'equipement_id' })
    panierErreur.value = r.error ? ('Panier non sauvegardé : ' + r.error.message + ' — crée la table planning_panier (voir SQL).') : ''
  } catch (e) { panierErreur.value = 'Panier non sauvegardé : ' + String(e) }
}
let uidCounter = 0
function uidGen() { return 'l' + Date.now().toString(36) + (uidCounter++) }
function ouvrirPanier(eq) { panierOuvert.value = eq; rechProd.value = '' }
function viderPanier() { if (!panierOuvert.value) return; if (!confirm('Vider le panier de cet équipement ?')) return; const id = panierOuvert.value.id; panierEquip[id] = []; sauverPanier(id) }
function ajouterLot(l) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; if (!panierEquip[id]) panierEquip[id] = []; if (!panierEquip[id].some(i => i.ordreId === l.id)) panierEquip[id].push({ ordreId: l.id, lot: l.lot, pid: l.pid }); sauverPanier(id) }
function retirerLot(idx) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; const a = panierEquip[id]; if (a) { a.splice(idx, 1); sauverPanier(id) } }
const requisDate = ref('')
const requisRegime = ref('3x8')
function setRegime(v) { if (!panierOuvert.value) return; regimeEquip[panierOuvert.value.id] = v; sauverPanier(panierOuvert.value.id) }
function ajouterRequis() { if (!panierOuvert.value || !requisDate.value) return; const id = panierOuvert.value.id; if (!requisEquip[id]) requisEquip[id] = []; const d = requisDate.value; if (!requisEquip[id].some(x => (typeof x === 'object' ? x.d : x) === d)) requisEquip[id].push({ d, r: requisRegime.value }); requisEquip[id].sort((a, b) => ((a && a.d) || a).localeCompare((b && b.d) || b)); requisDate.value = ''; sauverPanier(id) }
function retirerRequis(dt) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; requisEquip[id] = (requisEquip[id] || []).filter(x => (typeof x === 'object' ? x.d : x) !== dt); sauverPanier(id) }
const maintType = ref('prev')
const maintDebut = ref('')
const maintDuree = ref(8)
function ajouterMaint() { if (!panierOuvert.value || !maintDebut.value) return; const id = panierOuvert.value.id; if (!maintEquip[id]) maintEquip[id] = []; maintEquip[id].push({ type: maintType.value, debut: maintDebut.value, dureeH: Math.max(0.25, Number(maintDuree.value) || 8) }); maintEquip[id].sort((a, b) => String(a.debut).localeCompare(String(b.debut))); maintDebut.value = ''; sauverPanier(id) }
function retirerMaint(idx) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; const a = maintEquip[id]; if (a) { a.splice(idx, 1); sauverPanier(id) } }
function fmtMaint(dt) { const d = new Date(dt); return isNaN(d) ? dt : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function maintAbrev(t) { return t === 'curr' ? 'MC' : t === 'tech' ? 'AT' : 'MP' }
function maintNom(t) { return t === 'curr' ? 'Curatif' : t === 'tech' ? 'Technique' : 'Préventif' }
function maintLibelle(t) { return t === 'curr' ? 'Maintenance curative' : t === 'tech' ? 'Arrêt technique / essai / étalonnage' : 'Maintenance préventive' }
function maintStyle(m) { const deb = new Date(m.debut).getTime(); const left = ((deb - t0.value.getTime()) / 3600000) * pxH.value; const w = Math.max(2, (Number(m.dureeH) || 0) * pxH.value); return { left: left + 'px', width: w + 'px' } }
function produitNom(pid) { const p = produitsById.value[pid]; return p ? (p.code_pf + ' — ' + p.designation) : String(pid) }
const phaseOuvert = computed(() => panierOuvert.value ? phaseOrdre(panierOuvert.value.type) : null)
const lotsAjoutables = computed(() => {
  if (!panierOuvert.value) return []
  const ph = phaseOuvert.value
  const dans = new Set((panierEquip[panierOuvert.value.id] || []).map(i => i.ordreId))
  const q = rechProd.value.trim().toLowerCase()
  return (lotsAttentePhase.value[ph] || []).filter(l => !dans.has(l.id) && (!q || (l.lot + ' ' + l.code + ' ' + (l.desig || '')).toLowerCase().includes(q))).slice(0, 150)
})

const planning = computed(() => {
  const t0v = new Date(dateDepart.value + 'T06:00:00')
  const q = filtreTexte.value.trim().toLowerCase()
  const equipsFab = equipements.value.filter(e => estFab(e.type))
  const paramsEq = (eq) => ({
    regime: regimeEquip[eq.id] || '3x8',
    weAll: !!weekendEquip[eq.id],
    requis: buildRequisMap(requisEquip[eq.id], regimeEquip[eq.id] || '3x8'),
    vdlt: (eq.vdlt != null && eq.vdlt !== '') ? Number(eq.vdlt) : vdlt.value,
    vdlp: (eq.vdlp != null && eq.vdlp !== '') ? Number(eq.vdlp) : vdlp.value,
    holdingH: (eq.dht != null && eq.dht !== '') ? Number(eq.dht) * 24 : holdingH.value
  })
  const eqTasks = {}, eqCursor = {}, eqLastPid = {}, eqLastGen = {}
  const lotReady = {}  // pid#idx -> fin de la phase précédente du même lot
  // Ordonnancement de flux : phase par phase (1=pesée -> 7=pelliculage)
  for (let ph = 1; ph <= 7; ph++) {
    const eqsPh = equipsFab.filter(e => phaseOrdre(e.type) === ph).sort((a, b) => String(a.code).localeCompare(String(b.code)))
    for (const eq of eqsPh) {
      const pan = panierEquip[eq.id]
      if (!pan || !pan.length) continue
      const P = paramsEq(eq)
      maintCourant = buildMaintList(maintEquip[eq.id])
      if (eqCursor[eq.id] === undefined) eqCursor[eq.id] = prochainOuvre(new Date(t0v), P.regime, P.weAll, P.requis)
      if (!eqTasks[eq.id]) eqTasks[eq.id] = []
      for (const item of pan) {
        const prod = produitsById.value[item.pid]; if (!prod) continue
        const key = item.ordreId
        const readyPhase = lotReady[key] || new Date(t0v)  // fin de la phase précédente
        const cad = cadences.value.find(c => c.equipement_id === eq.id && c.produit_id === item.pid)
        const dLotFull = cad ? Math.max(0.25, dureeLotH(prod, cad)) : 8
        // Pelliculage : chaque turbine = un lot séparé
        let nbTurb = (ph === 7) ? nbTurbines(prod) : 1
        let dRun = dLotFull
        if (nbTurb > 1) {
          const cN = cad ? (Number(cad.cadence_nominale) || 0) : 0
          const kg = poidsLotKg(prod)
          dRun = (cN > 0 && kg > 0) ? Math.max(0.25, (kg / nbTurb) / cN) : Math.max(0.25, dLotFull / nbTurb)
        }
        const noWeekend = (ph === 2 || ph === 4 || ph === 7)  // granulation, mélange, pelliculage
        let finLot = null
        for (let k = 1; k <= nbTurb; k++) {
          let cursor = eqCursor[eq.id]
          const lastPid = eqLastPid[eq.id], lastGen = eqLastGen[eq.id]
          const holdingDep = lastGen && (cursor - lastGen) / 3600000 > P.holdingH
          const cln = (lastPid == null || item.pid !== lastPid) ? 'gen' : (holdingDep ? 'genH' : 'part')
          const C = (cln === 'gen' || cln === 'genH') ? P.vdlt : P.vdlp
          const clFinSiMaintenant = placer(cursor, C, P.regime, P.weAll, P.requis).end
          // 1re turbine : attend la fin de la phase précédente ; les suivantes enchaînent sur l'équipement
          const ready = (k === 1) ? readyPhase : new Date(t0v)
          let debut = clFinSiMaintenant > ready ? clFinSiMaintenant : ready
          debut = prochainOuvre(new Date(debut), P.regime, P.weAll, P.requis)
          const plLot = placerLot(debut, dRun, P.regime, P.weAll, P.requis, noWeekend)
          const lotStart = plLot.segments[0].start
          const clStart = reculerOuvre(lotStart, C, P.regime, P.weAll, P.requis)
          const plClean = placer(clStart, C, P.regime, P.weAll, P.requis)
          eqTasks[eq.id].push({ type: cln, segments: plClean.segments, start: plClean.segments[0].start, end: plClean.end })
          if (cln === 'gen' || cln === 'genH') eqLastGen[eq.id] = new Date(plClean.end)
          eqTasks[eq.id].push({ type: 'lot', prod, lot: item.lot, uid: item.ordreId, turbines: nbTurb, turbNo: (nbTurb > 1 ? k : null), segments: plLot.segments, start: lotStart, end: plLot.end })
          eqCursor[eq.id] = plLot.end; eqLastPid[eq.id] = item.pid
          finLot = plLot.end
        }
        lotReady[key] = new Date(finLot)  // prêt pour la phase suivante (après la dernière turbine)
      }
    }
  }
  // Lignes affichées (filtres)
  const rows = []
  const eqsSorted = equipsFab.filter(e => {
    if (filtrePhase.value && phaseOrdre(e.type) !== Number(filtrePhase.value)) return false
    if (filtreAvecPlan.value && !(panierEquip[e.id] && panierEquip[e.id].length)) return false
    if (q && !((e.code + ' ' + (e.nom || '')).toLowerCase().includes(q))) return false
    return true
  }).sort((a, b) => (phaseOrdre(a.type) - phaseOrdre(b.type)) || String(a.code).localeCompare(String(b.code)))
  for (const eq of eqsSorted) rows.push({ eq, tasks: eqTasks[eq.id] || [], fin: eqCursor[eq.id] || new Date(t0v) })
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
    out.push({ i, left, w: 24 * pxH.value, weekend: d.getDay() === 5 || d.getDay() === 6, aujourdhui: isoL(d) === isoL(new Date()), depart: isoL(d) === dateDepart.value, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) })
  }
  return out
})
const joursWeekend = computed(() => jours.value.filter(d => d.weekend))
const jourDepart = computed(() => jours.value.filter(d => d.depart))
const maintenant = ref(new Date())
let timerNow = null
onMounted(() => { timerNow = setInterval(() => { maintenant.value = new Date() }, 60000) })
onUnmounted(() => { if (timerNow) clearInterval(timerNow) })
const heureMaintenant = computed(() => maintenant.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
const posMaintenant = computed(() => {
  const px = ((maintenant.value - t0.value) / 3600000) * pxH.value
  return (px >= 0 && px <= totalW.value) ? px : null
})

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
  if (t.type === 'lot') return t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + (t.turbNo ? '  •  turbine ' + t.turbNo + '/' + t.turbines : '') + '  •  ' + p
  if (t.type === 'gen') return 'Nettoyage général (début campagne)  •  ' + p
  if (t.type === 'genH') return 'Nettoyage général (holding dépassé)  •  ' + p
  return 'Nettoyage partiel  •  ' + p
}

// Récap
const totalLots = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'lot').length, 0))
const totalNG = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length, 0))
const totalNP = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'part').length, 0))
const hMaint = (list, type) => (list || []).filter(m => (m.type || 'prev') === type).reduce((a, m) => a + (Number(m.dureeH) || 0), 0)
const synthEquip = computed(() => planning.value.map(r => {
  const mList = maintEquip[r.eq.id] || []
  const mp = hMaint(mList, 'prev'), mc = hMaint(mList, 'curr'), at = hMaint(mList, 'tech')
  return {
    id: r.eq.id, code: r.eq.code, nom: r.eq.nom,
    regime: regimeEquip[r.eq.id] || '3x8',
    lots: r.tasks.filter(t => t.type === 'lot').length,
    ng: r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length,
    np: r.tasks.filter(t => t.type === 'part').length,
    mp, mc, at, maintH: mp + mc + at,
    fin: r.fin
  }
}).filter(x => x.lots > 0 || x.maintH > 0))
const totalMP = computed(() => synthEquip.value.reduce((s, e) => s + e.mp, 0))
const totalMC = computed(() => synthEquip.value.reduce((s, e) => s + e.mc, 0))
const totalAT = computed(() => synthEquip.value.reduce((s, e) => s + e.at, 0))
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
.dep-row { display: flex; gap: 6px; align-items: center; }
.p-grp .chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }
.p-grp .chk-inline { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }
.p-grp input[type=text], .p-grp select { font-size: 12px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 7px; }

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
.g-depart { position: absolute; top: 0; bottom: 0; background: rgba(91, 155, 213, 0.10); border-left: 2px solid #5B9BD5; z-index: 0; box-sizing: border-box; }
.g-dcol-dep { background: rgba(91, 155, 213, 0.08); }
.g-dep-lbl { color: #2A4A85; font-weight: 800; }
.g-maint { position: absolute; top: 2px; bottom: 2px; background: repeating-linear-gradient(45deg, #93c5fd, #93c5fd 5px, #bfdbfe 5px, #bfdbfe 10px); border: 1px solid #3b82f6; border-radius: 3px; z-index: 2; box-sizing: border-box; }
.g-maint-curr { background: repeating-linear-gradient(45deg, #fca5a5, #fca5a5 5px, #fecaca 5px, #fecaca 10px); border-color: #ef4444; }
.g-maint-lbl { font-size: 7.5px; font-weight: 800; color: #1e3a8a; padding: 0 2px; white-space: nowrap; }
.g-maint-curr .g-maint-lbl { color: #7f1d1d; }
.g-maint-tech { background: repeating-linear-gradient(45deg, #d8b4fe, #d8b4fe 5px, #e9d5ff 5px, #e9d5ff 10px); border-color: #a855f7; }
.g-maint-tech .g-maint-lbl { color: #6b21a8; }
.pan-maint-tech { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }
.pan-maint-curr { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
.g-now { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 3; }
.g-now-head { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 4; }
.g-now-head span { position: absolute; top: 0; left: 2px; background: #ef4444; color: #fff; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 0 3px 3px 0; white-space: nowrap; }
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
.synth-eq { margin-top: 14px; overflow-x: auto; border-top: 1px solid #f1f5f9; padding-top: 10px; }
.synth-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.synth-tbl th { text-align: left; font-size: 10px; color: #64748b; padding: 4px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.synth-tbl th.right, .synth-tbl td.right { text-align: right; }
.synth-tbl td { padding: 3px 8px; border-bottom: 1px solid #f1f5f9; color: #1b2733; white-space: nowrap; }
.synth-nom { color: #94a3b8; font-size: 10px; }
.rc { display: flex; flex-direction: column; }
.rc-v { font-size: 18px; font-weight: 800; color: #0f172a; }
.rc-l { font-size: 10px; color: #64748b; }
.g-eqcol { cursor: pointer; }
.g-pan { font-size: 8px; color: #0f766e; font-weight: 700; }
.g-reg { font-size: 8px; font-weight: 700; color: #64748b; background: #eef2f7; border-radius: 5px; padding: 0 4px; }
.g-reg.r2 { color: #b45309; background: #fef3c7; }
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
.pan-chip-plan { background: #fef3c7; border-color: #fde68a; color: #92400e; }
.pan-chip-plan:hover { background: #fde68a; }
.pan-chip-cours { background: #dcfce7; border-color: #86efac; color: #166534; }
.pan-chip-cours:hover { background: #bbf7d0; }
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
.pan-reqreg { font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.g-drag { cursor: grab; }
.g-drag:active { cursor: grabbing; }
.g-dragging { opacity: .5; outline: 2px dashed #5B9BD5; outline-offset: -1px; }
/* Compact global pour optimiser l'affichage */
.pe-head h1 { font-size: 15px; }
.pe-head .sub { font-size: 9.5px; margin-bottom: 8px; }
.card { padding: 8px 10px; margin-bottom: 8px; }
.params { gap: 10px; }
.p-grp label { font-size: 10px; }
.p-grp input, .p-grp select { font-size: 11px; padding: 4px 6px; }
.vue-btn { font-size: 11px; padding: 4px 9px; }
.legende { font-size: 9.5px; gap: 12px; margin-bottom: 6px; }
.recap h3 { font-size: 12px; margin-bottom: 6px; }
.recap-grid { gap: 16px; }
.rc-v { font-size: 15px; }
.rc-l { font-size: 9px; }
.synth-tbl { font-size: 10px; }
.synth-tbl th { font-size: 9px; padding: 3px 6px; }
.synth-tbl td { padding: 2px 6px; }
.synth-nom { font-size: 9px; }
.g-eqcol { flex: 0 0 168px; width: 168px; padding: 4px 8px; }
.g-eqhead { font-size: 10px; }
.g-eqcode { font-size: 10px; }
.g-eqnom { font-size: 8.5px; }
.g-eqfin { font-size: 8px; }
.g-eqwe { font-size: 7.5px; }
.g-dlbl { font-size: 9px; }
.g-sh { font-size: 7.5px; }
.g-lbl { font-size: 8px; }
.g-reg, .g-pan { font-size: 7.5px; }
/* Paramètres en colonne à gauche du Gantt */
.pe-body { display: flex; gap: 10px; align-items: flex-start; }
.params-side { flex: 0 0 190px; width: 190px; flex-direction: column; align-items: stretch; gap: 8px; align-self: stretch; }
.params-side .p-grp { width: 100%; }
.params-side .p-grp label { display: flex; flex-direction: column; gap: 4px; }
.params-side .vue-btns { flex-wrap: nowrap; gap: 3px; }
.params-side .vue-btns .vue-btn { padding: 4px 4px; font-size: 9.5px; flex: 1 1 0; min-width: 0; white-space: nowrap; }
.params-side .dep-row { width: 100%; }
.params-side input, .params-side select { width: 100%; box-sizing: border-box; }
.pe-gantt-wrap { flex: 1; min-width: 0; }
@media (max-width: 900px) { .pe-body { flex-direction: column; } .params-side { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; } }
</style>
