<template>
  <div class="gr-page">
    <PageHeader title="Granulométrie & densité" tone="#a855f7"
      subtitle="Analyse par tamisage (histogramme + courbe cumulative, D10/D50/D90) et densité apparente / tassée (Hausner, Carr)." />

    <section class="card">
      <p v-if="erreur" class="gr-alert">⚠ {{ erreur }}</p>
      <p v-if="message" class="gr-ok">✓ {{ message }}</p>
      <div class="gr-id">
        <label class="gr-grow">Produit (référentiel PQR)
          <input v-model="rechercheProduit" class="gr-lbl" placeholder="🔍 filtrer un produit…" style="margin-bottom:5px" />
          <select v-model="produitSel" class="gr-lbl">
            <option value="">— aucun produit —</option>
            <option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option>
          </select>
        </label>
        <label>N° de lot<input v-model="numeroLot" class="gr-lbl" placeholder="ex. 26820" /></label>
        <label>Date d'analyse<input v-model="dateAnalyse" type="date" class="gr-lbl" /></label>
        <label>Observations<input v-model="lotLabel" class="gr-lbl" placeholder="ex. après lubrification" /></label>
      </div>
      <div class="gr-actions">
        <button class="btn" @click="enregistrer">💾 Enregistrer l'analyse</button>
        <select v-model="histSel" class="gr-lbl gr-hist" @change="chargerAnalyse(histSel)">
          <option value="">📂 Charger une analyse enregistrée…</option>
          <option v-for="h in historique" :key="h.id" :value="String(h.id)">{{ h.numero_lot || 'sans lot' }} · {{ frDate(h.date_analyse) }} · {{ h.libelle || prodNom(h.produit_id) || '—' }}</option>
        </select>
        <button class="btn ghost" @click="reporterPQR">↗ Reporter vers PQR (D50 &amp; densité)</button>
        <button class="btn ghost" @click="exporterPDF">🖨 Export PDF</button>
        <button class="btn ghost" @click="reset">↺ Réinitialiser</button>
      </div>
    </section>

    <!-- ANALYSE GRANULOMÉTRIQUE -->
    <section class="card">
      <h2 class="card-title">Analyse granulométrique (tamisage)</h2>
      <div class="gr-split">
        <div class="gr-tblbox">
          <table class="gr-tbl">
            <thead><tr><th>Tamis (µm)</th><th class="r">Brut (g)</th><th class="r">Net (g)</th><th class="r">Retenu (g)</th><th class="r">Retenu %</th><th class="r">Passant cumulé %</th><th class="r">Refus cumulé %</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in sieves" :key="i">
                <td><input v-model.number="s.taille" type="number" min="0" step="any" class="gr-in" /></td>
                <td class="r"><input v-model.number="s.brut" type="number" min="0" step="any" class="gr-in r" placeholder="0" /></td>
                <td class="r"><input v-model.number="s.net" type="number" min="0" step="any" class="gr-in r" placeholder="0" /></td>
                <td class="r reten">{{ retenuTxt(s) }}</td>
                <td class="r">{{ pct1(pctOf(s)) }}</td>
                <td class="r pass">{{ pct1(passantCumOf(s)) }}</td>
                <td class="r refus">{{ pct1(refusCumOf(s)) }}</td>
                <td class="act"><button @click="sieves.splice(i, 1)" title="Retirer">✕</button></td>
              </tr>
              <tr class="somme"><td>SOMME</td><td class="r">{{ fmt2(totalBrut) }}</td><td class="r">{{ fmt2(totalNet) }}</td><td class="r">{{ fmt2(total) }}</td><td class="r">{{ total > 0 ? '100,0' : '0' }}%</td><td></td><td></td><td></td></tr>
            </tbody>
          </table>
          <button class="btn ghost sm" @click="sieves.push({ taille: null, brut: null, net: null })">＋ Ajouter un tamis</button>
          <div class="gr-d">
            <div class="gr-dk"><span>D10</span><b>{{ dTxt(d10) }}</b></div>
            <div class="gr-dk"><span>D50 (médian)</span><b>{{ dTxt(d50) }}</b></div>
            <div class="gr-dk"><span>D90</span><b>{{ dTxt(d90) }}</b></div>
            <div class="gr-dk"><span>Span (D90−D10)/D50</span><b>{{ span != null ? span.toFixed(2) : '—' }}</b></div>
          </div>
        </div>

        <div class="gr-chartbox">
          <div class="gr-chart-t">Histogramme & courbes cumulatives (passant / refus)</div>
          <svg v-if="chart.bars.length" :viewBox="'0 0 ' + CW + ' ' + CH" class="gr-svg" preserveAspectRatio="xMidYMid meet">
            <line v-for="g in [0,25,50,75,100]" :key="'g'+g" :x1="ML" :x2="CW-MR" :y1="yPct(g)" :y2="yPct(g)" class="gr-grid" />
            <text v-for="g in [0,25,50,75,100]" :key="'gl'+g" :x="CW-MR+4" :y="yPct(g)+3" class="gr-axr">{{ g }}</text>
            <text v-for="g in [0,25,50,75,100]" :key="'ll'+g" :x="ML-6" :y="yPct(g)+3" class="gr-axl">{{ Math.round(g/100*chart.maxPct) }}</text>
            <rect v-for="(b, i) in chart.bars" :key="'b'+i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="gr-bar" />
            <polyline :points="chart.poly" class="gr-line" />
            <circle v-for="(p, i) in chart.pts" :key="'p'+i" :cx="p.x" :cy="p.y" r="3" class="gr-dot" />
            <polyline :points="chart.polyRefus" class="gr-line2" />
            <circle v-for="(p, i) in chart.ptsRefus" :key="'pr'+i" :cx="p.x" :cy="p.y" r="3" class="gr-dot2" />
            <text v-for="(b, i) in chart.bars" :key="'x'+i" :x="b.x + b.w/2" :y="CH-MB+14" class="gr-xlab">{{ b.label }}</text>
            <text :x="ML-6" :y="MT-6" class="gr-cap gr-capl">% retenu</text>
            <text :x="CW-MR+4" :y="MT-6" class="gr-cap gr-capr">% cumulé</text>
            <text :x="(ML+CW-MR)/2" :y="CH-4" class="gr-cap" text-anchor="middle">Taille des particules (µm)</text>
          </svg>
          <p v-else class="gr-empty">Saisis les masses retenues par tamis pour tracer l'histogramme et la courbe cumulative.</p>
          <div class="gr-leg"><span class="lg lg-bar"></span> % retenu <span class="lg lg-line"></span> passant cumulé <span class="lg lg-line2"></span> refus cumulé (retenu cumulé)</div>
        </div>
      </div>
    </section>

    <!-- DENSITÉ & COMPRESSIBILITÉ -->
    <section class="card">
      <h2 class="card-title">Densité apparente / tassée — compressibilité</h2>
      <div class="gr-split">
        <div class="gr-dens">
          <label class="gr-f"><span>Masse de l'échantillon (g)</span><input v-model.number="masse" type="number" min="0" step="any" /></label>
          <div class="gr-taps">
            <div class="gr-taps-h">Volumes (mL) — tassement</div>
            <div v-for="(t, i) in taps" :key="i" class="gr-tap">
              <input v-model="t.label" class="gr-tap-l" />
              <input v-model.number="t.v" type="number" min="0" step="any" class="gr-tap-v" placeholder="mL" />
              <button v-if="taps.length > 2" class="gr-tap-x" @click="taps.splice(i, 1)" title="Retirer">✕</button>
            </div>
            <button class="btn ghost sm" @click="taps.push({ label: 'V' + (taps.length), v: null })">＋ Ajouter un palier</button>
            <p class="gr-hint">V0 = volume apparent (vrac). Le <b>dernier volume renseigné</b> sert de volume tassé final.</p>
          </div>
        </div>
        <div class="gr-dens-res">
          <div class="gr-rk"><span>Densité apparente (vrac)</span><b>{{ densApp != null ? densApp.toFixed(3) : '—' }}</b><em>g/mL</em></div>
          <div class="gr-rk"><span>Densité tassée</span><b>{{ densTass != null ? densTass.toFixed(3) : '—' }}</b><em>g/mL</em></div>
          <div class="gr-rk"><span>Indice de Hausner</span><b>{{ hausner != null ? hausner.toFixed(3) : '—' }}</b><em>V0 / V tassé</em></div>
          <div class="gr-rk"><span>Indice de compressibilité (Carr)</span><b>{{ carr != null ? carr.toFixed(1) + ' %' : '—' }}</b></div>
          <div class="gr-flow" :style="{ borderColor: flow.c, color: flow.c }"><span>Écoulement</span><strong>{{ flow.t }}</strong></div>
        </div>
      </div>
    </section>

    <!-- COMPARAISON ENTRE LOTS -->
    <section class="card">
      <h2 class="card-title">Comparaison entre lots</h2>
      <p class="gr-cmp-help">Coche au moins deux analyses enregistrées pour superposer leurs courbes de passant cumulé et comparer les indices.</p>
      <div class="gr-cmp-pick">
        <label v-for="h in historique" :key="h.id" class="gr-cmp-item" :class="{ on: comparo.includes(String(h.id)) }">
          <input type="checkbox" :value="String(h.id)" v-model="comparo" @change="majComparaison" />
          <span>{{ h.numero_lot || 'sans lot' }} · {{ frDate(h.date_analyse) }} · {{ h.libelle || prodNom(h.produit_id) || '—' }}</span>
        </label>
        <p v-if="!historique.length" class="gr-empty" style="padding:14px 4px">Aucune analyse enregistrée pour l'instant — enregistre des analyses pour pouvoir les comparer.</p>
      </div>

      <template v-if="comparData.lots.length">
        <div class="gr-chartbox">
          <div class="gr-chart-t">Courbes de passant cumulé superposées</div>
          <svg :viewBox="'0 0 ' + CW + ' ' + CH" class="gr-svg" preserveAspectRatio="xMidYMid meet">
            <line v-for="g in [0,25,50,75,100]" :key="'cg'+g" :x1="ML" :x2="CW-MR" :y1="yPct(g)" :y2="yPct(g)" class="gr-grid" />
            <text v-for="g in [0,25,50,75,100]" :key="'cgl'+g" :x="ML-6" :y="yPct(g)+3" class="gr-axl">{{ g }}</text>
            <template v-for="(s, si) in comparData.lots" :key="'cs'+si">
              <polyline :points="s.poly" :style="{ stroke: s.color }" class="gr-cmp-line" />
              <circle v-for="(p, pi) in s.pts" :key="'cp'+si+'-'+pi" :cx="p.x" :cy="p.y" r="2.6" :style="{ fill: s.color }" />
            </template>
            <text v-for="(t, ti) in comparData.xticks" :key="'cxt'+ti" :x="t.x" :y="CH-MB+14" class="gr-xlab">{{ t.v }}</text>
            <text :x="ML-6" :y="MT-6" class="gr-cap gr-capl">% passant</text>
            <text :x="(ML+CW-MR)/2" :y="CH-4" class="gr-cap" text-anchor="middle">Taille des particules (µm)</text>
          </svg>
          <div class="gr-cmp-leg">
            <span v-for="(s, si) in comparData.lots" :key="'clg'+si" class="gr-cmp-lg"><i :style="{ background: s.color }"></i>{{ s.label }}</span>
          </div>
        </div>

        <div class="gr-tblbox gr-cmp-tblbox">
          <table class="gr-tbl gr-cmp-tbl">
            <thead><tr><th>Lot</th><th class="r">D10</th><th class="r">D50</th><th class="r">D90</th><th class="r">Span</th><th class="r">D. app.</th><th class="r">D. tassée</th><th class="r">Hausner</th><th class="r">Carr</th><th>Écoulement</th></tr></thead>
            <tbody>
              <tr v-for="(L, i) in comparTable" :key="'ct'+i">
                <td><span class="gr-cmp-dot" :style="{ background: L.color }"></span>{{ L.label }}</td>
                <td class="r">{{ dTxt(L.d10) }}</td>
                <td class="r">{{ dTxt(L.d50) }}</td>
                <td class="r">{{ dTxt(L.d90) }}</td>
                <td class="r">{{ L.span != null ? L.span.toFixed(2) : '—' }}</td>
                <td class="r">{{ L.densApp != null ? L.densApp.toFixed(3) : '—' }}</td>
                <td class="r">{{ L.densTass != null ? L.densTass.toFixed(3) : '—' }}</td>
                <td class="r">{{ L.hausner != null ? L.hausner.toFixed(3) : '—' }}</td>
                <td class="r">{{ L.carr != null ? L.carr.toFixed(1) + ' %' : '—' }}</td>
                <td :style="{ color: L.flow.c, fontWeight: 700 }">{{ L.flow.t }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import { supabase } from '../supabase'

const CW = 720, CH = 300, ML = 46, MR = 46, MT = 20, MB = 40
const plotW = CW - ML - MR, plotH = CH - MT - MB

const lotLabel = ref('')
const sieves = reactive([
  { taille: 0, brut: null, net: null }, { taille: 40, brut: null, net: null }, { taille: 63, brut: null, net: null },
  { taille: 90, brut: null, net: null }, { taille: 125, brut: null, net: null }, { taille: 160, brut: null, net: null },
  { taille: 250, brut: null, net: null }, { taille: 315, brut: null, net: null }, { taille: 500, brut: null, net: null }, { taille: 710, brut: null, net: null }
])
const masse = ref(null)
const taps = reactive([{ label: 'V0', v: null }, { label: 'V10', v: null }, { label: 'V500', v: null }, { label: 'V1250', v: null }, { label: 'V2500', v: null }])

function reset() {
  lotLabel.value = ''; masse.value = null
  numeroLot.value = ''; produitSel.value = ''; rechercheProduit.value = ''; histSel.value = ''
  erreur.value = ''; message.value = ''
  for (const s of sieves) { s.brut = null; s.net = null }
  for (const t of taps) t.v = null
}

// ---- Granulométrie ----
const retenuG = (r) => (Number(r.brut) || 0) - (Number(r.net) || 0)
const total = computed(() => sieves.reduce((s, r) => s + retenuG(r), 0))
const totalBrut = computed(() => sieves.reduce((s, r) => s + (Number(r.brut) || 0), 0))
const totalNet = computed(() => sieves.reduce((s, r) => s + (Number(r.net) || 0), 0))
function retenuTxt(r) { const hb = !(r.brut === '' || r.brut == null), hn = !(r.net === '' || r.net == null); return (hb || hn) ? fmt2(retenuG(r)) : '—' }
function pctOf(r) { const t = total.value; return t > 0 ? retenuG(r) / t * 100 : 0 }
function refusCumOf(r) { const t = total.value; if (!(t > 0)) return 0; let s = 0; const d = Number(r.taille) || 0; for (const x of sieves) if ((Number(x.taille) || 0) >= d) s += retenuG(x); return s / t * 100 }
function passantCumOf(r) { return 100 - refusCumOf(r) }
const pct1 = (v) => (total.value > 0 ? v.toFixed(1).replace('.', ',') + '%' : '—')
const fmt2 = (v) => (Number(v) || 0).toFixed(2).replace('.', ',')

const sortedRows = computed(() => sieves.map(s => ({ taille: Number(s.taille) || 0, pass: passantCumOf(s), pct: pctOf(s) })).sort((a, b) => a.taille - b.taille))
function dValue(p) {
  if (!(total.value > 0)) return null
  const pts = sortedRows.value
  if (!pts.length) return null
  if (p <= pts[0].pass) return pts[0].taille
  for (let i = 1; i < pts.length; i++) { if (pts[i].pass >= p) { const a = pts[i - 1], b = pts[i]; if (b.pass === a.pass) return b.taille; return a.taille + (b.taille - a.taille) * (p - a.pass) / (b.pass - a.pass) } }
  return pts[pts.length - 1].taille
}
const d10 = computed(() => dValue(10)), d50 = computed(() => dValue(50)), d90 = computed(() => dValue(90))
const span = computed(() => (d10.value != null && d50.value && d90.value && d50.value > 0) ? (d90.value - d10.value) / d50.value : null)
const dTxt = (v) => v == null ? '—' : (Math.round(v) + ' µm')

const yPct = (p) => MT + plotH - (p / 100) * plotH
const chart = computed(() => {
  const rows = sortedRows.value; const n = rows.length
  if (!n || !(total.value > 0)) return { bars: [], pts: [], poly: '', ptsRefus: [], polyRefus: '', maxPct: 1 }
  const maxPct = Math.max(1, ...rows.map(r => r.pct))
  const bw = plotW / n
  const bars = rows.map((r, i) => { const h = (r.pct / maxPct) * plotH; return { x: ML + i * bw + bw * 0.2, w: bw * 0.6, y: MT + plotH - h, h, label: r.taille, pct: r.pct } })
  const pts = rows.map((r, i) => ({ x: ML + i * bw + bw * 0.5, y: MT + plotH - (r.pass / 100) * plotH, p: r.pass }))
  const poly = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')
  const ptsRefus = rows.map((r, i) => ({ x: ML + i * bw + bw * 0.5, y: MT + plotH - ((100 - r.pass) / 100) * plotH, p: 100 - r.pass }))
  const polyRefus = ptsRefus.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')
  return { bars, pts, poly, ptsRefus, polyRefus, maxPct }
})

// ---- Densité & compressibilité ----
const v0 = computed(() => Number(taps[0] && taps[0].v) || 0)
const vTasse = computed(() => { for (let i = taps.length - 1; i >= 0; i--) { const v = Number(taps[i].v); if (v > 0) return v } return 0 })
const densApp = computed(() => (masse.value > 0 && v0.value > 0) ? masse.value / v0.value : null)
const densTass = computed(() => (masse.value > 0 && vTasse.value > 0) ? masse.value / vTasse.value : null)
const hausner = computed(() => (densApp.value && densTass.value) ? densTass.value / densApp.value : null)
const carr = computed(() => (densApp.value && densTass.value) ? (densTass.value - densApp.value) / densTass.value * 100 : null)
const flow = computed(() => {
  const c = carr.value
  if (c == null) return { t: '—', c: '#94a3b8' }
  if (c <= 10) return { t: 'Excellent', c: '#16a34a' }
  if (c <= 15) return { t: 'Bon', c: '#16a34a' }
  if (c <= 20) return { t: 'Assez bon', c: '#65a30d' }
  if (c <= 25) return { t: 'Passable', c: '#ca8a04' }
  if (c <= 31) return { t: 'Médiocre', c: '#ea580c' }
  if (c <= 37) return { t: 'Très médiocre', c: '#dc2626' }
  return { t: 'Très mauvais', c: '#b91c1c' }
})

// ======================================================================
//  Enregistrement par lot · historique · report PQR · export PDF
// ======================================================================
const erreur = ref(''), message = ref('')
const produits = ref([]), produitSel = ref(''), rechercheProduit = ref('')
const numeroLot = ref(''), dateAnalyse = ref(new Date().toISOString().slice(0, 10))
const historique = ref([]), histSel = ref('')

const tableAbsente = (m) => /relation|does not exist|schema cache|could not find the table|pgrst205/i.test(m || '')
const normP = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const produitsFiltres = computed(() => {
  const q = normP(rechercheProduit.value).trim()
  if (!q) return produits.value
  return produits.value.filter(p => normP((p.code_pf || '') + ' ' + (p.designation || '')).includes(q))
})
function prodNom(id) { const p = produits.value.find(x => x.id === id); return p ? p.code_pf : '' }
function frDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }

