<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Ligne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="ligne-wrap">
      <div class="dir">Flux de production &rarr;</div>
      <div class="conveyor">
        <div class="belt"></div>
        <div class="sweep"></div>
        <div class="batch"></div>
        <div class="batch b2"></div>
      </div>
      <div class="stations">
        <button v-for="(m, i) in modules" :key="m.path" class="station" :style="{ '--c': m.c }"
                @click="aller(m.path)" :title="m.label">
          <span class="st-node">
            <span class="st-badge">{{ i + 1 }}</span>
            <svg viewBox="0 0 24 24" v-html="m.icon"></svg>
          </span>
          <span class="st-caption">
            <span class="st-label">{{ m.label }}</span>
            <span class="st-sub">{{ m.sub }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
function aller(p) { router.push(p) }

const heure = ref('')
let timer = null
function maj() { heure.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
onMounted(() => { maj(); timer = setInterval(maj, 1000) })
onUnmounted(() => clearInterval(timer))

const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
const modules = [
  { label: 'Référentiels', sub: 'Matières & équipements', path: '/referentiels', c: '#64748b',
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>` },
  { label: 'Ordonnancement', sub: 'Planification', path: '/ordonnancement', c: '#6366f1',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>` },
  { label: 'Disponibilité', sub: 'Ateliers', path: '/dispo-equipements', c: '#0ea5e9',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>` },
  { label: 'Conditionnement', sub: 'Mise en boîte', path: '/conditionnement', c: '#14b8a6',
    icon: `<g ${S}><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></g>` },
  { label: 'Charge & capacité', sub: 'Capacité', path: '/capacite', c: '#f59e0b',
    icon: `<g ${S}><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></g>` },
  { label: 'Tableau de bord', sub: 'Pilotage', path: '/tableau-de-bord', c: '#22c55e',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>` }
]
</script>

<style scoped>
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif; display: flex; flex-direction: column;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
}

/* Header */
.ph { display: flex; justify-content: space-between; align-items: center; padding: 26px 42px; }
.ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.ph-mark { color: #5b9bd5; font-size: 15px; }
.ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.ph-right { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }

/* Ligne / convoyeur */
.ligne-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; padding: 30px 62px 90px; }
.dir { position: absolute; top: 26px; right: 62px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
.conveyor { position: absolute; left: 5%; right: 5%; top: 50%; height: 46px; transform: translateY(-50%); border-radius: 9px;
  background: linear-gradient(#414d5f, #29313d); box-shadow: inset 0 3px 9px rgba(0,0,0,.5), 0 10px 24px rgba(30,41,59,.18); overflow: hidden; }
.belt { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, transparent 2px 24px); animation: belt 1.1s linear infinite; }
.sweep { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(91,155,213,.30), transparent); background-size: 240px 100%; background-repeat: no-repeat; animation: sweep 3.2s linear infinite; }
.batch { position: absolute; top: 50%; margin-top: -6px; width: 24px; height: 12px; border-radius: 7px; background: linear-gradient(#fff, #d3e4f6); box-shadow: 0 2px 6px rgba(0,0,0,.4); z-index: 2; animation: batch 8s linear infinite; }
.batch.b2 { animation-delay: -4s; }
@keyframes belt { to { background-position: 24px 0; } }
@keyframes sweep { from { background-position: -240px 0; } to { background-position: 110% 0; } }
@keyframes batch { from { left: 1.5%; } to { left: 96.5%; } }

/* Stations */
.stations { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 3; }
.station { position: relative; background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; }
.st-node { width: 80px; height: 80px; border-radius: 19px; background: #fff; border: 2px solid var(--c); color: var(--c);
  box-shadow: 0 9px 24px rgba(30,41,59,.15), 0 0 0 6px #eef3f9; display: flex; align-items: center; justify-content: center; position: relative;
  transition: transform .22s ease, box-shadow .22s ease; }
.st-node svg { width: 35px; height: 35px; display: block; stroke: var(--c); }
.st-badge { position: absolute; top: -11px; left: -11px; width: 25px; height: 25px; border-radius: 50%; background: var(--c); color: #fff;
  font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 7px rgba(0,0,0,.22); }
.st-caption { position: absolute; top: calc(100% + 18px); left: 50%; transform: translateX(-50%); width: 132px; text-align: center; }
.st-label { display: block; font-size: 13px; font-weight: 700; color: #1e293b; }
.st-sub { display: block; font-size: 10.5px; color: #6b7c92; margin-top: 3px; }
.station:hover .st-node { transform: translateY(-9px) scale(1.07); box-shadow: 0 18px 34px rgba(30,41,59,.24), 0 0 0 6px #fff; }
.station:focus-visible { outline: none; }
.station:focus-visible .st-node { box-shadow: 0 0 0 4px rgba(91,155,213,.4), 0 0 0 6px #fff; }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

/* Mobile : la ligne devient verticale */
@media (max-width: 780px) {
  .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; }
  .ph-sub { display: none; }
  .ligne-wrap { padding: 20px 22px 40px; }
  .dir { position: static; margin: 0 auto 18px; }
  .conveyor { left: 44px; right: auto; top: 4%; bottom: 4%; width: 40px; height: auto; transform: none; }
  .belt { background: repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 2px, transparent 2px 24px); animation: beltV 1.1s linear infinite; }
  .sweep, .batch { display: none; }
  .stations { flex-direction: column; align-items: flex-start; gap: 46px; padding-left: 4px; }
  .station { flex-direction: row; gap: 16px; }
  .st-node { width: 64px; height: 64px; border-radius: 16px; } .st-node svg { width: 28px; height: 28px; }
  .st-caption { position: static; transform: none; width: auto; text-align: left; }
  @keyframes beltV { to { background-position: 0 24px; } }
}
@media (prefers-reduced-motion: reduce) { .belt, .sweep, .batch, .ph-status i { animation: none; } }
</style>
