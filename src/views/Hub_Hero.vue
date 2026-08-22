<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="hero-wrap">
      <section v-for="(g, i) in flux" :key="g.label" class="hero" :style="{ '--c': g.c }">
        <div class="hero-left">
          <span class="hero-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="hero-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
          <h2 class="hero-title">{{ g.label }}</h2>
          <span class="hero-count">{{ g.links.length }} pages</span>
        </div>
        <div class="hero-links">
          <button v-for="l in g.links" :key="l[0]" class="hero-link" @click="aller(l[0])">
            {{ l[1] }}<span class="hl-arrow">&rarr;</span>
          </button>
        </div>
      </section>
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
</script>

<style scoped>
.hub { position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; }
.ph { display: flex; justify-content: space-between; align-items: center; padding: 22px 46px 10px; }
.ph-brand { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.ph-mark { color: #5b9bd5; font-size: 15px; }
.ph-sub { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #334155; }
.ph-right { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #cbd5e1; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #4ade80; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }

.hero-wrap { padding: 16px 46px 50px; max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.hero { display: grid; grid-template-columns: 300px 1fr; gap: 26px; align-items: center; border-radius: 20px; padding: 26px 30px; position: relative; overflow: hidden;
  background:
    radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--c) 34%, transparent), transparent 60%),
    linear-gradient(120deg, #1e293b, #172033);
  border: 1px solid color-mix(in srgb, var(--c) 30%, #1e293b);
  transition: transform .18s ease, box-shadow .18s ease; }
.hero:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,.4); }
.hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--c); }

.hero-left { display: grid; grid-template-columns: auto auto; grid-template-areas: 'num ic' 'title title' 'count count'; align-items: center; gap: 6px 14px; }
.hero-num { grid-area: num; font-family: 'Consolas', ui-monospace, monospace; font-size: 30px; font-weight: 800; color: var(--c); line-height: 1; }
.hero-ic { grid-area: ic; width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); justify-self: end; }
.hero-ic svg { width: 30px; height: 30px; stroke: var(--c); }
.hero-title { grid-area: title; margin: 8px 0 0; font-size: 23px; font-weight: 800; color: #fff; letter-spacing: -.02em; }
.hero-count { grid-area: count; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; }

.hero-links { display: flex; flex-wrap: wrap; gap: 9px; }
.hero-link { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: 11px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; color: #e2e8f0; padding: 10px 15px; transition: all .14s ease; }
.hl-arrow { color: var(--c); opacity: 0; transform: translateX(-5px); transition: opacity .14s ease, transform .14s ease; }
.hero-link:hover { background: color-mix(in srgb, var(--c) 24%, transparent); border-color: var(--c); color: #fff; transform: translateY(-2px); }
.hero-link:hover .hl-arrow { opacity: 1; transform: translateX(0); }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 820px) {
  .ph { padding: 16px 18px; flex-wrap: wrap; gap: 10px; } .ph-sub { display: none; }
  .hero-wrap { padding: 12px 16px 40px; }
  .hero { grid-template-columns: 1fr; gap: 16px; padding: 20px; }
  .hero-title { font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) { .ph-status i { animation: none; } .hero, .hero-link { transition: none; } }
</style>