onMounted(async () => {
  const rp = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  await chargerHistorique()
})

async function chargerHistorique() {
  const r = await supabase.from('granulo_analyses')
    .select('id, produit_id, numero_lot, libelle, date_analyse')
    .eq('actif', true).order('id', { ascending: false }).limit(100)
  if (!r.error) historique.value = r.data || []
}

async function enregistrer() {
  erreur.value = ''; message.value = ''
  const payload = {
    produit_id: produitSel.value ? Number(produitSel.value) : null,
    numero_lot: (numeroLot.value || '').trim() || null,
    libelle: lotLabel.value || null,
    date_analyse: dateAnalyse.value || null,
    masse: (masse.value === '' || masse.value == null) ? null : Number(masse.value),
    tamis: sieves.map(s => ({ taille: Number(s.taille) || 0, brut: (s.brut === '' || s.brut == null) ? null : Number(s.brut), net: (s.net === '' || s.net == null) ? null : Number(s.net) })),
    taps: taps.map(t => ({ label: t.label, v: (t.v === '' || t.v == null) ? null : Number(t.v) })),
    d10: d10.value, d50: d50.value, d90: d90.value,
    dens_app: densApp.value, dens_tass: densTass.value, hausner: hausner.value, carr: carr.value
  }
  const r = await supabase.from('granulo_analyses').insert(payload).select('id').single()
  if (r.error) { erreur.value = tableAbsente(r.error.message) ? 'Table absente — exécute la migration 008_granulometrie.sql dans Supabase.' : r.error.message; return }
  message.value = 'Analyse enregistrée' + (numeroLot.value ? ' (lot ' + numeroLot.value + ')' : '') + '.'
  histSel.value = ''
  await chargerHistorique()
}

