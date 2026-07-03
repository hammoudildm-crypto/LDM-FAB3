<script setup>
import { ref, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const TABLES = [
  { v: 'donneurs_ordre', l: "Donneurs d'ordre" },
  { v: 'produits', l: 'Produits' },
  { v: 'ateliers', l: 'Ateliers' },
  { v: 'equipements', l: 'Équipements' },
  { v: 'plan_production', l: 'Plan directeur' },
  { v: 'ordres_fabrication', l: 'Lots' },
  { v: 'suivi_phases', l: 'Suivi phases' },
  { v: 'conditionnement', l: 'Conditionnement' },
  { v: 'effectifs', l: 'Effectifs' }
]
const SKIP = ['created_at', 'updated_at', 'created_by', 'id']

const entries = ref([])
const filtreTable = ref('')
const filtreAction = ref('')
const expanded = ref(null)
const erreur = ref('')
const chargement = ref(false)

function labelTable(t) { const x = TABLES.find(z => z.v === t); return x ? x.l : t }
function labelAction(a) { return { INSERT: 'Création', UPDATE: 'Modification', DELETE: 'Suppression' }[a] || a }
function classeAction(a) { return { INSERT: 'a-ins', UPDATE: 'a-upd', DELETE: 'a-del' }[a] || 'a-upd' }

async function charger() {
  erreur.value = ''
  chargement.value = true
  let q = supabase.from('audit_log').select('*').order('changed_at', { ascending: false }).limit(300)
  if (filtreTable.value) q = q.eq('table_name', filtreTable.value)
  if (filtreAction.value) q = q.eq('action', filtreAction.value)
  const r = await q
  chargement.value = false
  if (r.error) { erreur.value = r.error.message; return }
  entries.value = r.data
}

function champsModifies(e) {
  if (e.action !== 'UPDATE' || !e.old_data || !e.new_data) return []
  const out = []
  for (const k of Object.keys(e.new_data)) {
    if (SKIP.includes(k)) continue
    if (JSON.stringify(e.old_data[k]) !== JSON.stringify(e.new_data[k])) out.push({ champ: k, avant: e.old_data[k], apres: e.new_data[k] })
  }
  return out
}
function champsCrees(e) {
  if (e.action !== 'INSERT' || !e.new_data) return []
  const out = []
  for (const k of Object.keys(e.new_data)) {
    if (SKIP.includes(k) || k === 'actif') continue
    if (e.new_data[k] !== null && e.new_data[k] !== '') out.push({ champ: k, valeur: e.new_data[k] })
  }
  return out
}
function toggle(id) { expanded.value = expanded.value === id ? null : id }

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (v === true) return 'oui'
  if (v === false) return 'non'
  return String(v)
}
function fmtDate(d) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
function user(e) { return e.changed_by_email || (e.changed_by ? e.changed_by.slice(0, 8) + '…' : 'système') }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['Date / heure', 'Utilisateur', 'Table', 'Action', 'Enregistrement']
  const lignes = entries.value.map(e => [
    fmtDate(e.changed_at),
    user(e),
    labelTable(e.table_name),
    labelAction(e.action),
    '#' + e.record_id
  ])
  telechargerCSV('journal_audit.csv', entetes, lignes)
}

onMounted(charger)
watch([filtreTable, filtreAction], charger)
</script>

