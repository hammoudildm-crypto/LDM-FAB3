<template>
  <div class="gr-page">
    <PageHeader title="Granulométrie & densité" tone="#0891b2"
      subtitle="Analyse par tamisage (histogramme + courbe cumulative, D10/D50/D90) et densité apparente / tassée (Hausner, Carr)." />

    <section class="card">
      <div class="gr-id">
        <label>Échantillon / lot <input v-model="lotLabel" class="gr-lbl" placeholder="ex. DIAMICRON 60 MG — Lot 26820 (après lubrification)" /></label>
        <button class="btn ghost" @click="reset">↺ Réinitialiser</button>
      </div>
    </section>

    <!-- ANALYSE GRANULOMÉTRIQUE -->
    <section class="card">
      <h2 class="card-title">Analyse granulométrique (tamisage)</h2>
      <div class="gr-split">
        <div class="gr-tblbox">
          <table class="gr-tbl">
            <thead><tr><th>Tamis (µm)</th><th class="r">Refus (g)</th><th class="r">Retenu %</th><th class="r">Passant cumulé %</th><th class="r">Refus cumulé %</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(s, i) in sieves" :key="i">
                <td><input v-model.number="s.taille" type="number" min="0" step="any" class="gr-in" /></td>
                <td class="r"><input v-model.number="s.retenu" type="number" min="0" step="any" class="gr-in r" placeholder="0" /></td>
                <td class="r">{{ pct1(pctOf(s)) }}</td>
                <td class="r pass">{{ pct1(passantCumOf(s)) }}</td>
                <td class="r refus">{{ pct1(refusCumOf(s)) }}</td>
                <td class="act"><button @click="sieves.splice(i, 1)" title="Retirer">✕</button></td>
              </tr>
              <tr class="somme"><td>SOMME</td><td class="r">{{ fmt2(total) }}</td><td class="r">{{ total > 0 ? '100,0' : '0' }}%</td><td></td><td></td><td></td></tr>
            </tbody>
          </table>
          <button class="btn ghost sm" @click="sieves.push({ taille: null, retenu: null })">＋ Ajouter un tamis</button>
          <div class="gr-d">
            <div class="gr-dk"><span>D10</span><b>{{ dTxt(d10) }}</b></div>
            <div class="gr-dk"><span>D50 (médian)</span><b>{{ dTxt(d50) }}</b></div>
            <div class="gr-dk"><span>D90</span><b>{{ dTxt(d90) }}</b></div>
            <div class="gr-dk"><span>Span (D90−D10)/D50</span><b>{{ span != null ? span.toFixed(2) : '—' }}</b></div>
          </div>
        </div>

        <div class="gr-chartbox">
          <div class="gr-chart-t">Histogramme & courbe cumulative</div>
          <svg v-if="chart.bars.length" :viewBox="'0 0 ' + CW + ' ' + CH" class="gr-svg" preserveAspectRatio="xMidYMid meet">
            <line v-for="g in [0,25,50,75,100]" :key="'g'+g" :x1="ML" :x2="CW-MR" :y1="yPct(g)" :y2="yPct(g)" class="gr-grid" />
            <text v-for="g in [0,25,50,75,100]" :key="'gl'+g" :x="CW-MR+4" :y="yPct(g)+3" class="gr-axr">{{ g }}</text>
            <text v-for="g in [0,25,50,75,100]" :key="'ll'+g" :x="ML-6" :y="yPct(g)+3" class="gr-axl">{{ Math.round(g/100*chart.maxPct) }}</text>
            <rect v-for="(b, i) in chart.bars" :key="'b'+i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="gr-bar" />
            <polyline :points="chart.poly" class="gr-line" />
            <circle v-for="(p, i) in chart.pts" :key="'p'+i" :cx="p.x" :cy="p.y" r="3" class="gr-dot" />
            <text v-for="(b, i) in chart.bars" :key="'x'+i" :x="b.x + b.w/2" :y="CH-MB+14" class="gr-xlab">{{ b.label }}</text>
            <text :x="ML-6" :y="MT-6" class="gr-cap gr-capl">% retenu</text>
            <text :x="CW-MR+4" :y="MT-6" class="gr-cap gr-capr">% passant</text>
            <text :x="(ML+CW-MR)/2" :y="CH-4" class="gr-cap" text-anchor="middle">Taille des particules (µm)</text>
          </svg>
          <p v-else class="gr-empty">Saisis les masses retenues par tamis pour tracer l'histogramme et la courbe cumulative.</p>
          <div class="gr-leg"><span class="lg lg-bar"></span> % retenu par tamis <span class="lg lg-line"></span> passant cumulé (courbe en S)</div>
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
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import PageHeader from '../components/PageHeader.vue'

const CW = 720, CH = 300, ML = 46, MR = 46, MT = 20, MB = 40
const plotW = CW - ML - MR, plotH = CH - MT - MB

const lotLabel = ref('')
const sieves = reactive([
  { taille: 0, retenu: null }, { taille: 40, retenu: null }, { taille: 63, retenu: null },
  { taille: 90, retenu: null }, { taille: 125, retenu: null }, { taille: 160, retenu: null },
  { taille: 250, retenu: null }, { taille: 315, retenu: null }, { taille: 500, retenu: null }, { taille: 710, retenu: null }
])
const masse = ref(null)
const taps = reactive([{ label: 'V0', v: null }, { label: 'V10', v: null }, { label: 'V500', v: null }, { label: 'V1250', v: null }, { label: 'V2500', v: null }])

function reset() {
  lotLabel.value = ''; masse.value = null
  for (const s of sieves) s.retenu = null
  for (const t of taps) t.v = null
}

// ---- Granulométrie ----
const total = computed(() => sieves.reduce((s, r) => s + (Number(r.retenu) || 0), 0))
function pctOf(r) { const t = total.value; return t > 0 ? (Number(r.retenu) || 0) / t * 100 : 0 }
function refusCumOf(r) { const t = total.value; if (!(t > 0)) return 0; let s = 0; const d = Number(r.taille) || 0; for (const x of sieves) if ((Number(x.taille) || 0) >= d) s += (Number(x.retenu) || 0); return s / t * 100 }
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
  if (!n || !(total.value > 0)) return { bars: [], pts: [], poly: '', maxPct: 1 }
  const maxPct = Math.max(1, ...rows.map(r => r.pct))
  const bw = plotW / n
  const bars = rows.map((r, i) => { const h = (r.pct / maxPct) * plotH; return { x: ML + i * bw + bw * 0.2, w: bw * 0.6, y: MT + plotH - h, h, label: r.taille, pct: r.pct } })
  const pts = rows.map((r, i) => ({ x: ML + i * bw + bw * 0.5, y: MT + plotH - (r.pass / 100) * plotH, p: r.pass }))
  const poly = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')
  return { bars, pts, poly, maxPct }
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
.gr-tbl tr.somme td { font-weight: 800; background: #0f172a; color: #fff; border: none; }
.gr-in { width: 76px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; font-size: 12.5px; }
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
</style>