async function chargerAnalyse(id) {
  if (!id) return
  erreur.value = ''; message.value = ''
  const r = await supabase.from('granulo_analyses').select('*').eq('id', Number(id)).single()
  if (r.error) { erreur.value = r.error.message; return }
  const a = r.data
  produitSel.value = a.produit_id ? String(a.produit_id) : ''
  numeroLot.value = a.numero_lot || ''
  lotLabel.value = a.libelle || ''
  dateAnalyse.value = a.date_analyse || ''
  masse.value = (a.masse == null) ? null : Number(a.masse)
  if (Array.isArray(a.tamis) && a.tamis.length) sieves.splice(0, sieves.length, ...a.tamis.map(s => {
    const hasBN = (s.brut != null) || (s.net != null)
    return hasBN
      ? { taille: s.taille, brut: (s.brut != null ? s.brut : null), net: (s.net != null ? s.net : null) }
      : { taille: s.taille, brut: (s.retenu != null ? s.retenu : null), net: null }
  }))
  if (Array.isArray(a.taps) && a.taps.length) taps.splice(0, taps.length, ...a.taps.map(t => ({ label: t.label, v: t.v })))
  message.value = 'Analyse du lot ' + (a.numero_lot || '—') + ' chargée.'
}

async function reporterPQR() {
  erreur.value = ''; message.value = ''
  const lot = (numeroLot.value || '').trim()
  if (!lot) { erreur.value = 'Renseigne le N° de lot pour reporter la mesure vers PQR.'; return }
  if (d50.value == null && densTass.value == null) { erreur.value = 'Aucune valeur à reporter : saisis les refus par tamis et/ou la densité.'; return }
  const rp = await supabase.from('pqr_parametres').select('id, nom, phase').eq('actif', true)
  if (rp.error) { erreur.value = tableAbsente(rp.error.message) ? 'Référentiel PQR indisponible (migrations PQR non exécutées).' : rp.error.message; return }
  const pGran = (rp.data || []).find(p => normP(p.nom).includes('granulometr'))
  const pDens = (rp.data || []).find(p => normP(p.nom).startsWith('densite'))
  if (!pGran && !pDens) { erreur.value = 'Paramètres « Granulométrie » / « Densité » absents du référentiel PQR — ajoute-les dans Paramètres critiques.'; return }
  const ro = await supabase.from('ordres_fabrication').select('id, produit_id, numero_lot').eq('numero_lot', lot).limit(1)
  if (ro.error) { erreur.value = ro.error.message; return }
  const of = (ro.data || [])[0]
  if (!of) { erreur.value = 'Aucun OF trouvé pour le lot ' + lot + ' — la mesure PQR doit être rattachée à un ordre de fabrication.'; return }
  const dmes = dateAnalyse.value || new Date().toISOString().slice(0, 10)
  const mk = (p, val) => ({ of_id: of.id, numero_lot: lot, produit_id: of.produit_id, phase: p.phase, parametre_id: p.id, api: '', valeurs: [val], valeur: val, date_mesure: dmes })
  const up = []
  if (pGran && d50.value != null) up.push(mk(pGran, Math.round(d50.value)))
  if (pDens && densTass.value != null) up.push(mk(pDens, Number(densTass.value.toFixed(3))))
  if (!up.length) { erreur.value = 'Rien à reporter : le paramètre correspondant est absent ou la valeur n\'est pas calculée.'; return }
  let r = await supabase.from('pqr_mesures').upsert(up, { onConflict: 'of_id,parametre_id,api' })
  if (r.error && /api/i.test(r.error.message || '')) r = await supabase.from('pqr_mesures').upsert(up.map(({ api, ...x }) => x), { onConflict: 'of_id,parametre_id' })
  if (r.error) { erreur.value = r.error.message; return }
  const quoi = []
  if (pGran && d50.value != null) quoi.push('Granulométrie = ' + Math.round(d50.value) + ' µm (D50)')
  if (pDens && densTass.value != null) quoi.push('Densité = ' + densTass.value.toFixed(3) + ' g/mL (tassée)')
  message.value = 'Reporté vers PQR / Saisie des mesures — lot ' + lot + ' : ' + quoi.join(' · ') + '.'
}

