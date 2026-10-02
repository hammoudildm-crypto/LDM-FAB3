<template>
  <div class="pqr-page">
    <PageHeader title="Référentiel PQR — Paramètres critiques" tone="#a855f7"
      subtitle="Paramètres critiques suivis pour chaque phase de production, avec leurs limites par défaut ou par produit." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Paramètres par phase</h2>
        <span class="count">{{ params.length }}</span>
        <input v-model="recherche" class="pqr-search" placeholder="🔍 Rechercher un produit…" style="margin-left:auto" />
        <select v-model="produitSel" class="prod-sel">
          <option value="">Limites par défaut</option>
          <option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option>
        </select>
      </div>

      <!-- ===== MODE DÉFAUT : édition des paramètres + limites de référence ===== -->
      <template v-if="!produitSel">
        <div v-if="peutEditer && !params.length" style="margin-bottom:14px">
          <button class="btn" @click="chargerStandard">Charger le référentiel standard</button>
        </div>

        <div v-if="peutEditer" class="pqr-form">
          <select v-model="form.phase"><option value="">Phase —</option><option v-for="ph in PHASES_LISTE" :key="ph" :value="ph">{{ ph }}</option></select>
          <input v-model="form.nom" placeholder="Paramètre *" />
          <select v-model="form.type" class="t"><option value="num">Numérique</option><option value="bool">ON / OFF</option></select>
          <template v-if="form.type === 'num'">
          <input v-model="form.unite" list="unitesListe" placeholder="Unité" class="u" /><datalist id="unitesListe"><option v-for="u in UNITES" :key="u" :value="u" /></datalist>
          <input v-model.number="form.limite_min" type="number" step="any" placeholder="Min" class="n" />
          <input v-model.number="form.cible" type="number" step="any" placeholder="Cible" class="n" />
          <input v-model.number="form.limite_max" type="number" step="any" placeholder="Max" class="n" />
          </template>
          <select v-else v-model="form.etat_attendu" class="t"><option value="">État attendu —</option><option value="ON">Doit être ON</option><option value="OFF">Doit être OFF</option></select>
          <div class="pqr-actions">
            <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Ajouter' }}</button>
            <button v-if="form.id" class="btn ghost" @click="reset">Annuler</button>
          </div>
        </div>

        <div v-if="!params.length" class="empty-card">Aucun paramètre. Clique « Charger le référentiel standard » ci-dessus, ou ajoute-les un par un.</div>

        <div v-for="ph in phasesAvecParams" :key="ph" class="pqr-phase">
          <h3 class="pqr-phase-titre">{{ ph }}</h3>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Min</th><th class="r">Cible</th><th class="r">Max</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
            <tbody>
              <tr v-for="p in paramsDe(ph)" :key="p.id">
                <td class="nom">{{ p.nom }} <span v-if="p.type === 'bool'" class="tag-bool">ON/OFF</span></td>
                <td>{{ p.type === 'bool' ? '—' : (p.unite || '—') }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(p.limite_min) }}</td>
                <td class="r cible">{{ p.type === 'bool' ? (p.etat_attendu ? 'Attendu : ' + p.etat_attendu : 'ON/OFF') : fmt(p.cible) }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(p.limite_max) }}</td>
                <td v-if="peutEditer" class="act">
                  <button @click="modifier(p)" title="Modifier">✎</button>
                  <button @click="supprimer(p)" title="Supprimer">🗑</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ===== MODE PRODUIT : specs spécifiques (héritent du défaut si vide) ===== -->
      <template v-else>
        <p class="pqr-note">Specs pour <b>{{ produitNom }}</b>. Laisse une case <b>vide</b> pour hériter de la valeur par défaut (affichée en gris « déf. »).</p>

        <div v-if="!params.length" class="empty-card">Le référentiel est vide. Reviens en « Limites par défaut » pour le remplir d'abord.</div>

        <div v-for="ph in phasesAvecParams" :key="ph" class="pqr-phase">
          <h3 class="pqr-phase-titre">{{ ph }}</h3>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Min</th><th class="r">Cible</th><th class="r">Max</th></tr></thead>
            <tbody>
              <tr v-for="p in paramsDe(ph)" :key="p.id">
                <td class="nom">{{ p.nom }} <span v-if="p.type === 'bool'" class="tag-bool">ON/OFF</span></td>
                <td>{{ p.type === 'bool' ? '—' : (p.unite || '—') }}</td>
                <template v-if="p.type === 'bool'">
                  <td class="r bool-na" colspan="3">Pas de spec par produit (défini au référentiel)</td>
                </template>
                <template v-else>
                  <td class="r"><input class="spec-in" v-model="specsEdit[p.id].min" type="number" step="any" :placeholder="phDef(p.limite_min)" :disabled="!peutEditer" /></td>
                  <td class="r"><input class="spec-in" v-model="specsEdit[p.id].cible" type="number" step="any" :placeholder="phDef(p.cible)" :disabled="!peutEditer" /></td>
                  <td class="r"><input class="spec-in" v-model="specsEdit[p.id].max" type="number" step="any" :placeholder="phDef(p.limite_max)" :disabled="!peutEditer" /></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="peutEditer && params.length" style="margin-top:16px; display:flex; gap:8px">
          <button class="btn" @click="enregistrerSpecs">💾 Enregistrer les specs de ce produit</button>
          <button class="btn ghost" @click="produitSel = ''">Revenir au défaut</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
