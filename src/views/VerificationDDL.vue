<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(false))

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const STATUTS_PRODUITS = ['Terminé', 'Libéré'] // lots produits = sujets à vérification
const LIMITE = 300

const lots = ref([])
const msg = ref('')
const anneeSel = ref(0) // 0 = toutes
const verifEnCours = ref(null)
const vForm = ref({ verificateur: '', date: new Date().toISOString().slice(0, 10) })

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

async function charger() {
  msg.value = ''
  const r = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, ddl_verifie, ddl_verificateur, ddl_date_verification, produits(designation, code_pf)')
    .eq('actif', true)
    .order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (r.error) { msg.value = r.error.message; return }
  lots.value = r.data
}
onMounted(charger)

const anYear = (d) => d ? new Date(d).getFullYear() : null

const produits = computed(() => lots.value.filter(l =>
  STATUTS_PRODUITS.includes(l.statut) && (anneeSel.value === 0 || anYear(l.date_lancement) === anneeSel.value)))
const verifies = computed(() => produits.value.filter(l => l.ddl_verifie))
const attente = computed(() => produits.value.filter(l => !l.ddl_verifie))

const nbVerifies = computed(() => verifies.value.length)
const nbAttente = computed(() => attente.value.length)
const taux = computed(() => {
  const tot = nbVerifies.value + nbAttente.value
  return tot > 0 ? (nbVerifies.value / tot) * 100 : null
})

const parSuperviseur = computed(() => {
  const m = {}
  for (const l of verifies.value) { const k = l.ddl_verificateur || '—'; m[k] = (m[k] || 0) + 1 }
  const arr = Object.entries(m).map(([nom, n]) => ({ nom, n })).sort((a, b) => b.n - a.n)
  const tot = arr.reduce((s, x) => s + x.n, 0) || 1
  const max = arr.length ? arr[0].n : 1
  return arr.map(x => ({ ...x, pct: (x.n / tot) * 100, w: (x.n / max) * 100 }))
})

const superviseurs = computed(() => {
  const s = new Set()
  for (const l of lots.value) if (l.ddl_verificateur) s.add(l.ddl_verificateur)
  return [...s].sort()
})

const verifiesAffiches = computed(() => [...verifies.value]
  .sort((a, b) => String(b.ddl_date_verification || '').localeCompare(String(a.ddl_date_verification || '')))
  .slice(0, LIMITE))

function prodNom(l) { return l.produits?.designation || l.produits?.code_pf || '—' }
function fmt(n) { return (n == null ? '—' : Number(n).toLocaleString('fr-FR')) }
function fmtPct(p) { return (p == null ? '—' : p.toFixed(1) + ' %') }
function fmtDate(d) {
  if (!d) return '—'
  const x = new Date(d); if (isNaN(x)) return '—'
  return x.toLocaleDateString('fr-FR')
}

function ouvrir(l) {
  verifEnCours.value = l.id
  vForm.value = { verificateur: '', date: new Date().toISOString().slice(0, 10) }
  msg.value = ''
}

