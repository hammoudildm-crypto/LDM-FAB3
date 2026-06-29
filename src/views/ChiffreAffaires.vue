<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const anneeCourante = new Date().getFullYear()
const ANNEES = [anneeCourante - 1, anneeCourante, anneeCourante + 1]

const annee = ref('')        // '' = toutes les années
const records = ref([])
const erreur = ref('')

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
  erreur.value = ''
  const r = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('quantite_conditionnee, date_conditionnement, ordres_fabrication(produits(designation, code_pf, pcsu, unites_par_boite))')
    .eq('actif', true))
  if (r.error) { erreur.value = r.error.message; return }
  records.value = r.data
}

function produitDe(c) {
  return c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
}
function boitesRecord(c) {
  const p = produitDe(c)
  const upb = p ? Number(p.unites_par_boite || 0) : 0
  if (!upb || c.quantite_conditionnee == null) return 0
  return Math.floor(Number(c.quantite_conditionnee) / upb)
}
function caRecord(c) {
  const p = produitDe(c)
  const pcsu = p ? Number(p.pcsu || 0) : 0
  return boitesRecord(c) * pcsu
}

const recordsFiltres = computed(() => {
  if (!annee.value) return records.value
  return records.value.filter(c => c.date_conditionnement && new Date(c.date_conditionnement).getFullYear() === annee.value)
})

const parProduit = computed(() => {
  const m = {}
  for (const c of recordsFiltres.value) {
    const p = produitDe(c)
    const cle = p ? (p.code_pf || p.designation) : '(inconnu)'
    if (!m[cle]) m[cle] = { code: p ? p.code_pf : '—', nom: p ? p.designation : '(produit inconnu)', boites: 0, ca: 0 }
    m[cle].boites += boitesRecord(c)
    m[cle].ca += caRecord(c)
  }
  return Object.values(m).sort((a, b) => b.ca - a.ca)
})
const caTotal = computed(() => parProduit.value.reduce((s, x) => s + x.ca, 0))
const boitesTotal = computed(() => parProduit.value.reduce((s, x) => s + x.boites, 0))

function part(ca) { return caTotal.value > 0 ? (ca / caTotal.value) * 100 : 0 }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtCA(n) { return n == null ? '—' : Number(Math.round(n)).toLocaleString('fr-FR') + ' DA' }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['Produit', 'Désignation', 'Boîtes', 'CA (DA)', 'Part %']
  const lignes = parProduit.value.map(x => [
    x.code,
    x.nom,
    Math.round(x.boites),
    Math.round(x.ca),
    part(x.ca).toFixed(0)
  ])
  telechargerCSV('chiffre_affaires.csv', entetes, lignes)
}

onMounted(charger)
</script>

<template>
  <div class="ca-page">
    <header class="ca-head">
      <div>
        <h1>Chiffre d'affaires</h1>
        <p class="sub">Valorisation de la production conditionnée (boîtes × PCSU).</p>
      </div>
      <label class="annee">Année
        <select v-model="annee">
          <option value="">Toutes</option>
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val accent">{{ fmtCA(caTotal) }}</div><div class="kpi-lbl">CA total{{ annee ? ' ' + annee : '' }}</div></div>
      <div class="kpi"><div class="kpi-val">{{ fmt(boitesTotal) }}</div><div class="kpi-lbl">Boîtes valorisées</div></div>
      <div class="kpi"><div class="kpi-val">{{ parProduit.length }}</div><div class="kpi-lbl">Produits</div></div>
    </div>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">CA par produit</h2>
        <button class="btn-exp" @click="exporterCSV" :disabled="!parProduit.length">Exporter CSV</button>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr><th>Produit</th><th class="right">Boîtes</th><th class="right">CA</th><th class="part-col">Part</th></tr>
          </thead>
          <tbody>
            <tr v-for="x in parProduit" :key="x.code">
              <td><span class="mono">{{ x.code }}</span> <span class="desig">{{ x.nom }}</span></td>
              <td class="right">{{ fmt(x.boites) }}</td>
              <td class="right strong">{{ fmtCA(x.ca) }}</td>
              <td class="part-col">
                <div class="bar-wrap">
                  <div class="bar-track"><div class="bar-fill" :style="{ width: part(x.ca) + '%' }"></div></div>
                  <span class="bar-num">{{ part(x.ca).toFixed(0) }} %</span>
                </div>
              </td>
            </tr>
            <tr v-if="!parProduit.length"><td colspan="4" class="empty">Aucune donnée. Enregistre des conditionnements (avec un PCSU et des unités/boîte sur les produits) pour voir le CA.</td></tr>
          </tbody>
          <tfoot v-if="parProduit.length">
            <tr>
              <td class="strong">Total</td>
              <td class="right strong">{{ fmt(boitesTotal) }}</td>
              <td class="right strong">{{ fmtCA(caTotal) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <p class="hint">Le CA est calculé à partir des comprimés conditionnés convertis en boîtes (÷ unités/boîte), puis valorisés au PCSU du produit. Vérifie que tes produits ont un <strong>PCSU</strong> et un <strong>unités/boîte</strong> renseignés dans Référentiels.</p>
  </div>
</template>

<style scoped>
.ca-page { color: #1b2733; }
.ca-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 4px 0 18px; flex-wrap: wrap; }
.ca-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.ca-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-head .card-title { margin: 0; }
.btn-exp { margin-left: auto; font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
table.grid tfoot td { border-top: 2px solid #e2e8f0; border-bottom: 0; background: #f8fafc; }
.right { text-align: right; }
.strong { font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; font-size: 13px; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; white-space: normal; }

.part-col { width: 200px; }
.bar-wrap { display: flex; align-items: center; gap: 8px; }
.bar-track { flex: 1; height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: #0f766e; border-radius: 999px; min-width: 2px; }
.bar-num { width: 38px; text-align: right; font-size: 12px; font-weight: 600; color: #475569; }

.hint { color: #64748b; font-size: 13px; margin-top: 4px; }

@media (max-width: 700px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .part-col { width: 120px; }
}
</style>
