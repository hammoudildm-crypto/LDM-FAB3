<template>
  <div class="form-page">
    <PageHeader title="Formations — Enregistrements" tone="#0d9488"
      subtitle="Formations suivies par le personnel, avec date d'expiration et état calculés automatiquement." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head"><h2 class="card-title">{{ form.id ? 'Modifier l\'enregistrement' : 'Nouvel enregistrement' }}</h2></div>
      <div v-if="peutEditer" class="form-row">
        <select v-model="form.personne_id" class="grow"><option value="">Personne —</option><option v-for="p in personnes" :key="p.id" :value="String(p.id)">{{ p.nom }}{{ p.matricule ? ' · #' + p.matricule : '' }}{{ p.fonction ? ' — ' + p.fonction : '' }}</option></select>
        <select v-model="form.formation_id" class="grow"><option value="">Formation —</option><option v-for="f in formations" :key="f.id" :value="String(f.id)">{{ f.nom }}</option></select>
        <input type="date" v-model="form.date_formation" />
        <input v-model="form.formateur" placeholder="Formateur" class="c" />
        <select v-model="form.resultat" class="res"><option value="acquis">Acquis</option><option value="non acquis">Non acquis</option></select>
        <div class="acts"><button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="form.id" class="btn ghost" @click="reset">Annuler</button></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Enregistrements</h2>
        <span class="count">{{ enrFiltres.length }}</span>
        <select v-model="filtrePersonne" class="filtre" style="margin-left:auto"><option value="">Toutes les personnes</option><option v-for="p in personnes" :key="p.id" :value="String(p.id)">{{ p.nom }}</option></select>
      </div>
      <div v-if="!enrFiltres.length" class="empty-card">Aucun enregistrement. Ajoute une formation suivie ci-dessus.</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Personne</th><th>Formation</th><th>Date</th><th>Formateur</th><th>Résultat</th><th>Expiration</th><th>État</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
        <tbody>
          <tr v-for="e in enrFiltres" :key="e.id" :class="{ 'row-ko': e.statut === 'expire' || e.resultat === 'non acquis' }">
            <td class="nom">{{ e.personneNom }}</td>
            <td>{{ e.formationNom }}</td>
            <td>{{ e.date_formation }}</td>
            <td>{{ e.formateur || '—' }}</td>
            <td><span :class="e.resultat === 'acquis' ? 'c-ok' : 'c-ko'">{{ e.resultat === 'acquis' ? '✓ Acquis' : '✗ Non acquis' }}</span></td>
            <td>{{ e.expiration || 'Permanent' }}</td>
            <td><span class="etat" :class="'e-' + e.statut">{{ statutTxt(e) }}</span></td>
            <td v-if="peutEditer" class="act"><button @click="modifier(e)" title="Modifier">✎</button><button @click="supprimer(e)" title="Supprimer">🗑</button></td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const personnes = ref([])
const formations = ref([])
const enregistrements = ref([])
const filtrePersonne = ref('')
const erreur = ref('')
const message = ref('')
const form = reactive({ id: null, personne_id: '', formation_id: '', date_formation: new Date().toISOString().slice(0, 10), formateur: '', resultat: 'acquis' })
function reset() { Object.assign(form, { id: null, personne_id: '', formation_id: '', date_formation: new Date().toISOString().slice(0, 10), formateur: '', resultat: 'acquis' }) }

async function charger() {
  const rp = await supabase.from('organigramme').select('id, nom, matricule, fonction').eq('actif', true).order('nom')
  if (!rp.error) personnes.value = rp.data || []
  const rf = await supabase.from('formations').select('id, nom, categorie, validite_mois').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const re = await supabase.from('formation_enregistrements').select('*').order('date_formation', { ascending: false })
  if (re.error) { erreur.value = re.error.message; return }
  enregistrements.value = re.data || []
}
onMounted(charger)

const personneById = computed(() => { const m = {}; for (const p of personnes.value) m[p.id] = p; return m })
const formationById = computed(() => { const m = {}; for (const f of formations.value) m[f.id] = f; return m })

function addMonths(dateStr, m) { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10) }
const today = new Date().toISOString().slice(0, 10)
const dans60 = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10) })()

const enrEnrichis = computed(() => enregistrements.value.map(e => {
  const p = personneById.value[e.personne_id]
  const f = formationById.value[e.formation_id]
  const exp = (f && f.validite_mois && e.date_formation) ? addMonths(e.date_formation, f.validite_mois) : null
  let statut = 'permanent'
  if (exp) statut = exp < today ? 'expire' : (exp <= dans60 ? 'bientot' : 'valide')
  return { ...e, personneNom: p ? p.nom : '(personne supprimée)', formationNom: f ? f.nom : '(formation supprimée)', expiration: exp, statut }
}))
const enrFiltres = computed(() => filtrePersonne.value ? enrEnrichis.value.filter(e => String(e.personne_id) === filtrePersonne.value) : enrEnrichis.value)

function statutTxt(e) { if (e.resultat === 'non acquis') return '✗ Non acquis'; if (e.statut === 'valide') return '✓ Valide'; if (e.statut === 'bientot') return '⚠ Expire bientôt'; if (e.statut === 'expire') return '✗ Expiré'; return 'Permanent' }

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.personne_id) { erreur.value = 'Choisis une personne.'; return }
  if (!form.formation_id) { erreur.value = 'Choisis une formation.'; return }
  if (!form.date_formation) { erreur.value = 'La date est requise.'; return }
  const payload = { personne_id: Number(form.personne_id), formation_id: Number(form.formation_id), date_formation: form.date_formation, formateur: form.formateur || null, resultat: form.resultat }
  let r
  if (form.id) r = await supabase.from('formation_enregistrements').update(payload).eq('id', form.id)
  else r = await supabase.from('formation_enregistrements').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = form.id ? 'Enregistrement mis à jour.' : 'Enregistrement ajouté.'
  reset(); await charger()
}
function modifier(e) { Object.assign(form, { id: e.id, personne_id: String(e.personne_id), formation_id: String(e.formation_id), date_formation: e.date_formation, formateur: e.formateur || '', resultat: e.resultat || 'acquis' }) }
async function supprimer(e) {
  if (!confirm('Supprimer cet enregistrement ?')) return
  const r = await supabase.from('formation_enregistrements').delete().eq('id', e.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Enregistrement supprimé.'; await charger()
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

.form-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.form-row select, .form-row input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.form-row .grow { flex: 1; min-width: 180px; }
.form-row .c { width: 150px; }
.form-row .res { width: 120px; }
.form-row select:focus, .form-row input:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.15); }
.form-row .acts { display: flex; gap: 8px; }
.filtre { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; }

.form-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.form-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.form-tbl th.r { text-align: right; }
.form-tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.form-tbl td.nom { font-weight: 700; color: #0f172a; }
.form-tbl td.act { text-align: right; white-space: nowrap; }
.form-tbl td.act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.form-tbl td.act button:hover { background: #f8fafc; border-color: #cbd5e1; }
.form-tbl tbody tr:hover { background: #f0fdfa; }
.form-tbl tr.row-ko { background: #fef2f2; }
.form-tbl tr.row-ko:hover { background: #fee2e2; }
.c-ok { color: #16a34a; font-weight: 700; }
.c-ko { color: #dc2626; font-weight: 700; }
.etat { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.e-valide { background: #dcfce7; color: #166534; }
.e-bientot { background: #fef3c7; color: #92400e; }
.e-expire { background: #fee2e2; color: #b91c1c; }
.e-permanent { background: #f1f5f9; color: #64748b; }
</style>
