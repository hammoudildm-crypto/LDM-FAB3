<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const lots = ref([])
const phasesParLot = ref({})   // ordre_id -> dernière sortie (vrac fabriqué)
const condParLot = ref({})     // ordre_id -> somme entrée conditionnement
const masquerSoldes = ref(true)
const erreur = ref('')

async function charger() {
  erreur.value = ''
  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, produits(code_pf, designation)')
    .eq('actif', true).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rp = await supabase.from('suivi_phases')
    .select('ordre_id, quantite_sortie, date_phase, id')
    .eq('actif', true)
    .order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  const ph = {}
  if (!rp.error) {
    for (const p of rp.data) {
      if (p.quantite_sortie != null) ph[p.ordre_id] = Number(p.quantite_sortie)  // dernière sortie l'emporte
    }
  }
  phasesParLot.value = ph

  const rc = await supabase.from('conditionnement')
    .select('ordre_id, quantite_entree').eq('actif', true)
  const cd = {}
  if (!rc.error) {
    for (const c of rc.data) {
      if (c.quantite_entree != null) cd[c.ordre_id] = (cd[c.ordre_id] || 0) + Number(c.quantite_entree)
    }
  }
  condParLot.value = cd
}

function fabrique(l) { return phasesParLot.value[l.id] ?? null }
function entreCond(l) { return condParLot.value[l.id] ?? 0 }
function enCours(l) {
  const f = fabrique(l)
  if (f == null) return null
  return f - entreCond(l)
}

const lignes = computed(() =>
  lots.value
    .map(l => ({ lot: l, fab: fabrique(l), cond: entreCond(l), enc: enCours(l) }))
    .filter(x => !masquerSoldes.value || x.enc == null || x.enc > 0)
)
const totalEnCours = computed(() => lignes.value.reduce((s, x) => s + (x.enc != null && x.enc > 0 ? x.enc : 0), 0))
const nbAttente = computed(() => lignes.value.filter(x => x.enc != null && x.enc > 0).length)

function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}
function classeEnc(v) { if (v == null) return ''; if (v > 0) return 'enc-pos'; if (v < 0) return 'enc-neg'; return 'enc-zero' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

onMounted(charger)
</script>

<template>
  <div class="ec-page">
    <header class="ec-head">
      <div>
        <h1>En-cours de fabrication</h1>
        <p class="sub">Stock de vrac entre fabrication et conditionnement, par lot.</p>
      </div>
      <label class="toggle">
        <input type="checkbox" v-model="masquerSoldes" />
        Masquer les lots soldés (en-cours = 0)
      </label>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-val accent">{{ fmt(totalEnCours) }}</div><div class="kpi-lbl">Vrac en attente (cp)</div></div>
      <div class="kpi"><div class="kpi-val">{{ nbAttente }}</div><div class="kpi-lbl">Lots avec vrac en attente</div></div>
    </div>

    <section class="card">
      <h2 class="card-title">Par lot</h2>
      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th>Lot</th><th>Produit</th><th>Statut</th>
              <th class="right">Fabriqué (vrac)</th><th class="right">Entré en cond.</th><th class="right">En-cours</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in lignes" :key="x.lot.id">
              <td class="mono">{{ x.lot.numero_lot }}</td>
              <td class="desig">{{ x.lot.produits ? x.lot.produits.designation : '—' }}</td>
              <td><span class="badge" :class="classeStatut(x.lot.statut)">{{ x.lot.statut }}</span></td>
              <td class="right">{{ fmt(x.fab) }}</td>
              <td class="right">{{ fmt(x.cond) }}</td>
              <td class="right strong" :class="classeEnc(x.enc)">{{ fmt(x.enc) }}</td>
            </tr>
            <tr v-if="!lignes.length"><td colspan="6" class="empty">Aucun en-cours à afficher. Décoche « Masquer les lots soldés » pour voir tous les lots.</td></tr>
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
</style>
