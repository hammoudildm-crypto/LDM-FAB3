<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const STATUTS = ['En cours', 'Terminé', 'Libéré']

const records = ref([])
const lots = ref([])
const equipements = ref([])
const filtreStatut = ref('')
const anneeF = ref(0)
const moisF = ref(0)
const showList = ref(false)
const rechercheLot = ref('')
const rechercheLotForm = ref('')
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
const lotsFiltresForm = computed(() => {
  const q = rechercheLotForm.value.trim().toLowerCase()
  if (!q) return lots.value
  return lots.value.filter(l => {
    const p = l.produits
    const code = p ? String(p.code_pf || '') : ''
    const desig = p ? String(p.designation || '') : ''
    return code.toLowerCase().includes(q) || desig.toLowerCase().includes(q) || String(l.numero_lot || '').toLowerCase().includes(q)
  })
})
function upbLot(ordreId) {
  const l = lots.value.find(x => x.id === ordreId)
  const upb = l && l.produits ? Number(l.produits.unites_par_boite || 0) : 0
  return upb > 0 ? upb : 0
}

async function fetchAllPaged(make) {
  const size = 1000
  let from = 0, all = []
  for (;;) {
    const r = await make().range(from, from + size - 1)
    if (r.error) return { error: r.error, data: all }
    all = all.concat(r.data || [])
    if (!r.data || r.data.length < size) break
    from += size
  }
  return { data: all, error: null }
}

async function chargerTout() {
  erreur.value = ''
  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, boites_theoriques)')
    .eq('actif', true).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('*, ordres_fabrication(numero_lot, produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, boites_theoriques)), equipements(code, nom)')
    .eq('actif', true).order('date_conditionnement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (rc.error) { erreur.value = rc.error.message; return }
  records.value = rc.data
}

