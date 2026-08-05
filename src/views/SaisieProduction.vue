<template>
  <div class="sp-stack">
    <SuiviPhases />
    <div class="sp-sep"><span>Saisie TRS<template v-if="lotPartage.numeroLot"> — lot {{ lotPartage.numeroLot }} reporté</template></span></div>
    <SaisieTRS />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue'
import SuiviPhases from './SuiviPhases.vue'
import SaisieTRS from './SaisieTRS.vue'
const lotPartage = ref({ produitId: '', numeroLot: '' })
provide('lotPartage', lotPartage)
</script>

<style scoped>
.sp-stack { display: flex; flex-direction: column; }
.sp-sep { display: flex; align-items: center; gap: 14px; margin: 10px 24px 0; }
.sp-sep::before, .sp-sep::after { content: ''; flex: 1; height: 2px; background: #e2e8f0; border-radius: 2px; }
.sp-sep span { font-size: 12.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; white-space: nowrap; }
</style>