function svgString() {
  const c = chart.value
  if (!c.bars.length) return '<p style="color:#94a3b8;font-size:12px">Pas de données granulométriques.</p>'
  let s = '<svg viewBox="0 0 ' + CW + ' ' + CH + '" width="100%" xmlns="http://www.w3.org/2000/svg">'
  for (const g of [0, 25, 50, 75, 100]) {
    const y = yPct(g)
    s += '<line x1="' + ML + '" x2="' + (CW - MR) + '" y1="' + y + '" y2="' + y + '" stroke="#eef2f6"/>'
    s += '<text x="' + (CW - MR + 4) + '" y="' + (y + 3) + '" font-size="9" fill="#94a3b8">' + g + '</text>'
    s += '<text x="' + (ML - 6) + '" y="' + (y + 3) + '" font-size="9" fill="#94a3b8" text-anchor="end">' + Math.round(g / 100 * c.maxPct) + '</text>'
  }
  for (const b of c.bars) s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="#f59e0b"/>'
  s += '<polyline points="' + c.poly + '" fill="none" stroke="#0891b2" stroke-width="2"/>'
  for (const p of c.pts) s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="#0891b2"/>'
  s += '<polyline points="' + c.polyRefus + '" fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="5 3"/>'
  for (const p of c.ptsRefus) s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="3" fill="#c2410c"/>'
  for (const b of c.bars) s += '<text x="' + (b.x + b.w / 2) + '" y="' + (CH - MB + 14) + '" font-size="8.5" fill="#64748b" text-anchor="middle">' + b.label + '</text>'
  return s + '</svg>'
}

