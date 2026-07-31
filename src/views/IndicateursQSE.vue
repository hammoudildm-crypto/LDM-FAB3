<template>
  <div class="qse">
    <div class="qse-head">
      <div>
        <div class="qh-eyebrow">Système de management intégré</div>
        <h1 class="qh-title">Indicateurs QSE</h1>
        <p class="qh-sub">Performance par domaine — ISO 9001 (Qualité), ISO 14001 (Environnement), ISO 45001 (Santé & Sécurité).</p>
      </div>
      <div class="qh-ctrl">
        <label class="annee">Année
          <select v-model.number="annee"><option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option></select>
        </label>
        <button v-if="peutEditer" class="btn" :disabled="enCours" @click="enregistrer">{{ enCours ? 'Enregistrement…' : 'Enregistrer' }}</button>
      </div>
    </div>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <section v-for="dom in DOMAINES" :key="dom.cle" class="dom" :style="{ '--dc': dom.couleur, '--dcl': dom.clair }">
      <div class="dom-head">
        <div class="dom-id">
          <span class="dom-iso">{{ dom.iso }}</span>
          <span class="dom-nom">{{ dom.nom }}</span>
        </div>
        <div class="dom-bilan" v-if="bilanDomaine(dom.cle).total">
          <span class="db-val">{{ bilanDomaine(dom.cle).ok }}/{{ bilanDomaine(dom.cle).total }}</span> cibles atteintes
        </div>
      </div>

      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th class="sticky">Indicateur</th>
              <th class="right">Cible</th>
              <th v-for="(lib, i) in MOIS" :key="i" class="right">{{ lib }}</th>
              <th class="right annuel">Annuel</th>
              <th class="center">Tendance</th>
              <th class="center">Statut</th>
              <th v-if="peutEditer"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ind in indicateursDomaine(dom.cle)" :key="ind.id">
              <td class="sticky">
                <div class="ind-lib">{{ ind.libelle }}</div>
                <div class="ind-unite">{{ ind.unite }} · {{ ind.sens === 'bas' ? '↓ mieux' : '↑ mieux' }}</div>
              </td>
              <td class="right cible">{{ ind.cible == null ? '—' : fmt(ind.cible) }}</td>
              <td v-for="m in 12" :key="m" class="cell">
                <input v-model="cellules[ind.id][m]" type="number" step="any" inputmode="decimal" :disabled="!peutEditer" />
              </td>
              <td class="right annuel strong">
                <span v-if="cumul(ind) != null">{{ fmt(cumul(ind)) }}</span><span v-else>—</span>
                <span class="agg">{{ ind.agregat === 'somme' ? 'Σ' : 'x̄' }}</span>
              </td>
              <td class="center spark">
                <svg v-if="sparkline(ind.id)" viewBox="0 0 120 26" class="spark-svg" preserveAspectRatio="none"><polyline :points="sparkline(ind.id)" fill="none" :stroke="dom.couleur" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" /></svg>
                <span v-else class="muted-xs">—</span>
              </td>
              <td class="center">
                <span class="statut" :class="statut(ind)">{{ statutLabel(ind) }}</span>
              </td>
              <td v-if="peutEditer" class="center">
                <button class="del" title="Supprimer" @click="supprimerIndicateur(ind)">✕</button>
              </td>
            </tr>
            <tr v-if="!indicateursDomaine(dom.cle).length">
              <td :colspan="peutEditer ? 18 : 17" class="no-ind">Aucun indicateur dans ce domaine.<span v-if="peutEditer"> Ajoute-en un ci-dessous.</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="peutEditer" class="add-ind">
        <input v-model="formAdd[dom.cle].libelle" placeholder="Nouvel indicateur…" class="ai ai-lib" />
        <input v-model="formAdd[dom.cle].unite" placeholder="Unité (%, kg…)" class="ai ai-u" />
        <input v-model="formAdd[dom.cle].cible" type="number" step="any" placeholder="Cible" class="ai ai-c" />
        <select v-model="formAdd[dom.cle].sens" class="ai ai-s"><option value="haut">↑ mieux</option><option value="bas">↓ mieux</option></select>
        <select v-model="formAdd[dom.cle].agregat" class="ai ai-s"><option value="moyenne">Moyenne</option><option value="somme">Somme</option></select>
        <button class="btn-mini" :disabled="!formAdd[dom.cle].libelle.trim() || enCours" @click="ajouterIndicateur(dom.cle)">+ Ajouter</button>
      </div>
    </section>

    <p class="hint">Le <strong>statut</strong> compare le cumul annuel (Σ = somme, x̄ = moyenne) à la cible, selon le sens de l'indicateur. Saisis les valeurs mensuelles puis clique <strong>Enregistrer</strong>. Un indicateur sans cible n'a pas de statut.</p>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, inject, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const DOMAINES = [
  { cle: 'qualite', iso: 'ISO 9001', nom: 'Qualité', couleur: '#0f766e', clair: '#f0fdfa' },
  { cle: 'environnement', iso: 'ISO 14001', nom: 'Environnement', couleur: '#15803d', clair: '#f0fdf4' },
  { cle: 'securite', iso: 'ISO 45001', nom: 'Santé & Sécurité', couleur: '#b45309', clair: '#fffbeb' }
]
const anneeCourante = new Date().getFullYear()
const ANNEES = [anneeCourante - 2, anneeCourante - 1, anneeCourante, anneeCourante + 1]

