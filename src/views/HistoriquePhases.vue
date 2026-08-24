<template>
  <div class="ho-page">
    <PageHeader title="Historique des opérations" tone="indigo" />
    <div class="ho-wrap">
      <div class="card ho-bar">
        <input v-model="recherche" type="text" placeholder="Rechercher un lot ou un produit…" class="ho-search" />
        <select v-model="annee" class="ho-sel">
          <option value="">Toutes années</option>
          <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
        </select>
        <label class="ho-dflt">Du <input type="date" v-model="dateFrom" /></label>
        <label class="ho-dflt">Au <input type="date" v-model="dateTo" /></label>
        <button v-if="dateFrom || dateTo" class="ho-clear" @click="dateFrom = ''; dateTo = ''" title="Effacer la plage">✕</button>
        <button class="ho-exp" @click="exporterCSV" title="Exporter en Excel (CSV)">⬇ Excel</button>
        <button class="ho-exp" @click="exporterPDF" title="Imprimer / Enregistrer en PDF">⬇ PDF</button>
        <span class="ho-count">{{ lignesFiltrees.length }} lot(s)</span>
      </div>

      <div v-if="!chargement && !erreur && lignesFiltrees.length" class="card ho-rdt-band">
        <span class="ho-rdt-title">Rendement moyen par phase</span>
        <div class="ho-rdt-grid">
          <div v-for="r in rendementMoyen" :key="r.phase" class="ho-rdt-item">
            <span class="ho-rdt-ph">{{ courtPhase(r.phase) }}</span>
            <span class="ho-rdt-val" :class="clsRdt(r.moy)">{{ r.moy != null ? r.moy.toFixed(1) + '%' : '—' }}</span>
            <span class="ho-rdt-n">{{ r.n }} lot{{ r.n > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
      <div v-if="chargement" class="ho-load">Chargement de l'historique…</div>
      <div v-else-if="erreur" class="ho-err">{{ erreur }}</div>
      <div v-else class="card ho-tablecard">
        <div class="ho-scroll">
          <table class="ho-tbl">
            <thead>
              <tr>
                <th class="ho-th-lot">N° Lot</th>
                <th class="ho-th-prod">Produit</th>
                <th v-for="ph in PHASES" :key="ph">{{ courtPhase(ph) }}</th>
                <th>Progression</th>
                <th>Durée</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lignesFiltrees" :key="l.id" class="ho-row" :class="{ sel: sel === l.id }" @click="sel = (sel === l.id ? null : l.id)">
                <td class="ho-lot">{{ l.lot }}</td>
                <td class="ho-prod"><span class="ho-code">{{ l.code }}</span><span class="ho-desig">{{ l.desig }}</span></td>
                <td v-for="ph in PHASES" :key="ph" class="ho-cell" :class="{ 'ho-cell-na': !l.gamme.includes(ph), 'ho-cell-vide': l.gamme.includes(ph) && !l.phases[ph] }">
                  <span v-if="!l.gamme.includes(ph)" class="ho-na">NA</span>
                  <template v-else-if="l.phases[ph]">
                    <span class="ho-date"><span class="ho-lbl">D</span>{{ fmtDate(l.phases[ph].debut) }}</span>
                    <span class="ho-date"><span class="ho-lbl">F</span>{{ fmtDate(l.phases[ph].date) }}</span>
                    <span v-if="l.phases[ph].equip" class="ho-eq" :title="l.phases[ph].equip">{{ l.phases[ph].equip }}</span>
                    <span v-if="rendementPhase(l.phases[ph]) != null" class="ho-rdt" :class="clsRdt(rendementPhase(l.phases[ph]))">R {{ rendementPhase(l.phases[ph]).toFixed(0) }}%</span>
                  </template>
                  <span v-else>—</span>
                </td>
                <td class="ho-prog">
                  <div class="ho-progbar"><div class="ho-progfill" :style="{ width: (nbPhasesFaites(l) / nbPhasesGamme(l) * 100) + '%' }"></div></div>
                  <span class="ho-progtxt">{{ nbPhasesFaites(l) }}/{{ nbPhasesGamme(l) }}</span>
                </td>
                <td class="ho-duree">{{ dureeLot(l) }}</td>
                <td><span class="ho-badge" :class="'st-' + clsStatut(l.statut)">{{ l.statut || '—' }}</span></td>
              </tr>
              <tr v-if="!lignesFiltrees.length"><td :colspan="PHASES.length + 5" class="ho-empty">Aucun lot ne correspond.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="lotSel" class="card ho-detail">
        <h3 class="ho-dt-title">Détail du lot {{ lotSel.lot }} — {{ lotSel.code }} <span class="ho-dt-desig">{{ lotSel.desig }}</span></h3>
        <div class="ho-scroll">
          <table class="ho-dtbl">
            <thead><tr><th>Phase</th><th>Équipement</th><th class="r">Entrée (kg)</th><th class="r">Sortie (kg)</th><th>Début</th><th>Fin</th><th>Durée</th><th>Rendement</th><th>Statut</th></tr></thead>
            <tbody>
              <tr v-for="ph in phasesDuLot(lotSel)" :key="ph">
                <td class="ho-dp">{{ ph }}</td>
                <td>{{ lotSel.phases[ph].equip || '—' }}</td>
                <td class="r">{{ fmtNb(lotSel.phases[ph].qteE) }}</td>
                <td class="r">{{ fmtNb(lotSel.phases[ph].qteS) }}</td>
                <td>{{ fmtDate(lotSel.phases[ph].debut) }}</td>
                <td>{{ fmtDate(lotSel.phases[ph].date) }}</td>
                <td>{{ dureePhase(lotSel.phases[ph]) }}</td>
                <td :class="clsRdt(rendementPhase(lotSel.phases[ph]))" style="font-weight:800">{{ rendementPhase(lotSel.phases[ph]) != null ? rendementPhase(lotSel.phases[ph]).toFixed(1) + '%' : '—' }}</td>
                <td><span class="ho-badge sm" :class="'st-' + clsStatut(lotSel.phases[ph].statut)">{{ lotSel.phases[ph].statut || '—' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const PHASES = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
const COURT = { 'Pesée': 'Pesée', 'Granulation et Séchage': 'Granulation', 'Mélange': 'Mélange', 'Compression': 'Compression', 'Remplissage Gélules': 'Remplissage', 'Pelliculage': 'Pelliculage' }
function courtPhase(p) { return COURT[p] || p }

const chargement = ref(true)
const erreur = ref('')
const recherche = ref('')
const annee = ref(new Date().getFullYear())
const dateFrom = ref('')
const dateTo = ref('')
const sel = ref(null)
const lignes = ref([])

async function fetchAllPaged(make) {
  const size = 1000; let from = 0; let all = []
  while (true) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) throw error
    if (!data || !data.length) break
    all = all.concat(data)
    if (data.length < size) break
    from += size
  }
  return all
}

function normPhase(p) { return /^(granulation|s[ée]chage)$/i.test(String(p).trim()) ? 'Granulation et Séchage' : p }
function normGammeFab(g) {
  if (!Array.isArray(g) || !g.length) return PHASES.slice()
  const out = []
  for (const ph of g) { const n = normPhase(ph); if (PHASES.includes(n) && !out.includes(n)) out.push(n) }
  return out.length ? out : PHASES.slice()
}

async function charger() {
  chargement.value = true; erreur.value = ''
  try {
    const [ofs, phs] = await Promise.all([
      fetchAllPaged(() => supabase.from('ordres_fabrication')
        .select('id, numero_lot, statut, date_fin_fabrication, produits(code_pf, designation, gamme)')
        .order('id', { ascending: true })),
      fetchAllPaged(() => supabase.from('suivi_phases')
        .select('ordre_id, phase, quantite_entree, quantite_sortie, date_debut, date_phase, statut, equipements(code, nom)')
        .eq('actif', true).order('ordre_id', { ascending: true }).order('id', { ascending: true }))
    ])
    const map = {}
    for (const o of ofs) {
      const pr = o.produits || {}
      map[o.id] = { id: o.id, lot: o.numero_lot || '—', code: pr.code_pf || '—', desig: pr.designation || '', statut: o.statut || '', dateFin: o.date_fin_fabrication || null, gamme: normGammeFab(pr.gamme), phases: {} }
    }
    for (const r of phs) {
      const e = map[r.ordre_id]; if (!e) continue
      const ph = normPhase(r.phase)
      const eq = r.equipements ? (r.equipements.code + (r.equipements.nom ? ' · ' + r.equipements.nom : '')) : ''
      const prev = e.phases[ph]
      if (!prev || (r.date_phase && (!prev.date || r.date_phase > prev.date))) {
        e.phases[ph] = { date: r.date_phase, debut: r.date_debut, equip: eq, qteE: r.quantite_entree, qteS: r.quantite_sortie, statut: r.statut }
      }
    }
    lignes.value = Object.values(map)
  } catch (e) { erreur.value = e.message || String(e) }
  chargement.value = false
}
onMounted(charger)

function anneeLot(l) {
  if (l.dateFin) return new Date(l.dateFin).getFullYear()
  for (const ph of PHASES) { const p = l.phases[ph]; if (p && p.date) return new Date(p.date).getFullYear() }
  const d = String(l.lot || '').replace(/\D/g, '')
  if (d.length >= 2) return 2000 + parseInt(d.slice(0, 2), 10)
  return null
}
const anneesDispo = computed(() => {
  const s = new Set()
  for (const l of lignes.value) { const a = anneeLot(l); if (a) s.add(a) }
  return [...s].sort((a, b) => b - a)
})

function lotKey(v) { const d = String(v || '').replace(/\D/g, ''); if (!d) return { an: -1, seq: -1 }; return { an: parseInt(d.slice(0, 2), 10), seq: parseInt(d.slice(2) || '0', 10) } }

function dureeLot(l) {
  let min = null, max = null
  for (const ph of PHASES) { const p = l.phases[ph]; if (!p) continue; for (const d of [p.debut, p.date]) { if (!d) continue; const t = new Date(d).getTime(); if (min == null || t < min) min = t; if (max == null || t > max) max = t } }
  if (min == null || max == null) return '—'
  const j = Math.round((max - min) / 86400000)
  return j <= 0 ? '< 1 j' : j + ' j'
}
function dateLotMax(l) {
  let max = 0
  for (const ph of PHASES) { const p = l.phases[ph]; if (!p) continue; for (const d of [p.date, p.debut]) { if (d) { const t = new Date(d).getTime(); if (t > max) max = t } } }
  return max
}
function dansPlage(l) {
  if (!dateFrom.value && !dateTo.value) return true
  const from = dateFrom.value ? new Date(dateFrom.value).getTime() : null
  const to = dateTo.value ? new Date(dateTo.value + 'T23:59:59').getTime() : null
  for (const ph of PHASES) { const p = l.phases[ph]; if (!p) continue; for (const d of [p.debut, p.date]) { if (!d) continue; const x = new Date(d).getTime(); if ((from == null || x >= from) && (to == null || x <= to)) return true } }
  return false
}
const lignesFiltrees = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  const an = annee.value ? Number(annee.value) : null
  return lignes.value.filter(l => {
    if (q && !((l.lot || '').toLowerCase().includes(q) || (l.code || '').toLowerCase().includes(q) || (l.desig || '').toLowerCase().includes(q))) return false
    if (an && anneeLot(l) !== an) return false
    if (!dansPlage(l)) return false
    return true
  }).sort((a, b) => { const ka = lotKey(a.lot), kb = lotKey(b.lot); return (kb.an - ka.an) || (kb.seq - ka.seq) })
})

