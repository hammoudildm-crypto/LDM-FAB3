<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'

const peutEditer = inject('peutEditer', ref(false))
const role = inject('role', ref(null))
const estAdmin = computed(() => role.value === 'admin')

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
const superviseurChoix = ref('')
const nouveauSuperviseur = ref('')
const histRecherche = ref('')
const histDu = ref('')
const histAu = ref('')

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
    .select('id, numero_lot, statut, date_lancement, date_fin_fabrication, ddl_verifie, ddl_verificateur, ddl_date_verification, produits(designation, code_pf)')
    .eq('actif', true)
    .order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (r.error) { msg.value = r.error.message; return }
  lots.value = r.data
}
onMounted(charger)

const anYear = (d) => d ? new Date(d).getFullYear() : null

const produits = computed(() => lots.value.filter(l =>
  l.date_fin_fabrication && (anneeSel.value === 0 || anYear(l.date_fin_fabrication) === anneeSel.value)))
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
  for (const l of produits.value) {
    const k = l.ddl_verificateur
    if (!k) continue
    if (!m[k]) m[k] = { nom: k, assignes: 0, verifies: 0 }
    m[k].assignes++
    if (l.ddl_verifie) m[k].verifies++
  }
  return Object.values(m)
    .map(x => ({ ...x, taux: x.assignes ? (x.verifies / x.assignes) * 100 : 0 }))
    .sort((a, b) => b.assignes - a.assignes)
})

const superviseurs = computed(() => {
  const s = new Set()
  for (const l of lots.value) if (l.ddl_verificateur) s.add(l.ddl_verificateur)
  return [...s].sort()
})

