<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import { ICONS, TINTS } from '../icons.js'

const peutEditer = inject('peutEditer', ref(false))

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const anneeSel = ref(anneeCourante)

const lots = ref([])
const conds = ref([])
const msg = ref('')
const chargement = ref(true)

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
  chargement.value = true
  const r = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, ddl_cond_verifie, ddl_cond_verificateur, ddl_cond_date_verification, produits(designation, code_pf)')
    .eq('actif', true))
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  lots.value = r.data || []
  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, date_conditionnement, date_fin, statut').eq('actif', true))
  if (!rc.error) conds.value = rc.data || []
  chargement.value = false
}
onMounted(charger)

const anYear = (d) => d ? new Date(d).getFullYear() : null
function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return x.toLocaleDateString('fr-FR') }
function fmt(n) { return n == null ? '0' : Number(n).toLocaleString('fr-FR') }

// Date de fin de conditionnement d'un lot = la plus récente date_fin de ses conditionnements
const finCondParLot = computed(() => {
  const m = {}
  for (const c of conds.value) {
    if (!c.date_fin) continue
    const t = new Date(c.date_fin).getTime()
    if (!m[c.ordre_id] || t > m[c.ordre_id]) m[c.ordre_id] = t
  }
  return m
})
function dateFinCond(l) {
  const t = finCondParLot.value[l.id]
  return t ? new Date(t).toISOString() : null
}

// Lots dont le conditionnement est terminé (date de fin renseignée), pour l'année choisie
const dossiers = computed(() => lots.value.filter(l => {
  const d = dateFinCond(l)
  return d && (anneeSel.value === 0 || anYear(d) === anneeSel.value)
}))
const attente = computed(() => dossiers.value
  .filter(l => !l.ddl_cond_verifie)
  .sort((a, b) => String(a.numero_lot || '').localeCompare(String(b.numero_lot || ''), undefined, { numeric: true })))
const verifies = computed(() => dossiers.value
  .filter(l => l.ddl_cond_verifie)
  .sort((a, b) => String(b.ddl_cond_date_verification || '').localeCompare(String(a.ddl_cond_date_verification || ''))))

const nbAttente = computed(() => attente.value.length)
const nbVerifies = computed(() => verifies.value.length)
const taux = computed(() => {
  const tot = dossiers.value.length
  return tot ? Math.round((nbVerifies.value / tot) * 100) : 0
})

// Vérification
const verifEnCours = ref(null)
const nomVerif = ref('')
function ouvrir(l) { verifEnCours.value = l.id; nomVerif.value = l.ddl_cond_verificateur || '' }
async function valider(l) {
  const nom = nomVerif.value.trim()
  if (!nom) { msg.value = 'Indiquer le nom du vérificateur.'; return }
  const r = await supabase.from('ordres_fabrication').update({
    ddl_cond_verifie: true,
    ddl_cond_verificateur: nom,
    ddl_cond_date_verification: new Date().toISOString().slice(0, 10)
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  verifEnCours.value = null
  await charger()
}
async function devalider(l) {
  if (!confirm('Annuler la vérification du dossier ' + l.numero_lot + ' ?')) return
  const r = await supabase.from('ordres_fabrication').update({
    ddl_cond_verifie: false, ddl_cond_verificateur: null, ddl_cond_date_verification: null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  await charger()
}
</script>

<template>
  <div class="ddlc-page">
    <PageHeader title="Vérification DDL — Conditionnement" tone="blue"
      subtitle="Dossiers de lot dont le conditionnement est terminé, à vérifier.">
      <label class="annee">Année
        <select v-model.number="anneeSel">
          <option :value="0">Toutes</option>
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(dossiers.length) }}</div></div><div class="kpi-lbl">Dossiers conditionnement {{ anneeSel || '' }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val" :class="{ warn: nbAttente > 0 }">{{ fmt(nbAttente) }}</div></div><div class="kpi-lbl">En attente de vérification</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.check"></svg></span><div class="kpi-val accent">{{ taux }} %</div></div><div class="kpi-lbl">{{ nbVerifies }} vérifiés</div></div>
      </div>

      <section class="card">
        <h3 class="card-title">En attente de vérification ({{ nbAttente }})</h3>
        <div v-if="!attente.length" class="empty">Aucun dossier conditionnement en attente. 🎉</div>
        <div v-else class="table-scroll">
          <table class="mini">
            <thead><tr><th>N° lot</th><th>Code</th><th>Produit</th><th class="right">Fin cond.</th><th class="right"></th></tr></thead>
            <tbody>
              <template v-for="l in attente" :key="l.id">
                <tr>
                  <td class="strong">{{ l.numero_lot }}</td>
                  <td>{{ l.produits ? l.produits.code_pf : '—' }}</td>
                  <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                  <td class="right nowrap">{{ fmtDate(dateFinCond(l)) }}</td>
                  <td class="right"><button v-if="peutEditer" class="link" @click="ouvrir(l)">Vérifier</button></td>
                </tr>
                <tr v-if="verifEnCours === l.id">
                  <td colspan="5" class="verif-row">
                    <span>Vérificateur :</span>
                    <input v-model="nomVerif" placeholder="Nom" @keyup.enter="valider(l)" />
                    <button class="btn sm" @click="valider(l)">Valider</button>
                    <button class="link" @click="verifEnCours = null">Annuler</button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h3 class="card-title">Dossiers vérifiés ({{ nbVerifies }})</h3>
        <div v-if="!verifies.length" class="empty">Aucun dossier vérifié pour cette période.</div>
        <div v-else class="table-scroll">
          <table class="mini">
            <thead><tr><th>N° lot</th><th>Code</th><th>Produit</th><th>Vérifié par</th><th class="right">Date</th><th class="right"></th></tr></thead>
            <tbody>
              <tr v-for="l in verifies" :key="l.id">
                <td class="strong">{{ l.numero_lot }}</td>
                <td>{{ l.produits ? l.produits.code_pf : '—' }}</td>
                <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                <td>{{ l.ddl_cond_verificateur || '—' }}</td>
                <td class="right nowrap">{{ fmtDate(l.ddl_cond_date_verification) }}</td>
                <td class="right"><button v-if="peutEditer" class="link danger" @click="devalider(l)">Annuler</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="hint">Un dossier apparaît ici dès que le <strong>conditionnement du lot est terminé</strong> (date de fin de conditionnement renseignée dans Conditionnement). La vérification est indépendante de celle de la fabrication.</p>
    </template>
  </div>
</template>

<style scoped>
.ddlc-page { color: #1b2733; }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 19px; height: 19px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-val.warn { color: #d97706; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 6px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.accent { color: #0f766e; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }
.verif-row { background: #f8fafc; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.verif-row input { font-size: 13px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 8px; }
.btn { font-size: 13px; font-weight: 600; padding: 7px 12px; border: 0; border-radius: 8px; background: #0f766e; color: #fff; cursor: pointer; }
.btn.sm { padding: 5px 12px; }
.link { background: none; border: 0; color: #0f766e; font-weight: 600; cursor: pointer; font-size: 13px; }
.link.danger { color: #dc2626; }
.hint { color: #64748b; font-size: 13px; margin-top: 4px; }

@media (max-width: 700px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
