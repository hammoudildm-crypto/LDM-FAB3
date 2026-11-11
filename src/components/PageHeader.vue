<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'

// Palette d'accents par page (cohérente avec le tableau de bord)
const TONES = {
  teal: '#0f766e', indigo: '#4338ca', amber: '#b45309', blue: '#2563eb',
  green: '#059669', violet: '#7c3aed', slate: '#475569', rose: '#be123c', cyan: '#0891b2'
}
const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  tone: { type: String, default: 'teal' } // clé de TONES ou hex direct
})
const accent = computed(() => TONES[props.tone] || props.tone)
// Ouvrir la page courante en fenêtre flottante dans l'app (déplaçable, sans rechargement)
const route = useRoute()
const ouvrirFenetre = inject('ouvrirFenetre', null)
const dansFenetre = inject('dansFenetreFlottante', false)   // vrai si CE PageHeader est déjà dans une fenêtre
function popOut() { if (ouvrirFenetre) ouvrirFenetre(route.fullPath, props.title, accent.value) }
</script>

<template>
  <header class="page-header">
    <div class="ph-left">
      <h1 class="ph-title"><span class="ph-dot" :style="{ background: accent }"></span>{{ title }}</h1>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
    </div>
    <div class="ph-end">
      <div class="ph-actions"><slot /></div>
      <div v-if="!dansFenetre && ouvrirFenetre" class="ph-win">
        <button class="ph-win-b ph-win-new" @click="popOut" title="Ouvrir cette page en fenêtre flottante">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7.5" width="12" height="11" rx="1.6"/><path d="M8 7.5V6a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H16"/></svg>
          <span class="ph-win-txt">Fenêtre</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 20px; }
.ph-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; line-height: 1.1; }
.ph-dot { display: inline-block; width: 13px; height: 13px; border-radius: 4px; margin-right: 11px; flex-shrink: 0; }
.ph-sub { margin: 6px 0 0; color: #64748b; font-size: 14px; max-width: 900px; }
.ph-end { display: flex; align-items: center; gap: 14px; }
.ph-actions { display: flex; align-items: flex-end; gap: 12px; }
.ph-win { display: flex; align-items: center; flex-shrink: 0; }
.ph-win-b { height: 30px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; background: #f0fdfa; color: #0f766e; border: 1px solid #99f6e4; border-radius: 8px; cursor: pointer; font-size: 12.5px; font-weight: 700; line-height: 1; transition: all .15s; }
.ph-win-b:hover { background: #0f766e; border-color: #0f766e; color: #fff; }
.ph-win-txt { white-space: nowrap; }
@media (max-width: 640px) { .ph-win-txt { display: none; } .ph-win-b { padding: 0 9px; } }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ph-win-b { background: #0e2a29; border-color: #115e59; color: #5eead4; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ph-win-b:hover { background: #0f766e; color: #fff; }
.ph-actions :deep(select) { font-size: 14px; padding: 8px 13px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-weight: 600; color: #1b2733; cursor: pointer; min-width: 110px; }
html[data-theme="sombre"] .ph-sub { color: #94a3b8; }
@media (max-width: 640px) { .ph-title { font-size: 22px; } }
</style>
