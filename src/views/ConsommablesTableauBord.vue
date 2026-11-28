<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

function ymd(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const consommables = ref([])
const sorties = ref([])     // type=sortie depuis le 1er janv. de l'an dernier
const entrees = ref([])     // type=entree, même fenêtre
const transferts = ref([])  // type=transfert (MP → Fab), même fenêtre
const erreur = ref('')

async function charger() {
  erreur.value = ''
  const rc = await supabase.from('consommables').select('*').order('nom')
  if (rc.error) { erreur.value = rc.error.message; return }
  consommables.value = rc.data || []
  const depuis = new Date(new Date().getFullYear() - 1, 0, 1)
  const rm = await supabase.from('mouvements_consommables').select('consommable_id,quantite,date_mvt,type').gte('date_mvt', ymd(depuis))
  if (!rm.error) { const all = rm.data || []; sorties.value = all.filter(m => m.type === 'sortie'); entrees.value = all.filter(m => m.type === 'entree'); transferts.value = all.filter(m => m.type === 'transfert') }
}
onMounted(charger)

// ---- Formats & helpers ----
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDA = (n) => Number(Math.round(n) || 0).toLocaleString('fr-FR') + ' DA'
const fmtDAc = (n) => { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M DA' : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('fr-FR') + ' k DA' : Math.round(v) + ' DA' }
const fmtCompact = (n) => { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M' : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('fr-FR') + ' k' : String(Math.round(v)) }
const consoById = computed(() => { const m = {}; for (const c of consommables.value) m[c.id] = c; return m })
const prixDe = (id) => Number(consoById.value[id]?.prix_unitaire) || 0
// Deux emplacements : Stock MP (magasin) + Stock Fab (fabrication).
const sMp = (c) => Number(c.stock_mp) || 0
const sFab = (c) => Number(c.stock_fab) || 0
const seMp = (c) => Number(c.seuil_mp) || 0
const seFab = (c) => Number(c.seuil_fab) || 0
const seuilTot = (c) => seMp(c) + seFab(c)
const totalStock = (c) => sMp(c) + sFab(c)
function etatEmpl(stock, seuil) { if (stock <= 0) return 'rupture'; if (stock <= seuil) return 'alerte'; return 'ok' }
const etatMp = (c) => etatEmpl(sMp(c), seMp(c))
const etatFab = (c) => etatEmpl(sFab(c), seFab(c))
const valeurDe = (c) => totalStock(c) * (Number(c.prix_unitaire) || 0)
const valeurMp = computed(() => consommables.value.reduce((s, c) => s + sMp(c) * (Number(c.prix_unitaire) || 0), 0))
const valeurFab = computed(() => consommables.value.reduce((s, c) => s + sFab(c) * (Number(c.prix_unitaire) || 0), 0))
function etatClass(c) { const em = etatEmpl(sMp(c), Number(c.seuil_mp) || 0), ef = etatEmpl(sFab(c), Number(c.seuil_fab) || 0); if (em === 'rupture' || ef === 'rupture') return 'rupture'; if (em === 'alerte' || ef === 'alerte') return 'alerte'; return 'ok' }
function etatLabel(c) { const e = etatClass(c); return e === 'rupture' ? 'Rupture' : e === 'alerte' ? 'À commander' : 'OK' }
const ajKey = computed(() => ymd(new Date()))
const curYM = computed(() => ajKey.value.slice(0, 7))
const moisPrecYM = computed(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7) })
const moisLabel = (ym) => { if (!ym) return '—'; const [y, mo] = ym.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }

// ---- Couverture (jours) = stock ÷ conso journalière moyenne (90 j) ----
const AVG_FENETRE = 90
const consoRecente = computed(() => {
  const lim = ymd(new Date(Date.now() - AVG_FENETRE * 86400000)), m = {}
  for (const s of sorties.value) if ((s.date_mvt || '') >= lim) m[s.consommable_id] = (m[s.consommable_id] || 0) + (Number(s.quantite) || 0)
  return m
})
const moyJourDe = (id) => (consoRecente.value[id] || 0) / AVG_FENETRE
function couvertureJours(c) { const a = moyJourDe(c.id); return a > 0 ? totalStock(c) / a : null }

// ---- Consommation du mois sélectionné (journalière + par article) ----
const moisSel = ref(curYM.value)
const moisDispo = computed(() => { const s = new Set(sorties.value.map(m => (m.date_mvt || '').slice(0, 7)).filter(Boolean)); s.add(curYM.value); return [...s].sort().reverse() })
const sortiesMois = computed(() => sorties.value.filter(m => (m.date_mvt || '').slice(0, 7) === moisSel.value))
const joursRefMois = computed(() => { const [y, mo] = moisSel.value.split('-').map(Number); return moisSel.value === curYM.value ? new Date().getDate() : new Date(y, mo, 0).getDate() })
const consoAujVal = computed(() => sorties.value.filter(m => m.date_mvt === ajKey.value).reduce((s, m) => s + (Number(m.quantite) || 0) * prixDe(m.consommable_id), 0))
const consoAujNb = computed(() => sorties.value.filter(m => m.date_mvt === ajKey.value).length)
const consoMoisVal = computed(() => sortiesMois.value.reduce((s, m) => s + (Number(m.quantite) || 0) * prixDe(m.consommable_id), 0))
const consoMoyJour = computed(() => joursRefMois.value > 0 ? consoMoisVal.value / joursRefMois.value : 0)
const consoParArticle = computed(() => {
  const m = {}
  for (const s of sortiesMois.value) {
    const c = consoById.value[s.consommable_id]; if (!c) continue
    if (!m[s.consommable_id]) m[s.consommable_id] = { id: s.consommable_id, nom: c.nom, unite: c.unite, qte: 0, valeur: 0, jours: new Set() }
    const q = Number(s.quantite) || 0, o = m[s.consommable_id]
    o.qte += q; o.valeur += q * prixDe(s.consommable_id); o.jours.add(s.date_mvt)
  }
  return Object.values(m).map(o => ({ id: o.id, nom: o.nom, unite: o.unite, qte: o.qte, valeur: o.valeur, nbJours: o.jours.size, moyJour: joursRefMois.value > 0 ? o.qte / joursRefMois.value : 0 })).sort((a, b) => b.valeur - a.valeur || b.qte - a.qte)
})
const consoJour = computed(() => {
  const [y, mo] = moisSel.value.split('-').map(Number)
  const nb = new Date(y, mo, 0).getDate(), byDay = {}
  for (const s of sortiesMois.value) { const d = Number((s.date_mvt || '').slice(8, 10)); if (!d) continue; byDay[d] = (byDay[d] || 0) + (Number(s.quantite) || 0) * prixDe(s.consommable_id) }
  const jours = []; let max = 0, tot = 0
  const auj = moisSel.value === curYM.value ? new Date().getDate() : -1
  for (let d = 1; d <= nb; d++) { const v = byDay[d] || 0; if (v > max) max = v; tot += v; jours.push({ jour: d, val: v, auj: d === auj }) }
  return { jours, max, tot }
})

// ---- Évolution annuelle par article (matrice article × 12 mois) ----
const metrique = ref('valeur')
const anneeSel = ref(String(new Date().getFullYear()))
const artSel = ref('')
const consommablesTries = computed(() => [...consommables.value].sort((a, b) => (a.nom || '').localeCompare(b.nom || '')))
const anneesDispo = computed(() => { const s = new Set(sorties.value.map(m => (m.date_mvt || '').slice(0, 4)).filter(Boolean)); s.add(String(new Date().getFullYear())); return [...s].sort().reverse() })
const evolutionAnnee = computed(() => {
  const an = anneeSel.value, parArt = {}
  for (const s of sorties.value) {
    if ((s.date_mvt || '').slice(0, 4) !== an) continue
    const c = consoById.value[s.consommable_id]; if (!c) continue
    const mo = Number((s.date_mvt || '').slice(5, 7)) - 1; if (mo < 0 || mo > 11) continue
    if (!parArt[s.consommable_id]) parArt[s.consommable_id] = { id: s.consommable_id, nom: c.nom, unite: c.unite, mois: new Array(12).fill(0), qteMois: new Array(12).fill(0), total: 0, totalQte: 0 }
    const q = Number(s.quantite) || 0, o = parArt[s.consommable_id]
    o.qteMois[mo] += q; o.mois[mo] += q * prixDe(s.consommable_id); o.total += q * prixDe(s.consommable_id); o.totalQte += q
  }
  let arr = Object.values(parArt)
  if (artSel.value) arr = arr.filter(o => String(o.id) === artSel.value)
  for (const o of arr) { o.serie = metrique.value === 'qte' ? o.qteMois : o.mois; o.max = Math.max(...o.serie, 0); o.totAff = metrique.value === 'qte' ? o.totalQte : o.total }
  return arr.sort((a, b) => b.total - a.total)
})
const evolutionTotaux = computed(() => {
  const mois = new Array(12).fill(0)
  for (const o of evolutionAnnee.value) for (let i = 0; i < 12; i++) mois[i] += o.mois[i]
  return { mois, max: Math.max(...mois, 1), total: mois.reduce((s, x) => s + x, 0) }
})
function cellStyle(v, max) { if (!v || max <= 0) return {}; const a = Math.min(0.85, 0.12 + v / max * 0.73); return { background: `rgba(180,83,9,${a.toFixed(3)})`, color: a > 0.5 ? '#fff' : '#7c2d12', fontWeight: 700 } }
function couvClass(j) { if (j === null) return 'couv-none'; if (j < 7) return 'couv-bas'; if (j < 21) return 'couv-moy'; return 'couv-ok' }
function couvLabel(j) { return j === null ? '—' : Math.round(j) + ' j' }

// ---- KPI principaux ----
const nbRef = computed(() => consommables.value.length)
const valeurStock = computed(() => consommables.value.reduce((s, c) => s + valeurDe(c), 0))
const nbOk = computed(() => consommables.value.filter(c => etatClass(c) === 'ok').length)
const nbAlerte = computed(() => consommables.value.filter(c => etatClass(c) === 'alerte').length)
const nbRupture = computed(() => consommables.value.filter(c => etatClass(c) === 'rupture').length)
const tauxDispo = computed(() => nbRef.value > 0 ? Math.round(nbOk.value / nbRef.value * 100) : 0)
const nbCouvCrit = computed(() => consommables.value.filter(c => { const j = couvertureJours(c); return j !== null && j < 7 }).length)
// Alertes par emplacement (seuils séparés)
const nbFabSec = computed(() => consommables.value.filter(c => sFab(c) <= 0).length)
const nbFabAlerte = computed(() => consommables.value.filter(c => etatFab(c) === 'alerte').length)
const nbFabRupture = computed(() => consommables.value.filter(c => etatFab(c) === 'rupture').length)
const nbMpAlerte = computed(() => consommables.value.filter(c => etatMp(c) === 'alerte').length)
const nbMpRupture = computed(() => consommables.value.filter(c => etatMp(c) === 'rupture').length)

// ---- Consommation mensuelle (valeur) ----
function valByMonth(rows) { const m = {}; for (const r of rows) { const k = (r.date_mvt || '').slice(0, 7); if (!k) continue; m[k] = (m[k] || 0) + (Number(r.quantite) || 0) * prixDe(r.consommable_id) } return m }
const sortiesParMois = computed(() => valByMonth(sorties.value))
const entreesParMois = computed(() => valByMonth(entrees.value))
const transfertsParMois = computed(() => valByMonth(transferts.value))
const transfertMois = computed(() => transfertsParMois.value[curYM.value] || 0)
const consoMois = computed(() => sortiesParMois.value[curYM.value] || 0)
const consoMoisPrec = computed(() => sortiesParMois.value[moisPrecYM.value] || 0)
const entreeMois = computed(() => entreesParMois.value[curYM.value] || 0)
const variationMois = computed(() => consoMoisPrec.value > 0 ? (consoMois.value - consoMoisPrec.value) / consoMoisPrec.value * 100 : null)

// Tendance 12 mois glissants (sorties + entrées)
const trend12 = computed(() => {
  const now = new Date(), arr = []
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const ym = ymd(d).slice(0, 7); arr.push({ ym, label: MOIS_COURTS[d.getMonth()], an: String(d.getFullYear()).slice(2), val: sortiesParMois.value[ym] || 0, ent: entreesParMois.value[ym] || 0 }) }
  const max = Math.max(...arr.map(x => Math.max(x.val, x.ent)), 1)
  return { arr, max, moyenne: arr.reduce((s, x) => s + x.val, 0) / 12 }
})

