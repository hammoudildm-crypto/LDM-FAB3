<template>
  <div class="pes-page">
    <PageHeader title="Pesée — Calcul API / Excipient" tone="#4f46e5"
      subtitle="Pesée séquentielle multi-lots : on part du théorique total, chaque lot épuisé déduit sa part, et le lot qui complète est calculé sur le théorique restant." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <h2 class="card-title">Produit</h2>
      <label class="fld">Sélection <span v-if="rechercheProduit" class="cnt">({{ produitsFiltres.length }})</span>
        <input v-model="rechercheProduit" type="text" class="prod-search" placeholder="Rechercher (code ou désignation)…" />
        <select v-model="produitSel">
          <option value="">— Choisir —</option>
          <option v-for="p in produitsFiltres" :key="p.id" :value="String(p.id)">{{ p.code_pf }} — {{ p.designation }}</option>
        </select>
      </label>
      <p v-if="produitSel && configParProduit[produitSel]" class="cfg-note ok-note">✓ Méthode et quantités théoriques chargées depuis la configuration du produit.</p>
      <p v-else-if="produitSel" class="cfg-note">Aucune configuration pour ce produit. <router-link to="/referentiels" class="lnk">Configurer dans Référentiels</router-link></p>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">API</h2>
        <span class="u-fixed" style="margin-left:auto">Unité : kg</span>
      </div>

      <div class="grid">
        <label class="fld">Méthode de calcul
          <select v-model="methode">
            <option value="standard">Standard (titre = dosage − LOD)</option>
            <option value="cycladol">Cycladol (10,46 = 100 %)</option>
            <option value="perso">Personnalisé</option>
          </select>
        </label>
        <label class="fld" v-if="methode === 'perso'">Valeur représentant 100 %
          <input v-model.number="convPerso" type="number" min="0" step="any" placeholder="ex. 10.46" />
        </label>
        <label class="fld">Quantité théorique totale API ({{ unite }})
          <input v-model.number="theoTotalAPI" type="number" min="0" step="any" placeholder="ex. 30" />
        </label>
      </div>

      <div class="lots-wrap">
        <table class="lots-tbl">
          <thead>
            <tr>
              <th>Lot API</th>
              <th>Dosage (%)</th>
              <th>LOD (%)</th>
              <th>Titre (%)</th>
              <th>Qté réelle obtenue ({{ unite }})<br /><span class="th-sub">lot pesé / épuisé</span></th>
              <th>Qté théorique ({{ unite }})</th>
              <th>Qté réelle à peser ({{ unite }})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in lots" :key="i">
              <td><input v-model="l.lot" type="text" placeholder="N° lot" /></td>
              <td><input v-model.number="l.dosage" type="number" min="0" step="any" placeholder="99.5" /></td>
              <td><input v-model.number="l.lod" type="number" min="0" step="any" placeholder="0.5" /></td>
              <td class="calc">{{ lotsCalc[i].titre != null ? fmt(lotsCalc[i].titre) + ' %' : '—' }}</td>
              <td><input v-model.number="l.obtenu" type="number" min="0" step="any" placeholder="laisser vide = lot qui complète" /></td>
              <td class="calc">{{ lotsCalc[i].theo != null ? fmt(lotsCalc[i].theo) : '—' }}</td>
              <td class="calc b" :class="{ hl: lotsCalc[i].obtenue == null && lotsCalc[i].aPeser != null }">{{ lotsCalc[i].aPeser != null ? fmt(lotsCalc[i].aPeser) : '—' }}</td>
              <td><button v-if="lots.length > 1" class="x" @click="removeLot(i)" title="Supprimer ce lot">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="btn ghost sm" @click="addLot">+ Ajouter un lot API</button>

      <p class="hint">
        <b>Titre</b> : <span v-if="conv != null">dosage converti (dosage × 100 ÷ {{ fmt(conv) }}) − LOD</span><span v-else>dosage − LOD</span>. On traite les lots dans l'ordre à partir du théorique total.<br />
        <b>Lot pesé / épuisé</b> : saisis sa <b>quantité réelle obtenue</b> → sa quantité théorique couverte = obtenue × titre ÷ 100.<br />
        <b>Lot qui complète</b> : laisse la quantité obtenue <b>vide</b> → sa quantité à peser = théorique restant × 100 ÷ titre.<br />
        <b>Titre ≥ 100 %</b> : aucune correction appliquée → la quantité réelle = la quantité théorique.
      </p>
      <p v-if="resteACouvrir != null && Math.abs(resteACouvrir) > 0.0005" class="warn">
        Reste théorique non couvert : <b>{{ fmt(resteACouvrir) }} {{ unite }}</b>.
        {{ resteACouvrir > 0 ? 'Ajoute un lot (ou laisse le dernier lot sans quantité obtenue) pour compléter.' : 'Les quantités obtenues dépassent le théorique total.' }}
      </p>
    </section>

    <section class="card">
      <h2 class="card-title">Excipient</h2>
      <div class="grid">
        <label class="fld">N° lot excipient
          <input v-model="lotExc" type="text" placeholder="N° lot" />
        </label>
        <label class="fld">Quantité théorique excipient ({{ unite }})
          <input v-model.number="theoExc" type="number" min="0" step="any" placeholder="ex. 1500" />
        </label>
      </div>
    </section>

    <section class="card" v-if="totalReelAPI != null || titreInvalide">
      <h2 class="card-title">Résultats</h2>
      <p v-if="titreInvalide" class="alert">Un lot a un titre invalide (Dosage − LOD ≤ 0). Vérifie le dosage et la LOD.</p>
      <p v-if="excipientNegatif" class="alert">⚠ Excipient négatif : la quantité réelle totale d'API ({{ fmt(totalReelAPI) }} {{ unite }}) dépasse la masse totale théorique ({{ fmt(totalTheo) }} {{ unite }}). Vérifie les titres et les quantités.</p>

      <template v-if="totalReelAPI != null">
        <div class="res">
          <div class="res-card api">
            <div class="rc-l">Total réel API</div>
            <div class="rc-v">{{ fmt(totalReelAPI) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartAPI != null">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }} {{ unite }} vs théorique ({{ fmt(theoTotalAPI) }})</div>
          </div>
          <div class="res-card exc" :class="{ neg: excipientNegatif }" v-if="reelExc != null">
            <div class="rc-l">Quantité réelle excipient</div>
            <div class="rc-v">{{ fmt(reelExc) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartAPI != null">{{ sign(-ecartAPI) }}{{ fmt(-ecartAPI) }} {{ unite }} vs théorique</div>
          </div>
        </div>

        <table class="t">
          <thead><tr><th>Composant</th><th class="r">Théorique ({{ unite }})</th><th class="r">Réel ({{ unite }})</th><th class="r">Écart ({{ unite }})</th></tr></thead>
          <tbody>
            <tr v-for="l in lotsReels" :key="l.idx">
              <td>API — lot {{ l.lot || ('n°' + (l.idx + 1)) }}
                <span class="titre-badge">titre {{ fmt(l.titre) }} %</span>
                <span v-if="l.obtenue == null" class="comp-badge">complète</span>
              </td>
              <td class="r">{{ fmt(l.theo) }}</td>
              <td class="r b">{{ fmt(l.aPeser) }}</td>
              <td class="r" :class="ecartCls(l.aPeser - l.theo)">{{ sign(l.aPeser - l.theo) }}{{ fmt(l.aPeser - l.theo) }}</td>
            </tr>
            <tr class="sub" v-if="lotsReels.length > 1">
              <td>Total API</td>
              <td class="r">{{ fmt(theoTotalAPI) }}</td>
              <td class="r b">{{ fmt(totalReelAPI) }}</td>
              <td class="r" :class="ecartCls(ecartAPI)">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }}</td>
            </tr>
            <tr v-if="reelExc != null">
              <td>Excipient <span v-if="lotExc" class="titre-badge">lot {{ lotExc }}</span></td>
              <td class="r">{{ fmt(theoExc) }}</td>
              <td class="r b">{{ fmt(reelExc) }}</td>
              <td class="r" :class="ecartCls(-ecartAPI)">{{ sign(-ecartAPI) }}{{ fmt(-ecartAPI) }}</td>
            </tr>
            <tr class="tot" v-if="totalReel != null">
              <td>Total</td>
              <td class="r">{{ fmt(totalTheo) }}</td>
              <td class="r b">{{ fmt(totalReel) }}</td>
              <td class="r">0</td>
            </tr>
          </tbody>
        </table>
        <p class="note" v-if="reelExc != null">Chaque lot est corrigé par son propre titre (= dosage − LOD). L'excipient compense le surplus total d'API, la masse totale restant constante.</p>
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
          <thead><tr><th>Date</th><th>Produit</th><th>OF</th><th>Opérateur</th><th class="r">Total réel API</th><th class="r">Lots</th><th></th></tr></thead>
          <tbody>
            <tr v-for="p in historique" :key="p.id">
              <td>{{ p.date_pesee || '—' }}</td>
              <td>{{ p.produit_libelle || '—' }}</td>
              <td>{{ p.of_numero || '—' }}</td>
              <td>{{ p.operateur || '—' }}</td>
              <td class="r b">{{ p.total_reel_api != null ? fmt(p.total_reel_api) + ' ' + (p.unite || '') : '—' }}</td>
              <td class="r">{{ (p.lots && p.lots.length) || 0 }}</td>
              <td class="row-act">
                <button class="mini" @click="chargerPesee(p)" title="Recharger dans le calcul">Charger</button>
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
const theoTotalAPI = ref(null)
const theoExc = ref(null)
const lotExc = ref('')
const lots = ref([{ lot: '', dosage: null, lod: null, obtenu: null }])
const methode = ref('standard')
const convPerso = ref(100)
let suppressWatch = false
const configs = ref([])

const produits = ref([])
const produitSel = ref('')
const ofNum = ref('')
const datePesee = ref(new Date().toISOString().slice(0, 10))
const operateur = ref('')
const historique = ref([])
const erreur = ref('')
const message = ref('')
const enreg = ref(false)
const rechercheProduit = ref('')
const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  let list = q ? produits.value.filter(p => ((p.code_pf || '') + ' ' + (p.designation || '')).toLowerCase().includes(q)) : produits.value
  if (produitSel.value && !list.some(p => String(p.id) === produitSel.value)) {
    const sel = produits.value.find(p => String(p.id) === produitSel.value)
    if (sel) list = [sel, ...list]
  }
  return list
})

