<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="ligne-wrap">
      <div class="hint">Cliquez une étape pour afficher ses pages &nbsp;·&nbsp; Flux de production &rarr;</div>
      <div class="line-band">
        <div class="conveyor">
          <div class="belt"></div>
          <div class="sweep"></div>
          <div class="batch"></div>
          <div class="batch b2"></div>
        </div>
        <div class="stations">
          <div v-for="(g, i) in flux" :key="g.label" class="station" :class="{ open: selected === i }" :style="{ '--c': g.c }">
            <button class="st-node" @click="toggle(i)" :title="g.label">
              <span class="st-badge">{{ i + 1 }}</span>
              <svg viewBox="0 0 24 24" v-html="g.icon"></svg>
            </button>
            <button class="st-label" @click="toggle(i)">{{ g.label }} <span class="st-caret">▾</span></button>
            <transition name="drop">
              <div v-if="selected === i" class="st-drop">
                <button v-for="l in g.links" :key="l[0]" class="st-page" @click="aller(l[0])">{{ l[1] }}</button>
              </div>
            </transition>
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

const selected = ref(0)
function toggle(i) { selected.value = selected.value === i ? null : i }

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
.hub {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
}
.ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.ph-mark { color: #5b9bd5; font-size: 15px; }
.ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.ph-right { display: flex; align-items: center; gap: 20px; }
.ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }

.ligne-wrap { position: relative; padding: 44px 56px 60px; min-height: 480px; }
.hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 40px; }

/* Convoyeur + stations */
.line-band { position: relative; }
.conveyor { position: absolute; left: 4%; right: 4%; top: 18px; height: 44px; border-radius: 9px;
  background: linear-gradient(#414d5f, #29313d); box-shadow: inset 0 3px 9px rgba(0,0,0,.5), 0 10px 24px rgba(30,41,59,.18); overflow: hidden; z-index: 1; }
.belt { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, transparent 2px 24px); animation: belt 1.1s linear infinite; }
.sweep { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(91,155,213,.30), transparent); background-size: 240px 100%; background-repeat: no-repeat; animation: sweep 3.2s linear infinite; }
.batch { position: absolute; top: 50%; margin-top: -6px; width: 24px; height: 12px; border-radius: 7px; background: linear-gradient(#fff, #d3e4f6); box-shadow: 0 2px 6px rgba(0,0,0,.4); z-index: 2; animation: batch 8s linear infinite; }
.batch.b2 { animation-delay: -4s; }
@keyframes belt { to { background-position: 24px 0; } }
@keyframes sweep { from { background-position: -240px 0; } to { background-position: 110% 0; } }
@keyframes batch { from { left: 1.5%; } to { left: 96.5%; } }

.stations { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 3; }
.station { position: relative; display: flex; flex-direction: column; align-items: center; }
.st-node { width: 80px; height: 80px; border-radius: 19px; background: #fff; border: 2px solid var(--c); color: var(--c); position: relative; cursor: pointer;
  box-shadow: 0 9px 24px rgba(30,41,59,.15), 0 0 0 6px #eef3f9; display: flex; align-items: center; justify-content: center;
  transition: transform .2s ease, box-shadow .2s ease; }
.st-node svg { width: 35px; height: 35px; stroke: var(--c); }
.station:hover .st-node, .station.open .st-node { transform: translateY(-5px) scale(1.05); box-shadow: 0 16px 30px rgba(30,41,59,.22), 0 0 0 6px #fff; }
.st-badge { position: absolute; top: -11px; left: -11px; width: 25px; height: 25px; border-radius: 50%; background: var(--c); color: #fff;
  font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 7px rgba(0,0,0,.22); }
.st-label { margin-top: 15px; background: none; border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; color: #1e293b;
  display: inline-flex; align-items: center; gap: 5px; text-align: center; }
.st-caret { font-size: 10px; color: var(--c); transition: transform .2s ease; }
.station.open .st-caret { transform: rotate(180deg); }

/* Déroulé des pages */
.st-drop { position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); width: 200px; z-index: 10;
  background: #fff; border: 1px solid #e2e8f0; border-top: 3px solid var(--c); border-radius: 13px; padding: 8px; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 18px 40px rgba(30,41,59,.22); }
.st-drop::before { content: ''; position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 14px; height: 14px; background: #fff; border-left: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; }
.st-page { background: none; border: none; text-align: left; cursor: pointer; font: inherit; font-size: 13px; color: #334155; padding: 9px 11px; border-radius: 8px; transition: background .12s ease, color .12s ease, padding .12s ease; }
.st-page:hover { background: #f1f5f9; color: #0f172a; padding-left: 15px; }

.drop-enter-active, .drop-leave-active { transition: opacity .16s ease, transform .16s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 880px) {
  .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; } .ph-sub { display: none; }
  .ligne-wrap { padding: 24px 18px 40px; min-height: 0; }
  .conveyor { display: none; }
  .stations { flex-direction: column; align-items: stretch; gap: 12px; }
  .station { align-items: stretch; }
  .st-node { width: 54px; height: 54px; border-radius: 14px; } .st-node svg { width: 24px; height: 24px; }
  .station { flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; }
  .st-label { margin-top: 0; }
  .st-drop { position: static; transform: none; width: 100%; margin-top: 6px; }
  .st-drop::before { display: none; }
  .drop-enter-from, .drop-leave-to { transform: translateY(-6px); }
}
@media (prefers-reduced-motion: reduce) { .belt, .sweep, .batch, .ph-status i { animation: none; } }
</style>
