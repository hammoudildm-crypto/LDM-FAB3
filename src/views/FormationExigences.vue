<template>
  <div class="form-page">
    <PageHeader title="Formations — Exigences par fonction" tone="#0d9488"
      subtitle="Définis les formations obligatoires pour chaque fonction. Les manques deviennent des écarts critiques dans la matrice." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Exigences</h2>
        <select v-model="fonctionSel" class="fct-sel" style="margin-left:auto">
          <option value="">Choisir une fonction —</option>
          <option v-for="f in fonctions" :key="f" :value="f">{{ f }}<span v-if="compteRequis[f]"> ({{ compteRequis[f] }})</span></option>
        </select>
      </div>

      <div v-if="!fonctions.length" class="empty-card">Aucune fonction trouvée dans l'organigramme. Ajoute des postes d'abord.</div>
      <div v-else-if="!formations.length" class="empty-card">Aucune formation au référentiel. Ajoute des formations d'abord.</div>
      <div v-else-if="!fonctionSel" class="empty-card">Choisis une fonction pour définir ses formations obligatoires.</div>

      <template v-else>
        <p class="hint">Coche les formations <b>obligatoires</b> pour la fonction <b>« {{ fonctionSel }} »</b>. Les autres resteront « non requises ».</p>
        <div v-for="cat in categories" :key="cat || '—'" class="exi-cat">
          <h3 class="exi-cat-titre">{{ cat || 'Sans catégorie' }}</h3>
          <label v-for="f in formationsDe(cat)" :key="f.id" class="exi-item" :class="{ on: requisSet[f.id] }">
            <input type="checkbox" v-model="requisSet[f.id]" :disabled="!peutEditer" />
            <span class="nom">{{ f.nom }}</span>
            <span v-if="f.validite_mois" class="val">{{ f.validite_mois }} mois</span>
            <span v-else class="perm">permanent</span>
          </label>
        </div>
        <div v-if="peutEditer" style="margin-top:16px; display:flex; gap:8px">
          <button class="btn" @click="enregistrer">💾 Enregistrer les exigences</button>
          <button class="btn ghost" @click="toutCocher(true)">Tout cocher</button>
          <button class="btn ghost" @click="toutCocher(false)">Tout décocher</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const CATS = ['BPF', 'Hygiène', 'Sécurité', 'Procédé', 'Documentation', 'Équipement']
const formations = ref([])
const fonctions = ref([])
const requises = ref([])
const fonctionSel = ref('')
const requisSet = ref({})
const erreur = ref('')
const message = ref('')

async function charger() {
  const rf = await supabase.from('formations').select('id, nom, categorie, validite_mois').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const ro = await supabase.from('organigramme').select('fonction').eq('actif', true)
  if (!ro.error) fonctions.value = [...new Set((ro.data || []).map(r => (r.fonction || '').trim()).filter(Boolean))].sort()
  const rr = await supabase.from('formation_requise').select('*')
  if (!rr.error) requises.value = rr.data || []
}
onMounted(charger)

const catIndex = (c) => { const i = CATS.indexOf(c); return i >= 0 ? i : 999 }
const categories = computed(() => [...new Set(formations.value.map(f => f.categorie || ''))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (catIndex(a) - catIndex(b)) || a.localeCompare(b))))
function formationsDe(cat) { return formations.value.filter(f => (f.categorie || '') === cat).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id) }
const compteRequis = computed(() => { const m = {}; for (const r of requises.value) m[r.fonction] = (m[r.fonction] || 0) + 1; return m })

watch(fonctionSel, (fn) => {
  const obj = {}
  for (const f of formations.value) obj[f.id] = false
  if (fn) for (const r of requises.value) if (r.fonction === fn) obj[r.formation_id] = true
  requisSet.value = obj
})
function toutCocher(v) { const obj = {}; for (const f of formations.value) obj[f.id] = v; requisSet.value = obj }

async function enregistrer() {
  erreur.value = ''; message.value = ''
  const fn = fonctionSel.value; if (!fn) return
  const up = [], delIds = []
  for (const f of formations.value) { if (requisSet.value[f.id]) up.push({ fonction: fn, formation_id: f.id }); else delIds.push(f.id) }
  if (up.length) { const r = await supabase.from('formation_requise').upsert(up, { onConflict: 'fonction,formation_id' }); if (r.error) { erreur.value = r.error.message; return } }
  if (delIds.length) { const d = await supabase.from('formation_requise').delete().eq('fonction', fn).in('formation_id', delIds); if (d.error) { erreur.value = d.error.message; return } }
  message.value = 'Exigences enregistrées pour « ' + fn + ' ».'
  const rr = await supabase.from('formation_requise').select('*'); if (!rr.error) requises.value = rr.data || []
}
</script>

<style scoped>
.form-page { color: #1b2733; zoom: 0.9; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 11px; }
.btn { background: #0d9488; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.fct-sel { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; min-width: 220px; }

.exi-cat { margin-top: 14px; }
.exi-cat-titre { margin: 0 0 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #0d9488; }
.exi-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid #eef2f6; border-radius: 8px; margin-bottom: 6px; cursor: pointer; font-size: 13px; }
.exi-item:hover { background: #f0fdfa; }
.exi-item.on { background: #f0fdfa; border-color: #99f6e4; }
.exi-item input { width: 16px; height: 16px; accent-color: #0d9488; cursor: pointer; }
.exi-item .nom { flex: 1; font-weight: 600; color: #0f172a; }
.exi-item .val { font-size: 11px; color: #0f766e; font-weight: 600; }
.exi-item .perm { font-size: 11px; color: #94a3b8; }
</style>
