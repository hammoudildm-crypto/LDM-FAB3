<script setup>
import { ref, reactive, computed, onMounted, watch, inject, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const PHASES = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
const STATUTS = ['À faire', 'En cours', 'Terminé']

const lots = ref([])
const rechercheLot = ref('')
const equipements = ref([])
const lotId = ref('')
const aCompleter = ref([])
const filtreAC = ref('')
const aCompleterFiltre = computed(() => {
  const q = filtreAC.value.trim().toLowerCase()
  if (!q) return aCompleter.value
  return aCompleter.value.filter(x => {
    const o = x.ordres_fabrication || {}, pr = o.produits || {}
    return (o.numero_lot || '').toLowerCase().includes(q) || (pr.code_pf || '').toLowerCase().includes(q) || (pr.designation || '').toLowerCase().includes(q)
  })
})
const ouvertACompleter = ref(false)
const phases = ref([])
const erreur = ref('')
const message = ref('')

const form = reactive({
  id: null, phase: 'Pesée', equipement_id: '', quantite_entree: '',
  quantite_sortie: '', date_debut: '', date_phase: '', statut: 'Terminé', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, phase: 'Pesée', equipement_id: '', quantite_entree: '',
    quantite_sortie: '', date_debut: '', date_phase: '', statut: 'Terminé', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

const lotSelectionne = computed(() => lots.value.find(l => l.id === lotId.value) || null)
const lotsFiltres = computed(() => {
  const q = rechercheLot.value.trim().toLowerCase()
  if (!q) return lots.value
  return lots.value.filter(l => {
    const p = l.produits
    const code = p ? String(p.code_pf || '') : ''
    const desig = p ? String(p.designation || '') : ''
    return code.toLowerCase().includes(q) || desig.toLowerCase().includes(q) || String(l.numero_lot || '').toLowerCase().includes(q)
  })
})

// Équipements filtrés selon la phase sélectionnée (type = phase)
const equipementsFiltres = computed(() => {
  const f = equipements.value.filter(e => e.type === form.phase)
  if (f.length) {
    if (form.equipement_id && !f.some(e => e.id === form.equipement_id)) {
      const sel = equipements.value.find(e => e.id === form.equipement_id)
      if (sel) return [sel, ...f]
    }
    return f
  }
  return equipements.value
})
function onPhaseChange() {
  if (form.equipement_id && !equipements.value.some(e => e.id === form.equipement_id && e.type === form.phase)) {
    form.equipement_id = ''
  }
  remplirQuantites()
}
// Auto : entrée FIGÉE = sortie de la phase précédente (1re phase = poids vrac théorique).
// Sortie = auto pour Pesée/Granulation, VIDE dès le Séchage (saisie manuelle).
function remplirQuantites() {
  const lot = lotSelectionne.value
  if (!lot) return
  const mm = lot.produits ? Number(lot.produits.poids_unitaire_mg || 0) : 0
  const upb = lot.produits ? Number(lot.produits.unites_par_boite || 0) : 0
  const qth = Number(lot.quantite_theorique || 0)
  const theoKg = (qth > 0 && mm > 0 && upb > 0) ? Math.round(qth * upb * mm / 1e6 * 100) / 100 : null
  const gamme = (lot.produits && Array.isArray(lot.produits.gamme) && lot.produits.gamme.length) ? lot.produits.gamme : PHASES
  const idx = gamme.indexOf(form.phase)
  let entree
  if (idx <= 0) {
    entree = theoKg
  } else {
    const prev = gamme[idx - 1]
    const rec = phases.value.find(ph => ph.phase === prev && ph.quantite_sortie != null)
    entree = rec ? Number(rec.quantite_sortie) : theoKg
  }
  form.quantite_entree = (entree != null) ? entree : ''
  form.quantite_sortie = (form.phase === 'Pesée' || form.phase === 'Granulation') ? ((entree != null) ? entree : '') : ''
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

async function chargerBase() {
  erreur.value = ''
  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, quantite_theorique, statut, produits(code_pf, designation, gamme, poids_unitaire_mg, unites_par_boite)')
    .eq('actif', true).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
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

const ORDRE_PHASES = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
// Entrée effective : la quantité entrée saisie, sinon la sortie de la phase précédente (repli)
function entreeEffective(p) {
  if (p.quantite_entree != null && p.quantite_entree !== '') return Number(p.quantite_entree)
  const idx = ORDRE_PHASES.indexOf(p.phase)
  for (let i = idx - 1; i >= 0; i--) {
    const prev = phases.value.find(ph => ph.phase === ORDRE_PHASES[i] && ph.quantite_sortie != null && ph.quantite_sortie !== '')
    if (prev) return Number(prev.quantite_sortie)
  }
  return null
}
function rendement(p) {
  const e = entreeEffective(p), s = p.quantite_sortie
  if (e == null || e === 0 || s == null || s === '') return null
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

function phaseFinaleGamme(g) {
  if (!Array.isArray(g) || !g.length) return null
  for (let i = PHASES.length - 1; i >= 0; i--) if (g.includes(PHASES[i])) return PHASES[i]
  return null
}

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!lotId.value) { erreur.value = 'Choisis d\'abord un lot.'; return }
  const oid = lotId.value
  const statutPhase = form.date_phase ? 'Terminé' : (form.date_debut ? 'En cours' : 'À faire')
  const payload = {
    ordre_id: lotId.value,
    phase: form.phase,
    equipement_id: form.equipement_id || null,
    quantite_entree: toNum(form.quantite_entree),
    quantite_sortie: toNum(form.quantite_sortie),
    date_debut: form.date_debut || null,
    date_phase: form.date_phase || null,
    statut: statutPhase,
    commentaire: form.commentaire.trim() || null
  }
  const res = form.id
    ? await supabase.from('suivi_phases').update(payload).eq('id', form.id)
    : await supabase.from('suivi_phases').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  // Clôture de la VRAIE phase finale (gamme du produit) -> date fin fab + statut Terminé
  let finDeFab = false
  const gamme = lotSelectionne.value && lotSelectionne.value.produits ? lotSelectionne.value.produits.gamme : null
  const phaseFin = phaseFinaleGamme(gamme)
  const estPhaseFinale = phaseFin
    ? form.phase === phaseFin
    : ['Compression', 'Remplissage Gélules', 'Pelliculage'].includes(form.phase)  // repli si gamme non définie
  if (estPhaseFinale && statutPhase === 'Terminé') {
    const maj = { date_fin_fabrication: form.date_phase || new Date().toISOString().slice(0, 10) }
    const st = lotSelectionne.value ? lotSelectionne.value.statut : null
    if (st !== 'Libéré' && st !== 'Rejeté' && st !== 'Terminé') maj.statut = 'En cours'
    // Tranche « live » : boîtes fabriquées = sortie finale (kg) -> comprimés -> boîtes
    const pr = lotSelectionne.value ? lotSelectionne.value.produits : null
    const mm = pr ? Number(pr.poids_unitaire_mg || 0) : 0
    const upb = pr ? Number(pr.unites_par_boite || 0) : 0
    const kg = toNum(form.quantite_sortie)
    if (kg && mm > 0 && upb > 0) maj.boites_fabriquees = Math.floor(kg * 1e6 / mm / upb)
    const ru = await supabase.from('ordres_fabrication').update(maj).eq('id', lotId.value)
    if (!ru.error) { finDeFab = true; await chargerBase() }
  }
  message.value = (form.id ? 'Phase mise à jour.' : 'Phase ajoutée.') + (finDeFab ? ' Fin de fabrication : lot daté, boîtes fabriquées calculées, vrac prêt à conditionner → il entre dans la file DDL.' : '')
  resetForm()
  await chargerPhases()
  await majDatesLot(oid)
}

// Dates automatiques du lot depuis les phases : lancement = 1re date de phase ; fin fab = date de la phase finale terminée
async function majDatesLot(oid) {
  if (!oid) return
  const r = await supabase.from('suivi_phases').select('phase, statut, date_debut, date_phase').eq('ordre_id', oid).eq('actif', true)
  if (r.error) return
  const rows = r.data || []
  let minD = null
  for (const p of rows) { const d = p.date_debut || p.date_phase; if (d && (!minD || d < minD)) minD = d }
  const lot = lots.value.find(l => l.id === oid)
  const gamme = lot && lot.produits ? lot.produits.gamme : null
  const phaseFin = phaseFinaleGamme(gamme)
  const finale = rows.find(p => p.statut === 'Terminé' && (phaseFin ? p.phase === phaseFin : ['Compression', 'Remplissage Gélules', 'Pelliculage'].includes(p.phase)))
  await supabase.from('ordres_fabrication').update({
    date_lancement: minD || null,
    date_fin_fabrication: finale ? (finale.date_phase || finale.date_debut || null) : null
  }).eq('id', oid)
}

function modifier(p) {
  Object.assign(form, {
    id: p.id, phase: p.phase, equipement_id: p.equipement_id || '',
    quantite_entree: (p.quantite_entree != null && p.quantite_entree !== '') ? p.quantite_entree : (entreeEffective(p) ?? ''), quantite_sortie: p.quantite_sortie ?? '',
    date_debut: p.date_debut || '', date_phase: p.date_phase || '', statut: p.statut || 'Terminé', commentaire: p.commentaire || ''
  })
}
async function desactiver(p) {
  if (!confirm('Supprimer la phase « ' + p.phase + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('suivi_phases').update({ actif: false }).eq('id', p.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerPhases()
  await majDatesLot(p.ordre_id)
}

function classeStatut(s) {
  return { 'À faire': 'st-todo', 'En cours': 'st-cours', 'Terminé': 'st-fini' }[s] || 'st-todo'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtPct(n) { return n == null ? '—' : n.toFixed(1) + ' %' }

async function chargerACompleter() {
  const r = await supabase.from('suivi_phases')
    .select('id, phase, quantite_entree, quantite_sortie, ordre_id, ordres_fabrication!inner(numero_lot, date_fin_fabrication, produits(code_pf, designation))')
    .eq('actif', true)
    .or('quantite_sortie.is.null,quantite_sortie.eq.0')
    .not('ordres_fabrication.date_fin_fabrication', 'is', null)
  if (!r.error) aCompleter.value = r.data || []
}
async function allerVersLot(x) {
  lotId.value = x.ordre_id
  await chargerPhases()
  const ph = phases.value.find(p => p.id === x.id)
  if (ph) modifier(ph)
  await nextTick()
  const el = document.getElementById('fp-sortie')
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus() }
}
const route = useRoute()
onMounted(async () => {
  await chargerBase()
  await chargerACompleter()
  const q = route.query.lot ?? route.query.ordre
  if (q != null && q !== '') {
    const found = lots.value.find(l => String(l.id) === String(q))
    if (found) lotId.value = found.id
  }
})
watch(lotId, async () => { await chargerPhases(); remplirQuantites() })
</script>

<template>
  <div class="ph-page">
    <PageHeader title="Suivi de fabrication" tone="blue"
      subtitle="Détail des phases d'un lot — quantités entrée / sortie et rendements." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!lots.length" class="empty-card">
      Aucun lot. Va d'abord dans <strong>Ordres de fabrication</strong> créer un lot — tu pourras ensuite suivre ses phases ici.
    </div>

    <template v-else>
      <section class="card" v-if="aCompleter.length">
        <div class="ac-head" @click="ouvertACompleter = !ouvertACompleter">
          <h2 class="card-title">Phases à compléter <span class="ac-badge">{{ aCompleter.length }}</span></h2>
          <span class="ac-chev">{{ ouvertACompleter ? '▾' : '▸' }}</span>
        </div>
        <div v-show="ouvertACompleter">
          <p class="ac-hint">Lots terminés en fabrication dont une phase n'a pas de quantité sortie. Clique « Corriger » pour ouvrir le lot.</p>
          <div class="ac-filtre">
            <input v-model="filtreAC" type="search" placeholder="Filtrer par n° de lot, code ou désignation…" />
            <span v-if="filtreAC" class="ac-count">{{ aCompleterFiltre.length }} / {{ aCompleter.length }} lot(s)</span>
          </div>
          <div class="ac-scroll">
            <table class="ac-table">
              <thead><tr><th>Lot</th><th>Produit</th><th>Phase</th><th class="ac-r">Entrée (kg)</th><th>Fin fab.</th><th></th></tr></thead>
              <tbody>
                <tr v-for="x in aCompleterFiltre" :key="x.id">
                  <td class="ac-mono">{{ x.ordres_fabrication.numero_lot }}</td>
                  <td><span v-if="x.ordres_fabrication.produits"><strong>{{ x.ordres_fabrication.produits.code_pf }}</strong><span class="ac-desig">{{ x.ordres_fabrication.produits.designation }}</span></span><span v-else>—</span></td>
                  <td>{{ x.phase }}</td>
                  <td class="ac-r">{{ x.quantite_entree != null ? fmt(x.quantite_entree) : '—' }}</td>
                  <td class="ac-nowrap">{{ x.ordres_fabrication.date_fin_fabrication }}</td>
                  <td class="ac-r"><button class="ac-link" @click="allerVersLot(x)">Corriger ›</button></td>
                </tr>
                <tr v-if="filtreAC && !aCompleterFiltre.length"><td colspan="6" class="ac-vide">Aucune phase ne correspond au filtre.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card">
        <label class="lot-select">Recherche produit / lot
          <input v-model="rechercheLot" type="search" class="lot-search" placeholder="Code produit, désignation ou n° de lot…" />
        </label>
        <label class="lot-select">Lot <span class="lot-count">{{ lotsFiltres.length }}</span>
          <select v-model="lotId">
            <option value="">— Choisir un lot —</option>
            <option v-for="l in lotsFiltres" :key="l.id" :value="l.id">
              {{ l.numero_lot }} · {{ l.produits ? l.produits.code_pf + ' ' + l.produits.designation : '' }}
            </option>
          </select>
          <span v-if="rechercheLot && !lotsFiltres.length" class="lot-vide">Aucun lot ne correspond à « {{ rechercheLot }} ».</span>
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
              <select v-model="form.phase" @change="onPhaseChange">
                <option v-for="ph in PHASES" :key="ph" :value="ph">{{ ph }}</option>
              </select>
            </label>
            <label>Ligne / équipement — {{ form.phase }}
              <select v-model="form.equipement_id">
                <option value="">—</option>
                <option v-for="e in equipementsFiltres" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
              </select>
            </label>
            <label>Quantité entrée (kg)<input v-model="form.quantite_entree" type="number" step="any" placeholder="250" disabled title="Figée = sortie de la phase précédente." /></label>
            <label>Quantité sortie (kg)<input id="fp-sortie" v-model="form.quantite_sortie" type="number" step="any" placeholder="245" :disabled="['Pesée', 'Granulation'].includes(form.phase)" :title="['Pesée', 'Granulation'].includes(form.phase) ? 'Figée = entrée (pas de perte).' : 'À saisir : poids réel après pertes.'" /></label>
            <label>Date début<input v-model="form.date_debut" type="date" /></label>
            <label>Date fin<input v-model="form.date_phase" type="date" /></label>
            <label>Statut (automatique)<input :value="form.date_phase ? 'Terminé' : (form.date_debut ? 'En cours' : 'À faire')" disabled title="À faire → En cours (date début) → Terminé (date fin)." /></label>
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
                  <th class="right">Rendement</th><th>Début</th><th>Fin</th><th>Statut</th><th class="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in phases" :key="p.id">
                  <td class="strong">{{ p.phase }}</td>
                  <td>{{ p.equipements ? p.equipements.code : '—' }}</td>
                  <td class="right">{{ fmt(entreeEffective(p)) }}</td>
                  <td class="right">{{ fmt(p.quantite_sortie) }}</td>
                  <td class="right" :class="rendement(p) != null && rendement(p) < 95 ? 'rdt-bas' : ''">{{ fmtPct(rendement(p)) }}</td>
                  <td>{{ fmtDate(p.date_debut) }}</td>
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
.lot-select select { font-size: 14px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 500; color: #1b2733; }
.lot-select select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.lot-select { margin-bottom: 12px; }
.lot-search { font-size: 14px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 500; color: #1b2733; }
.lot-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.lot-count { display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; margin-left: 6px; }
.lot-vide { font-size: 12px; color: #b45309; font-weight: 500; }

.lot-info { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #eef2f6; font-size: 14px; }
.lot-info .lbl { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; margin-bottom: 2px; }
.rdt-global strong { color: #0f766e; font-size: 16px; }

.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: end; }
.form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.form-grid .wide { grid-column: span 2; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.form-grid input:disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
.hint-q { font-weight: 500; font-size: 11px; color: #94a3b8; }
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
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }
.rdt-bas { color: #b91c1c; font-weight: 700; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-todo { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #dcfce7; color: #166534; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

.hint-select { color: #64748b; font-size: 14px; padding: 8px 2px; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
}
.ac-head { display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none; }
.ac-badge { display: inline-block; background: #f59e0b; color: #fff; font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 10px; margin-left: 6px; }
.ac-chev { color: #94a3b8; }
.ac-hint { color: #64748b; font-size: 13px; margin: 8px 0 12px; }
.ac-scroll { overflow-x: auto; }
.ac-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ac-table th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.ac-table td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.ac-r { text-align: right; }
.ac-mono { font-family: ui-monospace, monospace; font-weight: 600; }
.ac-nowrap { white-space: nowrap; }
.ac-link { background: none; border: 0; color: #2563eb; font-weight: 600; cursor: pointer; font-size: 13px; }
.ac-link:hover { text-decoration: underline; }
.ac-desig { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
.ac-filtre { display: flex; align-items: center; gap: 12px; margin: 0 0 11px; flex-wrap: wrap; }
.ac-filtre input { flex: 1; min-width: 220px; max-width: 380px; padding: 7px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.ac-count { font-size: 12.5px; color: #64748b; font-weight: 600; }
.ac-vide { text-align: center; color: #94a3b8; padding: 14px; font-style: italic; }
</style>
