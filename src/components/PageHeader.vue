<script setup>
import { computed } from 'vue'

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
</script>

<template>
  <header class="page-header">
    <div class="ph-left">
      <h1 class="ph-title"><span class="ph-dot" :style="{ background: accent }"></span>{{ title }}</h1>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
    </div>
    <div class="ph-actions"><slot /></div>
  </header>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 20px; }
.ph-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; line-height: 1.1; }
.ph-dot { display: inline-block; width: 13px; height: 13px; border-radius: 4px; margin-right: 11px; flex-shrink: 0; }
.ph-sub { margin: 6px 0 0; color: #64748b; font-size: 14px; max-width: 900px; }
.ph-actions { display: flex; align-items: flex-end; gap: 12px; }
.ph-actions :deep(select) { font-size: 14px; padding: 8px 13px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-weight: 600; color: #1b2733; cursor: pointer; min-width: 110px; }
html[data-theme="sombre"] .ph-sub { color: #94a3b8; }
@media (max-width: 640px) { .ph-title { font-size: 22px; } }
</style>
