<template>
  <div class="pes-page">
    <PageHeader title="Pesée — Calcul API / Excipient" tone="#4f46e5"
      subtitle="Calcul par fraction, multi-API (chaque API a sa méthode), correction de titre et compensation de l'excipient." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Produit</h2>
        <span class="u-fixed" style="margin-left:auto">Unité : kg</span>
      </div>
      <label class="fld">Sélection <span v-if="rechercheProduit" class="cnt">({{ produitsFiltres.length }})</span>
        <input v-model="rechercheProduit" type="text" class="prod-search" placeholder="Rechercher (code ou désignation)…" />
        <select v-model="produitSel">
          <option value="">— Choisir —</option>
          <option v-for="p in produitsFiltres" :key="p.id" :value="String(p.id)">{{ p.code_pf }} — {{ p.designation }}</option>
        </select>
      </label>
      <p v-if="produitSel && configParProduit[produitSel]" class="cfg-note ok-note">✓ Méthode(s) et quantités théoriques chargées depuis la configuration du produit.</p>
      <p v-else-if="produitSel" class="cfg-note">Aucune configuration pour ce produit. <router-link to="/referentiels" class="lnk">Configurer dans Référentiels</router-link></p>
      <p v-if="nbFracNum > 1 && totalTheoAPIFrac != null" class="frac-note">Lot divisé en <b>{{ nbFracNum }} fractions</b> → pesée d'<b>1 fraction</b> : API <b>{{ fmt(totalTheoAPIFrac) }} {{ unite }}</b><span v-if="theoExcFrac != null">, excipient <b>{{ fmt(theoExcFrac) }} {{ unite }}</b></span>. À répéter {{ nbFracNum }} fois.</p>
    </section>

    <section class="card" v-for="(ap, ai) in apis" :key="ai">
      <div class="card-head">
        <h2 class="card-title">{{ apis.length > 1 ? 'API ' + (ai + 1) : 'API' }}</h2>
        <button v-if="apis.length > 1" class="x-api" @click="removeAPI(ai)" title="Retirer cette API">Retirer</button>
      </div>
      <div class="grid">
        <label class="fld">Nom de l'API
          <input v-model="ap.nom" type="text" placeholder="ex. Paracétamol" />
        </label>
        <label class="fld">Qté théorique — lot complet ({{ unite }})
          <input v-model.number="ap.theoTotal" type="number" min="0" step="any" placeholder="ex. 30" />
        </label>
      </div>
      <p class="meth-line">Méthode : <b>{{ labelMethode(ap.methode, ap.convPerso) }}</b></p>

      <div class="lots-wrap">
        <table class="lots-tbl">
          <thead>
            <tr>
              <th>Lot</th>
              <th v-if="ap.methode !== 'direct'">Dosage (%)</th>
              <th v-if="ap.methode !== 'direct'">LOD (%)</th>
              <th v-if="ap.methode !== 'direct'">Titre (%)</th>
              <th>Qté obtenue ({{ unite }})<br /><span class="th-sub">lot pesé / épuisé</span></th>
              <th>Qté théorique ({{ unite }})</th>
              <th>Qté réelle à peser ({{ unite }})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, li) in ap.lots" :key="li">
              <td><input v-model="l.lot" type="text" placeholder="N° lot" /></td>
              <td v-if="ap.methode !== 'direct'"><input v-model.number="l.dosage" type="number" min="0" step="any" placeholder="99.5" /></td>
              <td v-if="ap.methode !== 'direct'"><input v-model.number="l.lod" type="number" min="0" step="any" placeholder="0.5" /></td>
              <td v-if="ap.methode !== 'direct'" class="calc">{{ apisCalc[ai].lots[li].titre != null ? fmt(apisCalc[ai].lots[li].titre) + ' %' : '—' }}</td>
              <td><input v-model.number="l.obtenu" type="number" min="0" step="any" placeholder="vide = lot qui complète" /></td>
              <td class="calc">{{ apisCalc[ai].lots[li].theo != null ? fmt(apisCalc[ai].lots[li].theo) : '—' }}</td>
              <td class="calc b">{{ apisCalc[ai].lots[li].aPeser != null ? fmt(apisCalc[ai].lots[li].aPeser) : '—' }}</td>
              <td><button v-if="ap.lots.length > 1" class="x" @click="removeLot(ai, li)" title="Supprimer ce lot">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="btn ghost sm" @click="addLot(ai)">+ Ajouter un lot</button>
    </section>

    <div class="add-api-wrap"><button class="btn ghost" @click="addAPI">+ Ajouter une API</button></div>

    <section class="card">
      <h2 class="card-title">Excipient</h2>
      <div class="grid">
        <label class="fld">Désignation excipient
          <input v-model="designExc" type="text" placeholder="ex. Lactose" />
        </label>
        <label class="fld">N° lot excipient
          <input v-model="lotExc" type="text" placeholder="N° lot" />
        </label>
        <label class="fld">Quantité théorique excipient — lot complet ({{ unite }})
          <input v-model.number="theoExc" type="number" min="0" step="any" placeholder="ex. 1500" />
        </label>
      </div>
      <p class="hint" v-if="ajustExc">Chaque API est corrigée par sa propre méthode (titre = dosage − LOD, ou conversion, ou sans calcul). L'excipient <b>compense</b> le surplus total des API pour garder la masse constante.</p>
      <p class="frac-note" v-else>Produit <b>sans ajustage excipient</b> : la quantité réelle d'excipient reste égale à la quantité théorique (pas de compensation de la correction API).</p>
    </section>

    <section class="card" v-if="totalReelAPI != null && recapFraction.length">
      <h2 class="card-title">Pesée d'une fraction<span v-if="nbFracNum > 1" class="rep-badge">à répéter {{ nbFracNum }} ×</span></h2>
      <div class="recap">
        <div class="recap-row" v-for="(l, i) in recapFraction" :key="i">
          <span class="recap-nom">{{ l.nom }} <span class="recap-type" :class="l.type === 'Excipient' ? 'exc' : 'api'">{{ l.type }}</span></span>
          <span class="recap-q"><b>{{ fmt(l.reel) }}</b> {{ unite }}</span>
        </div>
        <div class="recap-row recap-tot">
          <span class="recap-nom">Total fraction</span>
          <span class="recap-q"><b>{{ fmt(totalReel) }}</b> {{ unite }}</span>
        </div>
      </div>
    </section>

    <section class="card" v-if="totalReelAPI != null && nbFracNum > 1 && recapFraction.length">
      <h2 class="card-title">Détail par fraction</h2>
      <div class="lots-wrap">
        <table class="t">
          <thead><tr><th>Fraction</th><th v-for="(c, i) in recapFraction" :key="i" class="r">{{ c.nom }} ({{ unite }})</th><th class="r">Total ({{ unite }})</th></tr></thead>
          <tbody>
            <tr v-for="f in nbFracNum" :key="f">
              <td>Fraction {{ f }} / {{ nbFracNum }}</td>
              <td v-for="(c, i) in recapFraction" :key="i" class="r">{{ fmt(c.reel) }}</td>
              <td class="r b">{{ fmt(totalReel) }}</td>
            </tr>
            <tr class="tot">
              <td>Lot complet</td>
              <td v-for="(c, i) in recapFraction" :key="i" class="r">{{ fmt(c.reel * nbFracNum) }}</td>
              <td class="r b">{{ fmt(totalReel * nbFracNum) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card" v-if="totalReelAPI != null || titreInvalide">
      <h2 class="card-title">Détail par lot</h2>
      <p v-if="nbFracNum > 1" class="frac-banner">Pesée d'<b>une fraction</b> — à répéter <b>{{ nbFracNum }} fois</b> pour le lot complet.</p>
      <p v-if="titreInvalide" class="alert">Un lot a un titre invalide (≤ 0). Vérifie le dosage et la LOD.</p>
      <p v-if="excipientNegatif" class="alert">⚠ Excipient négatif : la quantité réelle totale d'API dépasse la masse théorique. Vérifie les titres et les quantités.</p>

      <template v-if="totalReelAPI != null">
        <div class="res">
          <div class="res-card api">
            <div class="rc-l">Total réel API</div>
            <div class="rc-v">{{ fmt(totalReelAPI) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartAPI != null">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }} {{ unite }} vs théorique</div>
          </div>
          <div class="res-card exc" :class="{ neg: excipientNegatif }" v-if="reelExc != null">
            <div class="rc-l">Quantité réelle excipient</div>
            <div class="rc-v">{{ fmt(reelExc) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartExc != null">{{ sign(ecartExc) }}{{ fmt(ecartExc) }} {{ unite }} vs théorique</div>
          </div>
        </div>

        <table class="t">
          <thead><tr><th>Composant</th><th class="r">Théorique ({{ unite }})</th><th class="r">Réel ({{ unite }})</th><th class="r">Écart ({{ unite }})</th></tr></thead>
          <tbody>
            <template v-for="(ap, ai) in apisCalc" :key="ai">
              <tr class="api-row"><td colspan="4">{{ ap.nom || ('API ' + (ai + 1)) }} <span class="meth-badge">{{ labelCourt(ap.methode) }}</span></td></tr>
              <tr v-for="l in ap.lotsReels" :key="'l' + ai + '_' + l.idx">
                <td class="indent">Lot {{ l.lot || ('n°' + (l.idx + 1)) }}<span v-if="ap.avecTitre" class="titre-badge">titre {{ fmt(l.titre) }} %</span></td>
                <td class="r">{{ fmt(l.theo) }}</td>
                <td class="r b">{{ fmt(l.aPeser) }}</td>
                <td class="r" :class="ecartCls(l.aPeser - l.theo)">{{ sign(l.aPeser - l.theo) }}{{ fmt(l.aPeser - l.theo) }}</td>
              </tr>
            </template>
            <tr class="sub" v-if="apisCalc.length > 1 || (apisCalc[0] && apisCalc[0].lotsReels.length > 1)">
              <td>Total API</td>
              <td class="r">{{ fmt(totalTheoAPIFrac) }}</td>
              <td class="r b">{{ fmt(totalReelAPI) }}</td>
              <td class="r" :class="ecartCls(ecartAPI)">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }}</td>
            </tr>
            <tr v-if="reelExc != null">
              <td>{{ designExc || 'Excipient' }}<span v-if="lotExc" class="titre-badge">lot {{ lotExc }}</span></td>
              <td class="r">{{ fmt(theoExcFrac) }}</td>
              <td class="r b">{{ fmt(reelExc) }}</td>
              <td class="r" :class="ecartCls(ecartExc)">{{ sign(ecartExc) }}{{ fmt(ecartExc) }}</td>
            </tr>
            <tr class="tot" v-if="totalReel != null">
              <td>Total</td>
              <td class="r">{{ fmt(totalTheo) }}</td>
              <td class="r b">{{ fmt(totalReel) }}</td>
              <td class="r">0</td>
            </tr>
          </tbody>
        </table>
      </template>
    </section>

    <section class="card" v-if="totalReelAPI != null">
      <h2 class="card-title">Traçabilité</h2>
      <div class="grid">
        <label class="fld">N° OF (ordre de fabrication)
          <input v-model="ofNum" type="text" placeholder="ex. OF-2026-0123" />
        </label>
        <label class="fld">Date de pesée
          <input v-model="datePesee" type="date" />
        </label>
        <label class="fld">Opérateur
          <input v-model="operateur" type="text" placeholder="Nom" />
        </label>
      </div>
      <div class="actions">
        <button class="btn" :disabled="!peutEditer || enreg" @click="enregistrer">{{ enreg ? 'Enregistrement…' : '💾 Enregistrer la pesée' }}</button>
        <button class="btn ghost" @click="exporterPDF">📄 Fiche de pesée (PDF)</button>
        <button class="btn ghost sm" @click="reset">Réinitialiser</button>
      </div>
    </section>

    <section class="card" v-if="historique.length">
      <h2 class="card-title">Pesées enregistrées</h2>
      <div class="lots-wrap">
        <table class="t">
          <thead><tr><th>Date</th><th>Produit</th><th>OF</th><th>Opérateur</th><th class="r">Total réel API</th><th class="r">API</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in historique" :key="p.id">
              <td>{{ p.date_pesee || '—' }}</td>
              <td>{{ p.produit_libelle || '—' }}</td>
              <td>{{ p.of_numero || '—' }}</td>
              <td>{{ p.operateur || '—' }}</td>
              <td class="r b">{{ p.total_reel_api != null ? fmt(p.total_reel_api) + ' ' + (p.unite || '') : '—' }}</td>
              <td class="r">{{ (p.apis && p.apis.length) || 1 }}</td>
              <td class="row-act">
                <button class="mini" @click="chargerPesee(p)" title="Recharger">Charger</button>
                <button class="mini" @click="exporterPeseePDF(p)" title="Fiche PDF">PDF</button>
                <button v-if="peutEditer" class="mini del" @click="supprimerPesee(p)" title="Supprimer">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const unite = ref('kg')

const vide = (x) => x === null || x === '' || x === undefined
function newLot() { return { lot: '', dosage: null, lod: null, obtenu: null } }
function newAPI() { return { nom: '', methode: 'standard', convPerso: 100, theoTotal: null, lots: [newLot()] } }

const nbFractions = ref(1)
const theoExc = ref(null)
const lotExc = ref('')
const designExc = ref('')
const ajustExc = ref(true)
const apis = ref([newAPI()])

const produits = ref([])
const produitSel = ref('')
const rechercheProduit = ref('')
const ofNum = ref('')
const datePesee = ref(new Date().toISOString().slice(0, 10))
const operateur = ref('')
const historique = ref([])
const configs = ref([])
const erreur = ref('')
const message = ref('')
const enreg = ref(false)
let suppressWatch = false

const nbFracNum = computed(() => { const n = Number(nbFractions.value); return (n >= 1) ? Math.floor(n) : 1 })

const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  let list = q ? produits.value.filter(p => ((p.code_pf || '') + ' ' + (p.designation || '')).toLowerCase().includes(q)) : produits.value
  if (produitSel.value && !list.some(p => String(p.id) === produitSel.value)) {
    const sel = produits.value.find(p => String(p.id) === produitSel.value)
    if (sel) list = [sel, ...list]
  }
  return list
})
const configParProduit = computed(() => { const m = {}; for (const c of configs.value) if (c.produit_id != null) m[String(c.produit_id)] = c; return m })

// Méthodes
function methodeInfo(methode, convPerso) {
  const conv = methode === 'cycladol' ? 10.46 : (methode === 'perso' ? (Number(convPerso) > 0 ? Number(convPerso) : null) : null)
  return { conv, plafond: 100, direct: methode === 'direct' }
}
function labelMethode(methode, cv) {
  if (methode === 'cycladol') return 'Cycladol (dosage converti : 10,46 = 100 %)'
  if (methode === 'perso') return 'Personnalisé (dosage converti : ' + fmt(cv) + ' = 100 %)'
  if (methode === 'direct') return 'Sans calcul (réel = théorique)'
  return 'Standard (titre = dosage − LOD)'
}
function labelCourt(methode) {
  if (methode === 'cycladol') return 'Cycladol'
  if (methode === 'perso') return 'Personnalisé'
  if (methode === 'direct') return 'Sans calcul'
  return 'Standard'
}

// Calcul d'une API (quantité d'une fraction = théorique lot ÷ nombre de fractions)
function calcUneAPI(api) {
  const { conv, plafond, direct } = methodeInfo(api.methode, api.convPerso)
  const totalFrac = (!vide(api.theoTotal) && Number(api.theoTotal) >= 0) ? Number(api.theoTotal) / nbFracNum.value : null
  let remaining = totalFrac
  const lots = []
  for (let i = 0; i < api.lots.length; i++) {
    const l = api.lots[i]
    const dosage = Number(l.dosage), lod = Number(l.lod)
    const dosageConv = (!vide(l.dosage)) ? (conv != null ? dosage * 100 / conv : dosage) : null
    const titre = direct ? 100 : ((dosageConv != null && !vide(l.lod)) ? dosageConv - lod : null)
    const titreEff = (titre != null) ? Math.min(titre, plafond) : null
    const obtenue = (!vide(l.obtenu) && Number(l.obtenu) >= 0) ? Number(l.obtenu) : null
    let theo = null, aPeser = null
    if (titreEff != null && titreEff > 0 && remaining != null) {
      if (obtenue != null) { theo = obtenue * titreEff / 100; aPeser = obtenue; remaining = remaining - theo }
      else { theo = remaining > 0 ? remaining : 0; aPeser = theo * 100 / titreEff; remaining = remaining - theo }
    } else { remaining = null }
    lots.push({ idx: i, lot: l.lot, titre, obtenue, theo, aPeser })
  }
  let s = 0, any = false, broken = false
  for (let i = 0; i < api.lots.length; i++) {
    const raw = api.lots[i], c = lots[i]
    if (c.aPeser != null) { s += c.aPeser; any = true }
    else if (!vide(raw.dosage) || !vide(raw.lod) || !vide(raw.obtenu)) { broken = true }
  }
  const totalReel = (totalFrac == null || broken || !any) ? null : s
  const titreInvalide = lots.some(l => l.titre != null && l.titre <= 0)
  const lotsReels = lots.filter(l => l.aPeser != null && l.theo != null)
  return { nom: api.nom, methode: api.methode, conv, direct, avecTitre: !direct, totalFrac, totalReel, titreInvalide, lots, lotsReels }
}
const apisCalc = computed(() => apis.value.map(calcUneAPI))

const totalTheoAPIFrac = computed(() => {
  let s = 0, any = false
  for (const ap of apisCalc.value) { if (ap.totalFrac != null) { s += ap.totalFrac; any = true } }
  return any ? s : null
})
const totalReelAPI = computed(() => {
  let s = 0, any = false
  for (const ap of apisCalc.value) {
    if (ap.totalFrac != null) {
      if (ap.totalReel == null) return null
      s += ap.totalReel; any = true
    }
  }
  return any ? s : null
})
const titreInvalide = computed(() => apisCalc.value.some(ap => ap.titreInvalide))
const theoExcFrac = computed(() => (!vide(theoExc.value) && Number(theoExc.value) >= 0) ? Number(theoExc.value) / nbFracNum.value : null)
const reelExc = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPIFrac.value, te = theoExcFrac.value
  if (te == null) return null
  if (!ajustExc.value) return te
  if (tra == null || tta == null) return null
  return (tta + te) - tra
})
const ecartExc = computed(() => { const re = reelExc.value, te = theoExcFrac.value; return (re != null && te != null) ? re - te : null })
const totalTheo = computed(() => {
  const tta = totalTheoAPIFrac.value, te = theoExcFrac.value
  if (tta == null || te == null) return null
  return tta + te
})
const totalReel = computed(() => {
  const tra = totalReelAPI.value, re = reelExc.value
  return (tra != null && re != null) ? tra + re : null
})
const recapFraction = computed(() => {
  const l = []
  for (let ai = 0; ai < apisCalc.value.length; ai++) {
    const ap = apisCalc.value[ai]
    if (ap.totalReel != null) l.push({ nom: ap.nom || ('API ' + (ai + 1)), type: 'API', theo: ap.totalFrac, reel: ap.totalReel })
  }
  if (reelExc.value != null) l.push({ nom: designExc.value || 'Excipient', type: 'Excipient', theo: theoExcFrac.value, reel: reelExc.value })
  return l
})
const ecartAPI = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPIFrac.value
  return (tra != null && tta != null) ? tra - tta : null
})
const excipientNegatif = computed(() => reelExc.value != null && reelExc.value < 0)

