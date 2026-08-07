<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-l">
        <div class="ph-brand">Prod<span>Track</span></div>
        <div class="ph-tag">Espace de travail — Gestion de fabrication</div>
      </div>
      <div class="ph-r">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> Système opérationnel</span>
      </div>
    </header>

    <div class="grid">
      <button v-for="m in modules" :key="m.path" class="tile" :class="m.k"
              :style="{ background: m.bg }" @click="aller(m.path)">
        <svg class="tile-wm" viewBox="0 0 24 24" v-html="m.icon"></svg>
        <span class="tile-ic"><svg viewBox="0 0 24 24" v-html="m.icon"></svg></span>
        <span class="tile-txt">
          <span class="tile-label">{{ m.label }}</span>
          <span class="tile-sub">{{ m.sub }}</span>
        </span>
        <span class="tile-go">Ouvrir &rarr;</span>
      </button>
    </div>

    <div class="ma-head">Toutes les pages</div>
    <div class="menu-all">
      <div v-for="g in groupes" :key="g.label" class="ma-group">
        <div class="ma-title" :style="{ color: g.c }">{{ g.label }}</div>
        <div class="ma-links">
          <button v-for="l in g.links" :key="l[0]" class="ma-link" @click="aller(l[0])">{{ l[1] }}</button>
        </div>
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
  { label: 'Tableau de bord', sub: 'Vue d\u2019ensemble & indicateurs de production', path: '/tableau-de-bord', k: 't-big',
    bg: 'linear-gradient(135deg,#6366f1,#4338ca)',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>` },
  { label: 'Disponibilité', sub: 'Files par atelier & conditionnement', path: '/dispo-equipements', k: 't-wide',
    bg: 'linear-gradient(135deg,#0ea5e9,#0369a1)',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>` },
  { label: 'Ordonnancement', sub: 'Planning', path: '/ordonnancement', k: 't-small',
    bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>` },
  { label: 'Conditionnement', sub: 'Mise en boîte', path: '/conditionnement', k: 't-small',
    bg: 'linear-gradient(135deg,#14b8a6,#0f766e)',
    icon: `<g ${S}><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></g>` },
  { label: 'Charge & capacité', sub: 'Occupation des équipements', path: '/capacite', k: 't-wide',
    bg: 'linear-gradient(135deg,#f59e0b,#b45309)',
    icon: `<g ${S}><line x1="6" y1="20" x2="6" y2="14"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="10"/></g>` },
  { label: 'Référentiels', sub: 'Produits, équipements, cadences', path: '/referentiels', k: 't-wide',
    bg: 'linear-gradient(135deg,#f43f5e,#be123c)',
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>` }
]

