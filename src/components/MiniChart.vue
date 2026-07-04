<script setup>
import { computed } from 'vue'
import { chartStyle } from '../chartPref'

const props = defineProps({
  // séries : [{ label, color, data:[...], dash? }]
  series: { type: Array, required: true },
  labels: { type: Array, required: true },
  format: { type: Function, default: (v) => (v == null ? '—' : Number(v).toLocaleString('fr-FR')) },
  max: { type: Number, default: 0 },        // max imposé (sinon calculé)
  min: { type: Number, default: 0 },         // base d'échelle (zoom)
  showSwitch: { type: Boolean, default: true },
  clickable: { type: Boolean, default: false },
  showValues: { type: Boolean, default: false },
  valueFormat: { type: Function, default: null }
})
const emit = defineEmits(['pick'])
const vfmt = computed(() => props.valueFormat || props.format)

const CH = { w: 820, h: 240, pl: 12, pr: 12, pt: 22, pb: 26 }
const n = computed(() => props.labels.length)
const bandW = computed(() => (CH.w - CH.pl - CH.pr) / Math.max(1, n.value - 1))
const maxV = computed(() => props.max || Math.max(1, ...props.series.flatMap(s => s.data.map(v => Number(v) || 0))))
const minV = computed(() => props.min || 0)
const span = computed(() => (maxV.value - minV.value) || 1)
function x(i) { return CH.pl + (i / Math.max(1, n.value - 1)) * (CH.w - CH.pl - CH.pr) }
function y(v) { const vv = Math.max(minV.value, Math.min(Number(v), maxV.value)); return CH.h - CH.pb - ((vv - minV.value) / span.value) * (CH.h - CH.pt - CH.pb) }
function gridY(g) { return CH.h - CH.pb - g * (CH.h - CH.pt - CH.pb) }
function pts(data) { return data.map((v, i) => (v == null ? null : x(i) + ',' + y(v))).filter(Boolean).join(' ') }
function area(data) {
  const b = CH.h - CH.pb
  const idx = data.map((v, i) => (v == null ? -1 : i)).filter(i => i >= 0)
  if (!idx.length) return ''
  return x(idx[0]) + ',' + b + ' ' + idx.map(i => x(i) + ',' + y(data[i])).join(' ') + ' ' + x(idx[idx.length - 1]) + ',' + b
}
function barH(v) { const vv = Math.max(minV.value, Math.min(Number(v), maxV.value)); return ((vv - minV.value) / span.value * 100) + '%' }
function colOf(s, v) { return (s.threshold != null && v != null && v < s.threshold && s.low) ? s.low : s.color }
const gl = [0, 0.25, 0.5, 0.75, 1]
</script>