function fmt(v) { if (v == null || Number.isNaN(Number(v))) return '—'; return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) }
function sign(v) { return (v != null && v > 1e-9) ? '+' : '' }
function ecartCls(v) { if (v == null || Math.abs(v) < 1e-9) return ''; return v > 0 ? 'up' : 'down' }
function addLot(ai) { apis.value[ai].lots.push(newLot()) }
function removeLot(ai, li) { if (apis.value[ai].lots.length > 1) apis.value[ai].lots.splice(li, 1) }
function addAPI() { apis.value.push(newAPI()) }
function removeAPI(ai) { if (apis.value.length > 1) apis.value.splice(ai, 1) }
function reset() {
  apis.value = [newAPI()]; theoExc.value = null; lotExc.value = ''; designExc.value = ''; ajustExc.value = true; nbFractions.value = 1
  produitSel.value = ''; ofNum.value = ''; operateur.value = ''
  datePesee.value = new Date().toISOString().slice(0, 10); erreur.value = ''; message.value = ''
}

// Chargement produits / configs / historique
async function charger() {
  const rp = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  await chargerConfigs()
  await chargerHistorique()
}
async function chargerConfigs() {
  const r = await supabase.from('pesee_config').select('*')
  if (!r.error) configs.value = r.data || []
}
async function chargerHistorique() {
  const r = await supabase.from('pesees').select('*').order('created_at', { ascending: false }).limit(50)
  if (!r.error) historique.value = r.data || []
}
onMounted(charger)