const UNITES = ['N', 'Kp', 'mg', 'g', 'kg', '°C', '%', 'min', 'mm', 'tr/min', 'bar']
const STANDARD = [
  ['Pesée', 'Écart de pesée', '%'],
  ['Granulation et Séchage', 'Température produit', '°C'],
  ['Granulation et Séchage', 'Humidité résiduelle (LOD)', '%'],
  ['Granulation et Séchage', 'Temps de granulation', 'min'],
  ['Mélange', 'Temps de mélange', 'min'],
  ['Mélange', 'Vitesse', 'tr/min'],
  ['Mélange', 'Homogénéité (teneur)', '%'],
  ['Compression', 'Dureté', 'N'],
  ['Compression', 'Poids moyen', 'mg'],
  ['Compression', 'Uniformité de masse (RSD)', '%'],
  ['Compression', 'Épaisseur', 'mm'],
  ['Compression', 'Friabilité', '%'],
  ['Compression', 'Désagrégation', 'min'],
  ['Remplissage Gélules', 'Poids moyen', 'mg'],
  ['Remplissage Gélules', 'Uniformité de masse (RSD)', '%'],
  ['Remplissage Gélules', 'Désagrégation', 'min'],
  ['Pelliculage', 'Gain de masse', '%'],
  ['Pelliculage', 'Température', '°C'],
  ['Pelliculage', 'Aspect', '']
]

const params = ref([])
const produits = ref([])
const produitSel = ref('')
const specsEdit = ref({})
const erreur = ref('')
const message = ref('')
const recherche = ref('')
const form = reactive({ id: null, phase: '', nom: '', unite: '', type: 'num', etat_attendu: '', limite_min: null, cible: null, limite_max: null })
function reset() { Object.assign(form, { id: null, phase: '', nom: '', unite: '', type: 'num', etat_attendu: '', limite_min: null, cible: null, limite_max: null }) }

async function charger() {
  const r = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (r.error) { erreur.value = r.error.message; return }
  params.value = r.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
}
onMounted(charger)