const groupes = [
  { label: 'Consultation', c: '#0369a1', links: [
    ['/realisation-plan', 'Réalisation vs Plan'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"],
    ['/dispo-equipements', 'Disponibilité équipements'], ['/avancement', 'Suivi du process'], ['/production-atelier', 'Production par atelier'],
    ['/suivi-trs', 'Suivi TRS'], ['/capacite', 'Capacité équipements'], ['/qse', 'Indicateurs QSE'],
    ['/encours', 'En-cours'], ['/dossier', 'Dossier de lot'], ['/audit', "Journal d'audit"]
  ] },
  { label: 'Production & saisie', c: '#0f766e', links: [
    ['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication'],
    ['/suivi', 'Suivi fab. & Saisie TRS'], ['/conditionnement', 'Conditionnement'],
    ['/verification-ddl', 'DDL Fab — Production'], ['/verification-ddl-aq', 'DDL Fab — AQ'], ['/verification-ddl-cond', 'DDL Conditionnement'],
    ['/effectifs', 'Effectifs']
  ] },
  { label: 'Administration', c: '#be123c', links: [
    ['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations']
  ] }
]
</script>

<style scoped>
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #0f172a;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: radial-gradient(1200px 600px at 85% -10%, #e0e7ff 0%, transparent 60%),
             radial-gradient(900px 500px at 0% 110%, #fce7f3 0%, transparent 55%),
             #f4f6fb;
  padding: 30px 40px 40px;
}
/* Header */
.ph { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; flex-wrap: wrap; gap: 14px; }
.ph-brand { font-size: 26px; font-weight: 800; letter-spacing: -.6px; color: #1e1b4b; }
.ph-brand span { color: #6366f1; }
.ph-tag { font-size: 12.5px; color: #64748b; margin-top: 3px; }
.ph-r { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 17px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; text-transform: uppercase; letter-spacing: .5px; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s infinite; }

/* Grille bento */
.grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 152px; gap: 16px; grid-auto-flow: dense; max-width: 1180px; margin: 0 auto; }
.t-big { grid-column: span 2; grid-row: span 2; }
.t-wide { grid-column: span 2; }
.t-small { grid-column: span 1; }

.tile {
  position: relative; overflow: hidden; border: none; cursor: pointer; text-align: left;
  border-radius: 20px; color: #fff; padding: 20px 22px;
  display: flex; flex-direction: column; box-shadow: 0 10px 26px rgba(30,41,59,.16);
  transition: transform .22s ease, box-shadow .22s ease;
}
.tile:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(30,41,59,.26); }
.tile:focus-visible { outline: 3px solid rgba(255,255,255,.7); outline-offset: 3px; }
.tile::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,.14), transparent 40%); pointer-events: none; }

.tile-wm { position: absolute; right: -18px; bottom: -18px; width: 128px; height: 128px; opacity: .13; stroke: #fff; fill: none; stroke-width: 1.4; }
.tile-ic { width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center; }
.tile-ic svg { width: 26px; height: 26px; stroke: #fff; fill: none; stroke-width: 1.8; }
.tile-txt { margin-top: auto; position: relative; z-index: 2; }
.tile-label { display: block; font-size: 17px; font-weight: 700; letter-spacing: -.2px; }
.tile-sub { display: block; font-size: 12px; opacity: .85; margin-top: 3px; }
.tile-go { position: absolute; top: 22px; right: 22px; font-size: 12px; font-weight: 700; opacity: 0; transform: translateX(-6px); transition: opacity .2s ease, transform .2s ease; z-index: 2; }
.tile:hover .tile-go { opacity: .95; transform: translateX(0); }

/* Grande tuile : plus d'air */
.t-big .tile-ic { width: 56px; height: 56px; } .t-big .tile-ic svg { width: 32px; height: 32px; }
.t-big .tile-label { font-size: 24px; } .t-big .tile-sub { font-size: 13.5px; }
.t-big .tile-wm { width: 180px; height: 180px; }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 820px) {
  .hub { padding: 20px; }
  .grid { grid-template-columns: 1fr; grid-auto-rows: 128px; }
  .t-big, .t-wide, .t-small { grid-column: auto; grid-row: auto; }
  .t-big { grid-row: span 1; }
  .t-big .tile-label { font-size: 19px; }
}
.ma-head { max-width: 1180px; margin: 38px auto 12px; font-size: 13px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8; }
.menu-all { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; align-items: start; }
.ma-group { background: rgba(255,255,255,.72); border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; box-shadow: 0 6px 18px rgba(30,41,59,.06); }
.ma-title { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
.ma-links { display: flex; flex-direction: column; gap: 1px; }
.ma-link { background: none; border: none; text-align: left; cursor: pointer; font: inherit; font-size: 13.5px; color: #334155; padding: 7px 10px; border-radius: 8px; transition: background .12s ease, color .12s ease, padding .12s ease; }
.ma-link:hover { background: #f1f5f9; color: #0f172a; padding-left: 15px; }
@media (max-width: 820px) { .menu-all { grid-template-columns: 1fr; } .ma-head, .menu-all { max-width: none; } }
</style>