// Sélection produit → charge la config (méthodes + quantités théoriques)
watch(produitSel, (id) => {
  if (suppressWatch) return
  const cfg = configParProduit.value[id]
  if (cfg) {
    nbFractions.value = cfg.nb_fractions != null ? cfg.nb_fractions : 1
    if (cfg.theo_excipient != null) theoExc.value = cfg.theo_excipient
    if (cfg.design_excipient) designExc.value = cfg.design_excipient
    ajustExc.value = cfg.ajust_excipient !== false
    let apiList = (cfg.apis && cfg.apis.length) ? cfg.apis : null
    if (!apiList && (cfg.methode || cfg.theo_api != null)) {
      apiList = [{ nom: 'API', methode: cfg.methode || 'standard', conversion: cfg.conversion, theo_api: cfg.theo_api }]
    }
    if (apiList && apiList.length) {
      apis.value = apiList.map(a => ({ nom: a.nom || 'API', methode: a.methode || 'standard', convPerso: a.conversion != null ? a.conversion : 100, theoTotal: a.theo_api != null ? a.theo_api : null, lots: [newLot()] }))
    }
  } else {
    const pr = produits.value.find(x => String(x.id) === id)
    const estCycladol = pr && /cycladol/i.test((pr.code_pf || '') + ' ' + (pr.designation || ''))
    if (apis.value.length) {
      if (estCycladol) apis.value[0].methode = 'cycladol'
      else if (apis.value[0].methode === 'cycladol') apis.value[0].methode = 'standard'
    }
  }
}, { flush: 'sync' })

