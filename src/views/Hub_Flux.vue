<template>
  <div class="hub">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="flow-wrap">
      <div class="hint">Flux de production &middot; de la configuration au pilotage</div>
      <ol class="flow">
        <li v-for="(g, i) in flux" :key="g.label" class="step" :class="{ last: i === flux.length - 1 }" :style="{ '--c': g.c }">
          <div class="step-rail">
            <span class="step-num">{{ i + 1 }}</span>
          </div>
          <div class="step-card">
            <div class="step-head">
              <span class="step-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
              <h2 class="step-title">{{ g.label }}</h2>
              <span class="step-count">{{ g.links.length }} pages</span>
            </div>
            <div class="step-chips">
              <button v-for="l in g.links" :key="l[0]" class="chip" @click="aller(l[0])">{{ l[1] }}</button>
            </div>
          </div>
        </li>
      </ol>
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

.flow-wrap { padding: 24px 42px 60px; max-width: 900px; margin: 0 auto; }
.hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 26px; }

.flow { list-style: none; margin: 0; padding: 0; }
.step { position: relative; display: grid; grid-template-columns: 52px 1fr; gap: 18px; padding-bottom: 18px; }

/* Rail vertical + numéro */
.step-rail { position: relative; display: flex; justify-content: center; }
.step-num { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 2px solid var(--c); color: var(--c);
  font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; z-index: 2;
  box-shadow: 0 4px 12px rgba(30,41,59,.12); }
.step:not(.last) .step-rail::after { content: ''; position: absolute; top: 40px; bottom: -18px; left: 50%; transform: translateX(-50%);
  width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 30%, #e2e8f0)); border-radius: 3px; z-index: 1; }

/* Carte de l'étape */
.step-card { background: #fff; border: 1px solid #e6ecf3; border-radius: 16px; padding: 14px 18px 16px;
  box-shadow: 0 2px 8px rgba(30,41,59,.05); border-left: 4px solid var(--c); }
.step-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.step-ic { width: 40px; height: 40px; border-radius: 11px; flex: none; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); }
.step-ic svg { width: 23px; height: 23px; stroke: var(--c); }
.step-title { flex: 1; margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
.step-count { flex: none; font-size: 10.5px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 12%, #fff);
  border-radius: 20px; padding: 3px 10px; text-transform: uppercase; letter-spacing: .04em; }

.step-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { background: #f6f8fb; border: 1px solid #e2e8f0; border-radius: 9px; cursor: pointer; font: inherit; font-size: 12.5px;
  font-weight: 600; color: #334155; padding: 7px 13px; transition: all .12s ease; }
.chip:hover { background: color-mix(in srgb, var(--c) 12%, #fff); border-color: var(--c); color: var(--c); transform: translateY(-1px); }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

@media (max-width: 880px) {
  .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; } .ph-sub { display: none; }
  .flow-wrap { padding: 20px 16px 40px; }
  .step { grid-template-columns: 40px 1fr; gap: 12px; }
  .step-num { width: 32px; height: 32px; font-size: 14px; }
  .step:not(.last) .step-rail::after { top: 32px; }
}
@media (prefers-reduced-motion: reduce) { .ph-status i { animation: none; } .chip { transition: none; } }
</style>