// Conso 12 mois par article → top consommateurs + rotation
const conso12 = computed(() => {
  const now = new Date(), lim = ymd(new Date(now.getFullYear(), now.getMonth() - 11, 1)), m = {}; let tot = 0
  for (const s of sorties.value) { if ((s.date_mvt || '') < lim) continue; const v = (Number(s.quantite) || 0) * prixDe(s.consommable_id); m[s.consommable_id] = (m[s.consommable_id] || 0) + v; tot += v }
  const top = Object.entries(m).map(([id, val]) => ({ id: Number(id), nom: consoById.value[id]?.nom || '—', val })).sort((a, b) => b.val - a.val)
  return { map: m, tot, top }
})
const rotation = computed(() => valeurStock.value > 0 ? conso12.value.tot / valeurStock.value : 0)

// Valeur du stock par catégorie
const parCategorie = computed(() => {
  const m = {}
  for (const c of consommables.value) { const k = c.categorie || 'Sans catégorie'; m[k] = (m[k] || 0) + valeurDe(c) }
  const arr = Object.entries(m).map(([cat, val]) => ({ cat, val })).sort((a, b) => b.val - a.val)
  const tot = arr.reduce((s, x) => s + x.val, 0) || 1
  const max = Math.max(...arr.map(x => x.val), 1)
  for (const x of arr) { x.pct = x.val / tot * 100; x.w = x.val / max * 100 }
  return arr
})

