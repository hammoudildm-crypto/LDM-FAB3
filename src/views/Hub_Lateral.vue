<template>
  <div class="hub">
    <aside class="side">
      <div class="side-brand"><span class="ph-mark">▸</span>ProdTrack</div>
      <div class="side-sub">Chaîne de production</div>
      <nav class="side-nav">
        <button v-for="(g, i) in flux" :key="g.label" class="side-item" :class="{ on: selected === i }" :style="{ '--c': g.c }" @click="selected = i">
          <span class="side-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
          <span class="side-txt">{{ g.label }}</span>
          <span class="side-n">{{ g.links.length }}</span>
        </button>
      </nav>
      <div class="side-foot"><span class="ph-status"><i></i> En service</span><span class="side-clock">{{ heure }}</span></div>
    </aside>

    <main class="main" :style="{ '--c': cur.c }">
      <div class="main-head">
        <span class="main-ic"><svg viewBox="0 0 24 24" v-html="cur.icon"></svg></span>
        <div>
          <span class="main-step">Étape {{ selected + 1 }} / {{ flux.length }}</span>
          <h1 class="main-title">{{ cur.label }}</h1>
        </div>
      </div>
      <div class="main-grid">
        <button v-for="l in cur.links" :key="l[0]" class="main-card" @click="aller(l[0])">
          <span class="mc-label">{{ l[1] }}</span>
          <span class="mc-go">Ouvrir &rarr;</span>
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
function aller(p) { router.push(p) }

const selected = ref(0)
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
const cur = computed(() => flux[selected.value])
</script>

<style scoped>
.hub { position: fixed; inset: 0; z-index: 60; display: flex; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; background: #eef3f9; }
.ph-mark { color: #5b9bd5; }

/* Sidebar */
.side { width: 288px; flex: none; background: linear-gradient(180deg, #1e293b, #0f172a); color: #e2e8f0; display: flex; flex-direction: column; padding: 22px 16px; }
.side-brand { font-size: 21px; font-weight: 800; color: #fff; letter-spacing: -.4px; display: flex; align-items: center; gap: 9px; }
.side-sub { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 2.5px; text-transform: uppercase; margin: 4px 0 22px 1px; }
.side-nav { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.side-item { display: flex; align-items: center; gap: 12px; background: none; border: 0; cursor: pointer; font: inherit; color: #cbd5e1;
  padding: 11px 12px; border-radius: 11px; text-align: left; transition: background .14s ease, color .14s ease; position: relative; }
.side-item:hover { background: rgba(255,255,255,.06); color: #fff; }
.side-item.on { background: rgba(255,255,255,.10); color: #fff; }
.side-item.on::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 3px; background: var(--c); }
.side-ic { width: 34px; height: 34px; border-radius: 9px; flex: none; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 26%, transparent); color: var(--c); }
.side-item.on .side-ic { background: var(--c); color: #fff; }
.side-ic svg { width: 20px; height: 20px; }
.side-txt { flex: 1; font-size: 13.5px; font-weight: 700; }
.side-n { font-size: 11px; font-weight: 800; color: #94a3b8; background: rgba(255,255,255,.08); border-radius: 20px; padding: 2px 9px; }
.side-item.on .side-n { color: #fff; background: color-mix(in srgb, var(--c) 45%, transparent); }
.side-foot { margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1); display: flex; align-items: center; justify-content: space-between; }
.ph-status { font-size: 11px; font-weight: 700; color: #4ade80; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.side-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1.5px; }

/* Main */
.main { flex: 1; overflow: auto; padding: 40px 46px; }
.main-head { display: flex; align-items: center; gap: 18px; margin-bottom: 30px; }
.main-ic { width: 64px; height: 64px; border-radius: 18px; flex: none; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 14%, #fff); color: var(--c); box-shadow: 0 8px 22px color-mix(in srgb, var(--c) 22%, transparent); }
.main-ic svg { width: 36px; height: 36px; stroke: var(--c); }
.main-step { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--c); }
.main-title { margin: 2px 0 0; font-size: 30px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.main-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.main-card { background: #fff; border: 1px solid #e6ecf3; border-radius: 14px; padding: 18px; cursor: pointer; text-align: left;
  display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 6px rgba(30,41,59,.05); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
.main-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(30,41,59,.13); border-color: var(--c); }
.mc-label { font-size: 15px; font-weight: 700; color: #0f172a; }
.mc-go { font-size: 12px; font-weight: 700; color: var(--c); }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 820px) {
  .hub { flex-direction: column; overflow: auto; }
  .side { width: auto; flex-direction: column; padding: 16px; }
  .side-nav { flex-direction: row; flex-wrap: wrap; }
  .side-item { flex: 1 1 44%; }
  .main { padding: 24px 18px; }
  .main-title { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) { .ph-status i { animation: none; } .main-card { transition: none; } }
</style>
