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
        <span class="ho-count">{{ lignesFiltrees.length }} lot(s)</span>
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
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lignesFiltrees" :key="l.id" class="ho-row" :class="{ sel: sel === l.id }" @click="sel = (sel === l.id ? null : l.id)">
                <td class="ho-lot">{{ l.lot }}</td>
                <td class="ho-prod"><span class="ho-code">{{ l.code }}</span><span class="ho-desig">{{ l.desig }}</span></td>
                <td v-for="ph in PHASES" :key="ph" class="ho-cell" :class="{ 'ho-cell-vide': !l.phases[ph] }">
                  <template v-if="l.phases[ph]">
                    <span class="ho-date"><span class="ho-lbl">D</span>{{ fmtDate(l.phases[ph].debut) }}</span>
                    <span class="ho-date"><span class="ho-lbl">F</span>{{ fmtDate(l.phases[ph].date) }}</span>
                    <span v-if="l.phases[ph].equip" class="ho-eq" :title="l.phases[ph].equip">{{ l.phases[ph].equip }}</span>
                  </template>
                  <span v-else>—</span>
                </td>
                <td><span class="ho-badge" :class="'st-' + clsStatut(l.statut)">{{ l.statut || '—' }}</span></td>
              </tr>
              <tr v-if="!lignesFiltrees.length"><td :colspan="PHASES.length + 3" class="ho-empty">Aucun lot ne correspond.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="lotSel" class="card ho-detail">
        <h3 class="ho-dt-title">Détail du lot {{ lotSel.lot }} — {{ lotSel.code }} <span class="ho-dt-desig">{{ lotSel.desig }}</span></h3>
        <div class="ho-scroll">
          <table class="ho-dtbl">
            <thead><tr><th>Phase</th><th>Équipement</th><th class="r">Entrée (kg)</th><th class="r">Sortie (kg)</th><th>Début</th><th>Fin</th><th>Statut</th></tr></thead>
            <tbody>
              <tr v-for="ph in phasesDuLot(lotSel)" :key="ph">
                <td class="ho-dp">{{ ph }}</td>
                <td>{{ lotSel.phases[ph].equip || '—' }}</td>
                <td class="r">{{ fmtNb(lotSel.phases[ph].qteE) }}</td>
                <td class="r">{{ fmtNb(lotSel.phases[ph].qteS) }}</td>
                <td>{{ fmtDate(lotSel.phases[ph].debut) }}</td>
                <td>{{ fmtDate(lotSel.phases[ph].date) }}</td>
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
const annee = ref('')
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

async function charger() {
  chargement.value = true; erreur.value = ''
  try {
    const rows = await fetchAllPaged(() => supabase.from('suivi_phases')
      .select('ordre_id, phase, quantite_entree, quantite_sortie, date_debut, date_phase, statut, equipements(code, nom), ordres_fabrication(numero_lot, statut, produits(code_pf, designation))')
      .eq('actif', true))
    const map = {}
    for (const r of rows) {
      const oid = r.ordre_id; if (!oid) continue
      const o = r.ordres_fabrication || {}
      const pr = o.produits || {}
      if (!map[oid]) map[oid] = { id: oid, lot: o.numero_lot || '—', code: pr.code_pf || '—', desig: pr.designation || '', statut: o.statut || '', phases: {} }
      const ph = normPhase(r.phase)
      const eq = r.equipements ? (r.equipements.code + (r.equipements.nom ? ' · ' + r.equipements.nom : '')) : ''
      const prev = map[oid].phases[ph]
      if (!prev || (r.date_phase && (!prev.date || r.date_phase > prev.date))) {
        map[oid].phases[ph] = { date: r.date_phase, debut: r.date_debut, equip: eq, qteE: r.quantite_entree, qteS: r.quantite_sortie, statut: r.statut }
      }
    }
    lignes.value = Object.values(map)
  } catch (e) { erreur.value = e.message || String(e) }
  chargement.value = false
}
onMounted(charger)

function anneeLot(l) {
  for (const ph of PHASES) { const p = l.phases[ph]; if (p && p.date) return new Date(p.date).getFullYear() }
  return null
}
const anneesDispo = computed(() => {
  const s = new Set()
  for (const l of lignes.value) { const a = anneeLot(l); if (a) s.add(a) }
  return [...s].sort((a, b) => b - a)
})

function lotKey(v) { const d = String(v || '').replace(/\D/g, ''); if (!d) return { an: -1, seq: -1 }; return { an: parseInt(d.slice(0, 2), 10), seq: parseInt(d.slice(2) || '0', 10) } }

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
  }).sort((a, b) => { const ka = lotKey(a.lot), kb = lotKey(b.lot); return (ka.an - kb.an) || (ka.seq - kb.seq) })
})

const lotSel = computed(() => sel.value == null ? null : lignes.value.find(l => l.id === sel.value) || null)
function phasesDuLot(l) { return PHASES.filter(p => l.phases[p]) }

function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('fr-FR') }
function fmtNb(v) { if (v == null || v === '') return '—'; const n = Number(v); return isNaN(n) ? String(v) : n.toLocaleString('fr-FR') }
function clsStatut(s) { const t = String(s || '').toLowerCase(); if (/termin|libér/.test(t)) return 'ok'; if (/cours/.test(t)) return 'run'; if (/rejet|rebut/.test(t)) return 'bad'; return 'todo' }
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
.ho-prod { min-width: 160px; }
.ho-code { font-weight: 700; color: #4338ca; display: block; }
.ho-desig { color: #64748b; font-size: 11px; }
.ho-cell { white-space: nowrap; }
.ho-cell-vide { color: #cbd5e1; }
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