// Répartition des états (donut)
const etatRepartition = computed(() => {
  const ok = nbOk.value, al = nbAlerte.value, ru = nbRupture.value, tot = ok + al + ru || 1
  const okT = ok / tot, alT = al / tot
  const style = { background: `conic-gradient(#16a34a 0 ${okT}turn, #f59e0b ${okT}turn ${okT + alT}turn, #dc2626 ${okT + alT}turn 1turn)` }
  return { ok, al, ru, tot: ok + al + ru, style }
})

// Stock dormant : valeur > 0 et aucune sortie sur 12 mois
const dormants = computed(() => consommables.value
  .filter(c => valeurDe(c) > 0 && !(conso12.value.map[c.id] > 0))
  .map(c => ({ nom: c.nom, stock: totalStock(c), unite: c.unite, val: valeurDe(c) }))
  .sort((a, b) => b.val - a.val))
const dormantVal = computed(() => dormants.value.reduce((s, x) => s + x.val, 0))

// À réapprovisionner : hors stock OK, ou couverture < 21 j
function qConseillee(c) { const cible = Math.max(moyJourDe(c.id) * 30, seuilTot(c)); const q = Math.ceil(cible - totalStock(c)); return q > 0 ? q : 0 }
// Besoin au niveau fabrication (pour couvrir 30 j ou atteindre le seuil Fab)
function besoinFab(c) { const cible = Math.max(moyJourDe(c.id) * 30, seFab(c)); return Math.max(0, Math.ceil(cible - sFab(c))) }
// Action conseillée selon le flux : transférer depuis le MP si possible, sinon commander
function actionReappro(c) {
  const bf = besoinFab(c)
  if (bf > 0 && sMp(c) >= bf) return { type: 'transfert', qte: bf, label: 'Transférer', unite: c.unite }
  const qc = qConseillee(c)
  if (bf > 0 || etatMp(c) !== 'ok' || qc > 0) return { type: 'commande', qte: Math.max(qc, bf), label: 'Commander', unite: c.unite }
  return { type: 'none', qte: 0, label: '—', unite: c.unite }
}
const reappro = computed(() => consommables.value
  .map(c => ({ c, couv: couvertureJours(c), moy: moyJourDe(c.id), etat: etatClass(c), qConseil: qConseillee(c), action: actionReappro(c) }))
  .filter(x => x.etat !== 'ok' || (x.couv !== null && x.couv < 21))
  .sort((a, b) => (a.couv === null ? 1e9 : a.couv) - (b.couv === null ? 1e9 : b.couv)))