function exporterPDF() {
  erreur.value = ''
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  const titreProd = pr ? pr.code_pf + ' — ' + pr.designation : (lotLabel.value || '')
  const tamisRows = sieves.map(s => '<tr><td>' + esc(s.taille) + '</td><td class="r">' + ((s.brut == null || s.brut === '') ? '—' : esc(s.brut)) + '</td><td class="r">' + ((s.net == null || s.net === '') ? '—' : esc(s.net)) + '</td><td class="r">' + retenuTxt(s) + '</td><td class="r">' + pct1(pctOf(s)) + '</td><td class="r">' + pct1(passantCumOf(s)) + '</td><td class="r">' + pct1(refusCumOf(s)) + '</td></tr>').join('')
  const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Granulométrie ' + esc(numeroLot.value || '') + '</title>' +
    '<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:24px;font-size:12px}' +
    'h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;color:#7c3aed;border-bottom:2px solid #eee;padding-bottom:4px;margin:18px 0 8px}' +
    '.sub{color:#64748b;margin:0 0 12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px;margin-bottom:8px;font-size:12px}.meta b{color:#475569}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:6px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #eef2f6}' +
    'th{background:#faf5ff;color:#6b21a8;font-size:10px;text-transform:uppercase}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}' +
    '.kv{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 20px;margin-top:4px}.kv div{border-bottom:1px solid #f1f5f9;padding:4px 0}.kv b{color:#0f172a}' +
    '.foot{margin-top:22px;color:#94a3b8;font-size:10px;border-top:1px solid #eee;padding-top:6px}@media print{body{margin:12mm}}</style></head><body>' +
    '<h1>Analyse granulométrique &amp; densité</h1>' +
    '<p class="sub">' + esc(titreProd) + (numeroLot.value ? ' · Lot ' + esc(numeroLot.value) : '') + (pr && lotLabel.value ? ' · ' + esc(lotLabel.value) : '') + '</p>' +
    '<div class="meta"><div><b>Date d\'analyse :</b> ' + esc(frDate(dateAnalyse.value)) + '</div><div><b>Masse échantillon :</b> ' + (masse.value != null ? esc(masse.value) + ' g' : '—') + '</div></div>' +
    '<h2>Tamisage</h2>' +
    '<table><thead><tr><th>Tamis (µm)</th><th class="r">Brut (g)</th><th class="r">Net (g)</th><th class="r">Retenu (g)</th><th class="r">Retenu %</th><th class="r">Passant cum. %</th><th class="r">Refus cum. %</th></tr></thead><tbody>' +
    tamisRows +
    '<tr><td><b>SOMME</b></td><td class="r"><b>' + fmt2(totalBrut.value) + '</b></td><td class="r"><b>' + fmt2(totalNet.value) + '</b></td><td class="r"><b>' + fmt2(total.value) + '</b></td><td class="r"><b>' + (total.value > 0 ? '100,0%' : '—') + '</b></td><td></td><td></td></tr></tbody></table>' +
    '<div class="kv"><div><b>D10 :</b> ' + dTxt(d10.value) + '</div><div><b>D50 (médian) :</b> ' + dTxt(d50.value) + '</div><div><b>D90 :</b> ' + dTxt(d90.value) + '</div><div><b>Span :</b> ' + (span.value != null ? span.value.toFixed(2) : '—') + '</div></div>' +
    '<h2>Distribution</h2>' + svgString() +
    '<h2>Densité &amp; compressibilité</h2>' +
    '<div class="kv"><div><b>Densité apparente (vrac) :</b> ' + (densApp.value != null ? densApp.value.toFixed(3) + ' g/mL' : '—') + '</div>' +
    '<div><b>Densité tassée :</b> ' + (densTass.value != null ? densTass.value.toFixed(3) + ' g/mL' : '—') + '</div>' +
    '<div><b>Indice de Hausner :</b> ' + (hausner.value != null ? hausner.value.toFixed(3) : '—') + '</div>' +
    '<div><b>Indice de Carr :</b> ' + (carr.value != null ? carr.value.toFixed(1) + ' %' : '—') + '</div>' +
    '<div><b>Aptitude à l\'écoulement :</b> ' + esc(flow.value.t) + '</div></div>' +
    '<p class="foot">ProdTrack — LDM Groupe · Fiche générée le ' + esc(new Date().toLocaleDateString('fr-FR')) + '</p>' +
    '</body></html>'
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour générer le PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}