const vide = (x) => x === null || x === '' || x === undefined

// Méthodes : conversion éventuelle du dosage (valeur représentant 100 %). Le titre reste un %,
// la quantité réelle se calcule ensuite de façon standard (× 100 ÷ titre), plafond 100 %.
const METHODES = {
  standard: { conv: null, plafond: 100 },
  cycladol: { conv: 10.46, plafond: 100 }
}
const conv = computed(() => methode.value === 'perso' ? (Number(convPerso.value) > 0 ? Number(convPerso.value) : null) : METHODES[methode.value].conv)
const plafond = computed(() => methode.value === 'perso' ? 100 : METHODES[methode.value].plafond)
function labelMethode(key, cv) {
  if (key === 'cycladol') return 'Cycladol (dosage converti : 10,46 = 100 %)'
  if (key === 'perso') return 'Personnalisé (dosage converti : ' + fmt(cv) + ' = 100 %)'
  return 'Standard (titre = dosage − LOD)'
}
const methodeLabel = computed(() => labelMethode(methode.value, conv.value))
const configParProduit = computed(() => { const m = {}; for (const c of configs.value) if (c.produit_id != null) m[String(c.produit_id)] = c; return m })

// Calcul séquentiel : on part du théorique total ; chaque lot pesé déduit sa part (obtenue x titre / 100),
// le lot sans quantité obtenue prend le théorique restant et sa qté à peser = restant x 100 / titre.
const lotsCalc = computed(() => {
  const total = (!vide(theoTotalAPI.value) && Number(theoTotalAPI.value) >= 0) ? Number(theoTotalAPI.value) : null
  let remaining = total
  const cv = conv.value, plaf = plafond.value
  const out = []
  for (let i = 0; i < lots.value.length; i++) {
    const l = lots.value[i]
    const dosage = Number(l.dosage), lod = Number(l.lod)
    // Étape 1 : conversion du dosage si la méthode le demande (ex. Cycladol : 10,46 = 100 %)
    const dosageConv = (!vide(l.dosage)) ? (cv != null ? dosage * 100 / cv : dosage) : null
    // Étape 2 : titre = dosage converti − LOD
    const titre = (dosageConv != null && !vide(l.lod)) ? dosageConv - lod : null
    // Titre effectif plafonné (>= 100 % : pas de correction)
    const titreEff = (titre != null) ? (plaf != null ? Math.min(titre, plaf) : titre) : null
    const obtenue = (!vide(l.obtenu) && Number(l.obtenu) >= 0) ? Number(l.obtenu) : null
    let theo = null, aPeser = null
    if (titreEff != null && titreEff > 0 && remaining != null) {
      if (obtenue != null) {
        theo = obtenue * titreEff / 100
        aPeser = obtenue
        remaining = remaining - theo
      } else {
        theo = remaining > 0 ? remaining : 0
        aPeser = theo * 100 / titreEff
        remaining = remaining - theo
      }
    } else {
      // lot non calculable (titre invalide/manquant ou chaîne rompue) → stoppe la chaîne
      remaining = null
    }
    out.push({ idx: i, lot: l.lot, titre, obtenue, theo, aPeser })
  }
  return out
})
const lotsReels = computed(() => lotsCalc.value.filter(l => l.aPeser != null && l.theo != null))
const titreInvalide = computed(() => lotsCalc.value.some(l => l.titre != null && l.titre <= 0))

