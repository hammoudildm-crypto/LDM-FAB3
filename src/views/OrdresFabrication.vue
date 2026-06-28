<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']

const lots = ref([])
const produits = ref([])
const equipements = ref([])
const filtreStatut = ref('')
const erreur = ref('')
const message = ref('')

const form = reactive({
  id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
  date_lancement: '', statut: 'Planifié', equipement_id: '', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
    date_lancement: '', statut: 'Planifié', equipement_id: '', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

async function chargerTout() {
  erreur.value = ''
  const rp = await supabase.from('produits').select('id, code_pf, designation').eq('actif', true).order('code_pf')
  if (rp.error) { erreur.value = rp.error.message; return }
  produits.value = rp.data

  const re = await supabase.from('equipements').select('id, code, nom').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data

  const rl = await supabase.from('ordres_fabrication')
    .select('*, produits(code_pf, designation), equipements(code, nom)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data
}

const lotsFiltres = computed(() =>
  filtreStatut.value ? lots.value.filter(l => l.statut === filtreStatut.value) : lots.value
)

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!form.numero_lot.trim() || !form.produit_id) { erreur.value = 'Numéro de lot et produit obligatoires.'; return }
  const payload = {
    numero_lot: form.numero_lot.trim(),
    produit_id: form.produit_id,
    quantite_theorique: toNum(form.quantite_theorique),
    date_lancement: form.date_lancement || null,
    statut: form.statut,
    equipement_id: form.equipement_id || null,
    commentaire: form.commentaire.trim() || null
  }
  const res = form.id
    ? await supabase.from('ordres_fabrication').update(payload).eq('id', form.id)
    : await supabase.from('ordres_fabrication').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Lot mis à jour.' : 'Lot créé.'
  resetForm()
  await chargerTout()
}
function modifier(l) {
  Object.assign(form, {
    id: l.id, numero_lot: l.numero_lot, produit_id: l.produit_id || '',
    quantite_theorique: l.quantite_theorique ?? '', date_lancement: l.date_lancement || '',
    statut: l.statut || 'Planifié', equipement_id: l.equipement_id || '', commentaire: l.commentaire || ''
  })
}
async function desactiver(l) {
  if (!confirm('Désactiver le lot « ' + l.numero_lot + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('ordres_fabrication').update({ actif: false }).eq('id', l.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

function classeStatut(s) {
  return {
    'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini',
    'Libéré': 'st-lib', 'Rejeté': 'st-rej'
  }[s] || 'st-plan'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

onMounted(chargerTout)
</script>

<template>
  <div class="of-page">
    <header class="of-head">
      <h1>Ordres de fabrication</h1>
      <p class="sub">Création et suivi des lots de fabrication.</p>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!produits.length" class="empty-card">
      Aucun produit dans le référentiel. Va d'abord dans <strong>Référentiels</strong> créer un produit — il en faut un pour lancer un lot.
    </div>

    <template v-else>
      <section class="card">
        <h2 class="card-title">{{ form.id ? 'Modifier le lot' : 'Nouveau lot' }}</h2>
        <div class="form-grid">
          <label>N° de lot<input v-model="form.numero_lot" placeholder="L260145" /></label>
          <label class="wide">Produit
            <select v-model="form.produit_id">
              <option value="">—</option>
              <option v-for="p in produits" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option>
            </select>
          </label>
          <label>Quantité théorique<input v-model="form.quantite_theorique" type="number" placeholder="500000" /></label>
          <label>Date de lancement<input v-model="form.date_lancement" type="date" /></label>
          <label>Statut
            <select v-model="form.statut">
              <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label>Ligne / équipement
            <select v-model="form.equipement_id">
              <option value="">—</option>
              <option v-for="e in equipements" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
            </select>
          </label>
          <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
          <div class="form-actions">
            <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Créer le lot' }}</button>
            <button v-if="form.id" class="btn ghost" @click="resetForm">Annuler</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Lots</h2>
          <span class="count">{{ lotsFiltres.length }}</span>
          <select v-model="filtreStatut" class="filtre">
            <option value="">Tous les statuts</option>
            <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>N° lot</th><th>Produit</th><th class="right">Qté théo.</th>
                <th>Lancement</th><th>Statut</th><th>Ligne</th><th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lotsFiltres" :key="l.id">
                <td class="mono">{{ l.numero_lot }}</td>
                <td>
                  <span class="mono">{{ l.produits ? l.produits.code_pf : '—' }}</span>
                  <span class="desig"> {{ l.produits ? l.produits.designation : '' }}</span>
                </td>
                <td class="right">{{ fmt(l.quantite_theorique) }}</td>
                <td>{{ fmtDate(l.date_lancement) }}</td>
                <td><span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span></td>
                <td>{{ l.equipements ? l.equipements.code : '—' }}</td>
                <td class="right nowrap">
                  <button class="link" @click="modifier(l)">Modifier</button>
                  <button class="link danger" @click="desactiver(l)">Désactiver</button>
                </td>
              </tr>
              <tr v-if="!lotsFiltres.length"><td colspan="7" class="empty">Aucun lot. Crée-en un ci-dessus.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.of-page { color: #1b2733; }
.of-head { margin: 4px 0 18px; }
.of-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.of-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-head .card-title { margin: 0; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.filtre { margin-left: auto; font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }

.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: end; }
.form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.form-grid .wide { grid-column: span 2; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.form-actions { display: flex; gap: 8px; align-items: end; grid-column: 1 / -1; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: #0c5f59; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.ghost:hover { background: #f8fafc; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; font-size: 12px; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
}
</style>