// ======================================================================
//  Comparaison entre plusieurs lots
// ======================================================================
const palette = ['#0891b2', '#c2410c', '#7c3aed', '#16a34a', '#ca8a04', '#db2777', '#0ea5e9', '#65a30d']
const comparo = ref([])
const lotsCompares = ref([])

function metricsFromTamis(tamis) {
  const rows = (tamis || []).map(s => {
    const hasBN = (s.brut != null) || (s.net != null)
    const ret = hasBN ? ((Number(s.brut) || 0) - (Number(s.net) || 0)) : (Number(s.retenu) || 0)
    return { taille: Number(s.taille) || 0, ret }
  })
  const tot = rows.reduce((a, r) => a + r.ret, 0)
  const sorted = rows.map(r => {
    let rc = 0; for (const x of rows) if (x.taille >= r.taille) rc += x.ret
    return { taille: r.taille, pass: tot > 0 ? 100 - rc / tot * 100 : 0, pct: tot > 0 ? r.ret / tot * 100 : 0 }
  }).sort((a, b) => a.taille - b.taille)
  const dVal = (p) => {
    if (!(tot > 0) || !sorted.length) return null
    if (p <= sorted[0].pass) return sorted[0].taille
    for (let i = 1; i < sorted.length; i++) { if (sorted[i].pass >= p) { const a = sorted[i - 1], b = sorted[i]; if (b.pass === a.pass) return b.taille; return a.taille + (b.taille - a.taille) * (p - a.pass) / (b.pass - a.pass) } }
    return sorted[sorted.length - 1].taille
  }
  const d10c = dVal(10), d50c = dVal(50), d90c = dVal(90)
  const span = (d10c != null && d50c && d90c && d50c > 0) ? (d90c - d10c) / d50c : null
  return { sorted, total: tot, d10: d10c, d50: d50c, d90: d90c, span }
}

