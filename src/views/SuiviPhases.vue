<script setup>
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(true))

const PHASES = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Pelliculage', 'Conditionnement']
const STATUTS = ['À faire', 'En cours', 'Terminé']

const lots = ref([])
const equipements = ref([])
const lotId = ref('')
const phases = ref([])
const erreur = ref('')
const message = ref('')

const form = reactive({
  id: null, phase: 'Pesée', equipement_id: '', quantite_entree: '',
  quantite_sortie: '', date_phase: '', statut: 'Terminé', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, phase: 'Pesée', equipement_id: '', quantite_entree: '',
    quantite_sortie: '', date_phase: '', statut: 'Terminé', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

const lotSelectionne = computed(() => lots.value.find(l => l.id === lotId.value) || null)

async function chargerBase() {
  erreur.value = ''
  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, quantite_theorique, statut, produits(code_pf, designation)')
    .eq('actif', true).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const re = await supabase.from('equipements').select('id, code, nom').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data
}

async function chargerPhases() {
  phases.value = []
  message.value = ''
  if (!lotId.value) return
  erreur.value = ''
  const r = await supabase.from('suivi_phases')
    .select('*, equipements(code, nom)')
    .eq('ordre_id', lotId.value).eq('actif', true)
    .order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (r.error) { erreur.value = r.error.message; return }
  phases.value = r.data
}

function rendement(p) {
  const e = p.quantite_entree, s = p.quantite_sortie
  if (e == null || s == null || Number(e) === 0) return null
  return (Number(s) / Number(e)) * 100
}
const rendementGlobal = computed(() => {
  let r = 1, compte = 0
  for (const p of phases.value) {
    const rp = rendement(p)
    if (rp != null) { r *= rp / 100; compte++ }
  }
  return compte ? r * 100 : null
})

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!lotId.value) { erreur.value = 'Choisis d\'abord un lot.'; return }
  const payload = {
    ordre_id: lotId.value,
    phase: form.phase,
    equipement_id: form.equipement_id || null,
    quantite_entree: toNum(form.quantite_entree),
    quantite_sortie: toNum(form.quantite_sortie),
    date_phase: form.date_phase || null,
    statut: form.statut,
    commentaire: form.commentaire.trim() || null
  }
  const res = form.id
    ? await supabase.from('suivi_phases').update(payload).eq('id', form.id)
    : await supabase.from('suivi_phases').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Phase mise à jour.' : 'Phase ajoutée.'
  resetForm()
  await chargerPhases()
}
function modifier(p) {
  Object.assign(form, {
    id: p.id, phase: p.phase, equipement_id: p.equipement_id || '',
    quantite_entree: p.quantite_entree ?? '', quantite_sortie: p.quantite_sortie ?? '',
    date_phase: p.date_phase || '', statut: p.statut || 'Terminé', commentaire: p.commentaire || ''
  })
}
async function desactiver(p) {
  if (!confirm('Supprimer la phase « ' + p.phase + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('suivi_phases').update({ actif: false }).eq('id', p.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerPhases()
}

function classeStatut(s) {
  return { 'À faire': 'st-todo', 'En cours': 'st-cours', 'Terminé': 'st-fini' }[s] || 'st-todo'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtPct(n) { return n == null ? '—' : n.toFixed(1) + ' %' }

onMounted(chargerBase)
watch(lotId, chargerPhases)
</script>

<template>
  <div class="ph-page">
    <header class="ph-head">
      <h1>Suivi de fabrication</h1>
      <p class="sub">Détail des phases d'un lot — quantités entrée / sortie (kg) et rendements.</p>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!lots.length" class="empty-card">
      Aucun lot. Va d'abord dans <strong>Ordres de fabrication</strong> créer un lot — tu pourras ensuite suivre ses phases ici.
    </div>

    <template v-else>
      <section class="card">
        <label class="lot-select">Lot
          <select v-model="lotId">
            <option value="">— Choisir un lot —</option>
            <option v-for="l in lots" :key="l.id" :value="l.id">
              {{ l.numero_lot }} · {{ l.produits ? l.produits.designation : '' }}
            </option>
          </select>
        </label>

        <div v-if="lotSelectionne" class="lot-info">
          <div><span class="lbl">Produit</span>{{ lotSelectionne.produits ? lotSelectionne.produits.designation : '—' }}</div>
          <div><span class="lbl">Qté théorique</span>{{ fmt(lotSelectionne.quantite_theorique) }}</div>
          <div><span class="lbl">Statut lot</span>{{ lotSelectionne.statut }}</div>
          <div v-if="rendementGlobal != null" class="rdt-global">
            <span class="lbl">Rendement cumulé</span><strong>{{ fmtPct(rendementGlobal) }}</strong>
          </div>
        </div>
      </section>

      <template v-if="lotId">
        <section class="card" v-if="peutEditer">
          <h2 class="card-title">{{ form.id ? 'Modifier la phase' : 'Ajouter une phase' }}</h2>
          <div class="form-grid">
            <label>Phase
              <select v-model="form.phase">
                <option v-for="ph in PHASES" :key="ph" :value="ph">{{ ph }}</option>
              </select>
            </label>
            <label>Ligne / équipement
              <select v-model="form.equipement_id">
                <option value="">—</option>
                <option v-for="e in equipements" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
              </select>
            </label>
            <label>Quantité entrée (kg)<input v-model="form.quantite_entree" type="number" step="any" placeholder="250" /></label>
            <label>Quantité sortie (kg)<input v-model="form.quantite_sortie" type="number" step="any" placeholder="245" /></label>
            <label>Date<input v-model="form.date_phase" type="date" /></label>
            <label>Statut
              <select v-model="form.statut">
                <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
              </select>
            </label>
            <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
            <div class="form-actions">
              <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Ajouter la phase' }}</button>
              <button v-if="form.id" class="btn ghost" @click="resetForm">Annuler</button>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Phases du lot</h2>
            <span class="count">{{ phases.length }}</span>
          </div>
          <div class="table-scroll">
            <table class="grid">
              <thead>
                <tr>
                  <th>Phase</th><th>Ligne</th><th class="right">Entrée (kg)</th><th class="right">Sortie (kg)</th>
                  <th class="right">Rendement</th><th>Date</th><th>Statut</th><th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in phases" :key="p.id">
                  <td class="strong">{{ p.phase }}</td>
                  <td>{{ p.equipements ? p.equipements.code : '—' }}</td>
                  <td class="right">{{ fmt(p.quantite_entree) }}</td>
                  <td class="right">{{ fmt(p.quantite_sortie) }}</td>
                  <td class="right" :class="rendement(p) != null && rendement(p) < 95 ? 'rdt-bas' : ''">{{ fmtPct(rendement(p)) }}</td>
                  <td>{{ fmtDate(p.date_phase) }}</td>
                  <td><span class="badge" :class="classeStatut(p.statut)">{{ p.statut }}</span></td>
                  <td class="right nowrap">
                    <template v-if="peutEditer">
                      <button class="link" @click="modifier(p)">Modifier</button>
                      <button class="link danger" @click="desactiver(p)">Supprimer</button>
                    </template>
                  </td>
                </tr>
                <tr v-if="!phases.length"><td colspan="8" class="empty">Aucune phase. Ajoute-en une ci-dessus.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <div v-else class="hint-select">Choisis un lot ci-dessus pour saisir et voir ses phases.</div>
    </template>
  </div>
</template>

<style scoped>
.ph-page { color: #1b2733; }
.ph-head { margin: 4px 0 18px; }
.ph-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.ph-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-head .card-title { margin: 0; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }

.lot-select { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; max-width: 520px; }
.lot-select select { font-size: 14px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight:
