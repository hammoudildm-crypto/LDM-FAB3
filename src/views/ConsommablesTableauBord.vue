<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

function ymd(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const consommables = ref([])
const sorties = ref([])   // type=sortie depuis le 1er janv. de l'an dernier
const entrees = ref([])   // type=entree, même fenêtre
const erreur = ref('')

async function charger() {
  erreur.value = ''
  const rc = await supabase.from('consommables').select('*').order('nom')
  if (rc.error) { erreur.value = rc.error.message; return }
  consommables.value = rc.data || []
  const depuis = new Date(new Date().getFullYear() - 1, 0, 1)
  const rm = await supabase.from('mouvements_consommables').select('consommable_id,quantite,date_mvt,type').gte('date_mvt', ymd(depuis))
  if (!rm.error) { const all = rm.data || []; sorties.value = all.filter(m => m.type === 'sortie'); entrees.value = all.filter(m => m.type === 'entree') }
}
onMounted(charger)

// ---- Formats & helpers ----
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDA = (n) => Number(Math.round(n) || 0).toLocaleString('fr-FR') + ' DA'
const fmtDAc = (n) => { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M DA' : v >= 1e3 ? Math.round(v / 1e3).toLocaleString('fr-FR') + ' k DA' : Math.round(v) + ' DA' }
const consoById = computed(() => { const m = {}; for (const c of consommables.value) m[c.id] = c; return m })
const prixDe = (id) => Number(consoById.value[id]?.prix_unitaire) || 0
const valeurDe = (c) => (Number(c.stock_actuel) || 0) * (Number(c.prix_unitaire) || 0)
function etatClass(c) { const s = Number(c.stock_actuel), se = Number(c.seuil_alerte); if (s <= 0) return 'rupture'; if (s <= se) return 'alerte'; return 'ok' }
function etatLabel(c) { const s = Number(c.stock_actuel), se = Number(c.seuil_alerte); if (s <= 0) return 'Rupture'; if (s <= se) return 'À commander'; return 'OK' }
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
function couvertureJours(c) { const a = moyJourDe(c.id); return a > 0 ? (Number(c.stock_actuel) || 0) / a : null }
function couvClass(j) { if (j === null) return 'couv-none'; if (j < 7) return 'couv-bas'; if (j < 21) return 'couv-moy'; return 'couv-ok' }
function couvLabel(j) { return j === null ? '—' : Math.round(j) + ' j' }

// ---- KPI principaux ----
const nbRef = computed(() => consommables.value.length)
const valeurStock = computed(() => consommables.value.reduce((s, c) => s + valeurDe(c), 0))
const nbOk = computed(() => consommables.value.filter(c => { const s = Number(c.stock_actuel), se = Number(c.seuil_alerte); return s > 0 && s > se }).length)
const nbAlerte = computed(() => consommables.value.filter(c => { const s = Number(c.stock_actuel); return s > 0 && s <= Number(c.seuil_alerte) }).length)
const nbRupture = computed(() => consommables.value.filter(c => Number(c.stock_actuel) <= 0).length)
const tauxDispo = computed(() => nbRef.value > 0 ? Math.round(nbOk.value / nbRef.value * 100) : 0)
const nbCouvCrit = computed(() => consommables.value.filter(c => { const j = couvertureJours(c); return j !== null && j < 7 }).length)

// ---- Consommation mensuelle (valeur) ----
function valByMonth(rows) { const m = {}; for (const r of rows) { const k = (r.date_mvt || '').slice(0, 7); if (!k) continue; m[k] = (m[k] || 0) + (Number(r.quantite) || 0) * prixDe(r.consommable_id) } return m }
const sortiesParMois = computed(() => valByMonth(sorties.value))
const entreesParMois = computed(() => valByMonth(entrees.value))
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
  .map(c => ({ nom: c.nom, stock: c.stock_actuel, unite: c.unite, val: valeurDe(c) }))
  .sort((a, b) => b.val - a.val))
const dormantVal = computed(() => dormants.value.reduce((s, x) => s + x.val, 0))

// À réapprovisionner : hors stock OK, ou couverture < 21 j
function qConseillee(c) { const cible = Math.max(moyJourDe(c.id) * 30, Number(c.seuil_alerte) || 0); const q = Math.ceil(cible - (Number(c.stock_actuel) || 0)); return q > 0 ? q : 0 }
const reappro = computed(() => consommables.value
  .map(c => ({ c, couv: couvertureJours(c), moy: moyJourDe(c.id), etat: etatClass(c), qConseil: qConseillee(c) }))
  .filter(x => x.etat !== 'ok' || (x.couv !== null && x.couv < 21))
  .sort((a, b) => (a.couv === null ? 1e9 : a.couv) - (b.couv === null ? 1e9 : b.couv)))

const topMax = computed(() => conso12.value.top.length ? conso12.value.top[0].val || 1 : 1)
</script>

<template>
  <div class="tdb-conso">
    <PageHeader title="Tableau de bord — Consommables" tone="#b45309"
      subtitle="Indicateurs de gestion du magasin consommables : stock, disponibilité, consommation, rotation et réapprovisionnement." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <!-- KPI principaux -->
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-v">{{ fmt(nbRef) }}</div><div class="kpi-l">Références</div></div>
      <div class="kpi valeur"><div class="kpi-v">{{ fmtDA(valeurStock) }}</div><div class="kpi-l">Valeur du stock</div></div>
      <div class="kpi dispo"><div class="kpi-v">{{ tauxDispo }} %</div><div class="kpi-l">Taux de disponibilité</div></div>
      <div class="kpi alerte"><div class="kpi-v">{{ nbAlerte }}</div><div class="kpi-l">À commander (≤ seuil)</div></div>
      <div class="kpi rupture"><div class="kpi-v">{{ nbRupture }}</div><div class="kpi-l">Ruptures (stock 0)</div></div>
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
      <div class="kpi"><div class="kpi-v">{{ fmtDA(entreeMois) }}</div><div class="kpi-l">Entrées — {{ moisLabel(curYM) }}</div></div>
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

    <!-- À réapprovisionner -->
    <section class="card">
      <h2 class="card-title">À réapprovisionner <span class="sub-count" v-if="reappro.length">— {{ reappro.length }} article{{ reappro.length > 1 ? 's' : '' }}</span></h2>
      <p class="vide-p" v-if="!reappro.length">Aucun réapprovisionnement urgent. Tous les stocks sont au-dessus du seuil et couvrent plus de 21 jours. 👍</p>
      <div v-else class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Consommable</th><th>Catégorie</th><th class="r">Stock</th><th class="r">Seuil</th><th class="r">Conso/j (90 j)</th><th class="r">Couverture</th><th class="r">Qté conseillée (30 j)</th><th>État</th></tr></thead>
          <tbody>
            <tr v-for="x in reappro" :key="x.c.id">
              <td class="nom">{{ x.c.nom }}</td>
              <td>{{ x.c.categorie || '—' }}</td>
              <td class="r stock" :class="x.etat">{{ fmt(x.c.stock_actuel) }} <span class="u">{{ x.c.unite }}</span></td>
              <td class="r seuil">{{ fmt(x.c.seuil_alerte) }}</td>
              <td class="r">{{ fmt(Math.round(x.moy * 10) / 10) }}</td>
              <td class="r couv" :class="couvClass(x.couv)">{{ couvLabel(x.couv) }}</td>
              <td class="r qte"><b v-if="x.qConseil">{{ fmt(x.qConseil) }} {{ x.c.unite }}</b><span v-else>—</span></td>
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
.kpi.valeur { border-left-color: #0d9488; } .kpi.valeur .kpi-v { color: #0f766e; }
.kpi.dispo { border-left-color: #16a34a; } .kpi.dispo .kpi-v { color: #15803d; }
.kpi.alerte { border-left-color: #d97706; } .kpi.alerte .kpi-v { color: #b45309; }
.kpi.rupture { border-left-color: #dc2626; } .kpi.rupture .kpi-v { color: #dc2626; }
.kpi.crit { border-left-color: #ea580c; } .kpi.crit .kpi-v { color: #c2410c; }
.kpi.conso { border-left-color: #b45309; }
.kpi.rot { border-left-color: #7c3aed; } .kpi.rot .kpi-v { color: #6d28d9; }
.kpi.dormant { border-left-color: #64748b; } .kpi.dormant .kpi-v { color: #475569; }
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
.tbars { display: flex; align-items: flex-end; justify-content: center; gap: 3px; width: 100%; height: 100%; }
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
.stock { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stock.ok { color: #0f172a; } .stock.alerte { color: #b45309; } .stock.rupture { color: #dc2626; }
.couv { font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap; }
.couv-ok { color: #15803d; } .couv-moy { color: #b45309; } .couv-bas { color: #dc2626; } .couv-none { color: #cbd5e1; }
.badge { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.badge.ok { background: #dcfce7; color: #166534; } .badge.alerte { background: #fef3c7; color: #92400e; } .badge.rupture { background: #fee2e2; color: #b91c1c; }
</style>
