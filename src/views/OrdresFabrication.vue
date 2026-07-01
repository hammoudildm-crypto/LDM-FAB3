<script setup>
import { ref, reactive, computed, onMounted, nextTick, inject } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(true))
const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']

const lots = ref([])
const produits = ref([])
const equipements = ref([])
const filtreStatut = ref('')
const rechercheLot = ref('')
const anneeF = ref(0)
const moisF = ref(0)
const LIMITE = 300
const erreur = ref('')
const message = ref('')
const signatures = ref([])
const formCard = ref(null)

const sig = reactive({ open: false, mode: 'sign', ordre: null, pin: '', pin2: '', motif: '', erreur: '', busy: false })

const form = reactive({
  id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
  date_lancement: '', date_fin_fabrication: '', statut: 'Planifié', equipement_id: '', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
    date_lancement: '', date_fin_fabrication: '', statut: 'Planifié', equipement_id: '', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

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
  const rp = await supabase.from('produits').select('id, code_pf, designation').eq('actif', true).order('code_pf')
  if (rp.error) { erreur.value = rp.error.message; return }
  produits.value = rp.data

  const re = await supabase.from('equipements').select('id, code, nom').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data

  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('*, produits(code_pf, designation), equipements(code, nom)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rs = await supabase.from('signatures').select('ordre_id, email, signed_at, motif').order('signed_at', { ascending: false })
  if (!rs.error) signatures.value = rs.data
}

const MOIS = [
  { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
  { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
  { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
  { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' }
]
function refDateLot(l) { return l.date_lancement || l.date_fin_fabrication }
const anneesLot = computed(() => {
  const set = new Set()
  for (const l of lots.value) { const d = refDateLot(l); if (d) set.add(new Date(d).getFullYear()) }
  return [...set].sort((a, b) => b - a)
})
const lotsFiltres = computed(() => {
  const q = rechercheLot.value.trim().toLowerCase()
  return lots.value.filter(l => {
    if (filtreStatut.value && l.statut !== filtreStatut.value) return false
    const d = refDateLot(l)
    if (anneeF.value && (!d || new Date(d).getFullYear() !== anneeF.value)) return false
    if (moisF.value && (!d || (new Date(d).getMonth() + 1) !== moisF.value)) return false
    if (q) {
      const pr = l.produits
      const code = pr ? String(pr.code_pf || '') : ''
      const desig = pr ? String(pr.designation || '') : ''
      if (!(String(l.numero_lot || '').toLowerCase().includes(q) || code.toLowerCase().includes(q) || desig.toLowerCase().includes(q))) return false
    }
    return true
  })
})
const lotsAffiches = computed(() => lotsFiltres.value.slice(0, LIMITE))

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!form.numero_lot.trim() || !form.produit_id) { erreur.value = 'Numéro de lot et produit obligatoires.'; return }
  // Fin de fabrication : auto-datée quand le lot passe à Terminé/Libéré -> alimente la file DDL
  let dateFin = form.date_fin_fabrication || null
  if (!dateFin && (form.statut === 'Terminé' || form.statut === 'Libéré')) {
    dateFin = new Date().toISOString().slice(0, 10)
    form.date_fin_fabrication = dateFin
  }
  const payload = {
    numero_lot: form.numero_lot.trim(),
    produit_id: form.produit_id,
    quantite_theorique: toNum(form.quantite_theorique),
    date_lancement: form.date_lancement || null,
    date_fin_fabrication: dateFin,
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
    date_fin_fabrication: l.date_fin_fabrication || '',
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

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['N° lot', 'Produit', 'Quantité théorique', 'Date lancement', 'Statut', 'Ligne']
  const lignes = lotsFiltres.value.map(l => [
    l.numero_lot,
    l.produits ? (l.produits.code_pf + ' ' + l.produits.designation) : '',
    l.quantite_theorique ?? '',
    l.date_lancement || '',
    l.statut,
    l.equipements ? l.equipements.code : ''
  ])
  telechargerCSV('ordres_fabrication.csv', entetes, lignes)
}

function fmtDateHeure(d) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
function signatureDe(l) { return signatures.value.find(s => s.ordre_id === l.id) || null }

async function ouvrirSignature(l) {
  Object.assign(sig, { ordre: l, pin: '', pin2: '', motif: '', erreur: '', busy: false })
  const r = await supabase.rpc('a_un_pin')
  sig.mode = (r.data === true) ? 'sign' : 'set'
  sig.open = true
}
function fermerSignature() { sig.open = false; sig.ordre = null }

async function definirPin() {
  sig.erreur = ''
  if (sig.pin.length < 4) { sig.erreur = 'Le code doit comporter au moins 4 caractères.'; return }
  if (sig.pin !== sig.pin2) { sig.erreur = 'Les deux codes ne correspondent pas.'; return }
  sig.busy = true
  const r = await supabase.rpc('definir_pin', { p_pin: sig.pin })
  sig.busy = false
  if (r.error) { sig.erreur = r.error.message; return }
  sig.mode = 'sign'; sig.pin = ''; sig.pin2 = ''
}

async function signer() {
  sig.erreur = ''
  if (!sig.pin) { sig.erreur = 'Saisis ton code de signature.'; return }
  sig.busy = true
  const r = await supabase.rpc('signer_liberation', { p_ordre_id: sig.ordre.id, p_pin: sig.pin, p_motif: sig.motif })
  sig.busy = false
  if (r.error) { sig.erreur = r.error.message; return }
  const num = sig.ordre.numero_lot
  sig.open = false; sig.ordre = null
  message.value = 'Lot ' + num + ' libéré et signé.'
  await chargerTout()
}

const route = useRoute()
onMounted(async () => {
  await chargerTout()
  const id = route.query.edit
  if (id) {
    const l = lots.value.find(x => String(x.id) === String(id))
    if (l) {
      modifier(l)
      await nextTick()
      if (formCard.value) formCard.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
})
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
      <section class="card" v-if="peutEditer" ref="formCard">
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
          <label>Date fin fabrication<input v-model="form.date_fin_fabrication" type="date" /></label>
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
          <div class="head-tools">
            <input v-model="rechercheLot" type="search" class="recherche" placeholder="Rechercher (n° lot, code, désignation)…" />
            <select v-model.number="anneeF" class="filtre2">
              <option :value="0">Toutes années</option>
              <option v-for="a in anneesLot" :key="a" :value="a">{{ a }}</option>
            </select>
            <select v-model.number="moisF" class="filtre2">
              <option :value="0">Tous les mois</option>
              <option v-for="m in MOIS" :key="m.v" :value="m.v">{{ m.l }}</option>
            </select>
            <select v-model="filtreStatut" class="filtre2">
              <option value="">Tous les statuts</option>
              <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <button class="btn-exp" @click="exporterCSV" :disabled="!lotsFiltres.length">Exporter CSV</button>
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
              <tr v-for="l in lotsAffiches" :key="l.id">
                <td class="mono">{{ l.numero_lot }}</td>
                <td>
                  <span class="mono">{{ l.produits ? l.produits.code_pf : '—' }}</span>
                  <span class="desig"> {{ l.produits ? l.produits.designation : '' }}</span>
                </td>
                <td class="right">{{ fmt(l.quantite_theorique) }}</td>
                <td>{{ fmtDate(l.date_lancement) }}</td>
                <td>
                  <span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span>
                  <div v-if="l.statut === 'Libéré' && signatureDe(l)" class="sig-info">✍ {{ signatureDe(l).email }}<br>{{ fmtDateHeure(signatureDe(l).signed_at) }}</div>
                </td>
                <td>{{ l.equipements ? l.equipements.code : '—' }}</td>
                <td class="right nowrap">
                  <template v-if="peutEditer">
                    <button v-if="l.statut === 'Terminé'" class="link release" @click="ouvrirSignature(l)">Libérer (signer)</button>
                    <button class="link" @click="modifier(l)">Modifier</button>
                    <button class="link danger" @click="desactiver(l)">Désactiver</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!lotsFiltres.length"><td colspan="7" class="empty">Aucun lot ne correspond aux filtres.</td></tr>
              <tr v-else-if="lotsFiltres.length > LIMITE"><td colspan="7" class="cap-note">… {{ lotsFiltres.length - LIMITE }} autres lots masqués — affine les filtres (l'export CSV reste complet).</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-if="sig.open" class="modal-overlay" @click.self="fermerSignature">
      <div class="modal">
        <template v-if="sig.mode === 'set'">
          <h3 class="modal-title">Définir votre code de signature</h3>
          <p class="modal-sub">Ce code confidentiel vous servira à signer électroniquement les libérations de lot. Vous le choisissez une fois ; il vous sera redemandé à chaque signature.</p>
          <label class="modal-field">Nouveau code
            <input v-model="sig.pin" type="password" autocomplete="new-password" placeholder="Au moins 4 caractères" />
          </label>
          <label class="modal-field">Confirmer le code
            <input v-model="sig.pin2" type="password" autocomplete="new-password" @keyup.enter="definirPin" />
          </label>
          <p v-if="sig.erreur" class="modal-err">{{ sig.erreur }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="fermerSignature">Annuler</button>
            <button class="btn" :disabled="sig.busy" @click="definirPin">Enregistrer le code</button>
          </div>
        </template>
        <template v-else>
          <h3 class="modal-title">Signer la libération</h3>
          <p class="modal-sub">Lot <strong>{{ sig.ordre ? sig.ordre.numero_lot : '' }}</strong>. En signant, vous attestez la libération de ce lot. L'action est tracée, horodatée et nominative.</p>
          <label class="modal-field">Motif
            <input v-model="sig.motif" placeholder="Libération du lot" />
          </label>
          <label class="modal-field">Votre code de signature
            <input v-model="sig.pin" type="password" autocomplete="off" placeholder="••••" @keyup.enter="signer" />
          </label>
          <p v-if="sig.erreur" class="modal-err">{{ sig.erreur }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="fermerSignature">Annuler</button>
            <button class="btn" :disabled="sig.busy" @click="signer">Signer et libérer</button>
          </div>
        </template>
      </div>
    </div>
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
.btn-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

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
button.link.release { color: #166534; }

.sig-info { font-size: 11px; color: #166534; margin-top: 4px; line-height: 1.3; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15,42,51,.55); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
.modal-title { margin: 0 0 6px; font-size: 18px; }
.modal-sub { margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.45; }
.modal-field { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; margin-bottom: 12px; }
.modal-field input { font-size: 15px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.modal-field input:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.modal-err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
}
.head-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.recherche { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 220px; }
.recherche:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.filtre2 { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.cap-note { color: #94a3b8; font-size: 12px; padding: 8px 10px; }
</style>
