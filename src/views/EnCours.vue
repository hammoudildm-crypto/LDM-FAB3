<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import { ICONS, TINTS } from '../icons.js'

const lots = ref([])
const phasesParLot = ref({})   // ordre_id -> dernière sortie (vrac fabriqué)
const condParLot = ref({})     // ordre_id -> somme entrée conditionnement
const condDemarre = ref(new Set())  // ordre_ids ayant au moins un enregistrement de conditionnement
const masquerSoldes = ref(true)
const vracSeul = ref(false)
const recherche = ref('')
const filtreStatut = ref('')
const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']
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
  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_fin_fabrication, produits(code_pf, designation)')
    .eq('actif', true).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, quantite_sortie, date_phase, id')
    .eq('actif', true)
    .order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true }))
  const ph = {}
  if (!rp.error) {
    for (const p of rp.data) {
      if (p.quantite_sortie != null) ph[p.ordre_id] = Number(p.quantite_sortie)  // dernière sortie l'emporte
    }
  }
  phasesParLot.value = ph

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, quantite_entree').eq('actif', true))
  const cd = {}
  const dem = new Set()
  if (!rc.error) {
    for (const c of rc.data) {
      dem.add(c.ordre_id)
      if (c.quantite_entree != null) cd[c.ordre_id] = (cd[c.ordre_id] || 0) + Number(c.quantite_entree)
    }
  }
  condParLot.value = cd
  condDemarre.value = dem
}

function fabrique(l) { return phasesParLot.value[l.id] ?? null }
function entreCond(l) { return condParLot.value[l.id] ?? 0 }
function enCours(l) {
  const f = fabrique(l)
  if (f == null) return null
  return f - entreCond(l)
}

// Vrac en attente = fabrication terminée (date_fin_fabrication) et conditionnement jamais démarré
function estVracAttente(l) { return !!l.date_fin_fabrication && !condDemarre.value.has(l.id) }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }

const lignes = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return lots.value
    .map(l => ({ lot: l, fab: fabrique(l), cond: entreCond(l), enc: enCours(l), vracAttente: estVracAttente(l) }))
    .filter(x => !masquerSoldes.value || x.enc == null || x.enc > 0)
    .filter(x => !vracSeul.value || x.vracAttente)
    .filter(x => !filtreStatut.value || x.lot.statut === filtreStatut.value)
    .filter(x => {
      if (!q) return true
      const p = x.lot.produits
      const code = p ? String(p.code_pf || '') : ''
      const desig = p ? String(p.designation || '') : ''
      return String(x.lot.numero_lot || '').toLowerCase().includes(q) || code.toLowerCase().includes(q) || desig.toLowerCase().includes(q)
    })
    .sort((a, b) => String(a.lot.numero_lot || '').localeCompare(String(b.lot.numero_lot || ''), undefined, { numeric: true }))
})
const lotsVracAttente = computed(() => lots.value.filter(l => estVracAttente(l)))
const totalEnCours = computed(() => lotsVracAttente.value.reduce((s, l) => { const f = fabrique(l); return s + (f != null && f > 0 ? f : 0) }, 0))
const nbAttente = computed(() => lotsVracAttente.value.length)

function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}
function classeEnc(v) { if (v == null) return ''; if (v > 0) return 'enc-pos'; if (v < 0) return 'enc-neg'; return 'enc-zero' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

onMounted(charger)
</script>

<template>
  <div class="ec-page">
    <PageHeader title="En-cours de fabrication" tone="blue"
      subtitle="Stock de vrac entre fabrication et conditionnement, par lot.">
      <label class="toggle">
        <input type="checkbox" v-model="masquerSoldes" />
        Masquer les lots soldés (en-cours = 0)
      </label>
    </PageHeader>

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.orange"><svg viewBox="0 0 24 24" v-html="ICONS.hourglass"></svg></span><div class="kpi-val accent">{{ fmt(totalEnCours) }}</div></div><div class="kpi-lbl">Vrac en attente (kg)</div></div>
      <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.layers"></svg></span><div class="kpi-val">{{ nbAttente }}</div></div><div class="kpi-lbl">Lots avec vrac en attente</div></div>
    </div>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Par lot <span class="count">{{ lignes.length }}</span></h2>
        <div class="head-tools">
          <label class="toggle-sm"><input type="checkbox" v-model="vracSeul" /> Vrac en attente seulement</label>
          <input v-model="recherche" type="search" class="recherche" placeholder="Rechercher (lot, code, désignation)…" />
          <select v-model="filtreStatut" class="filtre">
            <option value="">Tous les statuts</option>
            <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th>Lot</th><th>Produit</th><th>Statut</th><th>Fin de fab.</th>
              <th class="right">Fabriqué (kg)</th><th class="right">Reçu en cond. (kg)</th><th class="right">En-cours</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in lignes" :key="x.lot.id">
              <td class="mono">{{ x.lot.numero_lot }}<span v-if="x.vracAttente" class="tag-vrac" title="Fabrication terminée, conditionnement non démarré">vrac en attente</span></td>
              <td class="desig">{{ x.lot.produits ? x.lot.produits.designation : '—' }}</td>
              <td><span class="badge" :class="classeStatut(x.lot.statut)">{{ x.lot.statut }}</span></td>
              <td>{{ fmtDate(x.lot.date_fin_fabrication) }}</td>
              <td class="right">{{ fmt(x.fab) }}</td>
              <td class="right">{{ fmt(x.cond) }}</td>
              <td class="right strong" :class="classeEnc(x.enc)">{{ fmt(x.enc) }}</td>
            </tr>
            <tr v-if="!lignes.length"><td colspan="7" class="empty">Aucun en-cours à afficher. Décoche « Masquer les lots soldés » pour voir tous les lots.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="hint">Calcul : <strong>Fabriqué</strong> = sortie de la dernière phase de fabrication du lot ; <strong>En-cours</strong> = Fabriqué − total entré en conditionnement. Un « — » signifie qu'aucune phase avec une quantité de sortie n'a encore été saisie pour ce lot.</p>
  </div>
</template>

<style scoped>
.ec-page { color: #1b2733; }
.ec-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin: 4px 0 18px; flex-wrap: wrap; }
.ec-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.ec-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; }
.toggle input { width: 16px; height: 16px; accent-color: #0f766e; cursor: pointer; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; grid-template-columns: repeat(2, 240px); gap: 14px; margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }
.tag-vrac { display: inline-block; margin-left: 7px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .02em; color: #92400e; background: #fef3c7; padding: 1px 7px; border-radius: 999px; vertical-align: middle; }
.toggle-sm { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; }
.toggle-sm input { width: 15px; height: 15px; accent-color: #0f766e; cursor: pointer; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.strong { font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; white-space: normal; }

.enc-pos { color: #0f766e; }
.enc-neg { color: #b91c1c; }
.enc-zero { color: #94a3b8; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

.hint { color: #64748b; font-size: 13px; margin-top: 4px; }

@media (max-width: 700px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
}
.card-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.card-head .card-title { margin: 0; }
.count { display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; margin-left: 6px; }
.head-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.recherche { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 240px; }
.recherche:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.filtre { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
</style>