const verifiesFiltres = computed(() => {
  const q = histRecherche.value.trim().toLowerCase()
  const du = histDu.value, au = histAu.value
  return verifies.value.filter(l => {
    const d = l.ddl_date_verification ? String(l.ddl_date_verification).slice(0, 10) : ''
    if (du && (!d || d < du)) return false
    if (au && (!d || d > au)) return false
    if (q) {
      const lot = String(l.numero_lot || '').toLowerCase()
      const sup = String(l.ddl_verificateur || '').toLowerCase()
      const nom = prodNom(l).toLowerCase()
      const code = (l.produits && l.produits.code_pf ? l.produits.code_pf : '').toLowerCase()
      if (!(lot.includes(q) || sup.includes(q) || nom.includes(q) || code.includes(q))) return false
    }
    return true
  })
})
const verifiesAffiches = computed(() => [...verifiesFiltres.value]
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
function exporterHistoriqueCSV() {
  const list = [...verifiesFiltres.value].sort((a, b) =>
    String(b.ddl_date_verification || '').localeCompare(String(a.ddl_date_verification || '')))
  const rows = [['Lot', 'Code produit', 'Produit', 'Superviseur', 'Date vérification']]
  for (const l of list) rows.push([
    l.numero_lot || '', (l.produits && l.produits.code_pf) || '', prodNom(l),
    l.ddl_verificateur || '', fmtDate(l.ddl_date_verification)
  ])
  const csv = rows.map(r => r.map(c => {
    const v = String(c == null ? '' : c)
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'historique_ddl_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click(); URL.revokeObjectURL(url)
}

function ouvrir(l) {
  verifEnCours.value = l.id
  const d = l.ddl_date_verification ? String(l.ddl_date_verification).slice(0, 10) : new Date().toISOString().slice(0, 10)
  vForm.value = { verificateur: l.ddl_verificateur || '', date: d }
  superviseurChoix.value = l.ddl_verificateur || ''
  nouveauSuperviseur.value = ''
  msg.value = ''
}

async function valider(l) {
  msg.value = ''
  const nom = (superviseurChoix.value === '__autre__' ? nouveauSuperviseur.value : superviseurChoix.value).trim()
  if (!nom) { msg.value = 'Choisis ou saisis le nom du superviseur.'; return }
  const r = await supabase.from('ordres_fabrication').update({
    ddl_verifie: true,
    ddl_verificateur: nom,
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
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.clipboard"></svg></span><div class="kpi-val">{{ fmt(nbVerifies) }}</div></div><div class="kpi-lbl">DDL vérifiés</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val" :class="{ warn: nbAttente > 0 }">{{ fmt(nbAttente) }}</div></div><div class="kpi-lbl">DDL en attente de vérification</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.emerald"><svg viewBox="0 0 24 24" v-html="ICONS.percent"></svg></span><div class="kpi-val accent">{{ fmtPct(taux) }}</div></div><div class="kpi-lbl">Taux de vérification</div></div>
    </div>

    <div class="cols">
      <section class="card">
        <h3 class="card-title">Taux de vérification par superviseur</h3>
        <p class="hint">DDL envoyés à l'AQ ÷ DDL qui lui sont assignés</p>
        <div v-if="!parSuperviseur.length" class="empty">Aucun DDL pour ce filtre.</div>
        <div v-for="s in parSuperviseur" :key="s.nom" class="prog-row">
          <div class="prog-head">
            <span class="prog-nom">{{ s.nom }}</span>
            <span class="prog-pct" :class="{ warn: s.taux < 100 }">{{ s.verifies }}/{{ s.assignes }} · {{ s.taux.toFixed(0) }}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" :class="s.taux >= 100 ? 'ok' : 'part'" :style="{ width: s.taux + '%' }"></div></div>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">DDL en attente de vérification ({{ nbAttente }})</h3>
        <div v-if="!attente.length" class="empty">Aucun DDL en attente. 🎉</div>
        <table v-else class="mini">
          <thead><tr><th>Lot</th><th>Produit</th><th>Superviseur</th><th class="right">Fin fab.</th><th></th></tr></thead>
          <tbody>
            <template v-for="l in attente" :key="l.id">
              <tr>
                <td class="mono">{{ l.numero_lot }}</td>
                <td class="desig">{{ prodNom(l) }}</td>
                <td>{{ l.ddl_verificateur || '—' }}</td>
                <td class="right nowrap">{{ fmtDate(l.date_fin_fabrication) }}</td>
                <td class="right"><button v-if="peutEditer" class="link" @click="ouvrir(l)">Vérifier</button></td>
              </tr>
              <tr v-if="verifEnCours === l.id">
                <td colspan="5">
                  <div class="verif-form">
                    <select v-model="superviseurChoix" class="sv-sel">
                      <option value="">— Choisir un superviseur —</option>
                      <option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option>
                      <option value="__autre__">＋ Autre (saisir un nom)…</option>
                    </select>
                    <input v-if="superviseurChoix === '__autre__'" list="superv-list" v-model="nouveauSuperviseur" placeholder="Nom du superviseur" />
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
      <div class="hist-head">
        <h3 class="card-title">DDL vérifiés</h3>
        <span class="hist-count">{{ verifiesFiltres.length }}</span>
        <div class="hist-tools">
          <input v-model="histRecherche" type="search" class="hist-search" placeholder="Rechercher (lot, produit, superviseur)…" />
          <label class="dlab">Du <input type="date" v-model="histDu" /></label>
          <label class="dlab">Au <input type="date" v-model="histAu" /></label>
          <button class="hist-exp" @click="exporterHistoriqueCSV" :disabled="!verifiesFiltres.length">Exporter CSV</button>
        </div>
      </div>
      <div v-if="!verifiesFiltres.length" class="empty">Aucun DDL vérifié pour ces critères.</div>
      <table v-else class="mini">
        <thead><tr><th>Lot</th><th>Produit</th><th>Superviseur</th><th class="right">Date d'envoi</th><th></th></tr></thead>
        <tbody>
          <template v-for="l in verifiesAffiches" :key="l.id">
            <tr>
              <td class="mono">{{ l.numero_lot }}</td>
              <td class="desig">{{ prodNom(l) }}</td>
              <td>{{ l.ddl_verificateur || '—' }}</td>
              <td class="right nowrap">{{ fmtDate(l.ddl_date_verification) }}</td>
              <td class="right nowrap">
                <button v-if="estAdmin" class="link" @click="ouvrir(l)">Modifier</button>
                <button v-if="peutEditer" class="link danger" @click="devalider(l)">Annuler</button>
              </td>
            </tr>
            <tr v-if="verifEnCours === l.id">
              <td colspan="5">
                <div class="verif-form">
                  <select v-model="superviseurChoix" class="sv-sel">
                    <option value="">— Choisir un superviseur —</option>
                    <option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option>
                    <option value="__autre__">＋ Autre (saisir un nom)…</option>
                  </select>
                  <input v-if="superviseurChoix === '__autre__'" list="superv-list" v-model="nouveauSuperviseur" placeholder="Nom du superviseur" />
                  <input type="date" v-model="vForm.date" />
                  <button class="btn sm" @click="valider(l)">Enregistrer</button>
                  <button class="link" @click="verifEnCours = null">Annuler</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="verifiesFiltres.length > verifiesAffiches.length" class="empty">
        … {{ fmt(verifiesFiltres.length - verifiesAffiches.length) }} autres (affichage limité à {{ LIMITE }} ; affine la recherche ou les dates).
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
.bar-fill.ok { background: #16a34a; }
.bar-fill.part { background: #f59e0b; }
.prog-pct.warn { color: #b45309; }
.hint { margin: -8px 0 14px; font-size: 12px; color: #94a3b8; }

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
.verif-form select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 230px; }
.hist-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.hist-head .card-title { margin: 0; }
.hist-count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.hist-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hist-search { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 220px; }
.hist-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.dlab { font-size: 12px; color: #64748b; display: inline-flex; align-items: center; gap: 5px; }
.dlab input { font-size: 13px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.hist-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.hist-exp:hover { background: #ecfdf5; }
.hist-exp:disabled { opacity: .45; cursor: not-allowed; }
</style>
