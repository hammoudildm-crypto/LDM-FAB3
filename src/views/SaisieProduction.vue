<template>
  <div class="sp-wrap">
    <div class="sp-tabs">
      <button type="button" :class="{ on: onglet === 'fab' }" @click="onglet = 'fab'">Suivi fabrication</button>
      <button type="button" :class="{ on: onglet === 'trs' }" @click="onglet = 'trs'">Saisie TRS</button>
    </div>
    <div class="sp-body">
      <SuiviPhases v-if="onglet === 'fab'" />
      <SaisieTRS v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SuiviPhases from './SuiviPhases.vue'
import SaisieTRS from './SaisieTRS.vue'
const onglet = ref('fab')
</script>

<style scoped>
.sp-tabs { display: flex; gap: 8px; padding: 16px 24px 0; }
.sp-tabs button {
  background: #fff; border: 1px solid #cbd5e1; border-bottom: none;
  border-radius: 10px 10px 0 0; font: inherit; font-size: 14px; font-weight: 600;
  padding: 11px 22px; cursor: pointer; color: #475569;
}
.sp-tabs button.on { background: #0f766e; color: #fff; border-color: #0f766e; }
.sp-body { margin-top: -1px; }
</style>
