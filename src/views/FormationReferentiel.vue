<template>
  <div class="form-page">
    <PageHeader title="Formations — Référentiel" tone="#0d9488"
      subtitle="Formations et qualifications du personnel, avec leur catégorie et leur durée de validité." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Formations</h2>
        <span class="count">{{ formations.length }}</span>
        <button v-if="peutEditer && !formations.length" class="btn" style="margin-left:auto" @click="chargerStandard">Charger le référentiel standard</button>
      </div>

      <datalist id="catsListe"><option v-for="c in CATS" :key="c" :value="c" /></datalist>

      <div v-if="peutEditer" class="form-row">
        <input v-model="form.nom" placeholder="Formation *" class="grow" />
        <input v-model="form.categorie" list="catsListe" placeholder="Catégorie" class="c" />
        <input v-model.number="form.validite_mois" type="number" min="0" placeholder="Validité (mois)" class="v" />
        <div class="acts">
          <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="form.id" class="btn ghost" @click="reset">Annuler</button>
        </div>
      </div>

      <div v-if="!formations.length" class="empty-card">Aucune formation. Clique « Charger le référentiel standard » ci-dessus, ou ajoute-les une par une.</div>

      <div v-for="cat in categories" :key="cat || '—'" class="form-cat">
        <h3 class="form-cat-titre">{{ cat || 'Sans catégorie' }}</h3>
        <table class="form-tbl">
          <thead><tr><th>Formation</th><th>Validité</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
          <tbody>
            <tr v-for="f in formationsDe(cat)" :key="f.id">
              <td class="nom">{{ f.nom }}</td>
              <td><span v-if="f.validite_mois" class="val">{{ f.validite_mois }} mois</span><span v-else class="perm">Permanent</span></td>
              <td v-if="peutEditer" class="act">
                <button @click="modifier(f)" title="Modifier">✎</button>
                <button @click="supprimer(f)" title="Supprimer">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const CATS = ['BPF', 'Hygiène', 'Sécurité', 'Procédé', 'Documentation', 'Équipement']
const STANDARD = [
  ['Bonnes Pratiques de Fabrication (BPF)', 'BPF', 12],
  ['Data Integrity (ALCOA+)', 'BPF', 12],
  ['Gestion des déviations', 'BPF', 24],
  ['Hygiène du personnel', 'Hygiène', 12],
  ['Habillage / Déshabillage zone propre', 'Hygiène', 12],
  ['Sécurité au poste de travail', 'Sécurité', 24],
  ['Prévention incendie', 'Sécurité', 24],
  ['Nettoyage et désinfection (SOP)', 'Procédé', 12],
  ['Pesée des matières premières', 'Procédé', null],
  ['Remplissage du dossier de lot', 'Documentation', 24],
  ['Conduite d\'équipement', 'Équipement', null]
]

const formations = ref([])
const erreur = ref('')
const message = ref('')
const form = reactive({ id: null, nom: '', categorie: '', validite_mois: null })
function reset() { Object.assign(form, { id: null, nom: '', categorie: '', validite_mois: null }) }

async function charger() {
  const r = await supabase.from('formations').select('*').eq('actif', true).order('ordre')
  if (r.error) { erreur.value = r.error.message; return }
  formations.value = r.data || []
}
onMounted(charger)

const catIndex = (c) => { const i = CATS.indexOf(c); return i >= 0 ? i : 999 }
const categories = computed(() => [...new Set(formations.value.map(f => f.categorie || ''))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (catIndex(a) - catIndex(b)) || a.localeCompare(b))))
function formationsDe(cat) { return formations.value.filter(f => (f.categorie || '') === cat).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id) }

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.nom.trim()) { erreur.value = 'Le nom de la formation est requis.'; return }
  const payload = { nom: form.nom.trim(), categorie: form.categorie || null, validite_mois: (form.validite_mois === '' || form.validite_mois == null) ? null : Number(form.validite_mois) }
  let r
  if (form.id) r = await supabase.from('formations').update(payload).eq('id', form.id)
  else r = await supabase.from('formations').insert({ ...payload, ordre: formations.value.length })
  if (r.error) { erreur.value = r.error.message; return }
  message.value = form.id ? 'Formation mise à jour.' : 'Formation ajoutée.'
  reset(); await charger()
}
function modifier(f) { Object.assign(form, { id: f.id, nom: f.nom, categorie: f.categorie || '', validite_mois: f.validite_mois }) }
async function supprimer(f) {
  if (!confirm('Supprimer la formation « ' + f.nom + ' » ?')) return
  const r = await supabase.from('formations').update({ actif: false }).eq('id', f.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Formation supprimée.'; await charger()
}
async function chargerStandard() {
  erreur.value = ''; message.value = ''
  const rows = STANDARD.map((s, i) => ({ nom: s[0], categorie: s[1] || null, validite_mois: s[2], ordre: i }))
  const r = await supabase.from('formations').insert(rows)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Référentiel standard chargé (' + rows.length + ' formations).'; await charger()
}
</script>

<style scoped>
.form-page { color: #1b2733; zoom: 0.9; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.btn { background: #0d9488; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }

.form-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; align-items: center; }
.form-row input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.form-row input.grow { flex: 1; min-width: 200px; }
.form-row input.c { width: 150px; }
.form-row input.v { width: 120px; }
.form-row input:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.15); }
.form-row .acts { display: flex; gap: 8px; }

.form-cat { margin-top: 16px; }
.form-cat-titre { margin: 0 0 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #0d9488; border-left: 3px solid #0d9488; padding-left: 8px; }
.form-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.form-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.form-tbl th.r { text-align: right; }
.form-tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.form-tbl td.nom { font-weight: 700; color: #0f172a; }
.form-tbl td.act { text-align: right; white-space: nowrap; }
.form-tbl td.act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.form-tbl td.act button:hover { background: #f8fafc; border-color: #cbd5e1; }
.form-tbl tbody tr:hover { background: #f0fdfa; }
.val { font-weight: 600; color: #0f766e; }
.perm { color: #94a3b8; font-size: 12px; }
</style>