function flowCalc(c) {
  if (c == null) return { t: '—', c: '#94a3b8' }
  if (c <= 10) return { t: 'Excellent', c: '#16a34a' }
  if (c <= 15) return { t: 'Bon', c: '#16a34a' }
  if (c <= 20) return { t: 'Assez bon', c: '#65a30d' }
  if (c <= 25) return { t: 'Passable', c: '#ca8a04' }
  if (c <= 31) return { t: 'Médiocre', c: '#ea580c' }
  if (c <= 37) return { t: 'Très médiocre', c: '#dc2626' }
  return { t: 'Très mauvais', c: '#b91c1c' }
}

async function majComparaison() {
  erreur.value = ''
  const ids = comparo.value.map(Number)
  if (!ids.length) { lotsCompares.value = []; return }
  const r = await supabase.from('granulo_analyses').select('*').in('id', ids)
  if (r.error) { erreur.value = r.error.message; return }
  const byId = {}; for (const a of (r.data || [])) byId[a.id] = a
  lotsCompares.value = ids.map(id => byId[id]).filter(Boolean).map(a => ({
    id: a.id,
    label: (a.numero_lot || 'sans lot') + (a.libelle ? ' (' + a.libelle + ')' : ''),
    densApp: a.dens_app != null ? Number(a.dens_app) : null,
    densTass: a.dens_tass != null ? Number(a.dens_tass) : null,
    hausner: a.hausner != null ? Number(a.hausner) : null,
    carr: a.carr != null ? Number(a.carr) : null,
    m: metricsFromTamis(a.tamis)
  }))
}

const comparData = computed(() => {
  const lots = lotsCompares.value
  if (!lots.length) return { lots: [], xMax: 1, xticks: [] }
  let xMax = 0
  for (const L of lots) for (const p of L.m.sorted) if (p.taille > xMax) xMax = p.taille
  if (!(xMax > 0)) xMax = 1
  const X = (t) => ML + (t / xMax) * plotW
  const Y = (p) => MT + plotH - (p / 100) * plotH
  const series = lots.map((L, i) => {
    const pts = L.m.sorted.map(p => ({ x: X(p.taille), y: Y(p.pass) }))
    return { label: L.label, color: palette[i % palette.length], pts, poly: pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') }
  })
  const xticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ x: ML + f * plotW, v: Math.round(f * xMax) }))
  return { lots: series, xMax, xticks }
})

const comparTable = computed(() => lotsCompares.value.map((L, i) => ({
  label: L.label, color: palette[i % palette.length],
  d10: L.m.d10, d50: L.m.d50, d90: L.m.d90, span: L.m.span,
  densApp: L.densApp, densTass: L.densTass, hausner: L.hausner, carr: L.carr,
  flow: flowCalc(L.carr)
})))
</script>

