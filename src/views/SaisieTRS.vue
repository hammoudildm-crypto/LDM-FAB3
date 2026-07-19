<script setup>
import { ref, reactive, computed, inject, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))

const equipements = ref([])
const produits = ref([])
const cadences = ref([])
const cadIn = ref('')
const cadUniteIn = ref('kg/h')
const cadMsg = ref('')
const saisies = ref([])
const msg = ref('')
const ok = ref('')

const phaseFiltre = ref('')
const equipId = ref('')
const produitId = ref('')
const rechercheProduit = ref('')
const dateSel = ref(new Date().toISOString().slice(0, 10))
const poste = ref(1)

const form = reactive({
  temps_ouverture_min: 450,
  arret_panne_min: 0, arret_format_min: 0, arret_nettoyage_min: 0,
  arret_reglage_min: 0, arret_maintenance_min: 0, arret_attente_min: 0, arret_autre_min: 0,
  production_realisee: 0, rebuts: 0, commentaire: ''
})

const MOTIFS = [
  ['arret_panne_min', 'Panne'], ['arret_format_min', 'Changement de format'],
  ['arret_nettoyage_min', 'Nettoyage'], ['arret_reglage_min', 'Réglage'],
  ['arret_maintenance_min', 'Maintenance'], ['arret_attente_min', 'Attente (matière/perso.)'],
  ['arret_autre_min', 'Autre']
]

async function charger() {
  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (!re.error) equipements.value = re.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation').eq('actif', true).order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  const rc = await supabase.from('cadences_produit').select('*')
  if (!rc.error) cadences.value = rc.data || []
  const rs = await supabase.from('trs_postes').select('*, equipements(code, nom), produits(code_pf)').eq('actif', true).order('date', { ascending: false }).order('poste').limit(40)
  if (!rs.error) saisies.value = rs.data || []
}
onMounted(charger)

const equip = computed(() => equipements.value.find(e => e.id === equipId.value))
const phases = computed(() => { const s = new Set(); for (const e of equipements.value) if (e.type) s.add(e.type); return [...s].sort() })
const equipementsFiltres = computed(() => phaseFiltre.value ? equipements.value.filter(e => e.type === phaseFiltre.value) : equipements.value)
function onPhaseChange() { equipId.value = '' }
const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produits.value
  return produits.value.filter(p => (String(p.code_pf || '') + ' ' + String(p.designation || '')).toLowerCase().includes(q))
})
const cadenceObj = computed(() => cadences.value.find(c => c.equipement_id === equipId.value && c.produit_id === produitId.value) || null)
const cadence = computed(() => cadenceObj.value && cadenceObj.value.cadence_nominale != null ? Number(cadenceObj.value.cadence_nominale) : 0)
const cadenceMode = computed(() => cadenceObj.value ? (cadenceObj.value.mode || 'debit') : 'debit')
const uniteCad = computed(() => cadenceObj.value && cadenceObj.value.unite_cadence ? cadenceObj.value.unite_cadence : 'unités/h')

// Enregistrer la cadence directement depuis la Saisie TRS (évite l'aller-retour
// vers Référentiels et recharge la liste sur place -> plus de discordance).
async function enregistrerCadenceInline() {
  cadMsg.value = ''
  if (!equipId.value || !produitId.value) { cadMsg.value = 'Choisir équipement et produit.'; return }
  const v = cadIn.value === '' ? null : Number(cadIn.value)
  if (!(v > 0)) { cadMsg.value = 'Valeur > 0 requise.'; return }
  // Nettoie toute ligne existante pour ce couple (doublons / valeurs nulles), puis réinsère.
  const del = await supabase.from('cadences_produit').delete().eq('equipement_id', equipId.value).eq('produit_id', produitId.value)
  if (del.error) { cadMsg.value = 'Erreur suppression : ' + del.error.message; return }
  const r = await supabase.from('cadences_produit').insert(
    { equipement_id: equipId.value, produit_id: produitId.value, cadence_nominale: v, unite_cadence: cadUniteIn.value, mode: 'debit' })
  if (r.error) { cadMsg.value = 'Erreur enregistrement : ' + r.error.message; return }
  cadIn.value = ''
  await charger()
  if (!cadenceObj.value || !cadence.value) { cadMsg.value = 'Enregistré, mais toujours pas relu — préviens le support.'; return }
  cadMsg.value = ''
}

