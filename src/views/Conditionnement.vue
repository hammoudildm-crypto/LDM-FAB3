<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(true))

const STATUTS = ['En cours', 'Terminé', 'Libéré']

const records = ref([])
const lots = ref([])
const equipements = ref([])
const filtreStatut = ref('')
const erreur = ref('')
const message = ref('')

const form = reactive({
  id: null, ordre_id: '', date_conditionnement: '', equipement_id: '',
  quantite_entree: '', boites: '', statut: 'En cours', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, ordre_id: '', date_conditionnement: '', equipement_id: '',
    quantite_entree: '', boites: '', statut: 'En cours', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

// Unités / boîte du produit du lot sélectionné (sert à convertir boîtes <-> comprimés stockés)
function upbLot(ordreId) {
  const l = lots.value.find(x => x.id === ordreId)
  const upb = l && l.produits ? Number(l.produits.unites_par_boite || 0) : 0
  return upb > 0 ? upb : 0
}

async function chargerTout() {
  erreur.value = ''
  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, produits(code_pf, designation, unites_par_boite, poids_unitaire_mg)')
    .eq('actif', true).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const re = await supabase.from('equipements').select('id, code, nom').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data

  const rc = await supabase.from('conditionnement')
    .select('*, ordres_fabrication(numero_lot, produits(code_pf, designation, unites_par_boite, poids_unitaire_mg)), equipements(code, nom)')
    .eq('actif', true).order('date_conditionnement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rc.error) { erreur.value = rc.error.message; return }
  records.value = rc.data
}

const recordsFiltres = computed(() =>
  filtreStatut.value ? records.value.filter(r => r.statut === filtreStatut.value) : records.value
)

function boites(r) {
  const upb = r.ordres_fabrication && r.ordres_fabrication.produits ? r.ordres_fabrication.produits.unites_par_boite : null
  if (r.quantite_conditionnee == null || !upb || Number(upb) === 0) return null
  return Math.floor(Number(r.quantite_conditionnee) / Number(upb))
}
function rendementCond(r) {
  const prod = r.ordres_fabrication && r.ordres_fabrication.produits ? r.ordres_fabrication.produits : null
  if (!prod) return null
  const mm = Number(prod.poids_unitaire_mg || 0)
  const upb = Number(prod.unites_par_boite || 0)
  const kg = r.quantite_entree
  const b = boites(r)
  if (b == null || kg == null || Number(kg) === 0 || mm === 0 || upb === 0) return null
  const boitesTheo = (Number(kg) * 1e6) / mm / upb
  return boitesTheo ? (b / boitesTheo) * 100 : null
}
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(2) + ' %' }

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!form.ordre_id) { erreur.value = 'Choisis un lot.'; return }
  let qcond = null
  if (form.boites !== '' && form.boites !== null) {
    const upb = upbLot(form.ordre_id)
    if (!upb) { erreur.value = 'Le produit de ce lot n\'a pas d\'unités/boîte. Renseigne-la d\'abord dans Référentiels.'; return }
    qcond = Number(form.boites) * upb
  }
  const payload = {
    ordre_id: form.ordre_id,
    date_conditionnement: form.date_conditionnement || null,
    equipement_id: form.equipement_id || null,
    quantite_entree: toNum(form.quantite_entree),
    quantite_conditionnee: qcond,
    statut: form.statut,
    commentaire: form.commentaire.trim() || null
  }
  const res = form.id
    ? await supabase.from('conditionnement').update(payload).eq('id', form.id)
    : await supabase.from('conditionnement').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Conditionnement mis à jour.' : 'Conditionnement enregistré.'
  resetForm()
  await chargerTout()
}
function modifier(r) {
  const upb = r.ordres_fabrication && r.ordres_fabrication.produits ? Number(r.ordres_fabrication.produits.unites_par_boite || 0) : 0
  Object.assign(form, {
    id: r.id, ordre_id: r.ordre_id || '', date_conditionnement: r.date_conditionnement || '',
    equipement_id: r.equipement_id || '', quantite_entree: r.quantite_entree ?? '',
    boites: (r.quantite_conditionnee != null && upb > 0) ? Math.round(Number(r.quantite_conditionnee) / upb) : '',
    statut: r.statut || 'En cours', commentaire: r.commentaire || ''
  })
}
async function desactiver(r) {
  if (!confirm('Supprimer ce conditionnement ?')) return
  erreur.value = ''
  const res = await supabase.from('conditionnement').update({ actif: false }).eq('id', r.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

function classeStatut(s) {
  return { 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib' }[s] || 'st-cours'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

onMounted(chargerTout)
</script>

<template>
  <div class="cd-page">
    <header class="cd-head">
      <h1>Conditionnement</h1>
      <p class="sub">Mise en boîte des lots — quantité reçue (kg) et nombre de boîtes.</p>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!lots.length" class="empty-card">
      Aucun lot. Va d'abord dans <strong>Ordres de fabrication</strong> créer un lot — tu pourras ensuite enregistrer son conditionnement ici.
    </div>

    <template v-else>
      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ form.id ? 'Modifier le conditionnement' : 'Nouveau conditionnement' }}</h2>
        <div class="form-grid">
          <label class="wide">Lot
            <select v-model="form.ordre_id">
              <option value="">—</option>
              <option v-for="l in lots" :key="l.id" :value="l.id">
                {{ l.numero_lot }} · {{ l.produits ? l.produits.designation : '' }}
              </option>
            </select>
          </label>
          <label>Date<input v-model="form.date_conditionnement" type="date" /></label>
          <label>Ligne / équipement
            <select v-model="form.equipement_id">
              <option value="">—</option>
              <option v-for="e in equipements" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
            </select>
          </label>
          <label>Quantité reçue (kg)<input v-model="form.quantite_entree" type="number" step="any" placeholder="245" /></label>
          <label>Boîtes conditionnées<input v-model="form.boites" type="number" placeholder="16000" /></label>
          <label>Statut
            <select v-model="form.statut">
              <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
          <div class="form-actions">
            <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Enregistrer' }}</button>
            <button v-if="form.id" class="btn ghost" @click="resetForm">Annuler</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Conditionnements</h2>
          <span class="count">{{ recordsFiltres.length }}</span>
          <select v-model="filtreStatut" class="filtre">
            <option value="">Tous les statuts</option>
            <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Lot</th><th>Produit</th><th>Date</th><th>Ligne</th>
                <th class="right">Reçu (kg)</th><th class="right">Boîtes</th><th class="right">Rendement</th><th>Statut</th><th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in recordsFiltres" :key="r.id">
                <td class="mono">{{ r.ordres_fabrication ? r.ordres_fabrication.numero_lot : '—' }}</td>
                <td class="desig">{{ r.ordres_fabrication && r.ordres_fabrication.produits ? r.ordres_fabrication.produits.designation : '—' }}</td>
                <td>{{ fmtDate(r.date_conditionnement) }}</td>
                <td>{{ r.equipements ? r.equipements.code : '—' }}</td>
                <td class="right">{{ fmt(r.quantite_entree) }}</td>
                <td class="right strong">{{ fmt(boites(r)) }}</td>
                <td class="right" :class="rendementCond(r) != null && rendementCond(r) < 95 ? 'rdt-bas' : ''">{{ fmtPct(rendementCond(r)) }}</td>
                <td><span class="badge" :class="classeStatut(r.statut)">{{ r.statut }}</span></td>
                <td class="right nowrap">
                  <template v-if="peutEditer">
                    <button class="link" @click="modifier(r)">Modifier</button>
                    <button class="link danger" @click="desactiver(r)">Supprimer</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!recordsFiltres.length"><td colspan="9" class="empty">Aucun conditionnement. Enregistres-en un ci-dessus.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="hint">Le <strong>nombre de boîtes</strong> est saisi directement ; la colonne <strong>Rendement</strong> compare les boîtes réelles aux boîtes théoriques (calculées d'après le poids du comprimé et les kg reçus). La <strong>quantité reçue (kg)</strong> alimente le stock de vrac (page En-cours).</p>
    </template>
  </div>
</template>

<style scoped>
.cd-page { color: #1b2733; }
.cd-head { margin: 4px 0 18px; }
.cd-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.cd-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

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
.strong { font-weight: 700; }
.rdt-bas { color: #b91c1c; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #475569; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

.hint { color: #64748b; font-size: 13px; margin-top: 4px; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
}
</style>