const topMax = computed(() => conso12.value.top.length ? conso12.value.top[0].val || 1 : 1)
</script>

<template>
  <div class="tdb-conso">
    <PageHeader title="Tableau de bord — Consommables" tone="#b45309"
      subtitle="Deux stocks (Stock MP + Fabrication) : disponibilité, consommation, rotation, transferts et réapprovisionnement." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <!-- KPI principaux -->
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-v">{{ fmt(nbRef) }}</div><div class="kpi-l">Références</div></div>
      <div class="kpi valeur"><div class="kpi-v">{{ fmtDA(valeurStock) }}</div><div class="kpi-l">Valeur du stock<span class="kpi-split">MP {{ fmtDAc(valeurMp) }} · Fab {{ fmtDAc(valeurFab) }}</span></div></div>
      <div class="kpi dispo"><div class="kpi-v">{{ tauxDispo }} %</div><div class="kpi-l">Taux de disponibilité</div></div>
      <div class="kpi alerte"><div class="kpi-v">{{ nbAlerte }}</div><div class="kpi-l">À commander (≤ seuil)</div></div>
      <div class="kpi rupture"><div class="kpi-v">{{ nbRupture }}</div><div class="kpi-l">Ruptures (un emplacement vide)</div></div>
      <div class="kpi sec"><div class="kpi-v">{{ nbFabSec }}</div><div class="kpi-l">Fabrication à sec (stock Fab 0)</div></div>
      <div class="kpi crit"><div class="kpi-v">{{ nbCouvCrit }}</div><div class="kpi-l">Couverture critique (&lt; 7 j)</div></div>
    </div>

    <div class="kpi-row">
      <div class="kpi conso">
        <div class="kpi-v">{{ fmtDA(consoMois) }}
          <span v-if="variationMois !== null" class="pill" :class="variationMois > 0 ? 'up' : 'down'">{{ variationMois > 0 ? '▲' : '▼' }} {{ Math.abs(Math.round(variationMois)) }} %</span>
        </div>
        <div class="kpi-l">Consommation — {{ moisLabel(curYM) }} <span v-if="variationMois !== null" class="muted">vs {{ moisLabel(moisPrecYM) }}</span></div>
      </div>
      <div class="kpi"><div class="kpi-v">{{ fmtDA(trend12.moyenne) }}</div><div class="kpi-l">Conso. moyenne / mois (12 mois)</div></div>
      <div class="kpi"><div class="kpi-v">{{ fmtDA(conso12.tot) }}</div><div class="kpi-l">Consommation sur 12 mois</div></div>
      <div class="kpi rot"><div class="kpi-v">{{ rotation.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} ×</div><div class="kpi-l">Rotation du stock / an</div></div>
      <div class="kpi"><div class="kpi-v">{{ fmtDA(entreeMois) }}</div><div class="kpi-l">Entrées MP — {{ moisLabel(curYM) }}</div></div>
      <div class="kpi transf"><div class="kpi-v">{{ fmtDA(transfertMois) }}</div><div class="kpi-l">Transférés vers Fab — {{ moisLabel(curYM) }}</div></div>
      <div class="kpi dormant"><div class="kpi-v">{{ fmtDA(dormantVal) }}</div><div class="kpi-l">Stock dormant ({{ dormants.length }} art.)</div></div>
    </div>

    <!-- État du stock + Valeur par catégorie -->
    <div class="grid2">
      <section class="card">
        <h2 class="card-title">État du stock</h2>
        <div class="donut-wrap">
          <div class="donut" :style="etatRepartition.style"><div class="donut-hole"><div class="dh-v">{{ tauxDispo }}%</div><div class="dh-l">dispo.</div></div></div>
          <ul class="donut-legend">
            <li><span class="dot ok"></span>OK<b>{{ etatRepartition.ok }}</b></li>
            <li><span class="dot al"></span>À commander<b>{{ etatRepartition.al }}</b></li>
            <li><span class="dot ru"></span>Rupture<b>{{ etatRepartition.ru }}</b></li>
            <li class="tot"><span class="dot none"></span>Total références<b>{{ etatRepartition.tot }}</b></li>
          </ul>
        </div>
        <div class="empl-split">
          <div class="es-row"><span class="es-t">Stock MP</span><span class="es-v"><b class="es-al">{{ nbMpAlerte }}</b> à commander · <b class="es-ru">{{ nbMpRupture }}</b> rupture</span></div>
          <div class="es-row"><span class="es-t">Fabrication</span><span class="es-v"><b class="es-al">{{ nbFabAlerte }}</b> bas · <b class="es-ru">{{ nbFabRupture }}</b> à sec</span></div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Valeur du stock par catégorie</h2>
        <p v-if="!parCategorie.length" class="vide-p">Aucun consommable.</p>
        <ul v-else class="hbars">
          <li v-for="x in parCategorie" :key="x.cat">
            <div class="hb-top"><span class="hb-lbl">{{ x.cat }}</span><span class="hb-val">{{ fmtDA(x.val) }} <span class="muted">· {{ Math.round(x.pct) }}%</span></span></div>
            <div class="hb-track"><div class="hb-fill" :style="{ width: x.w + '%' }"></div></div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Tendance 12 mois -->
    <section class="card">
      <div class="conso-head">
        <h2 class="card-title">Consommation mensuelle — 12 derniers mois</h2>
        <div class="leg-inline"><span><i class="sw sortie"></i>Sorties (conso.)</span><span><i class="sw entree"></i>Entrées</span></div>
      </div>
      <div class="trend">
        <div v-for="(m, i) in trend12.arr" :key="i" class="tcol" :title="m.label + ' ' + m.an + ' — Conso : ' + fmtDA(m.val) + ' · Entrées : ' + fmtDA(m.ent)">
          <span class="tval">{{ m.val ? fmtCompact(m.val) : '' }}</span>
          <div class="tbars">
            <div class="tbar sortie" :style="{ height: Math.max(m.val ? 2 : 0, Math.round(m.val / trend12.max * 100)) + '%' }"></div>
            <div class="tbar entree" :style="{ height: Math.max(m.ent ? 2 : 0, Math.round(m.ent / trend12.max * 100)) + '%' }"></div>
          </div>
          <span class="tlbl">{{ m.label }}</span>
        </div>
      </div>
    </section>

    <!-- Top consommateurs + Stock dormant -->
    <div class="grid2">
      <section class="card">
        <h2 class="card-title">Top consommables (12 mois)</h2>
        <p v-if="!conso12.top.length" class="vide-p">Aucune consommation enregistrée.</p>
        <ul v-else class="hbars">
          <li v-for="(x, i) in conso12.top.slice(0, 8)" :key="x.id">
            <div class="hb-top"><span class="hb-lbl"><b class="rk">{{ i + 1 }}</b>{{ x.nom }}</span><span class="hb-val">{{ fmtDA(x.val) }}</span></div>
            <div class="hb-track"><div class="hb-fill amber" :style="{ width: (x.val / topMax * 100) + '%' }"></div></div>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2 class="card-title">Stock dormant <span class="sub-count" v-if="dormants.length">— {{ fmtDA(dormantVal) }} immobilisés</span></h2>
        <p class="vide-p" v-if="!dormants.length">Aucun article dormant — tout le stock tourne. 👍</p>
        <div v-else class="tbl-scroll mini-scroll">
          <table class="tbl">
            <thead><tr><th>Consommable</th><th class="r">Stock</th><th class="r">Valeur</th></tr></thead>
            <tbody>
              <tr v-for="(d, i) in dormants.slice(0, 10)" :key="i">
                <td class="nom">{{ d.nom }}</td>
                <td class="r">{{ fmt(d.stock) }} <span class="u">{{ d.unite }}</span></td>
                <td class="r val">{{ fmtDA(d.val) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="hint">Articles avec du stock mais aucune sortie sur 12 mois — capital immobilisé à revoir.</p>
      </section>
    </div>

    <div class="grid2">
    <!-- Consommation du mois -->
    <section class="card">
      <div class="conso-head">
        <h2 class="card-title">Consommation — {{ moisLabel(moisSel) }}</h2>
        <select v-model="moisSel" class="mois-sel">
          <option v-for="ym in moisDispo" :key="ym" :value="ym">{{ moisLabel(ym) }}</option>
        </select>
      </div>

      <div class="kpi-row conso-kpi">
        <div class="kpi"><div class="kpi-v">{{ fmtDA(consoAujVal) }}</div><div class="kpi-l">Consommation aujourd'hui ({{ consoAujNb }} sortie{{ consoAujNb > 1 ? 's' : '' }})</div></div>
        <div class="kpi"><div class="kpi-v">{{ fmtDA(consoMoisVal) }}</div><div class="kpi-l">Consommation du mois</div></div>
        <div class="kpi"><div class="kpi-v">{{ fmtDA(consoMoyJour) }}</div><div class="kpi-l">Moyenne par jour ({{ joursRefMois }} j)</div></div>
      </div>

      <h3 class="conso-sub">Consommation journalière</h3>
      <p v-if="!consoJour.tot" class="vide-p">Aucune sortie enregistrée sur ce mois.</p>
      <div v-else class="daybars">
        <div v-for="d in consoJour.jours" :key="d.jour" class="daybar" :class="{ auj: d.auj }"
             :title="d.jour + ' ' + moisLabel(moisSel) + ' : ' + fmtDA(d.val)">
          <span class="db-val">{{ d.val ? fmtCompact(d.val) : '' }}</span>
          <div class="db-bars"><div class="db-fill" :style="{ height: (consoJour.max > 0 ? Math.max(2, Math.round(d.val / consoJour.max * 100)) : 0) + '%' }"></div></div>
          <span class="db-lbl">{{ d.jour }}</span>
        </div>
      </div>

      <h3 class="conso-sub">Consommation par consommable</h3>
      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Consommable</th><th class="r">Qté du mois</th><th class="r">Moyenne/jour</th><th class="r">Jours actifs</th><th class="r">Valeur</th></tr></thead>
          <tbody>
            <tr v-for="a in consoParArticle" :key="a.id">
              <td class="nom">{{ a.nom }}</td>
              <td class="r"><strong>{{ fmt(a.qte) }}</strong> <span class="u">{{ a.unite }}</span></td>
              <td class="r">{{ fmt(Math.round(a.moyJour * 10) / 10) }} <span class="u">{{ a.unite }}</span></td>
              <td class="r">{{ a.nbJours }}</td>
              <td class="r val">{{ a.valeur ? fmtDA(a.valeur) : '—' }}</td>
            </tr>
            <tr v-if="!consoParArticle.length"><td colspan="5" class="vide">Aucune consommation sur ce mois.</td></tr>
          </tbody>
          <tfoot v-if="consoParArticle.length">
            <tr class="tot"><td>Total valeur</td><td class="r"></td><td class="r"></td><td class="r"></td><td class="r val">{{ fmtDA(consoMoisVal) }}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>

    <!-- Évolution annuelle -->
    <section class="card">
      <div class="conso-head">
        <h2 class="card-title">Évolution de la consommation — {{ anneeSel }}</h2>
        <div class="evo-ctrl">
          <div class="seg">
            <button :class="{ on: metrique === 'valeur' }" @click="metrique = 'valeur'">Valeur (DA)</button>
            <button :class="{ on: metrique === 'qte' }" @click="metrique = 'qte'">Quantité</button>
          </div>
          <select v-model="artSel" class="mois-sel art-sel">
            <option value="">Tous les articles</option>
            <option v-for="c in consommablesTries" :key="c.id" :value="String(c.id)">{{ c.nom }}</option>
          </select>
          <select v-model="anneeSel" class="mois-sel">
            <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
      </div>

      <p v-if="!evolutionAnnee.length" class="vide-p">Aucune sortie enregistrée sur {{ anneeSel }}.</p>
      <template v-else>
        <div class="monthbars">
          <div v-for="(v, i) in evolutionTotaux.mois" :key="i" class="monthbar" :title="MOIS_COURTS[i] + ' ' + anneeSel + ' : ' + fmtDA(v)">
            <div class="mb-fill" :style="{ height: (evolutionTotaux.max > 0 ? Math.max(2, Math.round(v / evolutionTotaux.max * 100)) : 0) + '%' }"></div>
            <span class="mb-lbl">{{ MOIS_COURTS[i] }}</span>
          </div>
        </div>
        <p class="evo-note">Barres = consommation totale mensuelle (valeur, DA). Tableau = {{ metrique === 'qte' ? 'quantités par article (unité de l\'article)' : 'valeur consommée par article (DA)' }}, mois par mois ; l'intensité de couleur suit le niveau de chaque ligne.</p>

        <div class="tbl-scroll">
          <table class="tbl evo-tbl">
            <thead><tr><th>Consommable</th><th v-for="(m, i) in MOIS_COURTS" :key="i" class="r mo">{{ m }}</th><th class="r">Total {{ metrique === 'qte' ? '' : '(DA)' }}</th></tr></thead>
            <tbody>
              <tr v-for="o in evolutionAnnee" :key="o.id">
                <td class="nom">{{ o.nom }}</td>
                <td v-for="(v, i) in o.serie" :key="i" class="r cell" :style="cellStyle(v, o.max)">{{ v ? fmt(Math.round(v)) : '' }}</td>
                <td class="r val">{{ metrique === 'qte' ? fmt(o.totAff) + ' ' + o.unite : fmtDA(o.totAff) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="tot"><td>Total valeur</td><td v-for="(v, i) in evolutionTotaux.mois" :key="i" class="r">{{ v ? fmt(Math.round(v)) : '' }}</td><td class="r val">{{ fmtDA(evolutionTotaux.total) }}</td></tr>
            </tfoot>
          </table>
        </div>
      </template>
    </section>
    </div>

    <!-- À réapprovisionner -->
    <section class="card">
      <h2 class="card-title">À réapprovisionner <span class="sub-count" v-if="reappro.length">— {{ reappro.length }} article{{ reappro.length > 1 ? 's' : '' }}</span></h2>
      <p class="vide-p" v-if="!reappro.length">Aucun réapprovisionnement urgent. Tous les stocks sont au-dessus du seuil et couvrent plus de 21 jours. 👍</p>
      <div v-else class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Consommable</th><th>Catégorie</th><th class="r">Stock MP</th><th class="r">Stock Fab.</th><th class="r">Total</th><th class="r">Conso/j (90 j)</th><th class="r">Couverture</th><th>Action conseillée</th><th>État</th></tr></thead>
          <tbody>
            <tr v-for="x in reappro" :key="x.c.id">
              <td class="nom">{{ x.c.nom }}</td>
              <td>{{ x.c.categorie || '—' }}</td>
              <td class="r">{{ fmt(sMp(x.c)) }}</td>
              <td class="r">{{ fmt(sFab(x.c)) }}</td>
              <td class="r stock" :class="x.etat">{{ fmt(totalStock(x.c)) }} <span class="u">{{ x.c.unite }}</span></td>
              <td class="r">{{ fmt(Math.round(x.moy * 10) / 10) }}</td>
              <td class="r couv" :class="couvClass(x.couv)">{{ couvLabel(x.couv) }}</td>
              <td class="act-cell">
                <span v-if="x.action.type !== 'none'" class="act-badge" :class="x.action.type">{{ x.action.label }} <b>{{ fmt(x.action.qte) }}</b> {{ x.action.unite }}</span>
                <span v-else class="muted">—</span>
              </td>
              <td><span class="badge" :class="x.etat">{{ etatLabel(x.c) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tdb-conso { color: #1b2733; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 16px; }
.sub-count { font-size: 13px; font-weight: 600; color: #94a3b8; }
.muted { color: #94a3b8; font-weight: 600; }
.vide-p { color: #94a3b8; font-size: 13px; margin: 6px 0 0; }
.hint { margin: 12px 0 0; font-size: 11.5px; color: #94a3b8; }

.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid #b45309; }
.kpi-v { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.15; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.kpi-l { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 4px; }
.kpi-split { display: block; font-size: 10.5px; font-weight: 700; color: #94a3b8; margin-top: 2px; }
.kpi.valeur { border-left-color: #0d9488; } .kpi.valeur .kpi-v { color: #0f766e; }
.kpi.dispo { border-left-color: #16a34a; } .kpi.dispo .kpi-v { color: #15803d; }
.kpi.alerte { border-left-color: #d97706; } .kpi.alerte .kpi-v { color: #b45309; }
.kpi.rupture { border-left-color: #dc2626; } .kpi.rupture .kpi-v { color: #dc2626; }
.kpi.crit { border-left-color: #ea580c; } .kpi.crit .kpi-v { color: #c2410c; }
.kpi.conso { border-left-color: #b45309; }
.kpi.rot { border-left-color: #7c3aed; } .kpi.rot .kpi-v { color: #6d28d9; }
.kpi.dormant { border-left-color: #64748b; } .kpi.dormant .kpi-v { color: #475569; }
.kpi.sec { border-left-color: #dc2626; } .kpi.sec .kpi-v { color: #dc2626; }
.kpi.transf { border-left-color: #6366f1; } .kpi.transf .kpi-v { color: #4f46e5; }
.pill { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
.pill.up { background: #fef3c7; color: #b45309; } .pill.down { background: #dcfce7; color: #15803d; }

.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 860px) { .grid2 { grid-template-columns: 1fr; } }

/* Donut état */
.donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.donut { width: 150px; height: 150px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.donut-hole { width: 92px; height: 92px; background: #fff; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.dh-v { font-size: 26px; font-weight: 800; color: #15803d; line-height: 1; }
.dh-l { font-size: 11px; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.donut-legend { list-style: none; margin: 0; padding: 0; flex: 1 1 180px; }
.donut-legend li { display: flex; align-items: center; gap: 9px; padding: 7px 0; font-size: 13.5px; color: #334155; font-weight: 600; border-bottom: 1px solid #f1f5f9; }
.donut-legend li b { margin-left: auto; font-size: 15px; color: #0f172a; font-variant-numeric: tabular-nums; }
.donut-legend li.tot { border-bottom: 0; color: #64748b; }
.dot { width: 11px; height: 11px; border-radius: 3px; flex-shrink: 0; }
.dot.ok { background: #16a34a; } .dot.al { background: #f59e0b; } .dot.ru { background: #dc2626; } .dot.none { background: #e2e8f0; }
.empl-split { margin-top: 14px; border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.es-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 12.5px; }
.es-t { font-weight: 800; color: #334155; }
.es-v { color: #64748b; font-weight: 600; }
.es-al { color: #b45309; } .es-ru { color: #dc2626; }

/* Barres horizontales (catégories, top) */
.hbars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 13px; }
.hb-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 5px; }
.hb-lbl { font-size: 13px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
.hb-lbl .rk { display: inline-flex; align-items: center; justify-content: center; width: 19px; height: 19px; background: #fef3c7; color: #b45309; border-radius: 5px; font-size: 11px; font-weight: 800; }
.hb-val { font-size: 12.5px; font-weight: 700; color: #0f766e; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hb-track { height: 9px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.hb-fill { height: 100%; background: #0d9488; border-radius: 5px; }
.hb-fill.amber { background: #f59e0b; }

/* Tendance 12 mois (double barre) */
.conso-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.conso-head .card-title { margin: 0; }
.leg-inline { display: flex; gap: 14px; font-size: 12px; color: #64748b; font-weight: 600; }
.leg-inline i.sw { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
.sw.sortie { background: #f59e0b; } .sw.entree { background: #0d9488; }
.trend { display: flex; align-items: flex-end; gap: 10px; height: 170px; padding: 6px 2px 0; }
.tcol { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 5px; }
.tval { min-height: 13px; line-height: 13px; font-size: 9.5px; font-weight: 800; color: #b45309; font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: -.2px; }
.tbars { display: flex; align-items: flex-end; justify-content: center; gap: 3px; width: 100%; flex: 1; min-height: 0; }
.tbar { width: 38%; min-height: 0; border-radius: 3px 3px 0 0; transition: height .2s; }
.tbar.sortie { background: #f59e0b; } .tcol:hover .tbar.sortie { background: #b45309; }
.tbar.entree { background: #0d9488; } .tcol:hover .tbar.entree { background: #0f766e; }
.tlbl { font-size: 10.5px; color: #94a3b8; font-weight: 700; }

/* Tables */
.tbl-scroll { overflow-x: auto; }
.mini-scroll { max-height: 320px; overflow-y: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 800; padding: 8px 12px; border-bottom: 2px solid #eef2f6; white-space: nowrap; position: sticky; top: 0; background: #fff; }
.tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td.nom { font-weight: 700; color: #0f172a; }
.tbl td.val { font-weight: 700; color: #0f766e; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl td .u { font-size: 11px; color: #94a3b8; font-weight: 600; }
.tbl td.seuil { color: #64748b; }
.tbl td.qte b { color: #b45309; }
.tbl tfoot .tot td { border-top: 2px solid #e2e8f0; font-weight: 800; background: #f8fafc; color: #0f172a; }
.tbl tfoot .tot .val { color: #0f766e; }
.vide { text-align: center; color: #94a3b8; padding: 22px; }
/* Consommation mensuelle + évolution (déplacées depuis Consommables) */
.mois-sel { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; font-weight: 700; color: #334155; background: #fff; text-transform: capitalize; cursor: pointer; }
.art-sel { max-width: 220px; text-transform: none; }
.conso-kpi { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 4px; }
.conso-sub { margin: 18px 0 10px; font-size: 12px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: .04em; }
.daybars { display: flex; align-items: flex-end; gap: 3px; height: 130px; padding: 6px 2px 0; overflow-x: auto; border-bottom: 1px solid #f1f5f9; }
.daybar { flex: 1 0 15px; min-width: 15px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
.db-val { min-height: 32px; font-size: 8.5px; font-weight: 800; color: #b45309; font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1; writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: -.2px; }
.db-bars { flex: 1; min-height: 0; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.db-fill { width: 68%; min-height: 2px; background: #f59e0b; border-radius: 3px 3px 0 0; transition: height .2s; }
.daybar:hover .db-fill { background: #b45309; }
.daybar.auj .db-fill { background: #0d9488; }
.db-lbl { font-size: 9.5px; color: #94a3b8; font-weight: 700; }
.evo-ctrl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.seg { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: #fff; color: #475569; font: inherit; font-size: 12.5px; font-weight: 700; padding: 7px 13px; cursor: pointer; }
.seg button + button { border-left: 1px solid #e2e8f0; }
.seg button.on { background: #b45309; color: #fff; }
.monthbars { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 6px 2px 0; }
.monthbar { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
.mb-fill { width: 58%; min-height: 2px; background: #f59e0b; border-radius: 4px 4px 0 0; transition: height .2s; }
.monthbar:hover .mb-fill { background: #b45309; }
.mb-lbl { font-size: 10.5px; color: #94a3b8; font-weight: 700; }
.evo-note { font-size: 12px; color: #94a3b8; margin: 10px 0 14px; }
.evo-tbl th.mo { min-width: 50px; }
.evo-tbl .cell { font-variant-numeric: tabular-nums; font-size: 12px; text-align: right; }
.evo-tbl tfoot .tot td { border-top: 2px solid #e2e8f0; font-weight: 800; background: #f8fafc; color: #0f172a; font-variant-numeric: tabular-nums; }
.stock { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stock.ok { color: #0f172a; } .stock.alerte { color: #b45309; } .stock.rupture { color: #dc2626; }
.couv { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.couv-ok { color: #15803d; } .couv-moy { color: #b45309; } .couv-bas { color: #dc2626; } .couv-none { color: #cbd5e1; }
.badge { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.badge.ok { background: #dcfce7; color: #166534; } .badge.alerte { background: #fef3c7; color: #92400e; } .badge.rupture { background: #fee2e2; color: #b91c1c; }
.act-cell { white-space: nowrap; }
.act-badge { font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.act-badge.transfert { background: #e0e7ff; color: #4338ca; }
.act-badge.commande { background: #fef3c7; color: #92400e; }
.act-badge b { font-weight: 800; }
</style>