<template>
  <div class="mc">
    <div v-if="showSwitch" class="ch-switch">
      <button :class="{ on: chartStyle === 'courbes' }" @click="chartStyle = 'courbes'">Courbes</button>
      <button :class="{ on: chartStyle === 'aires' }" @click="chartStyle = 'aires'">Aires</button>
      <button :class="{ on: chartStyle === 'barres' }" @click="chartStyle = 'barres'">Barres</button>
    </div>

    <div v-if="chartStyle !== 'barres'" class="line-ch">
      <svg :viewBox="'0 0 ' + CH.w + ' ' + CH.h" class="lch-svg">
        <defs>
          <linearGradient v-for="(s, si) in series" :key="'g' + si" :id="'mc-g' + si" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="s.color" stop-opacity=".3" />
            <stop offset="100%" :stop-color="s.color" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line v-for="g in gl" :key="'gr' + g" :x1="CH.pl" :x2="CH.w - CH.pr" :y1="gridY(g)" :y2="gridY(g)" class="lch-grid" />
        <template v-if="chartStyle === 'aires'">
          <polygon v-for="(s, si) in series" :key="'a' + si" :points="area(s.data)" :fill="'url(#mc-g' + si + ')'" />
        </template>
        <polyline v-for="(s, si) in series" :key="'l' + si" :points="pts(s.data)" fill="none" :stroke="s.color" :stroke-dasharray="s.dash ? '5 4' : ''" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <template v-for="(mo, i) in labels" :key="i">
          <template v-for="(s, si) in series" :key="'p' + si + '-' + i">
            <circle v-if="s.data[i] != null" :cx="x(i)" :cy="y(s.data[i])" r="3.3" :fill="colOf(s, s.data[i])" class="mc-pt"><title>{{ mo }} — {{ s.label }} : {{ format(s.data[i]) }}</title></circle>
          </template>
          <text :x="x(i)" :y="CH.h - 8" text-anchor="middle" class="lch-lbl">{{ mo }}</text>
          <text v-if="showValues && series.length === 1 && series[0].data[i] != null" :x="x(i)" :y="y(series[0].data[i]) - 8" text-anchor="middle" class="mc-val">{{ vfmt(series[0].data[i]) }}</text>
        </template>
        <template v-if="clickable">
          <rect v-for="(mo, i) in labels" :key="'h' + i" :x="x(i) - bandW / 2" :y="CH.pt" :width="bandW" :height="CH.h - CH.pt - CH.pb" fill="transparent" class="mc-hit" @click="emit('pick', i)"><title>{{ mo }}</title></rect>
        </template>
      </svg>
    </div>

    <div v-else class="ch">
      <div v-for="(mo, i) in labels" :key="i" class="ch-group" :class="{ clic: clickable }" @click="clickable && emit('pick', i)">
        <div class="ch-bars">
          <template v-for="(s, si) in series" :key="si">
            <div v-if="s.data[i] != null" class="ch-bar" :style="{ height: barH(s.data[i]), backgroundColor: colOf(s, s.data[i]), width: (series.length === 1 ? 82 : Math.floor(84 / series.length)) + '%', maxWidth: (series.length === 1 ? 34 : Math.floor(72 / series.length)) + 'px' }" :title="mo + ' — ' + s.label + ' : ' + format(s.data[i])"><span v-if="showValues && s.data[i]" class="ch-val" :class="{ rot: series.length > 1 }">{{ vfmt(s.data[i]) }}</span></div>
          </template>
        </div>
        <div class="ch-lbl">{{ mo }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mc { width: 100%; }
.ch-switch { display: inline-flex; gap: 2px; background: #f1f5f9; border-radius: 8px; padding: 3px; margin-bottom: 6px; }
.ch-switch button { background: none; border: 0; font-family: inherit; font-size: 12px; font-weight: 600; color: #64748b; padding: 5px 11px; border-radius: 6px; cursor: pointer; transition: background .15s ease, color .15s ease; }
.ch-switch button.on { background: #fff; color: #0f766e; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.line-ch { width: 100%; }
.lch-svg { width: 100%; height: auto; display: block; overflow: visible; }
.lch-grid { stroke: #eef2f6; stroke-width: 1; }
.mc-pt { stroke: #fff; stroke-width: 1.5; cursor: pointer; }
.mc-pt:hover { r: 5; }
.lch-lbl { fill: #94a3b8; font-size: 13px; font-weight: 600; }
.ch { display: flex; align-items: flex-end; gap: 3px; height: 200px; padding-top: 20px; }
.ch-group { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; height: 100%; }
.ch-bars { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
.ch-bar { position: relative; border-radius: 5px 5px 2px 2px; min-height: 2px; transition: height .45s cubic-bezier(.4,0,.2,1); background-image: linear-gradient(180deg, rgba(255,255,255,.3), rgba(255,255,255,0) 55%); }
.ch-val { position: absolute; top: -15px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: #334155; white-space: nowrap; }
.ch-val.rot { writing-mode: vertical-rl; top: auto; bottom: 100%; margin-bottom: 3px; font-size: 9px; }
.mc-val { fill: #334155; font-size: 12px; font-weight: 700; }
.ch-bar:hover { filter: brightness(1.08); }
.ch-lbl { font-size: 10px; color: #94a3b8; margin-top: 6px; font-weight: 600; }
.mc-hit { cursor: pointer; }
.mc-hit:hover { fill: rgba(15,118,110,.06); }
.ch-group.clic { cursor: pointer; border-radius: 6px; transition: background .15s ease; }
.ch-group.clic:hover { background: rgba(15,118,110,.07); }
html[data-theme="sombre"] .ch-switch, html[data-theme="minuit"] .ch-switch { background: #0f1830; }
html[data-theme="sombre"] .ch-switch button.on, html[data-theme="minuit"] .ch-switch button.on { background: #243049; color: #2dd4bf; }
html[data-theme="sombre"] .lch-grid, html[data-theme="minuit"] .lch-grid { stroke: #2a3650; }
html[data-theme="sombre"] .mc-pt, html[data-theme="minuit"] .mc-pt { stroke: #161f33; }
html[data-theme="sombre"] .ch-val, html[data-theme="minuit"] .ch-val { color: #cbd5e1; }
html[data-theme="sombre"] .mc-val, html[data-theme="minuit"] .mc-val { fill: #cbd5e1; }
</style>
