<script setup>
import { computed, inject } from 'vue'

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
// Boutons façon fenêtre (réduire / agrandir / fermer), fournis par App.vue — propres à chaque page
const focusMode = inject('focusMode', null)
const fenetreCtrl = inject('fenetreCtrl', null)
</script>

<template>
  <header class="page-header">
    <div class="ph-left">
      <h1 class="ph-title"><span class="ph-dot" :style="{ background: accent }"></span>{{ title }}</h1>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
    </div>
    <div class="ph-end">
      <div class="ph-actions"><slot /></div>
      <div v-if="fenetreCtrl" class="ph-win">
        <button class="ph-win-b" :disabled="!focusMode" @click="fenetreCtrl.reduire()" title="Réduire">−</button>
        <button class="ph-win-b" :class="{ on: focusMode }" @click="fenetreCtrl.agrandir()" title="Agrandir (plein écran — Échap pour quitter)">☐</button>
        <button class="ph-win-b ph-win-x" @click="fenetreCtrl.fermer()" title="Fermer (page précédente)">✕</button>
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
.ph-win { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
.ph-win-b { width: 32px; height: 28px; display: inline-flex; align-items: center; justify-content: center; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 7px; cursor: pointer; font-size: 13px; line-height: 1; transition: all .15s; }
.ph-win-b:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
.ph-win-b:disabled { opacity: .4; cursor: default; }
.ph-win-b.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.ph-win-x:hover:not(:disabled) { background: #dc2626; border-color: #dc2626; color: #fff; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ph-win-b { background: #1e293b; border-color: #334155; color: #cbd5e1; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ph-win-b:hover:not(:disabled) { background: #334155; color: #fff; }
.ph-actions :deep(select) { font-size: 14px; padding: 8px 13px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-weight: 600; color: #1b2733; cursor: pointer; min-width: 110px; }
html[data-theme="sombre"] .ph-sub { color: #94a3b8; }
@media (max-width: 640px) { .ph-title { font-size: 22px; } }
</style>