<style scoped>
.gr-page { color: #1b2733; zoom: 0.9; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 16px; }
.btn { background: #0891b2; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 6px 12px; font-size: 12px; margin-top: 8px; }
.gr-id { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.gr-id label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; flex: 1; min-width: 260px; }
.gr-lbl { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 500; }
.gr-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
@media (max-width: 920px) { .gr-split { grid-template-columns: 1fr; } }

.gr-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.gr-tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; font-weight: 700; padding: 5px 7px; border-bottom: 2px solid #eef2f6; }
.gr-tbl th.r, .gr-tbl td.r { text-align: right; }
.gr-tbl td { padding: 3px 7px; border-bottom: 1px solid #f4f6f9; font-variant-numeric: tabular-nums; }
.gr-tbl td.pass { color: #0891b2; font-weight: 700; }
.gr-tbl td.refus { color: #c2410c; }
.gr-tbl td.reten { color: #0f172a; font-weight: 700; background: #f8fafc; }
.gr-tbl tr.somme td { font-weight: 800; background: #0f172a; color: #fff; border: none; }
.gr-in { width: 62px; padding: 4px 5px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; font-size: 12.5px; }
.gr-in.r { text-align: right; }
.gr-tbl td.act button { border: 0; background: transparent; color: #cbd5e1; cursor: pointer; font-size: 13px; }
.gr-tbl td.act button:hover { color: #ef4444; }
.gr-d { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 14px; }
.gr-dk { background: #ecfeff; border: 1px solid #cffafe; border-radius: 9px; padding: 8px 10px; }
.gr-dk span { display: block; font-size: 10.5px; color: #0e7490; font-weight: 700; }
.gr-dk b { font-size: 16px; color: #0f172a; }

.gr-chart-t { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px; }
.gr-svg { width: 100%; height: auto; background: #fff; border: 1px solid #eef2f6; border-radius: 8px; }
.gr-grid { stroke: #eef2f6; stroke-width: 1; }
.gr-bar { fill: #f59e0b; opacity: .9; }
.gr-line { fill: none; stroke: #0891b2; stroke-width: 2; }
.gr-dot { fill: #0891b2; }
.gr-axr, .gr-axl { font-size: 9px; fill: #94a3b8; }
.gr-axr { text-anchor: start; } .gr-axl { text-anchor: end; }
.gr-xlab { font-size: 8.5px; fill: #64748b; text-anchor: middle; }
.gr-cap { font-size: 9px; fill: #94a3b8; }
.gr-capl { text-anchor: start; } .gr-capr { text-anchor: end; }
.gr-empty { color: #94a3b8; font-size: 13px; padding: 30px 10px; text-align: center; }
.gr-leg { font-size: 11px; color: #64748b; margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.lg { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
.lg-bar { background: #f59e0b; } .lg-line { width: 16px; height: 0; border-top: 2px solid #0891b2; border-radius: 0; }
.lg-line2 { width: 16px; height: 0; border-top: 2px dashed #c2410c; border-radius: 0; }
.gr-line2 { fill: none; stroke: #c2410c; stroke-width: 2; stroke-dasharray: 5 3; }
.gr-dot2 { fill: #c2410c; }

.gr-dens { display: flex; flex-direction: column; gap: 14px; }
.gr-f { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; }
.gr-f input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; max-width: 200px; }
.gr-taps-h { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }
.gr-tap { display: flex; gap: 6px; margin-bottom: 5px; align-items: center; }
.gr-tap-l { width: 84px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 12.5px; font-weight: 600; }
.gr-tap-v { width: 96px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; }
.gr-tap-x { border: 0; background: transparent; color: #cbd5e1; cursor: pointer; }
.gr-tap-x:hover { color: #ef4444; }
.gr-hint { font-size: 11px; color: #94a3b8; margin: 6px 0 0; }
.gr-dens-res { display: flex; flex-direction: column; gap: 10px; }
.gr-rk { display: flex; align-items: baseline; gap: 8px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 9px; padding: 10px 14px; }
.gr-rk span { flex: 1; font-size: 12.5px; color: #475569; font-weight: 600; }
.gr-rk b { font-size: 20px; color: #0f172a; font-variant-numeric: tabular-nums; }
.gr-rk em { font-size: 11px; color: #94a3b8; font-style: normal; }
.gr-flow { display: flex; align-items: center; gap: 10px; border: 2px solid; border-radius: 10px; padding: 12px 16px; }
.gr-flow span { flex: 1; font-size: 12.5px; font-weight: 600; }
.gr-flow strong { font-size: 18px; }

/* Identification + actions (enregistrement / historique / report PQR / PDF) */
.gr-id label { min-width: 150px; flex: 1 1 150px; }
.gr-grow { flex: 2 1 300px !important; min-width: 280px; }
.gr-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 16px; padding-top: 14px; border-top: 1px dashed #e2e8f0; }
.gr-hist { min-width: 250px; cursor: pointer; font-weight: 600; color: #475569; }
.gr-alert { margin: 0 0 12px; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.gr-ok { margin: 0 0 12px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }

/* Comparaison entre lots */
.gr-cmp-help { font-size: 12.5px; color: #64748b; margin: 0 0 12px; }
.gr-cmp-pick { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.gr-cmp-item { display: flex; align-items: center; gap: 7px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 11px; font-size: 12.5px; color: #475569; cursor: pointer; background: #fff; }
.gr-cmp-item.on { border-color: #a855f7; background: #faf5ff; color: #6b21a8; font-weight: 600; }
.gr-cmp-item input { accent-color: #a855f7; cursor: pointer; }
.gr-cmp-line { fill: none; stroke-width: 2.2; }
.gr-cmp-leg { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 12px; color: #475569; }
.gr-cmp-lg { display: flex; align-items: center; gap: 6px; }
.gr-cmp-lg i { width: 16px; height: 3px; border-radius: 2px; display: inline-block; }
.gr-cmp-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 7px; vertical-align: middle; }
.gr-cmp-tblbox { margin-top: 16px; overflow-x: auto; }
.gr-cmp-tbl td, .gr-cmp-tbl th { white-space: nowrap; }
.gr-cmp-tbl tbody tr:hover { background: #faf5ff; }
</style>