const peutEditer = inject('peutEditer', ref(true))
const annee = ref(anneeCourante)
const indicateurs = ref([])
const cellules = reactive({})
const erreur = ref(''), message = ref(''), enCours = ref(false), chargement = ref(true)

const formAdd = reactive({})
for (const d of DOMAINES) formAdd[d.cle] = { libelle: '', unite: '', cible: '', sens: 'haut', agregat: 'moyenne' }

function initCellules() {
  Object.keys(cellules).forEach(k => delete cellules[k])
  for (const ind of indicateurs.value) { cellules[ind.id] = {}; for (let m = 1; m <= 12; m++) cellules[ind.id][m] = '' }
}
async function chargerIndicateurs() {
  const r = await supabase.from('qse_indicateurs').select('*').eq('actif', true).order('domaine', { ascending: true }).order('ordre', { ascending: true })
  if (r.error) { erreur.value = r.error.message; return }
  indicateurs.value = r.data || []
}
async function chargerValeurs() {
  const r = await supabase.from('qse_valeurs').select('indicateur_id, mois, valeur').eq('annee', annee.value)
  if (r.error) { erreur.value = r.error.message; return }
  for (const row of r.data) { if (cellules[row.indicateur_id]) cellules[row.indicateur_id][row.mois] = row.valeur }
}

onMounted(async () => {
  await chargerIndicateurs()
  initCellules()
  await chargerValeurs()
  chargement.value = false
})
watch(annee, async () => { erreur.value = ''; message.value = ''; initCellules(); await chargerValeurs() })

function indicateursDomaine(cle) { return indicateurs.value.filter(i => i.domaine === cle) }
function fmt(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) }

function cumul(ind) {
  const vals = []
  for (let m = 1; m <= 12; m++) { const v = cellules[ind.id] ? cellules[ind.id][m] : ''; if (v !== '' && v != null) vals.push(Number(v)) }
  if (!vals.length) return null
  if (ind.agregat === 'somme') return vals.reduce((s, x) => s + x, 0)
  return vals.reduce((s, x) => s + x, 0) / vals.length
}
function statut(ind) {
  const c = cumul(ind)
  if (c == null || ind.cible == null) return 'na'
  const ok = ind.sens === 'bas' ? c <= Number(ind.cible) : c >= Number(ind.cible)
  return ok ? 'ok' : 'ko'
}
function statutLabel(ind) { const s = statut(ind); return s === 'ok' ? 'Atteint' : s === 'ko' ? 'Non atteint' : '—' }