const rendementMoyen = computed(() => {
  const acc = {}, cnt = {}
  for (const ph of PHASES) { acc[ph] = 0; cnt[ph] = 0 }
  for (const l of lignesFiltrees.value) {
    for (const ph of PHASES) { const r = rendementPhase(l.phases[ph]); if (r != null) { acc[ph] += r; cnt[ph]++ } }
  }
  return PHASES.map(ph => ({ phase: ph, moy: cnt[ph] ? acc[ph] / cnt[ph] : null, n: cnt[ph] }))
})
const lotSel = computed(() => sel.value == null ? null : lignes.value.find(l => l.id === sel.value) || null)
function phasesDuLot(l) { return PHASES.filter(p => l.phases[p]) }

function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR') }
function fmtNb(v) { if (v == null || v === '') return '—'; const n = Number(v); return isNaN(n) ? String(v) : n.toLocaleString('fr-FR') }
function clsStatut(s) { const t = String(s || '').toLowerCase(); if (/termin|libér/.test(t)) return 'ok'; if (/cours/.test(t)) return 'run'; if (/rejet|rebut/.test(t)) return 'bad'; return 'todo' }
function rendementPhase(p) { if (!p) return null; const e = Number(p.qteE), so = Number(p.qteS); if (!(e > 0) || isNaN(so)) return null; return so / e * 100 }
function clsRdt(r) { if (r == null) return ''; if (r >= 98) return 'rdt-ok'; if (r >= 92) return 'rdt-warn'; return 'rdt-bad' }
function nbPhasesGamme(l) { return (l.gamme && l.gamme.length) ? l.gamme.length : PHASES.length }
function nbPhasesFaites(l) { let n = 0; for (const ph of (l.gamme || PHASES)) { const p = l.phases[ph]; if (p && (p.date || p.debut)) n++ } return n }
function dureePhase(p) { if (!p || !p.debut || !p.date) return '—'; const j = Math.round((new Date(p.date) - new Date(p.debut)) / 86400000); return j <= 0 ? '< 1 j' : j + ' j' }
function exporterCSV() {
  const sep = ';'
  const head = ['N° Lot', 'Code', 'Désignation']
  for (const ph of PHASES) { head.push(courtPhase(ph) + ' début', courtPhase(ph) + ' fin', courtPhase(ph) + ' rdt%') }
  head.push('Phases faites', 'Durée (j)', 'Statut')
  const esc = (x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'
  const rows = [head.map(esc).join(sep)]
  for (const l of lignesFiltrees.value) {
    const r = [l.lot, l.code, l.desig]
    for (const ph of PHASES) { if (!l.gamme.includes(ph)) { r.push('NA', 'NA', 'NA') } else { const p = l.phases[ph]; const rd = rendementPhase(p); r.push(p ? fmtDate(p.debut) : '', p ? fmtDate(p.date) : '', rd != null ? rd.toFixed(1) : '') } }
    r.push(nbPhasesFaites(l) + '/' + nbPhasesGamme(l), dureeLot(l).replace(' j', '').replace('< 1', '0'), l.statut || '')
    rows.push(r.map(esc).join(sep))
  }
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'historique-operations.csv'; document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
function exporterPDF() { window.print() }
</script>

<style scoped>
.ho-page { min-height: 100%; background: #f6f7fb; }
.ho-wrap { max-width: 1500px; margin: 0 auto; padding: 8px 14px 20px; }
.card { background: #fff; border: 1px solid #e6e8ef; border-radius: 12px; box-shadow: 0 1px 3px rgba(30, 41, 59, .05); }
.ho-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; margin-bottom: 10px; flex-wrap: wrap; }
.ho-search { flex: 1; min-width: 220px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.ho-search:focus, .ho-sel:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, .12); }
.ho-sel { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.ho-dflt { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; }
.ho-dflt input { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 12px; }
.ho-dflt input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.ho-clear { border: 1px solid #e2e8f0; background: #fff; color: #94a3b8; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-weight: 700; }
.ho-clear:hover { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.ho-count { font-size: 12px; font-weight: 700; color: #6366f1; background: #eef2ff; padding: 5px 10px; border-radius: 20px; }
.ho-load, .ho-err, .ho-empty { padding: 30px; text-align: center; color: #64748b; }
.ho-err { color: #dc2626; }
.ho-tablecard { padding: 0; overflow: hidden; }
.ho-scroll { overflow-x: auto; }
.ho-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.ho-tbl thead th { position: sticky; top: 0; background: #eef2ff; color: #4338ca; font-weight: 800; text-align: left; padding: 8px 10px; white-space: nowrap; border-bottom: 2px solid #e0e7ff; font-size: 11px; z-index: 2; }
.ho-tbl tbody td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.ho-row { cursor: pointer; transition: background .1s; }
.ho-row:hover { background: #f5f7ff; }
.ho-row.sel { background: #eef2ff; }
.ho-lot { font-weight: 800; color: #1e293b; white-space: nowrap; }
.ho-duree { font-weight: 700; color: #6366f1; white-space: nowrap; }
.ho-th-lot, .ho-lot { min-width: 82px; max-width: 82px; }
.ho-tbl thead th.ho-th-lot { position: sticky; left: 0; z-index: 3; }
.ho-tbl thead th.ho-th-prod { position: sticky; left: 82px; z-index: 3; }
.ho-tbl td.ho-lot { position: sticky; left: 0; background: #fff; z-index: 1; }
.ho-tbl td.ho-prod { position: sticky; left: 82px; background: #fff; z-index: 1; box-shadow: 2px 0 4px -2px rgba(0, 0, 0, .08); }
.ho-row:hover td.ho-lot, .ho-row:hover td.ho-prod { background: #f5f7ff; }
.ho-row.sel td.ho-lot, .ho-row.sel td.ho-prod { background: #eef2ff; }
.ho-exp { border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; font: inherit; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap; }
.ho-exp:hover { background: #e0e7ff; }
.ho-prog { min-width: 90px; }
.ho-progbar { height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 3px; }
.ho-progfill { height: 100%; background: linear-gradient(90deg, #818cf8, #4f46e5); border-radius: 4px; transition: width .3s; }
.ho-progtxt { font-size: 10px; font-weight: 700; color: #64748b; }
@media print {
  .ho-bar, .ho-detail { display: none !important; }
  .ho-page { background: #fff; }
  .ho-wrap { max-width: none; padding: 0; }
  .ho-tbl { font-size: 8.5px; }
  .ho-tbl thead th, .ho-tbl td.ho-lot, .ho-tbl td.ho-prod { position: static !important; box-shadow: none !important; }
  .card { border: none; box-shadow: none; }
  .ho-eq { display: none; }
}
.ho-prod { min-width: 160px; }
.ho-code { font-weight: 700; color: #4338ca; display: block; }
.ho-desig { color: #64748b; font-size: 11px; }
.ho-cell { white-space: nowrap; }
.ho-cell-vide { color: #cbd5e1; }
.ho-cell-na { background: #f8fafc; }
.ho-na { color: #cbd5e1; font-size: 10px; font-weight: 700; font-style: italic; }
.ho-rdt { display: block; font-size: 10px; font-weight: 800; margin-top: 1px; }
.rdt-ok { color: #16a34a; }
.rdt-warn { color: #d97706; }
.rdt-bad { color: #dc2626; }
.ho-rdt-band { display: flex; align-items: center; gap: 14px; padding: 8px 14px; margin-bottom: 10px; flex-wrap: wrap; }
.ho-rdt-title { font-size: 11px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: .04em; }
.ho-rdt-grid { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
.ho-rdt-item { display: flex; flex-direction: column; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 12px; min-width: 88px; }
.ho-rdt-ph { font-size: 10px; font-weight: 700; color: #64748b; }
.ho-rdt-val { font-size: 16px; font-weight: 800; line-height: 1.1; }
.ho-rdt-n { font-size: 9px; color: #94a3b8; }
.ho-date { display: block; font-weight: 600; color: #334155; }
.ho-lbl { display: inline-block; width: 13px; font-size: 9px; font-weight: 800; color: #a5b4fc; }
.ho-eq { display: block; font-size: 10px; color: #94a3b8; max-width: 130px; overflow: hidden; text-overflow: ellipsis; }
.ho-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.ho-badge.sm { font-size: 10px; padding: 1px 7px; }
.st-ok { background: #dcfce7; color: #15803d; }
.st-run { background: #dbeafe; color: #1d4ed8; }
.st-bad { background: #fee2e2; color: #b91c1c; }
.st-todo { background: #f1f5f9; color: #64748b; }
.ho-detail { margin-top: 12px; padding: 14px; }
.ho-dt-title { font-size: 15px; font-weight: 800; color: #4338ca; margin: 0 0 10px; }
.ho-dt-desig { color: #64748b; font-weight: 500; font-size: 13px; }
.ho-dtbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.ho-dtbl th { text-align: left; padding: 6px 10px; background: #f8fafc; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.ho-dtbl td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
.ho-dtbl .r, .ho-dtbl th.r { text-align: right; }
.ho-dp { font-weight: 700; color: #334155; }
@media (max-width: 700px) { .ho-tbl { font-size: 11px; } .ho-eq { display: none; } }
</style>
