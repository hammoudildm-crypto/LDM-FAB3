<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const anneeSel = ref(anneeCourante)
const planRows = ref([])
const realRows = ref([])
const condRows = ref([])
const ofs = ref([])
const msg = ref('')

async function fetchAllPaged(make) {
  const size = 1000
  let from = 0, all = []
  for (;;) {
    const r = await make().range(from, from + size - 1)
    if (r.error) return { error: r.error, data: all }
    all = all.concat(r.data || [])
    if (!r.data || r.data.length < size) break
    from += size
  }
  return { data: all, error: null }
}

async function charger() {
  msg.value = ''
  const rp = await fetchAllPaged(() => supabase.from('plan_production')
    .select('annee, mois, quantite_planifiee, produits(code_pf, designation, pcsu, taille_lot)'))
  if (rp.error) { msg.value = rp.error.message; return }
  planRows.value = rp.data

  const rr = await fetchAllPaged(() => supabase.from('realisations')
    .select('annee, mois, quantite_realisee, produits(code_pf, designation, pcsu)'))
  if (rr.error) { msg.value = rr.error.message; return }
  realRows.value = rr.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('quantite_conditionnee, date_conditionnement, ordres_fabrication(date_fin_fabrication, produits(code_pf, designation, pcsu, unites_par_boite, taille_lot))')
    .eq('actif', true))
  if (rc.error) { msg.value = rc.error.message; return }
  condRows.value = rc.data

  const ro = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('boites_fabriquees, date_fin_fabrication, produits(code_pf, designation, pcsu, taille_lot)')
    .eq('actif', true))
  if (ro.error) { msg.value = ro.error.message; return }
  ofs.value = ro.data
}
onMounted(charger)

const num = (v) => Number(v || 0)
const condBoites = (c) => {
  const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
  const upb = p ? num(p.unites_par_boite) : 0
  if (!upb || c.quantite_conditionnee == null) return 0
  return Math.floor(num(c.quantite_conditionnee) / upb)
}

// --- Séries mensuelles (boîtes) ---
const planParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value && r.mois >= 1 && r.mois <= 12) a[r.mois - 1] += num(r.quantite_planifiee)
  return a
})
const fabReelParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const d = new Date(o.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()] += num(o.boites_fabriquees)
  }
  return a
})
// Anticipation : fabriqué en N-1, conditionné en N -> crédité à la fabrication de N (au mois de conditionnement)
const condFabAnnee = (c) => {
  const o = c.ordres_fabrication
  return o && o.date_fin_fabrication ? new Date(o.date_fin_fabrication).getFullYear() : null
}
const anticipParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() === anneeSel.value && condFabAnnee(c) === anneeSel.value - 1) a[d.getMonth()] += condBoites(c)
  }
  return a
})
const anticipTotal = computed(() => anticipParMois.value.reduce((s, x) => s + x, 0))
const fabParMois = computed(() => fabReelParMois.value)
const condParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() === anneeSel.value) a[d.getMonth()] += condBoites(c)
  }
  return a
})

// --- Clic sur une barre : détail du mois par produit ---
const SERIES_RP = ['Plan', 'Fabrication', 'Conditionnement']
const modalRP = ref(null)   // { mois, si }
function ouvrirBarre(i, si) { modalRP.value = { mois: i, si: si == null ? 1 : si } }
const detailBarre = computed(() => {
  const m = modalRP.value
  if (!m) return []
  const acc = {}
  const add = (p, q) => {
    if (!p || !(q > 0)) return
    const k = p.code_pf || '—'
    if (!acc[k]) acc[k] = { code: k, desig: p.designation || '', taille: num(p.taille_lot), q: 0 }
    acc[k].q += q
  }
  if (m.si === 0) {
    for (const r of planRows.value) {
      if (Number(r.annee) !== anneeSel.value || Number(r.mois) !== m.mois + 1) continue
      add(r.produits, num(r.quantite_planifiee))
    }
  } else if (m.si === 1) {
    for (const o of ofs.value) {
      if (!o.date_fin_fabrication) continue
      const d = new Date(o.date_fin_fabrication)
      if (d.getFullYear() !== anneeSel.value || d.getMonth() !== m.mois) continue
      add(o.produits, num(o.boites_fabriquees))
    }
  } else {
    for (const c of condRows.value) {
      if (!c.date_conditionnement) continue
      const d = new Date(c.date_conditionnement)
      if (d.getFullYear() !== anneeSel.value || d.getMonth() !== m.mois) continue
      add(c.ordres_fabrication ? c.ordres_fabrication.produits : null, condBoites(c))
    }
  }
  return Object.values(acc).sort((a, b) => b.q - a.q)
})
const totalBarre = computed(() => detailBarre.value.reduce((s, r) => s + r.q, 0))
const totalLotsBarre = computed(() => detailBarre.value.reduce((s, r) => s + (r.taille > 0 ? Math.round(r.q / r.taille) : 0), 0))