function sparkline(indId) {
  const vals = []
  for (let m = 1; m <= 12; m++) { const v = cellules[indId] ? cellules[indId][m] : ''; vals.push(v === '' || v == null ? null : Number(v)) }
  const nums = vals.filter(v => v != null)
  if (nums.length < 2) return ''
  const min = Math.min(...nums), max = Math.max(...nums), range = (max - min) || 1
  const w = 120, h = 26, pad = 3
  const pts = []
  vals.forEach((v, i) => {
    if (v == null) return
    const x = pad + (i / 11) * (w - 2 * pad)
    const y = h - pad - ((v - min) / range) * (h - 2 * pad)
    pts.push(x.toFixed(1) + ',' + y.toFixed(1))
  })
  return pts.join(' ')
}

function bilanDomaine(cle) {
  const inds = indicateursDomaine(cle).filter(i => i.cible != null)
  return { ok: inds.filter(i => statut(i) === 'ok').length, total: inds.length }
}

async function ajouterIndicateur(cle) {
  const f = formAdd[cle]
  if (!f.libelle.trim()) return
  enCours.value = true; erreur.value = ''; message.value = ''
  const r = await supabase.from('qse_indicateurs').insert({
    domaine: cle, libelle: f.libelle.trim(), unite: (f.unite || '').trim() || null,
    cible: f.cible === '' || f.cible == null ? null : Number(f.cible), sens: f.sens, agregat: f.agregat,
    ordre: indicateursDomaine(cle).length + 1
  })
  enCours.value = false
  if (r.error) { erreur.value = r.error.message; return }
  f.libelle = ''; f.unite = ''; f.cible = ''; f.sens = 'haut'; f.agregat = 'moyenne'
  await chargerIndicateurs(); initCellules(); await chargerValeurs()
  message.value = 'Indicateur ajouté.'
}
async function supprimerIndicateur(ind) {
  if (!confirm('Supprimer l\'indicateur « ' + ind.libelle + ' » et toutes ses valeurs ?')) return
  enCours.value = true; erreur.value = ''; message.value = ''
  const r = await supabase.from('qse_indicateurs').delete().eq('id', ind.id)
  enCours.value = false
  if (r.error) { erreur.value = r.error.message; return }
  await chargerIndicateurs(); initCellules(); await chargerValeurs()
  message.value = 'Indicateur supprimé.'
}
async function enregistrer() {
  erreur.value = ''; message.value = ''; enCours.value = true
  const rows = []
  for (const ind of indicateurs.value) {
    for (let m = 1; m <= 12; m++) {
      const v = cellules[ind.id] ? cellules[ind.id][m] : ''
      if (v !== '' && v != null) rows.push({ indicateur_id: ind.id, annee: annee.value, mois: m, valeur: Number(v) })
    }
  }
  const del = await supabase.from('qse_valeurs').delete().eq('annee', annee.value)
  if (del.error) { erreur.value = del.error.message; enCours.value = false; return }
  if (rows.length) {
    const ins = await supabase.from('qse_valeurs').insert(rows)
    if (ins.error) { erreur.value = ins.error.message; enCours.value = false; return }
  }
  enCours.value = false
  message.value = 'Indicateurs ' + annee.value + ' enregistrés (' + rows.length + ' valeurs).'
}
</script>

