<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="bento-wrap">
      <div class="hint">Tableau de bord des modules &middot; {{ totalPages }} pages</div>
      <div class="bento">
        <section v-for="(g, i) in flux" :key="g.label" class="tile" :class="'span-' + (g.links.length >= 7 ? 2 : 1)" :style="{ '--c': g.c }">
          <div class="tile-head">
            <span class="tile-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
            <div class="tile-tt">
              <span class="tile-step">{{ String(i + 1).padStart(2, '0') }}</span>
              <h2 class="tile-title">{{ g.label }}</h2>
            </div>
          </div>
          <div class="tile-links">
            <button v-for="l in g.links" :key="l[0]" class="tile-link" @click="aller(l[0])">{{ l[1] }}</button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
function aller(p) { router.push(p) }

const heure = ref('')
let timer = null
function maj() { heure.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
onMounted(() => { maj(); timer = setInterval(maj, 1000) })
onUnmounted(() => clearInterval(timer))

const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
const flux = [
  { label: 'Configuration', c: '#64748b',
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>`,
    links: [['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations'], ['/effectifs', 'Effectifs']] },
  { label: 'Ordonnancement & OF', c: '#6366f1',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>`,
    links: [['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication'], ['/planning-equipements', 'Planning équipements']] },
  { label: 'Suivi de production', c: '#0ea5e9',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>`,
    links: [['/temps-reel', 'Suivi temps réel'], ['/dispo-equipements', 'Disponibilité équipements'], ['/avancement', 'Suivi du process'], ['/production-atelier', 'Production par atelier'], ['/suivi-trs', 'Suivi TRS'], ['/capacite', 'Capacité équipements'], ['/encours', 'En-cours'], ['/dossier', 'Dossier de lot']] },
  { label: 'Saisie & exécution', c: '#14b8a6',
    icon: `<g ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></g>`,
    links: [['/suivi', 'Suivi fab. & Saisie TRS'], ['/conditionnement', 'Conditionnement'], ['/passation', 'Passation de consigne']] },
  { label: 'Qualité — DDL', c: '#f43f5e',
    icon: `<g ${S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></g>`,
    links: [['/verification-ddl', 'DDL Fab — Production'], ['/verification-ddl-aq', 'DDL Fab — AQ'], ['/verification-ddl-cond', 'DDL Conditionnement'], ['/audit', "Journal d'audit"]] },
  { label: 'Pilotage', c: '#22c55e',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>`,
    links: [['/tableau-de-bord', 'Tableau de bord'], ['/realisation-plan', 'Réalisation vs Plan'], ['/realisation-pdp', 'Réalisation PDP par phase'], ['/pdp-equipement', 'PDP par équipement'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"], ['/qse', 'Indicateurs QSE']] }
]
const totalPages = computed(() => flux.reduce((s, g) => s + g.links.length, 0))
</script>

<style scoped>
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #eef3f9 0%, #e3ebf4 100%);
}
.ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.ph-mark { color: #5b9bd5; font-size: 15px; }
.ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.ph-right { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }

.bento-wrap { padding: 22px 42px 60px; max-width: 1320px; margin: 0 auto; }
.hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 22px; }

.bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; grid-auto-flow: dense; }
.tile { grid-column: span 1; background: #fff; border-radius: 18px; padding: 16px 18px; position: relative; overflow: hidden;
  box-shadow: 0 2px 8px rgba(30,41,59,.05); border: 1px solid #e6ecf3;
  transition: transform .18s ease, box-shadow .18s ease; }
.tile::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--c); }
.tile.span-2 { grid-column: span 2; }
.tile:hover { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(30,41,59,.14); }

.tile-head { display: flex; align-items: center; gap: 12px; margin-bottom: 13px; }
.tile-ic { width: 44px; height: 44px; border-radius: 12px; flex: none; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 13%, #fff); color: var(--c); }
.tile-ic svg { width: 25px; height: 25px; stroke: var(--c); }
.tile-tt { display: flex; flex-direction: column; }
.tile-step { font-family: 'Consolas', ui-monospace, monospace; font-size: 12px; font-weight: 800; color: var(--c); opacity: .7; }
.tile-title { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }

.tile-links { display: grid; grid-template-columns: 1fr; gap: 4px; }
.tile.span-2 .tile-links { grid-template-columns: 1fr 1fr; }
.tile-link { background: #f6f8fb; border: 1px solid transparent; border-radius: 9px; cursor: pointer; font: inherit; font-size: 12.5px;
  font-weight: 600; color: #475569; padding: 8px 11px; text-align: left; transition: all .12s ease; }
.tile-link:hover { background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); border-color: var(--c); }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 1080px) { .bento { grid-template-columns: repeat(2, 1fr); } .tile.span-2 { grid-column: span 2; } .tile.span-2 .tile-links { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) {
  .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; } .ph-sub { display: none; }
  .bento-wrap { padding: 18px 16px 40px; }
  .bento { grid-template-columns: 1fr; } .tile.span-2 { grid-column: span 1; } .tile.span-2 .tile-links { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .ph-status i { animation: none; } .tile { transition: none; } }
</style>