const planTotal = computed(() => planParMois.value.reduce((s, x) => s + x, 0))
const fabTotal = computed(() => fabParMois.value.reduce((s, x) => s + x, 0))
const condTotal = computed(() => condParMois.value.reduce((s, x) => s + x, 0))
const moisCourant = new Date().getMonth()
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const objectifMois = computed(() => planParMois.value[moisCourant])
const fabMois = computed(() => fabParMois.value[moisCourant])
const condMois = computed(() => condParMois.value[moisCourant])
const moisTopFab = computed(() => { let idx = -1, mx = -1; fabParMois.value.forEach((v, i) => { if (v > mx) { mx = v; idx = i } }); return mx > 0 ? { nom: MOIS_LONG[idx], val: mx } : null })
const moisTopCond = computed(() => { let idx = -1, mx = -1; condParMois.value.forEach((v, i) => { if (v > mx) { mx = v; idx = i } }); return mx > 0 ? { nom: MOIS_LONG[idx], val: mx } : null })

// --- Valorisation CA (boîtes × PCSU) ---
const planCA = computed(() => {
  let ca = 0
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value) ca += num(r.quantite_planifiee) * num(r.produits && r.produits.pcsu)
  return ca
})
const fabReelCA = computed(() => {
  let ca = 0
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication || new Date(o.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    ca += num(o.boites_fabriquees) * num(o.produits && o.produits.pcsu)
  }
  return ca
})
const anticipCA = computed(() => {
  let ca = 0
  for (const c of condRows.value) {
    if (!c.date_conditionnement || new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    if (condFabAnnee(c) !== anneeSel.value - 1) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    ca += condBoites(c) * num(p && p.pcsu)
  }
  return ca
})
const fabCA = computed(() => fabReelCA.value)
const condCA = computed(() => {
  let ca = 0
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    if (new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    ca += condBoites(c) * num(p && p.pcsu)
  }
  return ca
})

// --- Contrôle : produits SANS PCSU -> leurs boîtes comptent, leur CA vaut 0 ---
const ouvertSansPcsu = ref(false)
const sansPcsu = computed(() => {
  const m = {}
  const entree = (p) => {
    if (!p || num(p.pcsu) > 0) return null
    const k = p.code_pf || '—'
    if (!m[k]) m[k] = { code: k, desig: p.designation || '', fab: 0, cond: 0 }
    return m[k]
  }
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    if (new Date(o.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    const b = num(o.boites_fabriquees); if (b <= 0) continue
    const e = entree(o.produits); if (e) e.fab += b
  }
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    if (new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    const b = condBoites(c); if (b <= 0) continue
    const e = entree(c.ordres_fabrication ? c.ordres_fabrication.produits : null); if (e) e.cond += b
  }
  return Object.values(m).sort((a, b) => (b.fab + b.cond) - (a.fab + a.cond))
})
const boitesSansPcsu = computed(() => sansPcsu.value.reduce((s, r) => s + r.fab + r.cond, 0))

const pctFab = computed(() => planTotal.value > 0 ? (fabTotal.value / planTotal.value) * 100 : null)
const pctCond = computed(() => planTotal.value > 0 ? (condTotal.value / planTotal.value) * 100 : null)
const maxMois = computed(() => {
  let m = 0
  for (let i = 0; i < 12; i++) m = Math.max(m, planParMois.value[i], fabParMois.value[i], condParMois.value[i])
  return m || 1
})

// --- Par produit ---
const parProduit = computed(() => {
  const m = {}
  const ent = (code, nom) => { if (!m[code]) m[code] = { code, nom, plan: 0, fab: 0, cond: 0, ca: 0 }; return m[code] }
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value && r.produits) ent(r.produits.code_pf, r.produits.designation).plan += num(r.quantite_planifiee)
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication || new Date(o.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    if (o.produits) ent(o.produits.code_pf, o.produits.designation).fab += num(o.boites_fabriquees)
  }
  for (const c of condRows.value) {
    if (!c.date_conditionnement || new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    if (!p) continue
    const e = ent(p.code_pf, p.designation)
    const b = condBoites(c)
    e.cond += b; e.ca += b * num(p.pcsu)
  }
  return Object.values(m).sort((a, b) => (b.plan - a.plan) || (b.fab - a.fab))
})

// --- Filtre de recherche (Détail par produit) ---
const rechercheProduit = ref('')
const parProduitFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return parProduit.value
  return parProduit.value.filter(p => (p.code && String(p.code).toLowerCase().includes(q)) || (p.nom && String(p.nom).toLowerCase().includes(q)))
})