const totalTheoAPINum = computed(() => (!vide(theoTotalAPI.value) && Number(theoTotalAPI.value) >= 0) ? Number(theoTotalAPI.value) : null)

// Total réel API : somme des « à peser », null si un lot renseigné n'est pas calculable
const totalReelAPI = computed(() => {
  if (totalTheoAPINum.value == null) return null
  let s = 0, any = false
  for (let i = 0; i < lots.value.length; i++) {
    const raw = lots.value[i], c = lotsCalc.value[i]
    const actif = !vide(raw.dosage) || !vide(raw.lod) || !vide(raw.obtenu)
    if (actif) {
      if (c.aPeser == null) return null
      s += c.aPeser; any = true
    }
  }
  return any ? s : null
})
// Reste théorique non couvert par les lots
const resteACouvrir = computed(() => {
  const tta = totalTheoAPINum.value
  if (tta == null) return null
  let covered = 0, anyIncomplete = false
  for (let i = 0; i < lots.value.length; i++) {
    const raw = lots.value[i], c = lotsCalc.value[i]
    const actif = !vide(raw.dosage) || !vide(raw.lod) || !vide(raw.obtenu)
    if (actif) {
      if (c.theo == null) { anyIncomplete = true; break }
      covered += c.theo
    }
  }
  if (anyIncomplete) return null
  return tta - covered
})
const reelExc = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPINum.value
  if (tra == null || tta == null || vide(theoExc.value)) return null
  const te = Number(theoExc.value)
  if (!(te >= 0)) return null
  return (tta + te) - tra
})
const totalTheo = computed(() => {
  const tta = totalTheoAPINum.value
  if (tta == null || vide(theoExc.value)) return null
  const te = Number(theoExc.value)
  return (te >= 0) ? tta + te : null
})
const totalReel = computed(() => {
  const tra = totalReelAPI.value, re = reelExc.value
  return (tra != null && re != null) ? tra + re : null
})
const ecartAPI = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPINum.value
  return (tra != null && tta != null) ? tra - tta : null
})
const excipientNegatif = computed(() => reelExc.value != null && reelExc.value < 0)