function chargerContexte() {
  const ex = saisies.value.find(s => s.equipement_id === equipId.value && s.date === dateSel.value && s.poste === Number(poste.value))
  if (ex) {
    if (ex.produit_id) produitId.value = ex.produit_id
    form.temps_ouverture_min = ex.temps_ouverture_min
    for (const m of MOTIFS) form[m[0]] = ex[m[0]] || 0
    form.production_realisee = ex.production_realisee || 0
    form.rebuts = ex.rebuts || 0
    form.commentaire = ex.commentaire || ''
  }
}

const sommeArrets = computed(() => MOTIFS.reduce((s, m) => s + (Number(form[m[0]]) || 0), 0))
const tempsFonct = computed(() => Math.max(0, (Number(form.temps_ouverture_min) || 0) - sommeArrets.value))
const dispo = computed(() => { const to = Number(form.temps_ouverture_min) || 0; return to ? tempsFonct.value / to : 0 })
const perf = computed(() => {
  const prod = Number(form.production_realisee) || 0
  if (cadenceMode.value === 'cycle') return tempsFonct.value ? Math.min(1, prod / tempsFonct.value) : 0
  const theo = (tempsFonct.value / 60) * cadence.value
  return theo ? Math.min(1, prod / theo) : 0
})
const qualite = computed(() => {
  if (cadenceMode.value === 'cycle') return 1
  const p = Number(form.production_realisee) || 0
  return p ? Math.max(0, (p - (Number(form.rebuts) || 0)) / p) : 0
})
const trs = computed(() => dispo.value * perf.value * qualite.value)
const pct = (x) => (x * 100).toFixed(1) + ' %'

async function enregistrer() {
  msg.value = ''
  if (!equipId.value) { msg.value = 'Choisir un équipement.'; return }
  if (!produitId.value) { msg.value = 'Choisir le produit qui tournait sur ce poste.'; return }
  if (!cadenceObj.value) { msg.value = "Ce produit sur cet équipement n'a pas de mode/cadence défini — renseigne-le dans Référentiels › Cadences."; return }
  if (cadenceMode.value === 'debit' && !cadence.value) { msg.value = "Renseigner la cadence (débit) dans Référentiels › Cadences."; return }
  const payload = {
    equipement_id: equipId.value, produit_id: produitId.value, date: dateSel.value, poste: Number(poste.value),
    temps_ouverture_min: Number(form.temps_ouverture_min) || 0,
    production_realisee: Number(form.production_realisee) || 0,
    rebuts: Number(form.rebuts) || 0, commentaire: form.commentaire || null
  }
  for (const m of MOTIFS) payload[m[0]] = Number(form[m[0]]) || 0
  const r = await supabase.from('trs_postes').upsert(payload, { onConflict: 'equipement_id,date,poste' })
  if (r.error) { msg.value = r.error.message; return }
  const trsFige = pct(trs.value)
  await charger()
  ok.value = 'Poste enregistré (TRS ' + trsFige + ').'; setTimeout(() => ok.value = '', 3500)
  // vider les champs pour la saisie suivante
  form.temps_ouverture_min = 450
  for (const m of MOTIFS) form[m[0]] = 0
  form.production_realisee = 0
  form.rebuts = 0
  form.commentaire = ''
}

function trsSaisie(s) {
  const arr = MOTIFS.reduce((t, m) => t + (s[m[0]] || 0), 0)
  const to = s.temps_ouverture_min || 0
  const tf = Math.max(0, to - arr)
  return { arr, tf }
}
const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('fr-FR')
</script>