const w = (v) => (Math.min(100, (v / maxMois.value) * 100)) + '%'

// --- Graphe en courbes (SVG) ---
const CH = { w: 820, h: 250, pl: 12, pr: 12, pt: 14, pb: 28 }
function chX(i) { return CH.pl + (i / 11) * (CH.w - CH.pl - CH.pr) }
function chY(v) { const m = maxMois.value || 1; return CH.h - CH.pb - (Math.min(v, m) / m) * (CH.h - CH.pt - CH.pb) }
function chPts(arr) { return arr.map((v, i) => chX(i) + ',' + chY(v)).join(' ') }
function chArea(arr) { const base = CH.h - CH.pb; return chX(0) + ',' + base + ' ' + chPts(arr) + ' ' + chX(11) + ',' + base }
const chartType = ref('courbes') // 'courbes' | 'aires' | 'barres'
const fmt = (n) => n == null ? '—' : Number(Math.round(n)).toLocaleString('fr-FR')
const fmtDA = (n) => n == null ? '—' : Number(Math.round(n)).toLocaleString('fr-FR') + ' DA'
const fmtPct = (p) => p == null ? '—' : p.toFixed(1) + ' %'
</script>

<template>
  <div class="rp-page">
    <PageHeader title="Réalisation vs Plan" tone="teal"
      subtitle="Fabrication et conditionnement réalisés (boîtes) comparés au plan, et leur valorisation en CA.">
      <label class="annee-sel">Année
        <select v-model.number="anneeSel">
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>

    <div class="kpi-grid k4">
      <div class="kpi">
        <div class="kpi-tag plan-tag">Plan</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(planTotal) }}</div></div>
        <div class="kpi-lbl">boîtes · {{ fmtDA(planCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag fab-tag">Fabrication réalisée</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.factory"></svg></span><div class="kpi-val">{{ fmt(fabTotal) }}</div></div>
        <div class="kpi-lbl">{{ fmtPct(pctFab) }} du plan · {{ fmtDA(fabCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag cond-tag">Conditionnement réalisé</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(condTotal) }}</div></div>
        <div class="kpi-lbl">{{ fmtPct(pctCond) }} du plan · {{ fmtDA(condCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag antic-tag">Anticipation N-1</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val">{{ fmt(anticipTotal) }}</div></div>
        <div class="kpi-lbl">fab. {{ anneeSel - 1 }} → cond. {{ anneeSel }} · {{ fmtDA(anticipCA) }}</div>
      </div>
    </div>

    <p class="ca-note">
      <strong>Comment le CA est calculé :</strong> boîtes × <strong>PCSU actuel</strong> du produit (Référentiels › Produits).
      C'est la <strong>valorisation</strong> du vrac fabriqué et du conditionnement réalisé — pas un CA encaissé.
      Le PCSU n'est pas historisé : le modifier revalorise aussi les années passées.
    </p>

    <section v-if="sansPcsu.length" class="ca-warn">
      <div class="ca-warn-head" @click="ouvertSansPcsu = !ouvertSansPcsu">
        <h3>⚠ {{ sansPcsu.length }} produit(s) sans PCSU — CA sous-estimé</h3>
        <span class="ca-chev">{{ ouvertSansPcsu ? '▾ masquer' : '▸ afficher le détail' }}</span>
      </div>
      <p class="ca-warn-txt">
        Ces produits totalisent <strong>{{ fmt(boitesSansPcsu) }} boîtes</strong> en {{ anneeSel }}, mais leur PCSU
        n'est pas renseigné : leurs boîtes sont comptées, leur CA vaut <strong>0</strong>. Les montants ci-dessus sont
        donc <strong>incomplets</strong>. À corriger dans Référentiels › Produits.
      </p>
      <div v-show="ouvertSansPcsu" class="ca-scroll">
        <table class="ca-table">
          <thead><tr><th>Code</th><th>Produit</th><th class="ta-r">Boîtes fabriquées</th><th class="ta-r">Boîtes conditionnées</th></tr></thead>
          <tbody>
            <tr v-for="r in sansPcsu" :key="r.code">
              <td class="ca-code">{{ r.code }}</td>
              <td>{{ r.desig }}</td>
              <td class="ta-r">{{ r.fab ? fmt(r.fab) : '—' }}</td>
              <td class="ta-r">{{ r.cond ? fmt(r.cond) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="kpi-grid k5">
      <div class="kpi">
        <div class="kpi-tag plan-tag">Objectif du mois</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(objectifMois) }}</div></div>
        <div class="kpi-lbl">{{ MOIS_LONG[moisCourant] }} {{ anneeSel }} · boîtes</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag fab-tag">Fabrication du mois</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.factory"></svg></span><div class="kpi-val">{{ fmt(fabMois) }}</div></div>
        <div class="kpi-lbl">{{ MOIS_LONG[moisCourant] }} · réalisé</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag cond-tag">Conditionnement du mois</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(condMois) }}</div></div>
        <div class="kpi-lbl">{{ MOIS_LONG[moisCourant] }} · réalisé</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag fab-tag">Meilleur mois — fab.</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.factory"></svg></span><div class="kpi-val">{{ moisTopFab ? moisTopFab.nom : '—' }}</div></div>
        <div class="kpi-lbl"><template v-if="moisTopFab">{{ fmt(moisTopFab.val) }} boîtes</template><template v-else>—</template></div>
      </div>
      <div class="kpi">
        <div class="kpi-tag cond-tag">Meilleur mois — cond.</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ moisTopCond ? moisTopCond.nom : '—' }}</div></div>
        <div class="kpi-lbl"><template v-if="moisTopCond">{{ fmt(moisTopCond.val) }} boîtes</template><template v-else>—</template></div>
      </div>
    </div>

    <section class="card">
      <div class="card-head">
        <h3 class="card-title">Comparaison mensuelle (boîtes)</h3>
        <div class="legend">
          <span><i class="dot plan"></i>Plan</span>
          <span><i class="dot fab"></i>Fabrication</span>
          <span><i class="dot cond"></i>Conditionnement</span>
        </div>
      </div>
      <MiniChart :labels="MOIS" :format="fmt" :max="maxMois" show-values clickable @pick="ouvrirBarre"
        :value-format="v => v == null ? '' : (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(v))"
        :series="[
          { label: 'Plan', color: '#94a3b8', data: planParMois, dash: true },
          { label: 'Fabrication', color: '#0f766e', data: fabParMois },
          { label: 'Conditionnement', color: '#2563eb', data: condParMois }
        ]" />
    </section>

    <section class="card" style="margin-top: 22px">
      <div class="card-head">
        <h3 class="card-title">Détail par produit ({{ parProduitFiltres.length }})</h3>
        <input v-model="rechercheProduit" type="search" class="prod-search" placeholder="Rechercher un produit (code ou désignation)…" />
      </div>
      <div v-if="!parProduit.length" class="empty">Aucune donnée pour {{ anneeSel }}.</div>
      <div v-else-if="!parProduitFiltres.length" class="empty">Aucun produit ne correspond à « {{ rechercheProduit }} ».</div>
      <div v-else class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th class="sticky">Produit</th>
              <th class="ta-r">Plan (bts)</th>
              <th class="ta-r">Fab. réalisée (bts)</th>
              <th class="ta-r">Cond. réalisé (bts)</th>
              <th class="ta-r">% plan (cond.)</th>
              <th class="ta-r">CA cond. réalisé</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in parProduitFiltres" :key="p.code">
              <td class="sticky"><span class="mono">{{ p.code }}</span> <span class="desig">{{ p.nom }}</span></td>
              <td class="ta-r">{{ fmt(p.plan) }}</td>
              <td class="ta-r fab-txt">{{ fmt(p.fab) }}</td>
              <td class="ta-r cond-txt">{{ fmt(p.cond) }}</td>
              <td class="ta-r">{{ p.plan > 0 ? ((p.cond / p.plan) * 100).toFixed(0) + ' %' : '—' }}</td>
              <td class="ta-r strong">{{ fmtDA(p.ca) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
    <div v-if="modalRP" class="modal-overlay" @click="modalRP = null">
      <div class="rp-modal" @click.stop>
        <div class="rp-md-head">
          <h3>{{ MOIS_LONG[modalRP.mois] }} {{ anneeSel }}</h3>
          <button class="rp-md-x" @click="modalRP = null">✕</button>
        </div>
        <div class="rp-tabs">
          <button v-for="(s, i) in SERIES_RP" :key="s" :class="{ on: modalRP.si === i }" @click="modalRP.si = i">{{ s }}</button>
        </div>
        <div class="rp-md-sub">{{ detailBarre.length }} produit(s) · <strong>{{ fmt(totalBarre) }}</strong> boîtes · <strong>{{ fmt(totalLotsBarre) }}</strong> lots</div>
        <div class="rp-md-body">
          <div v-if="!detailBarre.length" class="empty">Aucune donnée pour ce mois.</div>
          <table v-else class="grid rp-detail">
            <thead>
              <tr><th>Code produit</th><th>Désignation</th><th class="rp-num">Quantité (boîtes)</th><th class="rp-num">En lots</th></tr>
            </thead>
            <tbody>
              <tr v-for="r in detailBarre" :key="r.code">
                <td class="rp-code">{{ r.code }}</td>
                <td class="rp-des">{{ r.desig }}</td>
                <td class="rp-num">{{ fmt(r.q) }}</td>
                <td class="rp-num">{{ r.taille > 0 ? fmt(Math.round(r.q / r.taille)) + ' lots' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
</template>

<style scoped>
.rp-page { color: #1b2733; }
.rp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.rp-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
.kpi-grid.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi-grid.k4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid.k5 { grid-template-columns: repeat(5, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-tag { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 3px 8px; border-radius: 999px; margin-bottom: 8px; }
.plan-tag { background: #f1f5f9; color: #475569; }
.fab-tag { background: #ccfbf1; color: #0f766e; }
.cond-tag { background: #dbeafe; color: #1d4ed8; }
.antic-tag { background: #fef3c7; color: #92400e; }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
.note { font-size: 12px; color: #475569; margin: -12px 0 22px; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 8px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.prod-search { font-size: 13px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 240px; max-width: 100%; }
.prod-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.card-title { margin: 0; font-size: 16px; }
.legend { display: flex; gap: 16px; font-size: 12px; color: #475569; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.dot.plan, .bar-fill.plan { background: #94a3b8; }
.dot.fab, .bar-fill.fab { background: #0f766e; }
.dot.cond, .bar-fill.cond { background: #2563eb; }
.ch { display: flex; align-items: flex-end; gap: 3px; height: 180px; padding-top: 8px; }
.ch-group { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; height: 100%; }
.ch-bars { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
.ch-bar { width: 30%; max-width: 11px; border-radius: 3px 3px 1px 1px; min-height: 2px; transition: height .45s cubic-bezier(.4,0,.2,1); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
.ch-bar.plan { background: linear-gradient(180deg, #cbd5e1, #94a3b8); }
.ch-bar.fab { background: linear-gradient(180deg, #2dd4bf, #0f766e); }
.ch-bar.cond { background: linear-gradient(180deg, #60a5fa, #2563eb); }
.ch-bar:hover { filter: brightness(1.08); }
.ch-lbl { font-size: 10px; color: #94a3b8; margin-top: 6px; font-weight: 600; }
.line-ch { width: 100%; margin-top: 4px; }
.ch-switch { display: inline-flex; gap: 2px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
.ch-switch button { background: none; border: 0; font-family: inherit; font-size: 12px; font-weight: 600; color: #64748b; padding: 5px 11px; border-radius: 6px; cursor: pointer; transition: background .15s ease, color .15s ease; }
.ch-switch button.on { background: #fff; color: #0f766e; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
html[data-theme="sombre"] .ch-switch, html[data-theme="minuit"] .ch-switch { background: #0f1830; }
html[data-theme="sombre"] .ch-switch button.on, html[data-theme="minuit"] .ch-switch button.on { background: #243049; color: #2dd4bf; }
.lch-svg { width: 100%; height: auto; display: block; overflow: visible; }
.lch-grid { stroke: #eef2f6; stroke-width: 1; }
.lch-line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.lch-line.plan { stroke: #94a3b8; stroke-dasharray: 5 4; }
.lch-line.fab { stroke: #0f766e; }
.lch-line.cond { stroke: #2563eb; }
.lch-pt { stroke: #fff; stroke-width: 1.5; cursor: pointer; }
.lch-pt.plan { fill: #94a3b8; }
.lch-pt.fab { fill: #0f766e; }
.lch-pt.cond { fill: #2563eb; }
.lch-pt:hover { r: 5; }
.lch-lbl { fill: #94a3b8; font-size: 13px; font-weight: 600; }
html[data-theme="sombre"] .lch-grid, html[data-theme="minuit"] .lch-grid { stroke: #2a3650; }
html[data-theme="sombre"] .lch-pt, html[data-theme="minuit"] .lch-pt { stroke: #161f33; }

.mois-bloc { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
.mois-bloc:last-child { border-bottom: 0; }
.mois-nom { width: 38px; font-weight: 700; font-size: 13px; color: #475569; flex-shrink: 0; }
.series { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.serie { display: flex; align-items: center; gap: 10px; }
.bar-track { flex: 1; height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.serie-val { width: 92px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; color: #1b2733; flex-shrink: 0; }

.table-scroll { overflow-x: auto; }
table.grid { border-collapse: collapse; font-size: 13px; width: 100%; }
table.grid th { text-align: left; padding: 9px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.ta-r { text-align: right; }
.sticky { position: sticky; left: 0; background: #fff; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; }
.fab-txt { color: #0f766e; font-weight: 600; }
.cond-txt { color: #1d4ed8; font-weight: 600; }
.strong { font-weight: 700; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

@media (max-width: 980px) {
  .kpi-grid.k4, .kpi-grid.k5 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .kpi-grid.k3, .kpi-grid.k4, .kpi-grid.k5 { grid-template-columns: 1fr; }
  .serie-val { width: 70px; }
}
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.rp-detail thead th { text-align: left; font-size: 11.5px; color: #64748b; font-weight: 600; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
.rp-detail thead th.rp-num { text-align: right; }
.rp-modal { background: #fff; border-radius: 14px; width: min(580px, 100%); max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.rp-md-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 10px; }
.rp-md-head h3 { margin: 0; font-size: 15.5px; }
.rp-md-x { background: none; border: 0; font-size: 17px; color: #94a3b8; cursor: pointer; }
.rp-tabs { display: flex; gap: 6px; padding: 0 18px 10px; }
.rp-tabs button { background: #f1f5f9; border: 0; font-family: inherit; font-size: 12px; font-weight: 600; color: #64748b; padding: 5px 12px; border-radius: 7px; cursor: pointer; }
.rp-tabs button.on { background: #0f766e; color: #fff; }
.rp-md-sub { padding: 8px 18px; font-size: 12.5px; color: #64748b; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; }
.rp-md-body { overflow-y: auto; padding: 6px 18px 16px; }
.rp-code { font-family: ui-monospace, monospace; font-weight: 700; color: #0f766e; white-space: nowrap; }
.rp-des { color: #475569; }
.rp-num { text-align: right; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ca-note { font-size: 12.5px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 9px 12px; margin: 0 0 14px; line-height: 1.5; }
.ca-warn { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 13px 16px; margin: 0 0 16px; }
.ca-warn-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; gap: 10px; }
.ca-warn-head h3 { margin: 0; font-size: 15px; color: #92400e; }
.ca-chev { font-size: 12px; color: #b45309; font-weight: 600; white-space: nowrap; }
.ca-warn-txt { font-size: 13px; color: #78350f; margin: 8px 0 0; line-height: 1.5; }
.ca-scroll { overflow-x: auto; margin-top: 12px; }
.ca-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ca-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #92400e; padding: 6px 8px; border-bottom: 2px solid #fde68a; white-space: nowrap; }
.ca-table td { padding: 6px 8px; border-bottom: 1px solid #fef3c7; }
.ca-table .ta-r { text-align: right; font-variant-numeric: tabular-nums; }
.ca-code { font-family: ui-monospace, monospace; font-weight: 700; color: #b45309; white-space: nowrap; }
</style>