function fmt(v) { if (v == null || Number.isNaN(Number(v))) return '—'; return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) }
function sign(v) { return (v != null && v > 1e-9) ? '+' : '' }
function ecartCls(v) { if (v == null || Math.abs(v) < 1e-9) return ''; return v > 0 ? 'up' : 'down' }
function addLot() { lots.value.push({ lot: '', dosage: null, lod: null, obtenu: null }) }
function removeLot(i) { if (lots.value.length > 1) lots.value.splice(i, 1) }
function reset() {
  lots.value = [{ lot: '', dosage: null, lod: null, obtenu: null }]
  theoTotalAPI.value = null; theoExc.value = null; lotExc.value = ''; methode.value = 'standard'; convPerso.value = 100; produitSel.value = ''; ofNum.value = ''; operateur.value = ''
  datePesee.value = new Date().toISOString().slice(0, 10); erreur.value = ''; message.value = ''
}

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

// Sélection auto de la méthode Cycladol quand le produit Cycladol est choisi
watch(produitSel, (id) => {
  if (suppressWatch) return
  const cfg = configParProduit.value[id]
  if (cfg) {
    methode.value = cfg.methode || 'standard'
    if (cfg.methode === 'perso' && cfg.conversion != null) convPerso.value = cfg.conversion
    if (cfg.theo_api != null) theoTotalAPI.value = cfg.theo_api
    if (cfg.theo_excipient != null) theoExc.value = cfg.theo_excipient
  } else {
    const pr = produits.value.find(x => String(x.id) === id)
    const estCycladol = pr && /cycladol/i.test((pr.code_pf || '') + ' ' + (pr.designation || ''))
    if (estCycladol) methode.value = 'cycladol'
    else if (methode.value === 'cycladol') methode.value = 'standard'
  }
}, { flush: 'sync' })