// Enregistrement
function apisPayload() {
  return apis.value.map((api, ai) => {
    const c = apisCalc.value[ai]
    return {
      nom: api.nom || ('API ' + (ai + 1)), methode: api.methode,
      conversion: api.methode === 'perso' ? Number(api.convPerso) : null,
      theo_api: vide(api.theoTotal) ? null : Number(api.theoTotal),
      total_reel: c.totalReel,
      lots: api.lots.map((l, li) => ({
        lot: l.lot || '', dosage: vide(l.dosage) ? null : Number(l.dosage), lod: vide(l.lod) ? null : Number(l.lod),
        titre: c.lots[li].titre, obtenu: c.lots[li].obtenue, theo: c.lots[li].theo, reel: c.lots[li].aPeser
      })).filter(l => l.reel != null)
    }
  })
}
async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (totalReelAPI.value == null) { erreur.value = 'Complète au moins une API (quantité théorique et lots) avant d\'enregistrer.'; return }
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  enreg.value = true
  const payload = {
    date_pesee: datePesee.value || null,
    produit_id: pr ? pr.id : null,
    produit_libelle: pr ? (pr.code_pf + ' — ' + pr.designation) : null,
    of_numero: ofNum.value || null,
    operateur: operateur.value || null,
    unite: unite.value,
    nb_fractions: nbFracNum.value,
    total_theo_api: totalTheoAPIFrac.value,
    total_reel_api: totalReelAPI.value,
    theo_excipient: vide(theoExc.value) ? null : Number(theoExc.value),
    reel_excipient: reelExc.value,
    lot_excipient: lotExc.value || null,
    design_excipient: designExc.value || null,
    ajust_excipient: ajustExc.value,
    apis: apisPayload()
  }
  const r = await supabase.from('pesees').insert(payload)
  enreg.value = false
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Pesée enregistrée.'
  await chargerHistorique()
}
function chargerPesee(p) {
  suppressWatch = true
  unite.value = p.unite || 'kg'
  nbFractions.value = p.nb_fractions != null ? p.nb_fractions : 1
  theoExc.value = p.theo_excipient
  lotExc.value = p.lot_excipient || ''
  designExc.value = p.design_excipient || ''
  ajustExc.value = p.ajust_excipient !== false
  produitSel.value = p.produit_id != null ? String(p.produit_id) : ''
  ofNum.value = p.of_numero || ''
  operateur.value = p.operateur || ''
  datePesee.value = p.date_pesee || new Date().toISOString().slice(0, 10)
  const al = (p.apis && p.apis.length) ? p.apis : [{ nom: 'API', methode: p.methode || 'standard', conversion: p.facteur, theo_api: p.total_theo_api, lots: p.lots || [] }]
  apis.value = al.map(a => ({
    nom: a.nom || 'API', methode: a.methode || 'standard', convPerso: a.conversion != null ? a.conversion : 100,
    theoTotal: a.theo_api != null ? a.theo_api : null,
    lots: (a.lots && a.lots.length) ? a.lots.map(l => ({ lot: l.lot || '', dosage: l.dosage, lod: l.lod, obtenu: l.obtenu })) : [newLot()]
  }))
  suppressWatch = false
  message.value = 'Pesée chargée dans le calcul.'; erreur.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function supprimerPesee(p) {
  if (!window.confirm('Supprimer définitivement cette pesée enregistrée ?')) return
  const r = await supabase.from('pesees').delete().eq('id', p.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerHistorique()
}

// Fiche de pesée PDF
function snapshotActuel() {
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  return {
    prNom: pr ? (pr.code_pf + ' — ' + pr.designation) : '—',
    ofNum: ofNum.value || '—', datePesee: datePesee.value || '—', operateur: operateur.value || '—',
    unite: unite.value, nbFrac: nbFracNum.value,
    apis: apis.value.map((api, ai) => {
      const c = apisCalc.value[ai]
      return {
        nom: api.nom || ('API ' + (ai + 1)), methode: labelCourt(api.methode), direct: c.direct,
        lots: api.lots.map((l, li) => ({ lot: l.lot || ('n°' + (li + 1)), dosage: vide(l.dosage) ? null : Number(l.dosage), lod: vide(l.lod) ? null : Number(l.lod), titre: c.lots[li].titre, obtenu: c.lots[li].obtenue, theo: c.lots[li].theo, reel: c.lots[li].aPeser })).filter(l => l.reel != null)
      }
    }),
    designExc: designExc.value, lotExc: lotExc.value, theoExc: theoExcFrac.value, reelExc: reelExc.value,
    totalReelAPI: totalReelAPI.value, totalTheoAPI: totalTheoAPIFrac.value, totalTheo: totalTheo.value, totalReel: totalReel.value,
    recapFrac: recapFraction.value.map(c => ({ nom: c.nom, reel: c.reel }))
  }
}
function snapshotStored(p) {
  const nb = p.nb_fractions != null ? p.nb_fractions : 1
  const al = (p.apis && p.apis.length) ? p.apis : [{ nom: 'API', methode: p.methode || 'standard', theo_api: p.total_theo_api, lots: p.lots || [] }]
  return {
    prNom: p.produit_libelle || '—', ofNum: p.of_numero || '—', datePesee: p.date_pesee || '—', operateur: p.operateur || '—',
    unite: p.unite || 'kg', nbFrac: nb,
    apis: al.map((a, ai) => ({
      nom: a.nom || ('API ' + (ai + 1)), methode: labelCourt(a.methode || 'standard'), direct: (a.methode === 'direct'),
      lots: (a.lots || []).filter(l => l.reel != null).map((l, li) => ({ lot: l.lot || ('n°' + (li + 1)), dosage: l.dosage, lod: l.lod, titre: l.titre, obtenu: l.obtenu, theo: l.theo, reel: l.reel }))
    })),
    designExc: p.design_excipient, lotExc: p.lot_excipient, theoExc: (p.theo_excipient != null) ? p.theo_excipient / nb : null, reelExc: p.reel_excipient,
    totalReelAPI: p.total_reel_api, totalTheoAPI: p.total_theo_api,
    totalTheo: (p.total_theo_api != null && p.reel_excipient != null) ? p.total_theo_api + (p.theo_excipient != null ? p.theo_excipient / nb : 0) : null,
    totalReel: (p.total_reel_api != null && p.reel_excipient != null) ? p.total_reel_api + p.reel_excipient : null,
    recapFrac: [...al.map((a, ai) => ({ nom: a.nom || ('API ' + (ai + 1)), reel: a.total_reel })).filter(c => c.reel != null), ...(p.reel_excipient != null ? [{ nom: p.design_excipient || 'Excipient', reel: p.reel_excipient }] : [])]
  }
}
function ficheHTML(d) {
  const now = new Date().toLocaleString('fr-FR'), u = d.unite
  let corps = ''
  for (const ap of d.apis) {
    corps += `<tr class="grp"><td colspan="7">${ap.nom} — ${ap.methode}</td></tr>`
    corps += ap.lots.map(l => `<tr><td>${l.lot}</td><td class="r">${l.dosage != null ? fmt(l.dosage) : '—'}</td><td class="r">${l.lod != null ? fmt(l.lod) : '—'}</td><td class="r">${l.titre != null ? fmt(l.titre) : '—'}</td><td class="r">${l.obtenu != null ? fmt(l.obtenu) : '—'}</td><td class="r">${fmt(l.theo)}</td><td class="r b">${fmt(l.reel)}</td></tr>`).join('')
  }
  if (d.reelExc != null) corps += `<tr><td>${d.designExc || 'Excipient'}${d.lotExc ? ' — lot ' + d.lotExc : ''}</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">${fmt(d.theoExc)}</td><td class="r b">${fmt(d.reelExc)}</td></tr>`
  if (d.totalReel != null) corps += `<tr class="tot"><td>Total</td><td colspan="4"></td><td class="r">${fmt(d.totalTheo)}</td><td class="r b">${fmt(d.totalReel)}</td></tr>`
  let fracTable = ''
  if (d.nbFrac > 1 && d.recapFrac && d.recapFrac.length) {
    const head = d.recapFrac.map(c => `<th class="r">${c.nom} (${u})</th>`).join('')
    let rows = ''
    for (let f = 1; f <= d.nbFrac; f++) rows += `<tr><td>Fraction ${f}</td>${d.recapFrac.map(c => `<td class="r">${fmt(c.reel)}</td>`).join('')}</tr>`
    fracTable = `<h2 style="font-size:13px;margin:16px 0 6px;color:#3730a3;border-left:4px solid #a855f7;padding-left:8px">Détail par fraction</h2><table><thead><tr><th>Fraction</th>${head}</tr></thead><tbody>${rows}</tbody></table>`
  }
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Fiche de pesée</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:28px;font-size:12px}
h1{font-size:19px;margin:0 0 2px;color:#3730a3} .sub{color:#64748b;font-size:12px;margin:0 0 14px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:12px;color:#334155;border-top:2px solid #6366f1;border-bottom:1px solid #e2e8f0;padding:10px 0;margin-bottom:16px}
.meta b{color:#0f172a}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px}
th{text-align:left;background:#eef2ff;color:#3730a3;padding:6px 7px;border:1px solid #e0e7ff;font-size:9.5px;text-transform:uppercase}
th.r,td.r{text-align:right} td{padding:6px 7px;border:1px solid #eef2f6}
td.b{font-weight:800;color:#3730a3} tr.tot td{font-weight:800;background:#fafafa;border-top:2px solid #e2e8f0}
tr.grp td{background:#f5f3ff;font-weight:800;color:#4338ca}
.sig{display:flex;gap:40px;margin-top:34px} .sig .box{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#64748b}
.foot{margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:14mm}}
</style></head><body>
<h1>Fiche de pesée</h1><p class="sub">Multi-API — correction de titre par API — masse totale constante</p>
<div class="meta">
  <span>Produit : <b>${d.prNom}</b></span><span>N° OF : <b>${d.ofNum}</b></span>
  <span>Date de pesée : <b>${d.datePesee}</b></span><span>Opérateur : <b>${d.operateur}</b></span>
  <span>Total API / fraction : <b>${fmt(d.totalTheoAPI)} ${u}</b></span>${d.nbFrac > 1 ? `<span>Nombre de fractions : <b>${d.nbFrac}</b> (fiche = 1 fraction)</span>` : '<span></span>'}
  <span>Édité le : <b>${now}</b></span>
</div>
<table>
  <thead><tr><th>Composant / Lot</th><th class="r">Dosage (%)</th><th class="r">LOD (%)</th><th class="r">Titre (%)</th><th class="r">Obtenue (${u})</th><th class="r">Théorique (${u})</th><th class="r">Réel à peser (${u})</th></tr></thead>
  <tbody>${corps}</tbody>
</table>
${fracTable}
<div class="sig"><div class="box">Pesé par (nom, date, visa)</div><div class="box">Vérifié par (nom, date, visa)</div></div>
<div class="foot">Document généré par ProdTrack — Module Pesée.</div>
</body></html>`
}
function imprimer(html) {
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour éditer la fiche de pesée.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
function exporterPDF() { imprimer(ficheHTML(snapshotActuel())) }
function exporterPeseePDF(p) { imprimer(ficheHTML(snapshotStored(p))) }
</script>

<style scoped>
.pes-page { color: #1b2733; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head .card-title { margin: 0; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; font-size: 13px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; font-size: 13px; }
.u-fixed { font-size: 13px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 6px 12px; }
.x-api { margin-left: auto; background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 7px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.x-api:hover { background: #fef2f2; }
.meth-line { font-size: 12.5px; color: #475569; margin: 0 0 10px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 7px 11px; }
.add-api-wrap { margin: -4px 0 18px; }
.lots-wrap { overflow-x: auto; margin-bottom: 10px; }
.lots-tbl { border-collapse: collapse; width: 100%; font-size: 13px; }
.lots-tbl th { text-align: left; background: #f8fafc; color: #475569; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; white-space: nowrap; vertical-align: bottom; }
.lots-tbl .th-sub { font-size: 9px; font-weight: 500; text-transform: none; color: #94a3b8; }
.lots-tbl td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; }
.lots-tbl input { width: 100%; min-width: 80px; padding: 7px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 14px; color: #0f172a; }
.lots-tbl input[type=text] { min-width: 94px; }
.lots-tbl input:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.lots-tbl .calc { text-align: right; font-weight: 600; color: #0f172a; white-space: nowrap; }
.lots-tbl .calc.b { font-weight: 800; color: #4f46e5; }
.lots-tbl .x { background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 13px; }
.lots-tbl .x:hover { background: #fef2f2; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 4px; }
.fld { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: #475569; }
.fld input, .fld select { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 15px; color: #0f172a; background: #fff; }
.fld input:focus, .fld select:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.prod-search { font-size: 13px !important; padding: 7px 10px !important; }
.cnt { font-size: 11px; color: #94a3b8; font-weight: 600; }
.cfg-note { font-size: 12px; color: #64748b; margin: 8px 0 0; }
.cfg-note.ok-note { color: #166534; }
.lnk { color: #4f46e5; font-weight: 600; cursor: pointer; text-decoration: underline; }
.hint { font-size: 12px; color: #64748b; margin: 12px 0 0; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 9px 11px; line-height: 1.6; }
.frac-note { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; margin: 10px 0 0; line-height: 1.5; }
.frac-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 9px 12px; border-radius: 8px; font-size: 13px; margin: 0 0 14px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.btn { background: #4f46e5; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 6px 12px; font-size: 13px; }
.res { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.res-card { flex: 1; min-width: 220px; border-radius: 12px; padding: 16px 18px; border: 1px solid; }
.res-card.api { background: #eef2ff; border-color: #c7d2fe; }
.res-card.exc { background: #f0fdfa; border-color: #99f6e4; }
.res-card.exc.neg { background: #fef2f2; border-color: #fecaca; }
.rc-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.rc-v { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }
.rc-v span { font-size: 16px; font-weight: 600; color: #64748b; }
.rc-e { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; }
.t { width: 100%; border-collapse: collapse; font-size: 13px; }
.t th { text-align: left; background: #f8fafc; color: #475569; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; white-space: nowrap; }
.t th.r, .t td.r { text-align: right; }
.t td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.t td.b { font-weight: 800; color: #0f172a; }
.t td.indent { padding-left: 22px; }
.t tr.api-row td { font-weight: 800; color: #4338ca; background: #f5f3ff; }
.t tr.sub td { font-weight: 700; background: #fafbff; }
.t tr.tot td { font-weight: 800; background: #fafafa; border-top: 2px solid #e2e8f0; }
.t td.up { color: #047857; }
.t td.down { color: #b91c1c; }
.meth-badge { font-size: 11px; color: #4338ca; font-weight: 700; background: #e0e7ff; padding: 1px 7px; border-radius: 10px; margin-left: 6px; }
.titre-badge { font-size: 11px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 1px 6px; border-radius: 10px; margin-left: 6px; white-space: nowrap; }
.note { font-size: 12px; color: #64748b; margin-top: 10px; line-height: 1.5; }
.rep-badge { font-size: 12px; font-weight: 700; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 2px 10px; margin-left: 10px; }
.recap { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
.recap-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
.recap-row:last-child { border-bottom: 0; }
.recap-nom { font-size: 15px; font-weight: 700; color: #0f172a; }
.recap-type { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 1px 7px; border-radius: 10px; margin-left: 6px; letter-spacing: .03em; }
.recap-type.api { background: #e0e7ff; color: #4338ca; }
.recap-type.exc { background: #ccfbf1; color: #0f766e; }
.recap-q { font-size: 15px; color: #64748b; white-space: nowrap; }
.recap-q b { font-size: 19px; color: #4f46e5; }
.recap-row.recap-tot { background: #fafafa; border-top: 2px solid #e2e8f0; }
.recap-row.recap-tot .recap-nom { color: #475569; }
.recap-row.recap-tot .recap-q b { color: #0f172a; }
.row-act { white-space: nowrap; text-align: right; }
.mini { background: #eef2ff; border: 1px solid #c7d2fe; color: #4338ca; border-radius: 6px; padding: 4px 9px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 5px; }
.mini:hover { background: #e0e7ff; }
.mini.del { background: #fff; border-color: #fca5a5; color: #dc2626; }
.mini.del:hover { background: #fef2f2; }
</style>
