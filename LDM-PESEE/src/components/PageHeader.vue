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
      <h1 class="ph-title">
        <svg class="ph-logo" viewBox="0 0 512 512" aria-hidden="true">
          <defs>
            <linearGradient id="phLogoBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#6366f1"/>
              <stop offset="1" stop-color="#4338ca"/>
            </linearGradient>
            <clipPath id="phLogoCap"><rect x="106" y="130" width="300" height="58" rx="29"/></clipPath>
          </defs>
          <rect x="0" y="0" width="512" height="512" rx="116" fill="url(#phLogoBg)"/>
          <g fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
            <line x1="140" y1="188" x2="140" y2="250"/>
            <line x1="372" y1="188" x2="372" y2="250"/>
            <path d="M78 250 Q140 312 202 250"/>
            <path d="M310 250 Q372 312 434 250"/>
            <line x1="182" y1="392" x2="330" y2="392"/>
          </g>
          <rect x="243" y="176" width="26" height="206" rx="13" fill="#fff"/>
          <rect x="106" y="130" width="300" height="58" rx="29" fill="#fff"/>
          <rect x="256" y="130" width="150" height="58" fill="#c7d2fe" clip-path="url(#phLogoCap)"/>
          <rect x="252" y="130" width="8" height="58" fill="#4338ca" opacity="0.35"/>
        </svg>
        <span class="ph-ttl">{{ title }}</span>
      </h1>
      <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
    </div>
    <div class="ph-actions"><slot /></div>
  </header>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 20px; }
.ph-title { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; line-height: 1.1; }
.ph-logo { width: 42px; height: 42px; margin-right: 13px; flex-shrink: 0; border-radius: 11px; box-shadow: 0 2px 6px rgba(67,56,202,.28); }
.ph-ttl { min-width: 0; }
.ph-sub { margin: 6px 0 0; color: #64748b; font-size: 14px; max-width: 900px; }
.ph-actions { display: flex; align-items: flex-end; gap: 12px; }
.ph-actions :deep(select) { font-size: 14px; padding: 8px 13px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-weight: 600; color: #1b2733; cursor: pointer; min-width: 110px; }
html[data-theme="sombre"] .ph-sub { color: #94a3b8; }
@media (max-width: 640px) { .ph-title { font-size: 22px; } .ph-logo { width: 36px; height: 36px; border-radius: 9px; } }
</style>
