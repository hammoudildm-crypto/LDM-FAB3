<template>
  <div class="pqr-page">
    <PageHeader title="Référentiel PQR — Protocole de validation procédé" tone="#a855f7"
      subtitle="Protocole de validation des procédés de fabrication : approche, critères d'acceptation et lots de validation par produit." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Protocole de validation</h2>
        <span v-if="produitSel" class="count" :class="'badge-' + protocole.statut">{{ statutLabel(protocole.statut) }}</span>
        <input v-model="recherche" class="pqr-search" placeholder="🔍 Rechercher un produit…" style="margin-left:auto" />
        <select v-model="produitSel" class="prod-sel">
          <option value="">— Choisir un produit —</option>
          <option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option>
        </select>
      </div>

      <div v-if="!produitSel" class="empty-card">Choisis un produit pour créer ou consulter son protocole de validation procédé.</div>

      <template v-else>
        <!-- En-tête du protocole -->
        <div class="pv-grid">
          <label class="pv-f"><span>Référence</span><input v-model="protocole.reference" :disabled="!peutEditer" placeholder="PV-…" /></label>
          <label class="pv-f"><span>Approche</span>
            <select v-model="protocole.approche" :disabled="!peutEditer"><option value="">—</option><option value="prospective">Prospective</option><option value="concurrente">Concurrente</option><option value="retrospective">Rétrospective</option></select>
          </label>
          <label class="pv-f"><span>Nature</span>
            <select v-model="protocole.nature" :disabled="!peutEditer"><option value="">—</option><option value="initiale">Validation initiale</option><option value="revalidation">Revalidation</option><option value="transfert">Transfert</option></select>
          </label>
          <label class="pv-f pv-sm"><span>Nb lots</span><input v-model.number="protocole.nb_lots" type="number" min="1" :disabled="!peutEditer" /></label>
          <label class="pv-f pv-sm"><span>Date protocole</span><input v-model="protocole.date_protocole" type="date" :disabled="!peutEditer" /></label>
          <label class="pv-f"><span>Responsable</span><input v-model="protocole.responsable" :disabled="!peutEditer" placeholder="Nom / fonction" /></label>
          <label class="pv-f"><span>Statut</span>
            <select v-model="protocole.statut" :disabled="!peutEditer"><option value="brouillon">Brouillon</option><option value="en_cours">En cours</option><option value="valide">Validé</option><option value="cloture">Clôturé</option></select>
          </label>
        </div>
        <div class="pv-grid2">
          <label class="pv-f"><span>Portée / objectif</span><textarea v-model="protocole.portee" :disabled="!peutEditer" rows="2" placeholder="Procédé, dosage, taille de lot, équipements concernés…"></textarea></label>
          <label class="pv-f"><span>Critères d'acceptation (généraux)</span><textarea v-model="protocole.criteres" :disabled="!peutEditer" rows="2" placeholder="Ex. 3 lots consécutifs conformes à toutes les specs ; RSD ≤ … ; dissolution ≥ …"></textarea></label>
        </div>
        <div v-if="peutEditer" class="pv-save">
          <button class="btn" @click="enregistrerProtocole">💾 {{ protocole.id ? 'Mettre à jour le protocole' : 'Créer le protocole' }}</button>
        </div>

        <!-- Paramètres critiques à valider -->
        <h3 class="pv-sect">Paramètres critiques à valider <span class="pv-sect-sub">critères d'acceptation issus des « Paramètres critiques » du produit</span></h3>
        <div v-if="!paramsProduit.length" class="pqr-note">Aucun paramètre critique défini pour ce produit. Renseigne-les d'abord dans « Paramètres critiques ».</div>
        <div v-for="ph in phasesAffichees" :key="ph" class="pqr-phase">
          <h4 class="pqr-phase-titre">{{ ph }}</h4>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Min</th><th class="r">Cible</th><th class="r">Max</th></tr></thead>
            <tbody>
              <tr v-for="p in paramsDe(ph)" :key="p.id">
                <td class="nom">{{ p.nom }}<span v-if="p.par_api" class="tag-api">par API</span></td>
                <td>{{ p.type === 'bool' ? '—' : (effUnite(p) || '—') }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(effMin(p)) }}</td>
                <td class="r cible">{{ p.type === 'bool' ? (p.etat_attendu ? 'Attendu : ' + p.etat_attendu : 'ON/OFF') : fmt(effCible(p)) }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(effMax(p)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Lots de validation -->
        <h3 class="pv-sect">Lots de validation <span class="pv-sect-sub">{{ lotsConformes }}/{{ lots.length }} conforme(s) · objectif {{ protocole.nb_lots }} lot(s)</span></h3>
        <div class="pv-tbl-wrap">
          <table class="pqr-tbl pv-lots">
            <thead><tr><th>#</th><th>N° lot</th><th class="r">Taille (bts)</th><th>Date fab.</th><th>Statut</th><th>Écarts / observations</th><th v-if="peutEditer" class="r">Act.</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in lots" :key="l._k">
                <td>{{ i + 1 }}</td>
                <td><input v-model="l.numero_lot" :disabled="!peutEditer" class="pv-in" placeholder="N° lot" /></td>
                <td class="r"><input v-model.number="l.taille_lot" type="number" min="0" :disabled="!peutEditer" class="pv-in pv-in-n" placeholder="—" /></td>
                <td><input v-model="l.date_fabrication" type="date" :disabled="!peutEditer" class="pv-in" /></td>
                <td><select v-model="l.statut" :disabled="!peutEditer" class="pv-in pv-st" :class="'st-' + l.statut"><option value="prevu">Prévu</option><option value="en_cours">En cours</option><option value="conforme">Conforme</option><option value="non_conforme">Non conforme</option></select></td>
                <td><input v-model="l.ecarts" :disabled="!peutEditer" class="pv-in pv-in-w" placeholder="—" /></td>
                <td v-if="peutEditer" class="act"><button @click="retirerLot(i)" title="Retirer">🗑</button></td>
              </tr>
              <tr v-if="!lots.length"><td :colspan="peutEditer ? 7 : 6" class="pv-empty">Aucun lot de validation.</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="peutEditer" class="pv-lots-actions">
          <button class="btn ghost" @click="ajouterLot">＋ Ajouter un lot</button>
          <button v-if="lots.length < (Number(protocole.nb_lots) || 0)" class="btn ghost" @click="ajouterLotsObjectif">＋ Compléter à {{ protocole.nb_lots }} lots</button>
          <button class="btn" @click="enregistrerLots" :disabled="!protocole.id">💾 Enregistrer les lots</button>
        </div>
        <p v-if="!protocole.id" class="pqr-note">Crée d'abord le protocole (bouton plus haut) pour pouvoir enregistrer les lots.</p>

        <!-- Conclusion -->
        <h3 class="pv-sect">Conclusion</h3>
        <textarea v-model="protocole.conclusion" :disabled="!peutEditer" rows="3" class="pv-concl" placeholder="Synthèse : procédé validé / non validé, écarts rencontrés, actions, références documentaires…"></textarea>
        <div v-if="peutEditer" class="pv-save"><button class="btn" @click="enregistrerProtocole">💾 Enregistrer le protocole</button></div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const produits = ref([]), produitSel = ref(''), recherche = ref('')
const params = ref([])      // référentiel pqr_parametres
const specs = ref({})       // specs produit : parametre_id -> {min,cible,max,unite}
const protocoleVide = () => ({ id: null, reference: '', approche: '', nature: '', nb_lots: 3, portee: '', criteres: '', responsable: '', statut: 'brouillon', date_protocole: '', conclusion: '' })
const protocole = reactive(protocoleVide())
const lots = ref([])
const erreur = ref(''), message = ref('')
let lotSeq = 1

const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Contrôle Qualité']
const PHASES_PROD = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']

async function charger() {
  const r = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (!r.error) params.value = r.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation, gamme').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
}
onMounted(charger)

const normR = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const produitsFiltres = computed(() => { const q = normR(recherche.value).trim(); if (!q) return produits.value; return produits.value.filter(pr => normR((pr.code_pf || '') + ' ' + (pr.designation || '')).includes(q)) })
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
function normPhaseG(ph) { return /^(granulation|s[ée]chage)$/i.test(String(ph).trim()) ? 'Granulation et Séchage' : ph }
function normGammeFab(g) { if (!Array.isArray(g) || !g.length) return PHASES_PROD.slice(); const out = []; for (const ph of g) { const n = normPhaseG(ph); if (PHASES_PROD.includes(n) && !out.includes(n)) out.push(n) } return out.length ? out : PHASES_PROD.slice() }
const gammeProduit = computed(() => { if (!produitSel.value) return null; const pr = produits.value.find(x => String(x.id) === produitSel.value); if (!pr) return null; const ph = normGammeFab(pr.gamme); ph.push('Contrôle Qualité'); return ph })
const paramsProduit = computed(() => { const g = gammeProduit.value; if (!g) return []; return params.value.filter(p => g.includes(p.phase)) })
const phasesAffichees = computed(() => [...new Set(paramsProduit.value.map(p => p.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
function paramsDe(ph) { return paramsProduit.value.filter(p => p.phase === ph).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id) }

const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : v
const effMin = (p) => { const s = specs.value[p.id]; return s && s.min != null && s.min !== '' ? s.min : p.limite_min }
const effCible = (p) => { const s = specs.value[p.id]; return s && s.cible != null && s.cible !== '' ? s.cible : p.cible }
const effMax = (p) => { const s = specs.value[p.id]; return s && s.max != null && s.max !== '' ? s.max : p.limite_max }
const effUnite = (p) => { const s = specs.value[p.id]; return s && s.unite ? s.unite : p.unite }

const lotsConformes = computed(() => lots.value.filter(l => l.statut === 'conforme').length)
function statutLabel(s) { return ({ brouillon: 'Brouillon', en_cours: 'En cours', valide: 'Validé', cloture: 'Clôturé' })[s] || s }
const tableAbsente = (m) => /relation|does not exist|schema cache|could not find the table/i.test(m || '')

watch(produitSel, async (pid) => {
  erreur.value = ''; message.value = ''
  Object.assign(protocole, protocoleVide()); lots.value = []; specs.value = {}
  if (!pid) return
  const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (!rs.error) { const by = {}; for (const sp of (rs.data || [])) by[sp.parametre_id] = { min: sp.limite_min, cible: sp.cible, max: sp.limite_max, unite: sp.unite }; specs.value = by }
  const rp = await supabase.from('pqr_validation_protocoles').select('*').eq('produit_id', Number(pid)).eq('actif', true).limit(1)
  if (rp.error) { erreur.value = tableAbsente(rp.error.message) ? 'Tables de validation absentes — exécute la migration 007_pqr_validation.sql dans Supabase.' : rp.error.message; return }
  const proto = (rp.data || [])[0]
  if (proto) {
    Object.assign(protocole, { id: proto.id, reference: proto.reference || '', approche: proto.approche || '', nature: proto.nature || '', nb_lots: proto.nb_lots || 3, portee: proto.portee || '', criteres: proto.criteres || '', responsable: proto.responsable || '', statut: proto.statut || 'brouillon', date_protocole: proto.date_protocole || '', conclusion: proto.conclusion || '' })
    const rl = await supabase.from('pqr_validation_lots').select('*').eq('protocole_id', proto.id).order('ordre')
    if (!rl.error) lots.value = (rl.data || []).map(l => ({ _k: lotSeq++, id: l.id, numero_lot: l.numero_lot || '', taille_lot: l.taille_lot, date_fabrication: l.date_fabrication || '', statut: l.statut || 'prevu', ecarts: l.ecarts || '' }))
  }
})

function payloadProto(pid) { return { produit_id: pid, reference: protocole.reference || null, approche: protocole.approche || null, nature: protocole.nature || null, nb_lots: Number(protocole.nb_lots) || 3, portee: protocole.portee || null, criteres: protocole.criteres || null, responsable: protocole.responsable || null, statut: protocole.statut || 'brouillon', date_protocole: protocole.date_protocole || null, conclusion: protocole.conclusion || null } }

async function enregistrerProtocole() {
  erreur.value = ''; message.value = ''
  const pid = Number(produitSel.value); if (!pid) return
  const payload = payloadProto(pid)
  let r
  if (protocole.id) r = await supabase.from('pqr_validation_protocoles').update(payload).eq('id', protocole.id).select('id').single()
  else r = await supabase.from('pqr_validation_protocoles').insert(payload).select('id').single()
  if (r.error) { erreur.value = tableAbsente(r.error.message) ? 'Tables de validation absentes — exécute la migration 007_pqr_validation.sql dans Supabase.' : r.error.message; return }
  if (r.data) protocole.id = r.data.id
  message.value = 'Protocole enregistré.'
}

function ajouterLot() { lots.value.push({ _k: lotSeq++, id: null, numero_lot: '', taille_lot: null, date_fabrication: '', statut: 'prevu', ecarts: '' }) }
function ajouterLotsObjectif() { let g = 0; while (lots.value.length < (Number(protocole.nb_lots) || 3) && g++ < 60) ajouterLot() }
function retirerLot(i) { lots.value.splice(i, 1) }

async function enregistrerLots() {
  erreur.value = ''; message.value = ''
  if (!protocole.id) { erreur.value = 'Crée d\'abord le protocole.'; return }
  const del = await supabase.from('pqr_validation_lots').delete().eq('protocole_id', protocole.id)
  if (del.error) { erreur.value = del.error.message; return }
  const rows = lots.value.map((l, i) => ({ protocole_id: protocole.id, numero_lot: l.numero_lot || null, taille_lot: (l.taille_lot === '' || l.taille_lot == null) ? null : Number(l.taille_lot), date_fabrication: l.date_fabrication || null, statut: l.statut || 'prevu', ecarts: l.ecarts || null, ordre: i }))
  if (rows.length) { const ins = await supabase.from('pqr_validation_lots').insert(rows); if (ins.error) { erreur.value = ins.error.message; return } }
  message.value = 'Lots de validation enregistrés.'
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.badge-en_cours { background: #fef9c3; color: #854d0e; }
.badge-valide { background: #dcfce7; color: #166534; }
.badge-cloture { background: #e0e7ff; color: #3730a3; }
.prod-sel { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; max-width: 340px; }
.pqr-search { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 220px; }
.pqr-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.pqr-note { background: #faf5ff; border: 1px solid #e9d5ff; color: #6b21a8; padding: 9px 13px; border-radius: 8px; font-size: 13px; margin: 10px 0 0; }

.pv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 14px; }
.pv-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin-top: 12px; }
.pv-f { display: flex; flex-direction: column; gap: 4px; }
.pv-f > span { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.pv-f input, .pv-f select, .pv-f textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pv-f textarea { resize: vertical; }
.pv-f input:focus, .pv-f select:focus, .pv-f textarea:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pv-sm { max-width: 130px; }
.pv-save { margin-top: 14px; }
@media (max-width: 720px) { .pv-grid2 { grid-template-columns: 1fr; } }

.pv-sect { margin: 26px 0 8px; font-size: 14px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #eef2f6; padding-bottom: 6px; }
.pv-sect-sub { font-size: 11.5px; font-weight: 500; color: #94a3b8; text-transform: none; letter-spacing: 0; margin-left: 4px; }

.pqr-phase { margin-top: 14px; }
.pqr-phase-titre { margin: 0 0 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; border-left: 3px solid #a855f7; padding-left: 8px; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.cible { color: #a855f7; font-weight: 700; }
.pqr-tbl td.act { text-align: right; white-space: nowrap; }
.pqr-tbl td.act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; }
.tag-api { font-size: 9px; font-weight: 800; background: #faf5ff; color: #7c3aed; padding: 1px 6px; border-radius: 999px; vertical-align: middle; margin-left: 4px; }

.pv-tbl-wrap { overflow-x: auto; }
.pv-lots td { vertical-align: middle; }
.pv-in { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; background: #fff; color: #0f172a; width: 100%; box-sizing: border-box; }
.pv-in:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pv-in-n { text-align: right; font-variant-numeric: tabular-nums; max-width: 110px; }
.pv-in-w { min-width: 220px; }
.pv-st { font-weight: 700; }
.pv-st.st-conforme { color: #166534; }
.pv-st.st-non_conforme { color: #b91c1c; }
.pv-st.st-en_cours { color: #854d0e; }
.pv-st.st-prevu { color: #64748b; }
.pv-empty { text-align: center; color: #94a3b8; padding: 18px; }
.pv-lots-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.pv-concl { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; resize: vertical; }
.pv-concl:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
</style>
