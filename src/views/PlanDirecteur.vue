<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const anneeCourante = new Date().getFullYear()
const ANNEES = [anneeCourante - 1, anneeCourante, anneeCourante + 1, anneeCourante + 2]

const annee = ref(anneeCourante)
const produits = ref([])
const cellules = reactive({})   // cellules[produit_id][mois] = '' | nombre
const erreur = ref('')
const message = ref('')
const enCours = ref(false)

function initCellules() {
  Object.keys(cellules).forEach(k => delete cellules[k])
  for (const p of produits.value) {
    cellules[p.id] = {}
    for (let m = 1; m <= 12; m++) cellules[p.id][m] = ''
  }
}

async function chargerProduits() {
  erreur.value = ''
  const r = await supabase.from('produits')
    .select('id, code_pf, designation, pcsu, donneurs_ordre(nom)')
    .eq('actif', true).order('code_pf')
  if (r.error) { erreur.value = r.error.message; return }
  produits.value = r.data
  initCellules()
}

async function chargerPlan() {
  erreur.value = ''
  message.value = ''
  initCellules()
  const r = await supabase.from('plan_production')
    .select('produit_id, mois, quantite_planifiee').eq('annee', annee.value)
  if (r.error) { erreur.value = r.error.message; return }
  for (const row of r.data) {
    if (cellules[row.produit_id]) cellules[row.produit_id][row.mois] = row.quantite_planifiee
  }
}

function totalLigne(p) {
  let t = 0
  for (let m = 1; m <= 12; m++) {
    const v = cellules[p.id] ? cellules[p.id][m] : ''
    if (v !== '' && v != null) t += Number(v)
  }
  return t
}
function valeurLigne(p) {
  const pcsu = p.pcsu ? Number(p.pcsu) : 0
  return Math.round(totalLigne(p) * pcsu)
}
function totalMois(m) {
  let t = 0
  for (const p of produits.value) {
    const v = cellules[p.id] ? cellules[p.id][m] : ''
    if (v !== '' && v != null) t += Number(v)
  }
  return t
}
const totalGeneral = computed(() => produits.value.reduce((s, p) => s + totalLigne(p), 0))
const valeurGenerale = computed(() => produits.value.reduce((s, p) => s + valeurLigne(p), 0))

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  enCours.value = true
  const rows = []
  for (const p of produits.value) {
    for (let m = 1; m <= 12; m++) {
      const v = cellules[p.id][m]
      if (v !== '' && v != null) rows.push({ produit_id: p.id, annee: annee.value, mois: m, quantite_planifiee: Number(v) })
    }
  }
  if (!rows.length) { message.value = 'Rien à enregistrer (toutes les cases sont vides).'; enCours.value = false; return }
  const res = await supabase.from('plan_production').upsert(rows, { onConflict: 'produit_id,annee,mois' })
  enCours.value = false
  if (res.error) { erreur.value = res.error.message; return }
  message.value = 'Plan ' + annee.value + ' enregistré (' + rows.length + ' valeurs).'
}

function fmt(n) { return n == null ? '' : Number(n).toLocaleString('fr-FR') }

onMounted(async () => { await chargerProduits(); await chargerPlan() })
watch(annee, chargerPlan)
</script>

<template>
  <div class="pdp-page">
    <header class="pdp-head">
      <div>
        <h1>Plan directeur de production</h1>
        <p class="sub">Plan de fabrication par produit et par mois (quantités en unités / boîtes).</p>
      </div>
      <div class="controls">
        <label class="annee">Année
          <select v-model.number="annee">
            <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
        <button class="btn" :disabled="enCours || !produits.length" @click="enregistrer">
          {{ enCours ? 'Enregistrement…' : 'Enregistrer le plan' }}
        </button>
      </div>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!produits.length" class="empty-card">
      Aucun produit dans le référentiel. Va d'abord dans <strong>Référentiels</strong> créer tes produits — ils apparaîtront ici en lignes.
    </div>

    <div v-else class="table-scroll">
      <table class="grid">
        <thead>
          <tr>
            <th class="sticky">Produit</th>
            <th>Donneur d'ordre</th>
            <th v-for="(lib, i) in MOIS" :key="i" class="right">{{ lib }}</th>
            <th class="right total-col">Total</th>
            <th class="right">Valeur (DA)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in produits" :key="p.id">
            <td class="sticky">
              <div class="mono">{{ p.code_pf }}</div>
              <div class="desig">{{ p.designation }}</div>
            </td>
            <td class="do">{{ p.donneurs_ordre ? p.donneurs_ordre.nom : '—' }}</td>
            <td v-for="m in 12" :key="m" class="cell">
              <input v-model="cellules[p.id][m]" type="number" min="0" inputmode="numeric" />
            </td>
            <td class="right total-col strong">{{ fmt(totalLigne(p)) }}</td>
            <td class="right">{{ fmt(valeurLigne(p)) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="sticky strong">Total</td>
            <td></td>
            <td v-for="m in 12" :key="m" class="right strong">{{ fmt(totalMois(m)) }}</td>
            <td class="right strong total-col">{{ fmt(totalGeneral) }}</td>
            <td class="right strong">{{ fmt(valeurGenerale) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <p class="hint">Astuce : laisse une case vide ou mets <strong>0</strong> s'il n'y a pas de production planifiée. Clique <strong>Enregistrer le plan</strong> pour sauvegarder toute la grille. La valeur est calculée à partir du PCSU de chaque produit.</p>
  </div>
</template>

<style scoped>
.pdp-page { color: #1b2733; }
.pdp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 4px 0 18px; flex-wrap: wrap; }
.pdp-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.pdp-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.controls { display: flex; align-items: flex-end; gap: 12px; }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #0c5f59; }
.btn:disabled { opacity: .5; cursor: default; }

.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.table-scroll { overflow-x: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; }
table.grid { border-collapse: collapse; font-size: 13px; width: 100%; }
table.grid th { background: #f8fafc; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 6px 8px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.right { text-align: right; }
.cell { padding: 4px; }
.cell input { width: 68px; font-size: 13px; padding: 6px; border: 1px solid #d8dee6; border-radius: 6px; text-align: right; color: #1b2733; }
.cell input:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; font-size: 12px; }
.do { color: #475569; }
.strong { font-weight: 700; }
.total-col { background: #f8fafc; }

.sticky { position: sticky; left: 0; background: #fff; z-index: 1; box-shadow: 1px 0 0 #eef2f6; }
thead .sticky { background: #f8fafc; }
tfoot td { border-top: 2px solid #e2e8f0; background: #f8fafc; }
tfoot .sticky { background: #f8fafc; }

.hint { color: #64748b; font-size: 13px; margin-top: 12px; }
</style>