<template>
  <div class="trs-page">
    <PageHeader title="Saisie TRS" tone="indigo"
      subtitle="Temps, arrêts, production et rebuts par équipement, produit et poste (3×8).">
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="ok" class="okmsg">{{ ok }}</p>

    <section class="card">
      <div class="sel-row">
        <label>Phase / Atelier
          <select v-model="phaseFiltre" @change="onPhaseChange">
            <option value="">— Toutes —</option>
            <option v-for="ph in phases" :key="ph" :value="ph">{{ ph }}</option>
          </select>
        </label>
        <label>Équipement
          <select v-model="equipId" @change="chargerContexte">
            <option value="">— Choisir —</option>
            <option v-for="e in equipementsFiltres" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
          </select>
        </label>
        <label>Produit
          <input class="prod-search" v-model="rechercheProduit" placeholder="Rechercher (code / nom)…" />
          <select v-model="produitId">
            <option value="">— {{ produitsFiltres.length }} produit(s) —</option>
            <option v-for="p in produitsFiltres" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option>
          </select>
        </label>
        <label>Date
          <input type="date" v-model="dateSel" @change="chargerContexte" />
        </label>
        <label>Poste
          <select v-model.number="poste" @change="chargerContexte">
            <option :value="1">Poste 1</option>
            <option :value="2">Poste 2</option>
            <option :value="3">Poste 3</option>
          </select>
        </label>
      </div>

      <div v-if="equipId && produitId" class="cad-row">
        <span class="cad-lbl">Cadence de ce produit sur cet équipement :</span>
        <span class="cad-val" v-if="cadenceMode === 'cycle'">Mesuré au temps écoulé</span>
        <span class="cad-val" v-else>{{ cadence ? cadence.toLocaleString('fr-FR') + ' ' + uniteCad : '—' }}</span>
        <span v-if="cadenceMode === 'debit' && !cadence" class="cad-warn">⚠ non définie</span>
        <span v-if="peutEditer && cadenceMode === 'debit' && !cadence" class="cad-inline">
          <input type="number" step="any" min="0" v-model="cadIn" placeholder="cadence" class="cad-inline-in" @keyup.enter="enregistrerCadenceInline" />
          <select v-model="cadUniteIn" class="cad-inline-sel"><option value="kg/h">kg/h</option><option value="unités/h">unités/h</option></select>
          <button class="cad-inline-btn" @click="enregistrerCadenceInline">Enregistrer ici</button>
          <span v-if="cadMsg" class="cad-inline-msg">{{ cadMsg }}</span>
        </span>
      </div>
      <p v-else class="hint">Choisis un équipement <b>et</b> un produit : la cadence est propre à chaque couple.</p>
    </section>

    <section v-if="equipId && produitId" class="card">
      <div class="grid2">
        <div>
          <h3 class="card-title">Temps du poste (minutes)</h3>
          <label class="fl">Temps d'ouverture (pause 30 min déduite)<input type="number" v-model.number="form.temps_ouverture_min" /></label>
          <div class="motifs">
            <label v-for="m in MOTIFS" :key="m[0]" class="fl" :class="{ hl: m[0] === 'arret_nettoyage_min' }">{{ m[1] }}<input type="number" min="0" v-model.number="form[m[0]]" /></label>
          </div>
          <div class="sub">Σ arrêts : <b>{{ sommeArrets }}</b> min · Fonctionnement : <b>{{ tempsFonct }}</b> min</div>
        </div>
        <div>
          <h3 class="card-title">Production</h3>
          <label class="fl">{{ cadenceMode === 'cycle' ? 'Temps écoulé (min)' : 'Production réalisée (' + uniteCad.replace('/h','') + ')' }}<input type="number" min="0" v-model.number="form.production_realisee" /></label>
          <label v-if="cadenceMode !== 'cycle'" class="fl">Rebuts<input type="number" min="0" v-model.number="form.rebuts" /></label>
          <label class="fl">Commentaire<input type="text" v-model="form.commentaire" placeholder="Optionnel" /></label>

          <div class="trs-box">
            <div class="trs-line"><span>Disponibilité</span><b>{{ pct(dispo) }}</b></div>
            <div class="trs-line"><span>Performance</span><b>{{ pct(perf) }}</b></div>
            <div class="trs-line"><span>Qualité</span><b>{{ pct(qualite) }}</b></div>
            <div class="trs-total"><span>TRS</span><b>{{ pct(trs) }}</b></div>
          </div>
          <button v-if="peutEditer" class="btn" @click="enregistrer">Enregistrer le poste</button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3 class="card-title">Dernières saisies</h3>
      <div v-if="!saisies.length" class="empty">Aucune saisie pour l'instant.</div>
      <div v-else class="table-scroll">
        <table class="mini">
          <thead><tr><th>Date</th><th>Poste</th><th>Équip.</th><th>Produit</th><th class="right">Ouv.</th><th class="right">Arrêts</th><th class="right">Fonct.</th><th class="right">Nettoyage</th></tr></thead>
          <tbody>
            <tr v-for="s in saisies" :key="s.id">
              <td class="nowrap">{{ s.date }}</td>
              <td>P{{ s.poste }}</td>
              <td>{{ s.equipements ? s.equipements.code : '—' }}</td>
              <td>{{ s.produits ? s.produits.code_pf : '—' }}</td>
              <td class="right">{{ fmt(s.temps_ouverture_min) }}</td>
              <td class="right">{{ fmt(trsSaisie(s).arr) }}</td>
              <td class="right">{{ fmt(trsSaisie(s).tf) }}</td>
              <td class="right">{{ fmt(s.arret_nettoyage_min) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.trs-page { color: #1b2733; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.okmsg { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.sel-row { display: flex; gap: 14px; flex-wrap: wrap; }
.sel-row label, .fl { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.sel-row select, .sel-row input, .fl input { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 500; }
.sel-row select { max-width: 320px; }
.prod-search { font-size: 13px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 5px; max-width: 320px; }
.cad-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; font-size: 14px; }
.cad-lbl { font-weight: 600; color: #475569; }
.cad-row input { font-size: 14px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 130px; }
.cad-unit { color: #64748b; }
.cad-val { font-weight: 700; color: #4338ca; font-size: 15px; }
.cad-warn { color: #d97706; font-size: 12px; font-weight: 600; }
.hint { margin-top: 12px; color: #64748b; font-size: 13px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.fl { margin-bottom: 10px; }
.motifs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fl.hl input { border-color: #0f766e; background: #f0fdfa; }
.sub { font-size: 13px; color: #64748b; margin-top: 8px; }
.trs-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin: 14px 0; background: #f8fafc; }
.trs-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: #475569; }
.trs-line b { color: #1b2733; }
.trs-total { display: flex; justify-content: space-between; padding: 8px 0 2px; margin-top: 6px; border-top: 2px solid #e2e8f0; font-size: 17px; font-weight: 700; }
.trs-total b { color: #4338ca; }
.btn { font-size: 14px; font-weight: 600; padding: 9px 16px; border: 0; border-radius: 8px; background: #4338ca; color: #fff; cursor: pointer; }
.btn-sm { font-size: 13px; font-weight: 600; padding: 6px 12px; border: 1px solid #4338ca; border-radius: 8px; background: #fff; color: #4338ca; cursor: pointer; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.empty { color: #94a3b8; text-align: center; padding: 16px; font-style: italic; }
@media (max-width: 800px) { .grid2 { grid-template-columns: 1fr; } .motifs { grid-template-columns: 1fr; } }
.cad-inline { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; }
.cad-inline-in { width: 110px; font-size: 13px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.cad-inline-sel { font-size: 13px; padding: 5px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.cad-inline-btn { font-size: 13px; font-weight: 700; color: #fff; background: #0f766e; border: 0; border-radius: 7px; padding: 6px 12px; cursor: pointer; }
.cad-inline-btn:hover { background: #0b5b55; }
.cad-inline-msg { font-size: 12.5px; font-weight: 700; color: #b91c1c; margin-left: 8px; }
</style>