async function valider(l) {
  msg.value = ''
  if (!vForm.value.verificateur.trim()) { msg.value = 'Indique le nom du vérificateur.'; return }
  const r = await supabase.from('ordres_fabrication').update({
    ddl_verifie: true,
    ddl_verificateur: vForm.value.verificateur.trim(),
    ddl_date_verification: vForm.value.date || null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  verifEnCours.value = null
  await charger()
}

async function devalider(l) {
  if (!confirm(`Annuler la vérification du lot ${l.numero_lot} ?`)) return
  const r = await supabase.from('ordres_fabrication').update({
    ddl_verifie: false, ddl_verificateur: null, ddl_date_verification: null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  await charger()
}
</script>

<template>
  <div class="vd-page">
    <div class="vd-head">
      <div>
        <h1>Vérification des dossiers de lot</h1>
        <p class="sub">Suivi de la vérification des DDL de fabrication par superviseur</p>
      </div>
      <label class="annee-sel">Année
        <select v-model.number="anneeSel">
          <option :value="0">Toutes</option>
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </div>

    <p v-if="msg" class="alert">{{ msg }}</p>

    <div class="kpi-grid k3">
      <div class="kpi"><div class="kpi-val">{{ fmt(nbVerifies) }}</div><div class="kpi-lbl">DDL vérifiés</div></div>
      <div class="kpi"><div class="kpi-val" :class="{ warn: nbAttente > 0 }">{{ fmt(nbAttente) }}</div><div class="kpi-lbl">DDL en attente de vérification</div></div>
      <div class="kpi"><div class="kpi-val accent">{{ fmtPct(taux) }}</div><div class="kpi-lbl">Taux de vérification</div></div>
    </div>

    <div class="cols">
      <section class="card">
        <h3 class="card-title">Vérifications par superviseur</h3>
        <div v-if="!parSuperviseur.length" class="empty">Aucune vérification pour ce filtre.</div>
        <div v-for="s in parSuperviseur" :key="s.nom" class="prog-row">
          <div class="prog-head">
            <span class="prog-nom">{{ s.nom }}</span>
            <span class="prog-pct">{{ s.n }} · {{ s.pct.toFixed(0) }}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill prod" :style="{ width: s.w + '%' }"></div></div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">DDL en attente de vérification ({{ nbAttente }})</h3>
        <div v-if="!attente.length" class="empty">Aucun DDL en attente. 🎉</div>
        <table v-else class="mini">
          <tbody>
            <template v-for="l in attente" :key="l.id">
              <tr>
                <td class="mono">{{ l.numero_lot }}</td>
                <td class="desig">{{ prodNom(l) }}</td>
                <td class="right nowrap">{{ fmtDate(l.date_lancement) }}</td>
                <td class="right"><button v-if="peutEditer" class="link" @click="ouvrir(l)">Vérifier</button></td>
              </tr>
              <tr v-if="verifEnCours === l.id">
                <td colspan="4">
                  <div class="verif-form">
                    <input list="superv-list" v-model="vForm.verificateur" placeholder="Vérificateur (superviseur)" />
                    <input type="date" v-model="vForm.date" />
                    <button class="btn sm" @click="valider(l)">Valider</button>
                    <button class="link" @click="verifEnCours = null">Annuler</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </div>

    <section class="card span2" style="margin-top: 22px">
      <h3 class="card-title">DDL vérifiés ({{ nbVerifies }})</h3>
      <div v-if="!verifies.length" class="empty">Aucun DDL vérifié pour ce filtre.</div>
      <table v-else class="mini">
        <thead><tr><th>Lot</th><th>Produit</th><th>Vérificateur</th><th class="right">Date</th><th></th></tr></thead>
        <tbody>
          <tr v-for="l in verifiesAffiches" :key="l.id">
            <td class="mono">{{ l.numero_lot }}</td>
            <td class="desig">{{ prodNom(l) }}</td>
            <td>{{ l.ddl_verificateur || '—' }}</td>
            <td class="right nowrap">{{ fmtDate(l.ddl_date_verification) }}</td>
            <td class="right"><button v-if="peutEditer" class="link danger" @click="devalider(l)">Annuler</button></td>
          </tr>
        </tbody>
      </table>
      <p v-if="verifies.length > verifiesAffiches.length" class="empty">
        … {{ fmt(verifies.length - verifiesAffiches.length) }} autres (affichage limité à {{ LIMITE }} ; filtre par année pour réduire).
      </p>
    </section>

    <datalist id="superv-list">
      <option v-for="s in superviseurs" :key="s" :value="s"></option>
    </datalist>
  </div>
</template>

<style scoped>
.vd-page { color: #1b2733; }
.vd-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.vd-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
.kpi-grid.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-val.warn { color: #b45309; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card.span2 { grid-column: 1 / -1; }
.card-title { margin: 0 0 14px; font-size: 16px; }

.prog-row { margin-bottom: 13px; }
.prog-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 5px; }
.prog-nom { font-size: 13px; font-weight: 600; color: #1b2733; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
.prog-pct { font-size: 13px; font-weight: 700; color: #0f766e; flex-shrink: 0; }
.bar-track { height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.bar-fill.prod { background: #0f766e; }

table.mini { width: 100%; border-collapse: collapse; font-size: 13px; }
table.mini th { text-align: left; padding: 7px 6px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; }
table.mini td { padding: 7px 6px; border-bottom: 1px solid #eef2f6; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

.btn { display: inline-block; background: #0f766e; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover { background: #0c5f59; }
.btn.sm { padding: 7px 14px; font-size: 13px; }
.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 6px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #b91c1c; }

.verif-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 0; }
.verif-form input { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.verif-form input[list] { min-width: 230px; }

@media (max-width: 900px) {
  .kpi-grid.k3 { grid-template-columns: 1fr; }
  .cols { grid-template-columns: 1fr; }
  .card.span2 { grid-column: auto; }
}
</style>
