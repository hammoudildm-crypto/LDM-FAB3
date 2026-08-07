<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Ligne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="lines">
      <div v-for="(g, i) in flux" :key="g.label" class="pline" :style="{ '--c': g.c }">
        <div class="pl-head">
          <span class="pl-badge"><span class="pl-num">{{ i + 1 }}</span><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
          <span class="pl-label">{{ g.label }}</span>
        </div>
        <div class="pl-track">
          <div class="pl-belt"></div>
          <div class="pl-nodes">
            <button v-for="l in g.links" :key="l[0]" class="pl-node" @click="aller(l[0])" :title="l[1]">
              <span class="pl-marker"></span>{{ l[1] }}
            </button>
          </div>
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
const flux = [
  { label: 'Configuration', c: '#64748b',
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>`,
    links: [['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations'], ['/effectifs', 'Effectifs']] },
  { label: 'Ordonnancement & OF', c: '#6366f1',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>`,
    links: [['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication']] },
  { label: 'Suivi de production', c: '#0ea5e9',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>`,
    links: [['/dispo-equipements', 'Disponibilité'], ['/avancement', 'Suivi du process'], ['/production-atelier', 'Production par atelier'], ['/suivi-trs', 'Suivi TRS'], ['/capacite', 'Capacité'], ['/encours', 'En-cours'], ['/dossier', 'Dossier de lot']] },
  { label: 'Saisie & exécution', c: '#14b8a6',
    icon: `<g ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></g>`,
    links: [['/suivi', 'Suivi fab. & Saisie TRS'], ['/conditionnement', 'Conditionnement']] },
  { label: 'Qualité — DDL', c: '#f43f5e',
    icon: `<g ${S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></g>`,
    links: [['/verification-ddl', 'DDL Production'], ['/verification-ddl-aq', 'DDL AQ'], ['/verification-ddl-cond', 'DDL Conditionnement'], ['/audit', "Journal d'audit"]] },
  { label: 'Pilotage', c: '#22c55e',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>`,
    links: [['/tableau-de-bord', 'Tableau de bord'], ['/realisation-plan', 'Réalisation vs Plan'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"], ['/qse', 'Indicateurs QSE']] }
]
</script>

<style scoped>
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
  padding-bottom: 40px;
}
.ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.ph-mark { color: #5b9bd5; font-size: 15px; }
.ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.ph-right { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }

/* Lignes (une par catégorie) */
.lines { padding: 18px 40px 0; display: flex; flex-direction: column; gap: 16px; max-width: 1280px; margin: 0 auto; }
.pline { display: flex; align-items: stretch; gap: 18px; }

.pl-head { width: 190px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; }
.pl-badge { width: 46px; height: 46px; border-radius: 13px; background: #fff; border: 2px solid var(--c); color: var(--c); position: relative;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(30,41,59,.12); flex-shrink: 0; }
.pl-badge svg { width: 24px; height: 24px; stroke: var(--c); }
.pl-num { position: absolute; top: -8px; left: -8px; width: 20px; height: 20px; border-radius: 50%; background: var(--c); color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.pl-label { font-size: 13px; font-weight: 800; color: var(--c); text-transform: uppercase; letter-spacing: .4px; line-height: 1.2; }

/* Convoyeur + stations = pages */
.pl-track { flex: 1; min-width: 0; position: relative; display: flex; align-items: center; }
.pl-belt { position: absolute; left: 0; right: 0; top: 50%; height: 40px; transform: translateY(-50%); border-radius: 8px;
  background: linear-gradient(#414d5f, #29313d); box-shadow: inset 0 3px 8px rgba(0,0,0,.5), 0 8px 18px rgba(30,41,59,.16); overflow: hidden; }
.pl-belt::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, transparent 2px 22px); animation: belt 1.1s linear infinite; }
.pl-nodes { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; width: 100%; overflow-x: auto; padding: 8px 6px; }
.pl-nodes::-webkit-scrollbar { height: 6px; } .pl-nodes::-webkit-scrollbar-thumb { background: rgba(148,163,184,.5); border-radius: 3px; }
.pl-node { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; background: #fff; border: 1.5px solid #e2e8f0; border-left: 4px solid var(--c);
  border-radius: 10px; font: inherit; font-size: 12.5px; font-weight: 600; color: #334155; padding: 8px 13px; cursor: pointer; white-space: nowrap;
  box-shadow: 0 4px 12px rgba(30,41,59,.14); transition: transform .18s ease, box-shadow .18s ease, color .18s ease; }
.pl-marker { width: 9px; height: 9px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 20%, transparent); flex-shrink: 0; }
.pl-node:hover { transform: translateY(-4px); box-shadow: 0 12px 22px rgba(30,41,59,.22); color: #0f172a; }
.pl-node:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 45%, transparent); }

@keyframes belt { to { background-position: 22px 0; } }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 860px) {
  .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; } .ph-sub { display: none; }
  .lines { padding: 14px 18px 0; gap: 22px; }
  .pline { flex-direction: column; gap: 10px; }
  .pl-head { width: auto; }
  .pl-belt { display: none; }
  .pl-nodes { flex-wrap: wrap; overflow-x: visible; padding: 0; }
}
@media (prefers-reduced-motion: reduce) { .pl-belt::after, .ph-status i { animation: none; } }
</style>
