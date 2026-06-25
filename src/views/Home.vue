<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const items = ref([])
const label = ref('')
const errorMsg = ref('')

async function load() {
  errorMsg.value = ''
  const res = await supabase
    .from('ma_table')
    .select('*')
    .order('created_at', { ascending: false })
  // Convention : on ne throw jamais, on vérifie res.error après CHAQUE appel.
  if (res.error) {
    errorMsg.value = res.error.message
    return
  }
  items.value = res.data
}

async function add() {
  errorMsg.value = ''
  if (!label.value.trim()) return
  const res = await supabase.from('ma_table').insert({ label: label.value.trim() })
  if (res.error) {
    errorMsg.value = res.error.message
    return
  }
  label.value = ''
  await load()
}
</script>

<template>
  <h1>Accueil</h1>
  <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

  <div style="display:flex; gap:8px; margin:12px 0;">
    <input v-model="label" placeholder="Nouveau label" @keyup.enter="add" />
    <button type="button" @click="add">Ajouter</button>
  </div>

  <ul>
    <li v-for="it in items" :key="it.id">{{ it.label }}</li>
  </ul>
  <p v-if="!items.length && !errorMsg" style="color:#6b7280;">
    Aucune donnée (connecte-toi et vérifie que la table + les policies RLS existent).
  </p>
</template>