<template>
  <div class="au-page">
    <PageHeader title="Journal d'audit" tone="slate"
      subtitle="Traçabilité des créations, modifications et suppressions — qui, quoi, quand (BPF / 21 CFR Part 11)." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Événements</h2>
        <span class="count">{{ entries.length }}</span>
        <select v-model="filtreTable" class="filtre">
          <option value="">Toutes les tables</option>
          <option v-for="t in TABLES" :key="t.v" :value="t.v">{{ t.l }}</option>
        </select>
        <select v-model="filtreAction" class="filtre">
          <option value="">Toutes les actions</option>
          <option value="INSERT">Création</option>
          <option value="UPDATE">Modification</option>
          <option value="DELETE">Suppression</option>
        </select>
        <button class="btn-exp" @click="exporterCSV" :disabled="!entries.length">Exporter CSV</button>
      </div>

      <p v-if="chargement" class="info">Chargement…</p>

      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr><th>Date / heure</th><th>Utilisateur</th><th>Table</th><th>Action</th><th>Enreg.</th><th class="right">Détails</th></tr>
          </thead>
          <tbody>
            <template v-for="e in entries" :key="e.id">
              <tr>
                <td class="nowrap">{{ fmtDate(e.changed_at) }}</td>
                <td>{{ user(e) }}</td>
                <td>{{ labelTable(e.table_name) }}</td>
                <td><span class="badge" :class="classeAction(e.action)">{{ labelAction(e.action) }}</span></td>
                <td class="mono">#{{ e.record_id }}</td>
                <td class="right"><button class="link" @click="toggle(e.id)">{{ expanded === e.id ? 'Masquer' : 'Voir' }}</button></td>
              </tr>
              <tr v-if="expanded === e.id" class="detail-row">
                <td colspan="6">
                  <div class="detail">
                    <template v-if="e.action === 'UPDATE'">
                      <table v-if="champsModifies(e).length" class="diff">
                        <thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead>
                        <tbody>
                          <tr v-for="c in champsModifies(e)" :key="c.champ">
                            <td class="champ">{{ c.champ }}</td>
                            <td class="avant">{{ fmtVal(c.avant) }}</td>
                            <td class="apres">{{ fmtVal(c.apres) }}</td>
                          </tr>
                        </tbody>
                      </table>
                      <span v-else class="muted">Aucun champ suivi n'a changé.</span>
                    </template>
                    <template v-else-if="e.action === 'INSERT'">
                      <div class="created">
                        <span v-for="c in champsCrees(e)" :key="c.champ" class="chip"><b>{{ c.champ }}</b> : {{ fmtVal(c.valeur) }}</span>
                        <span v-if="!champsCrees(e).length" class="muted">Enregistrement créé.</span>
                      </div>
                    </template>
                    <template v-else>
                      <span class="muted">Enregistrement supprimé.</span>
                    </template>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="!entries.length && !chargement"><td colspan="6" class="empty">Aucun événement. Le journal se remplira automatiquement à chaque création / modification.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="hint">Le journal est alimenté automatiquement par la base de données et ne peut pas être modifié depuis l'application — gage d'intégrité.</p>
  </div>
</template>

<style scoped>
.au-page { color: #1b2733; }
.au-head { margin: 4px 0 18px; }
.au-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.au-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.info { color: #64748b; font-size: 13px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.filtre { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.btn-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }
.card-head .filtre:first-of-type { margin-left: auto; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid > tbody > tr > td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.a-ins { background: #dcfce7; color: #166534; }
.a-upd { background: #dbeafe; color: #1e40af; }
.a-del { background: #fee2e2; color: #b91c1c; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }

.detail-row > td { background: #f8fafc; border-bottom: 1px solid #eef2f6; padding: 0 10px 12px; }
.detail { padding: 10px 0; }
.muted { color: #94a3b8; font-size: 13px; font-style: italic; }

table.diff { border-collapse: collapse; font-size: 13px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
table.diff th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; padding: 6px 12px; }
table.diff td { padding: 6px 12px; border-top: 1px solid #eef2f6; }
.champ { font-weight: 600; }
.avant { color: #b91c1c; }
.apres { color: #166534; }

.created { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { background: #fff; border: 1px solid #e2e8f0; border-radius: 7px; padding: 4px 10px; font-size: 13px; color: #475569; }
.chip b { color: #1b2733; }

.hint { color: #64748b; font-size: 13px; margin-top: 4px; }
</style>
