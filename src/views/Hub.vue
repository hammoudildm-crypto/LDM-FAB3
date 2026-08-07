<template>
  <div class="hub">
    <!-- Barre supérieure -->
    <div class="hub-top">
      <div class="hub-clock">
        <div class="hc-time">{{ heure }}</div>
        <div class="hc-date">{{ dateStr }}</div>
      </div>
      <div class="hub-status">
        <span class="hs-etat"><span class="hs-dot"></span> Système opérationnel</span>
      </div>
    </div>

    <!-- Lignes de liaison -->
    <svg class="hub-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line v-for="m in modules" :key="'l' + m.path" :x1="50" :y1="52" :x2="m.x" :y2="m.y"
            class="hub-line" vector-effect="non-scaling-stroke" />
    </svg>
    <!-- Points animés sur les lignes -->
    <span v-for="m in modules" :key="'d' + m.path" class="hub-dot"
          :style="{ left: ((50 + m.x) / 2) + '%', top: ((52 + m.y) / 2) + '%' }"></span>

    <!-- Noyau central -->
    <div class="hub-core">
      <div class="core-ring"></div>
      <div class="core-glow"></div>
      <div class="core-inner">
        <div class="core-name">PROD<span>TRACK</span></div>
        <div class="core-sub">Gestion de fabrication</div>
      </div>
    </div>

    <!-- Modules -->
    <button v-for="m in modules" :key="m.path" class="hub-mod"
            :style="{ left: m.x + '%', top: m.y + '%' }" @click="aller(m.path)" :title="m.label">
      <span class="mod-circle"><svg viewBox="0 0 24 24" v-html="m.icon"></svg></span>
      <span class="mod-label">{{ m.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
function aller(p) { router.push(p) }

const heure = ref(''); const dateStr = ref('')
let timer = null
function maj() {
  const d = new Date()
  heure.value = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  dateStr.value = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}
onMounted(() => { maj(); timer = setInterval(maj, 1000) })
onUnmounted(() => clearInterval(timer))

const A = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'
const modules = [
  { label: 'Tableau de bord', path: '/', x: 50, y: 19,
    icon: `<g ${A}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>` },
  { label: 'Disponibilité', path: '/dispo-equipements', x: 81, y: 36,
    icon: `<g ${A}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>` },
  { label: 'Ordonnancement', path: '/ordonnancement', x: 81, y: 68,
    icon: `<g ${A}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>` },
  { label: 'Conditionnement', path: '/conditionnement', x: 50, y: 85,
    icon: `<g ${A}><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></g>` },
  { label: 'Charge & capacité', path: '/capacite', x: 19, y: 68,
    icon: `<g ${A}><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></g>` },
  { label: 'Référentiels', path: '/referentiels', x: 19, y: 36,
    icon: `<g ${A}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>` }
]
</script>

<style scoped>
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: hidden;
  background: radial-gradient(ellipse at 50% 44%, #101c34 0%, #0a1120 48%, #05080f 100%);
  color: #cbd5e1; font-family: 'Segoe UI', system-ui, sans-serif;
}
/* Grain / vignette léger */
.hub::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  box-shadow: inset 0 0 220px rgba(0,0,0,.6); }

/* Barre haut */
.hub-top { position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
  align-items: flex-start; padding: 30px 40px; z-index: 5; }
.hc-time { font-family: 'Consolas', ui-monospace, monospace; font-size: 34px; font-weight: 300;
  letter-spacing: 7px; color: #e6edf7; }
.hc-date { font-size: 11px; letter-spacing: 4px; color: #52708f; margin-top: 5px; }
.hub-status { text-align: right; }
.hs-etat { font-size: 11px; letter-spacing: 3px; color: #6b829f; text-transform: uppercase;
  display: inline-flex; align-items: center; gap: 9px; }
.hs-dot { width: 8px; height: 8px; border-radius: 50%; background: #34d399;
  box-shadow: 0 0 12px #34d399; animation: pulse 2.2s ease-in-out infinite; }

/* Lignes + points */
.hub-lines { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.hub-line { stroke: rgba(91,155,213,.20); stroke-width: 1; }
.hub-dot { position: absolute; width: 5px; height: 5px; border-radius: 50%; transform: translate(-50%,-50%);
  background: #5b9bd5; box-shadow: 0 0 10px #5b9bd5; z-index: 2; animation: pulse 2.6s ease-in-out infinite; }

/* Noyau central */
.hub-core { position: absolute; left: 50%; top: 52%; transform: translate(-50%,-50%);
  z-index: 3; display: flex; align-items: center; justify-content: center; }
.core-glow { position: absolute; width: 320px; height: 320px; border-radius: 50%;
  background: radial-gradient(circle, rgba(91,155,213,.18), transparent 70%); }
.core-ring { position: absolute; width: 196px; height: 196px; border-radius: 50%;
  border: 1px solid rgba(91,155,213,.35); border-top-color: #5b9bd5;
  box-shadow: 0 0 45px rgba(91,155,213,.22); animation: spin 22s linear infinite; }
.core-inner { position: relative; width: 152px; height: 152px; border-radius: 50%;
  background: radial-gradient(circle, rgba(21,35,62,.92), rgba(8,14,26,.96));
  border: 1px solid rgba(91,155,213,.28); display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; }
.core-name { font-family: ui-monospace, monospace; font-size: 21px; font-weight: 600;
  letter-spacing: 4px; color: #eaf1fb; }
.core-name span { color: #5b9bd5; }
.core-sub { font-size: 8.5px; letter-spacing: 2px; color: #52708f; margin-top: 5px; text-transform: uppercase; }

/* Modules */
.hub-mod { position: absolute; transform: translate(-50%,-50%); background: none; border: none;
  cursor: pointer; padding: 0; display: flex; flex-direction: column; align-items: center; gap: 13px; z-index: 4; }
.mod-circle { width: 84px; height: 84px; border-radius: 50%; color: #7aa5d6;
  border: 1px solid rgba(91,155,213,.28);
  background: radial-gradient(circle, rgba(17,28,50,.85), rgba(8,14,26,.55));
  display: flex; align-items: center; justify-content: center;
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease, color .25s ease; }
.mod-circle svg { width: 31px; height: 31px; display: block; }
.mod-label { font-size: 11px; letter-spacing: 2px; color: #8299b6; text-transform: uppercase;
  font-weight: 600; transition: color .25s ease; }
.hub-mod:hover .mod-circle { transform: scale(1.09); border-color: #5b9bd5; color: #d6e8ff;
  box-shadow: 0 0 34px rgba(91,155,213,.4); background: radial-gradient(circle, rgba(26,43,74,.92), rgba(11,19,34,.7)); }
.hub-mod:hover .mod-label { color: #d6e8ff; }
.hub-mod:focus-visible { outline: none; }
.hub-mod:focus-visible .mod-circle { border-color: #5b9bd5; box-shadow: 0 0 0 3px rgba(91,155,213,.35); }

@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes spin { to { transform: rotate(360deg); } }

/* Tablette / mobile : on réduit et on remonte les points */
@media (max-width: 720px) {
  .hc-time { font-size: 24px; letter-spacing: 4px; }
  .core-inner { width: 116px; height: 116px; } .core-ring { width: 150px; height: 150px; }
  .core-name { font-size: 16px; } .core-glow { width: 220px; height: 220px; }
  .mod-circle { width: 62px; height: 62px; } .mod-circle svg { width: 24px; height: 24px; }
  .mod-label { font-size: 9px; letter-spacing: 1px; }
  .hub-top { padding: 18px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .core-ring, .hs-dot, .hub-dot { animation: none; }
}
</style>