function lotsPayload() {
  return lots.value.map((l, i) => ({
    lot: l.lot || '',
    dosage: vide(l.dosage) ? null : Number(l.dosage),
    lod: vide(l.lod) ? null : Number(l.lod),
    titre: lotsCalc.value[i].titre,
    obtenu: lotsCalc.value[i].obtenue,
    theo: lotsCalc.value[i].theo,
    reel: lotsCalc.value[i].aPeser
  })).filter(l => l.reel != null)
}

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (totalReelAPI.value == null) { erreur.value = 'Renseigne la quantité théorique totale et au moins un lot (dosage, LOD) avant d\'enregistrer.'; return }
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  enreg.value = true
  const payload = {
    date_pesee: datePesee.value || null,
    produit_id: pr ? pr.id : null,
    produit_libelle: pr ? (pr.code_pf + ' — ' + pr.designation) : null,
    of_numero: ofNum.value || null,
    operateur: operateur.value || null,
    unite: unite.value,
    methode: methode.value,
    facteur: conv.value,
    total_theo_api: totalTheoAPINum.value,
    total_reel_api: totalReelAPI.value,
    theo_excipient: vide(theoExc.value) ? null : Number(theoExc.value),
    lot_excipient: lotExc.value || null,
    reel_excipient: reelExc.value,
    lots: lotsPayload()
  }
  const r = await supabase.from('pesees').insert(payload)
  enreg.value = false
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Pesée enregistrée.'
  await chargerHistorique()
}