const normR = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const produitsFiltres = computed(() => { const q = normR(recherche.value).trim(); if (!q) return produits.value; return produits.value.filter(pr => normR((pr.code_pf || '') + ' ' + (pr.designation || '')).includes(q)) })
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecParams = computed(() => [...new Set(params.value.map(p => p.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
function paramsDe(ph) { return params.value.filter(p => p.phase === ph).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id) }
const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : v
const phDef = (v) => (v === null || v === undefined || v === '') ? '—' : ('déf. ' + v)
const produitNom = computed(() => { const p = produits.value.find(x => String(x.id) === produitSel.value); return p ? (p.code_pf + ' — ' + p.designation) : '' })

// Charger les surcharges du produit sélectionné (init synchrone puis remplissage)
watch(produitSel, async (pid) => {
  message.value = ''
  if (!pid) { reset(); return }
  const base = {}
  for (const p of params.value) base[p.id] = { min: '', cible: '', max: '' }
  specsEdit.value = base
  const r = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (r.error) { erreur.value = r.error.message; return }
  const by = {}
  for (const sp of (r.data || [])) by[sp.parametre_id] = sp
  const obj = {}
  for (const p of params.value) {
    const sp = by[p.id]
    obj[p.id] = {
      min: sp && sp.limite_min != null ? sp.limite_min : '',
      cible: sp && sp.cible != null ? sp.cible : '',
      max: sp && sp.limite_max != null ? sp.limite_max : ''
    }
  }
  specsEdit.value = obj
})

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.phase) { erreur.value = 'Choisis une phase.'; return }
  if (!form.nom.trim()) { erreur.value = 'Le nom du paramètre est requis.'; return }
  const bool = form.type === 'bool'
  const payload = { phase: form.phase, nom: form.nom.trim(), unite: bool ? null : (form.unite || null), type: form.type, etat_attendu: bool ? (form.etat_attendu || null) : null, limite_min: bool ? null : form.limite_min, cible: bool ? null : form.cible, limite_max: bool ? null : form.limite_max }
  let r
  if (form.id) r = await supabase.from('pqr_parametres').update(payload).eq('id', form.id)
  else r = await supabase.from('pqr_parametres').insert({ ...payload, ordre: params.value.length })
  if (r.error) { erreur.value = r.error.message; return }
  message.value = form.id ? 'Paramètre mis à jour.' : 'Paramètre ajouté.'
  reset(); await charger()
}
function modifier(p) { Object.assign(form, { id: p.id, phase: p.phase, nom: p.nom, unite: p.unite || '', type: p.type || 'num', etat_attendu: p.etat_attendu || '', limite_min: p.limite_min, cible: p.cible, limite_max: p.limite_max }) }
async function supprimer(p) {
  if (!confirm('Supprimer le paramètre « ' + p.nom + ' » ?')) return
  const r = await supabase.from('pqr_parametres').update({ actif: false }).eq('id', p.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Paramètre supprimé.'; await charger()
}
async function chargerStandard() {
  erreur.value = ''; message.value = ''
  const rows = STANDARD.map((s, i) => ({ phase: s[0], nom: s[1], unite: s[2] || null, ordre: i }))
  const r = await supabase.from('pqr_parametres').insert(rows)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Référentiel standard chargé (' + rows.length + ' paramètres).'; await charger()
}
async function enregistrerSpecs() {
  erreur.value = ''; message.value = ''
  const pid = Number(produitSel.value)
  const up = [], delIds = []
  const num = (v) => (v === '' || v === null || v === undefined) ? null : Number(v)
  for (const p of params.value) {
    if (p.type === 'bool') continue
    const e = specsEdit.value[p.id] || {}
    const mn = num(e.min), cb = num(e.cible), mx = num(e.max)
    if (mn == null && cb == null && mx == null) delIds.push(p.id)
    else up.push({ parametre_id: p.id, produit_id: pid, limite_min: mn, cible: cb, limite_max: mx })
  }
  if (up.length) {
    const r = await supabase.from('pqr_specs_produit').upsert(up, { onConflict: 'parametre_id,produit_id' })
    if (r.error) { erreur.value = r.error.message; return }
  }
  if (delIds.length) {
    const d = await supabase.from('pqr_specs_produit').delete().eq('produit_id', pid).in('parametre_id', delIds)
    if (d.error) { erreur.value = d.error.message; return }
  }
  message.value = 'Specs enregistrées pour ' + produitNom.value + '.'
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.prod-sel { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; max-width: 340px; }
.pqr-search { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 220px; }
.pqr-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.pqr-note { background: #faf5ff; border: 1px solid #e9d5ff; color: #6b21a8; padding: 9px 13px; border-radius: 8px; font-size: 13px; margin: 0 0 14px; }

.pqr-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; align-items: center; }
.pqr-form select, .pqr-form input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pqr-form input:not(.u):not(.n) { flex: 1; min-width: 160px; }
.pqr-form .u { width: 82px; }
.pqr-form .n { width: 78px; }
.pqr-form .t { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.tag-bool { font-size: 9px; font-weight: 800; background: #ecfeff; color: #0891b2; padding: 1px 6px; border-radius: 999px; vertical-align: middle; }
.bool-na { color: #94a3b8; font-style: italic; text-align: left !important; }
.pqr-actions { display: flex; gap: 8px; }

.pqr-phase { margin-top: 16px; }
.pqr-phase-titre { margin: 0 0 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; border-left: 3px solid #a855f7; padding-left: 8px; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.cible { color: #a855f7; font-weight: 700; }
.pqr-tbl td.act { text-align: right; white-space: nowrap; }
.pqr-tbl td.act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.pqr-tbl td.act button:hover { background: #f8fafc; border-color: #cbd5e1; }
.pqr-tbl tbody tr:hover { background: #faf5ff; }
.spec-in { width: 72px; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; background: #fff; color: #0f172a; font-variant-numeric: tabular-nums; }
.spec-in:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.spec-in::placeholder { color: #cbd5e1; font-style: italic; }
</style>