<style scoped>
.qse { max-width: 1280px; margin: 0 auto; padding: 6px 4px 28px; }
.qse-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.qh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6366f1; }
.qh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.qh-sub { font-size: 13.5px; color: #64748b; max-width: 640px; }
.qh-ctrl { display: flex; align-items: center; gap: 12px; }
.annee { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .05em; display: flex; flex-direction: column; gap: 4px; }
.annee select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 500; color: #1b2733; text-transform: none; }
.btn { background: #0f766e; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #0c5f59; } .btn:disabled { opacity: .5; cursor: default; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 14px; border-radius: 9px; font-size: 13.5px; margin-bottom: 12px; }
.ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 9px; font-size: 13.5px; margin-bottom: 12px; }
.muted { font-size: 13px; color: #94a3b8; }

.dom { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; }
.dom-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 13px 18px; background: var(--dcl); border-bottom: 2px solid var(--dc); flex-wrap: wrap; }
.dom-id { display: flex; align-items: baseline; gap: 10px; }
.dom-iso { font-size: 12px; font-weight: 800; color: #fff; background: var(--dc); padding: 3px 9px; border-radius: 6px; letter-spacing: .02em; }
.dom-nom { font-size: 16px; font-weight: 800; color: #1a2233; }
.dom-bilan { font-size: 12.5px; color: #475569; }
.db-val { font-weight: 800; color: var(--dc); font-size: 14px; }

.table-scroll { overflow-x: auto; }
table.grid { border-collapse: collapse; width: 100%; font-size: 13px; min-width: 900px; }
table.grid th, table.grid td { border-bottom: 1px solid #eef2f6; padding: 7px 9px; white-space: nowrap; }
table.grid th { background: #f8fafc; font-size: 11.5px; font-weight: 700; color: #64748b; text-align: left; position: sticky; top: 0; z-index: 2; }
.right { text-align: right; } .center { text-align: center; }
.sticky { position: sticky; left: 0; background: #fff; z-index: 1; box-shadow: 1px 0 0 #eef2f6; min-width: 190px; }
thead th.sticky { z-index: 3; background: #f8fafc; }
.ind-lib { font-weight: 600; color: #1b2733; white-space: normal; }
.ind-unite { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.cible { color: #475569; font-weight: 600; }
.annuel { background: #fafbfc; }
.annuel.strong { font-weight: 800; color: #1b2733; }
.agg { font-size: 10px; color: #cbd5e1; margin-left: 3px; }

.cell { padding: 3px; }
.cell input { width: 66px; font-size: 12.5px; padding: 5px 6px; border: 1px solid #d8dee6; border-radius: 6px; text-align: right; color: #1b2733; }
.cell input::-webkit-outer-spin-button, .cell input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.cell input[type=number] { -moz-appearance: textfield; appearance: textfield; }
.cell input:focus { outline: 2px solid var(--dc); border-color: var(--dc); }
.cell input:disabled { background: #f8fafc; color: #475569; }

.spark-svg { width: 110px; height: 24px; display: block; margin: 0 auto; }
.muted-xs { color: #cbd5e1; font-size: 12px; }

.statut { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; }
.statut.ok { background: #dcfce7; color: #15803d; }
.statut.ko { background: #fee2e2; color: #b91c1c; }
.statut.na { background: #f1f5f9; color: #94a3b8; }

.del { background: none; border: 0; color: #cbd5e1; font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.del:hover { color: #b91c1c; background: #fef2f2; }

.no-ind { text-align: center; color: #94a3b8; padding: 18px; font-size: 13.5px; }

.add-ind { display: flex; gap: 8px; align-items: center; padding: 12px 18px; background: #f8fafc; border-top: 1px solid #eef2f6; flex-wrap: wrap; }
.ai { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; }
.ai-lib { flex: 1; min-width: 200px; } .ai-u { width: 110px; } .ai-c { width: 90px; text-align: right; } .ai-s { width: 120px; }
.btn-mini { background: var(--dc); color: #fff; border: 0; border-radius: 7px; font: inherit; font-size: 13px; font-weight: 700; padding: 8px 14px; cursor: pointer; white-space: nowrap; }
.btn-mini:disabled { background: #cbd5e1; cursor: default; }

.hint { font-size: 12px; color: #64748b; font-style: italic; margin-top: 8px; }
</style>