function chargerPesee(p) {
  suppressWatch = true
  methode.value = p.methode || 'standard'
  if (p.methode === 'perso' && p.facteur != null) convPerso.value = p.facteur
  theoTotalAPI.value = p.total_theo_api
  theoExc.value = p.theo_excipient
  lotExc.value = p.lot_excipient || ''
  produitSel.value = p.produit_id != null ? String(p.produit_id) : ''
  ofNum.value = p.of_numero || ''
  operateur.value = p.operateur || ''
  datePesee.value = p.date_pesee || new Date().toISOString().slice(0, 10)
  lots.value = (p.lots && p.lots.length)
    ? p.lots.map(l => ({ lot: l.lot || '', dosage: l.dosage, lod: l.lod, obtenu: l.obtenu }))
    : [{ lot: '', dosage: null, lod: null, obtenu: null }]
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

// ---- Fiche de pesée PDF ----
function snapshotActuel() {
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  return {
    prNom: pr ? (pr.code_pf + ' — ' + pr.designation) : '—',
    ofNum: ofNum.value || '—', datePesee: datePesee.value || '—', operateur: operateur.value || '—',
    unite: unite.value, theoTotal: totalTheoAPINum.value, methode: methodeLabel.value,
    lots: lots.value.map((l, i) => ({ lot: l.lot || ('n°' + (i + 1)), dosage: vide(l.dosage) ? null : Number(l.dosage), lod: vide(l.lod) ? null : Number(l.lod), titre: lotsCalc.value[i].titre, obtenu: lotsCalc.value[i].obtenue, theo: lotsCalc.value[i].theo, reel: lotsCalc.value[i].aPeser })).filter(l => l.reel != null),
    lotExc: lotExc.value, theoExc: vide(theoExc.value) ? null : Number(theoExc.value), reelExc: reelExc.value,
    totalReelAPI: totalReelAPI.value, totalTheo: totalTheo.value, totalReel: totalReel.value
  }
}
function snapshotStored(p) {
  const ls = (p.lots || []).filter(l => l.reel != null)
  const totTheo = (p.total_theo_api != null && p.theo_excipient != null) ? p.total_theo_api + p.theo_excipient : null
  const totReel = (p.total_reel_api != null && p.reel_excipient != null) ? p.total_reel_api + p.reel_excipient : null
  return {
    prNom: p.produit_libelle || '—', ofNum: p.of_numero || '—', datePesee: p.date_pesee || '—', operateur: p.operateur || '—',
    unite: p.unite || 'g', theoTotal: p.total_theo_api, methode: labelMethode(p.methode || 'standard', p.facteur),
    lots: ls.map((l, i) => ({ lot: l.lot || ('n°' + (i + 1)), dosage: l.dosage, lod: l.lod, titre: l.titre, obtenu: l.obtenu, theo: l.theo, reel: l.reel })),
    lotExc: p.lot_excipient, theoExc: p.theo_excipient, reelExc: p.reel_excipient,
    totalReelAPI: p.total_reel_api, totalTheo: totTheo, totalReel: totReel
  }
}
function ficheHTML(d) {
  const now = new Date().toLocaleString('fr-FR')
  const u = d.unite
  const lignes = d.lots.map(l => `<tr><td>${l.lot}</td><td class="r">${l.dosage != null ? fmt(l.dosage) : '—'}</td><td class="r">${l.lod != null ? fmt(l.lod) : '—'}</td><td class="r">${l.titre != null ? fmt(l.titre) : '—'}</td><td class="r">${l.obtenu != null ? fmt(l.obtenu) : '—'}</td><td class="r">${fmt(l.theo)}</td><td class="r b">${fmt(l.reel)}</td></tr>`).join('')
  const excLigne = d.reelExc != null ? `<tr><td>Excipient${d.lotExc ? ' — lot ' + d.lotExc : ''}</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">—</td><td class="r">${fmt(d.theoExc)}</td><td class="r b">${fmt(d.reelExc)}</td></tr>` : ''
  const totLigne = d.totalReel != null ? `<tr class="tot"><td>Total</td><td colspan="4"></td><td class="r">${fmt(d.totalTheo)}</td><td class="r b">${fmt(d.totalReel)}</td></tr>` : ''
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
.sig{display:flex;gap:40px;margin-top:34px}
.sig .box{flex:1;border-top:1px solid #94a3b8;padding-top:6px;font-size:11px;color:#64748b}
.foot{margin-top:24px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:14mm}}
</style></head><body>
<h1>Fiche de pesée</h1><p class="sub">Pesée séquentielle multi-lots — titre = dosage − LOD — masse totale constante</p>
<div class="meta">
  <span>Produit : <b>${d.prNom}</b></span><span>N° OF : <b>${d.ofNum}</b></span>
  <span>Date de pesée : <b>${d.datePesee}</b></span><span>Opérateur : <b>${d.operateur}</b></span>
  <span>Théorique total API : <b>${fmt(d.theoTotal)} ${u}</b></span><span>Méthode : <b>${d.methode}</b></span>
  <span>Édité le : <b>${now}</b></span>
</div>
<table>
  <thead><tr><th>Composant / Lot</th><th class="r">Dosage (%)</th><th class="r">LOD (%)</th><th class="r">Titre (%)</th><th class="r">Obtenue (${u})</th><th class="r">Théorique (${u})</th><th class="r">Réel à peser (${u})</th></tr></thead>
  <tbody>${lignes}${excLigne}${totLigne}</tbody>
</table>
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
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head .card-title { margin: 0; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; font-size: 13px; }
.warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 9px 12px; border-radius: 8px; margin: 10px 0 0; font-size: 12px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; font-size: 13px; }
.u-fixed { font-size: 13px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 6px 12px; }
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
.lots-tbl .calc.hl { background: #eef2ff; border-radius: 6px; }
.lots-tbl .x { background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 13px; }
.lots-tbl .x:hover { background: #fef2f2; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 12px; }
.fld { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: #475569; }
.fld input, .fld select { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 15px; color: #0f172a; background: #fff; }
.fld input:focus, .fld select:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.prod-search { font-size: 13px !important; padding: 7px 10px !important; }
.cnt { font-size: 11px; color: #94a3b8; font-weight: 600; }
.hint { font-size: 12px; color: #64748b; margin: 12px 0 0; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 9px 11px; line-height: 1.6; }
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
.t tr.sub td { font-weight: 700; background: #fafbff; }
.t tr.tot td { font-weight: 800; background: #fafafa; border-top: 2px solid #e2e8f0; }
.t td.up { color: #047857; }
.t td.down { color: #b91c1c; }
.titre-badge { font-size: 11px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 1px 6px; border-radius: 10px; margin-left: 6px; white-space: nowrap; }
.comp-badge { font-size: 11px; color: #3730a3; font-weight: 700; background: #e0e7ff; padding: 1px 6px; border-radius: 10px; margin-left: 4px; white-space: nowrap; }
.note { font-size: 12px; color: #64748b; margin-top: 10px; line-height: 1.5; }
.row-act { white-space: nowrap; text-align: right; }
.mini { background: #eef2ff; border: 1px solid #c7d2fe; color: #4338ca; border-radius: 6px; padding: 4px 9px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 5px; }
.mini:hover { background: #e0e7ff; }
.mini.del { background: #fff; border-color: #fca5a5; color: #dc2626; }
.mini.del:hover { background: #fef2f2; }
.cfg-note { font-size: 12px; color: #64748b; margin: 8px 0 0; }
.cfg-note.ok-note { color: #166534; }
.lnk { color: #4f46e5; font-weight: 600; cursor: pointer; text-decoration: underline; }
.cfg-toggle { background: none; border: 0; padding: 0; font-size: 17px; font-weight: 700; color: #1b2733; cursor: pointer; }
</style>