const MOIS = [
  { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
  { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
  { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
  { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' }
]
const anneesCond = computed(() => {
  const set = new Set()
  for (const r of records.value) { if (r.date_conditionnement) set.add(new Date(r.date_conditionnement).getFullYear()) }
  return [...set].sort((a, b) => b - a)
})
const recordsFiltres = computed(() => {
  let list = records.value
  if (filtreStatut.value) list = list.filter(r => r.statut === filtreStatut.value)
  if (anneeF.value) list = list.filter(r => { const d = r.date_conditionnement ? new Date(r.date_conditionnement) : null; return d && d.getFullYear() === anneeF.value })
  if (moisF.value) list = list.filter(r => { const d = r.date_conditionnement ? new Date(r.date_conditionnement) : null; return d && (d.getMonth() + 1) === moisF.value })
  const q = rechercheLot.value.trim().toLowerCase()
  if (q) {
    list = list.filter(r => {
      const o = r.ordres_fabrication
      const lot = o ? String(o.numero_lot || '') : ''
      const p = o && o.produits ? o.produits : null
      const code = p ? String(p.code_pf || '') : ''
      const desig = p ? String(p.designation || '') : ''
      return lot.toLowerCase().includes(q) || code.toLowerCase().includes(q) || desig.toLowerCase().includes(q)
    })
  }
  return list
})

// Seules les lignes de conditionnement (type = 'Conditionnement')
const equipementsFiltres = computed(() => {
  const f = equipements.value.filter(e => e.type === 'Conditionnement')
  if (f.length) {
    if (form.equipement_id && !f.some(e => e.id === form.equipement_id)) {
      const sel = equipements.value.find(e => e.id === form.equipement_id)
      if (sel) return [sel, ...f]
    }
    return f
  }
  return equipements.value
})

function boites(r) {
  const upb = r.ordres_fabrication && r.ordres_fabrication.produits ? r.ordres_fabrication.produits.unites_par_boite : null
  if (r.quantite_conditionnee == null || !upb || Number(upb) === 0) return null
  return Math.floor(Number(r.quantite_conditionnee) / Number(upb))
}
// Rendement de conditionnement = boîtes obtenues / équivalent du vrac reçu (en boîtes)
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
// Rendement global = boîtes obtenues / boîtes théoriques du produit (TTL)
function rendementGlobal(r) {
  const prod = r.ordres_fabrication && r.ordres_fabrication.produits ? r.ordres_fabrication.produits : null
  if (!prod) return null
  const theo = Number(prod.boites_theoriques || 0)
  const b = boites(r)
  if (b == null || theo === 0) return null
  return (b / theo) * 100
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

const route = useRoute()
onMounted(async () => {
  await chargerTout()
  const q = route.query.lot
  if (q) { rechercheLot.value = String(q); showList.value = true }
})
</script>

<template>
  <div class="cd-page">
    <PageHeader title="Conditionnement" tone="blue"
      subtitle="Mise en boîte des lots — quantité reçue (kg) et nombre de boîtes." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!lots.length" class="empty-card">
      Aucun lot. Va d'abord dans <strong>Ordres de fabrication</strong> créer un lot — tu pourras ensuite enregistrer son conditionnement ici.
    </div>

    <template v-else>
      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ form.id ? 'Modifier le conditionnement' : 'Nouveau conditionnement' }}</h2>
        <div class="form-grid">
          <label class="wide">Lot <span class="lot-count">{{ lotsFiltresForm.length }}</span>
            <input v-model="rechercheLotForm" type="search" class="lot-search" placeholder="Rechercher un lot (code, désignation, n° lot)…" />
            <select v-model="form.ordre_id" size="1">
              <option value="">—</option>
              <option v-for="l in lotsFiltresForm" :key="l.id" :value="l.id">
                {{ l.numero_lot }} · {{ l.produits ? l.produits.code_pf + ' ' + l.produits.designation : '' }}
              </option>
            </select>
          </label>
          <label>Date<input v-model="form.date_conditionnement" type="date" /></label>
          <label>Ligne / équipement
            <select v-model="form.equipement_id">
              <option value="">—</option>
              <option v-for="e in equipementsFiltres" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
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
          <div class="head-tools">
            <input v-model="rechercheLot" class="recherche" type="search" placeholder="Rechercher un n° de lot…" />
            <select v-model.number="anneeF" class="filtre">
              <option :value="0">Toutes années</option>
              <option v-for="a in anneesCond" :key="a" :value="a">{{ a }}</option>
            </select>
            <select v-model.number="moisF" class="filtre">
              <option :value="0">Tous les mois</option>
              <option v-for="m in MOIS" :key="m.v" :value="m.v">{{ m.l }}</option>
            </select>
            <select v-model="filtreStatut" class="filtre">
              <option value="">Tous les statuts</option>
              <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
            </select>
            <button class="btn-toggle" @click="showList = !showList">
              {{ showList ? '▲ Masquer' : '▼ Afficher' }} les lignes
            </button>
          </div>
        </div>
        <div v-if="showList" class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Lot</th><th>Produit</th><th>Date</th><th>Ligne</th>
                <th class="right">Reçu (kg)</th><th class="right">Boîtes</th><th class="right">Rendement</th><th class="right">Rendement global</th><th>Statut</th><th class="right">Actions</th>
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
                <td class="right" :class="rendementGlobal(r) != null && rendementGlobal(r) < 90 ? 'rdt-bas' : ''">{{ fmtPct(rendementGlobal(r)) }}</td>
                <td><span class="badge" :class="classeStatut(r.statut)">{{ r.statut }}</span></td>
                <td class="right nowrap">
                  <template v-if="peutEditer">
                    <button class="link" @click="modifier(r)">Modifier</button>
                    <button class="link danger" @click="desactiver(r)">Supprimer</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!recordsFiltres.length"><td colspan="10" class="empty">Aucun conditionnement. Enregistres-en un ci-dessus.</td></tr>
            </tbody>
          </table>
        </div>
        <p v-if="!showList" class="masque-hint">{{ recordsFiltres.length }} conditionnement(s) — clique sur « Afficher les lignes » pour voir le détail.</p>
      </section>

      <p class="hint"><strong>Rendement</strong> = boîtes obtenues ÷ équivalent du vrac reçu (poids du comprimé). <strong>Rendement global</strong> = boîtes obtenues ÷ boîtes théoriques du produit (TTL). La <strong>quantité reçue (kg)</strong> alimente le stock de vrac (page En-cours).</p>
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
.filtre { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.head-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.recherche { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 200px; }
.recherche:focus { outline: 2px solid #0f766e; border-color: #0f766e; }

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
.lot-search { font-size: 14px; padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; margin-bottom: 6px; width: 100%; box-sizing: border-box; }
.lot-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.lot-count { display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; margin-left: 6px; }
.btn-toggle { background: #fff; border: 1px solid #cbd5e1; color: #0f766e; font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
.btn-toggle:hover { background: #f0fdfa; border-color: #0f766e; }
.masque-hint { color: #94a3b8; font-size: 13px; margin: 4px 2px; }
</style>
