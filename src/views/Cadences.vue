<template>
  <div class="cad">
    <div class="cad-head">
      <div>
        <div class="cadh-eyebrow">Référentiel</div>
        <h1 class="cadh-title">Cadences par équipement & produit</h1>
        <p class="cadh-sub">Saisis la cadence de chaque produit sur un équipement. Elles alimentent le suivi de capacité et l'ordonnancement.</p>
      </div>
    </div>

    <section class="card">
      <div class="ctrl">
        <div class="cf grow">
          <label>Équipement</label>
          <select v-model="selEquip" @change="chargerEditeur">
            <option value="">— Choisir un équipement ({{ equipements.length }}) —</option>
            <optgroup v-for="g in equipParAtelierListe" :key="g.aid" :label="g.nom">
              <option v-for="e in g.equipements" :key="e.id" :value="e.id">{{ e.nom || e.code }}</option>
            </optgroup>
          </select>
        </div>
        <div class="cf hint" v-if="selEquip">
          <label>Unité attendue</label>
          <div class="unite">{{ uniteHint }}</div>
        </div>
      </div>
      <p v-if="chargement" class="muted">Chargement…</p>
    </section>

    <section v-if="selEquip && !chargement" class="card">
      <div class="ed-head">
        <h2 class="card-title">{{ equipNom }} — {{ nbRenseignees }} produit(s) cadencé(s)</h2>
        <input type="search" v-model="filtre" class="prod-search" placeholder="Filtrer un produit…" />
      </div>
      <div class="tbl-wrap">
        <table class="grid">
          <thead>
            <tr><th>Produit</th><th class="ta-r">Taille lot</th><th class="ta-c">Cadence ({{ uniteCourte }})</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in produitsAffiches" :key="p.id" :class="{ modif: estModifie(p.id) }">
              <td><strong>{{ p.code_pf }}</strong> <span class="desig">{{ p.designation }}</span></td>
              <td class="ta-r">{{ p.taille_lot ? Number(p.taille_lot).toLocaleString('fr-FR') : '—' }}</td>
              <td class="ta-c">
                <input type="number" min="0" step="any" class="cad-inp" :class="{ rempli: Number(cadEdit[p.id]) > 0 }"
                       v-model="cadEdit[p.id]" placeholder="—" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="save-bar">
        <span class="pending" v-if="nbChangements">{{ nbChangements }} modification(s) en attente</span>
        <span class="pending ok" v-else>Aucune modification</span>
        <button class="btn-save" :disabled="!nbChangements || sauvegarde" @click="enregistrer">
          {{ sauvegarde ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
      <p v-if="message" class="msg" :class="{ err: messageErr }">{{ message }}</p>
    </section>

    <section v-if="!chargement && !selEquip" class="card">
      <h2 class="card-title">Récapitulatif</h2>
      <p class="muted">{{ cadences.length }} cadence(s) enregistrée(s) au total, sur {{ equipCadenceCount }} équipement(s).</p>
      <div class="recap">
        <div v-for="g in recapEquip" :key="g.id" class="recap-item">
          <span class="ri-nom">{{ g.nom }}</span>
          <span class="ri-cnt">{{ g.n }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const produits = ref([]), equipements = ref([]), ateliers = ref([]), cadences = ref([])
const chargement = ref(true), sauvegarde = ref(false)
const selEquip = ref(''), filtre = ref('')
const message = ref(''), messageErr = ref(false)

const cadEdit = reactive({})   // produitId -> valeur (string)
let original = {}              // produitId -> nombre (valeur d'origine)
let rowIds = {}               // produitId -> id de la ligne cadences_produit existante

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}
async function chargerCadences() {
  cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('id, equipement_id, produit_id, cadence_nominale'))
}

onMounted(async () => {
  const [rp, re, ra] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id').eq('actif', true)),
    fetchAllPaged(() => supabase.from('ateliers').select('id, code, nom').eq('actif', true))
  ])
  produits.value = rp; equipements.value = re; ateliers.value = ra
  await chargerCadences()
  chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}

const atelierById = computed(() => { const m = {}; for (const a of ateliers.value) m[a.id] = a; return m })
const equipById = computed(() => { const m = {}; for (const e of equipements.value) m[e.id] = e; return m })
const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))

const equipParAtelierListe = computed(() => {
  const g = {}
  for (const e of equipements.value) {
    const aid = e.atelier_id || 'sans'
    if (!g[aid]) g[aid] = { aid, nom: (atelierById.value[aid] && atelierById.value[aid].nom) || 'Sans atelier', equipements: [] }
    g[aid].equipements.push(e)
  }
  return Object.values(g).sort((a, b) => a.nom.localeCompare(b.nom))
})

const equipNom = computed(() => { const e = equipById.value[selEquip.value]; return e ? (e.nom || e.code) : '' })
const phaseCourante = computed(() => { const e = equipById.value[selEquip.value]; return e ? phaseDeType(e.type) : null })
const estCond = computed(() => phaseCourante.value === 'conditionnement')
const uniteHint = computed(() => estCond.value ? 'unités / heure (conditionnement)' : 'kg / heure (fabrication)')
const uniteCourte = computed(() => estCond.value ? 'u/h' : 'kg/h')

function chargerEditeur() {
  for (const k of Object.keys(cadEdit)) delete cadEdit[k]
  original = {}; rowIds = {}; message.value = ''
  if (!selEquip.value) return
  for (const c of cadences.value) {
    if (c.equipement_id !== selEquip.value) continue
    const v = Number(c.cadence_nominale || 0)
    cadEdit[c.produit_id] = v ? String(v) : ''
    original[c.produit_id] = v
    rowIds[c.produit_id] = c.id
  }
}

const produitsAffiches = computed(() => {
  const q = filtre.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})
const nbRenseignees = computed(() => produits.value.filter(p => Number(cadEdit[p.id]) > 0).length)
function estModifie(pid) { return (Number(cadEdit[pid]) || 0) !== (original[pid] || 0) }
const nbChangements = computed(() => produits.value.filter(p => estModifie(p.id)).length)

async function enregistrer() {
  if (!nbChangements.value) return
  sauvegarde.value = true; message.value = ''; messageErr.value = false
  const inserts = [], updates = [], deletes = []
  for (const p of produits.value) {
    const nv = Number(cadEdit[p.id]) || 0
    const ov = original[p.id] || 0
    if (nv === ov) continue
    if (nv > 0 && rowIds[p.id]) updates.push({ id: rowIds[p.id], cadence_nominale: nv })
    else if (nv > 0) inserts.push({ equipement_id: selEquip.value, produit_id: p.id, cadence_nominale: nv })
    else if (nv === 0 && rowIds[p.id]) deletes.push(rowIds[p.id])
  }
  try {
    for (const u of updates) { const r = await supabase.from('cadences_produit').update({ cadence_nominale: u.cadence_nominale }).eq('id', u.id); if (r.error) throw r.error }
    if (inserts.length) { const r = await supabase.from('cadences_produit').insert(inserts); if (r.error) throw r.error }
    if (deletes.length) { const r = await supabase.from('cadences_produit').delete().in('id', deletes); if (r.error) throw r.error }
    await chargerCadences()
    chargerEditeur()
    message.value = `Enregistré : ${updates.length} mise(s) à jour, ${inserts.length} ajout(s), ${deletes.length} suppression(s).`
  } catch (e) {
    messageErr.value = true
    message.value = 'Erreur lors de l\'enregistrement : ' + (e.message || e)
  } finally {
    sauvegarde.value = false
  }
}

// Récapitulatif (aucun équipement sélectionné)
const cadenceParEquip = computed(() => { const m = {}; for (const c of cadences.value) if (Number(c.cadence_nominale) > 0) m[c.equipement_id] = (m[c.equipement_id] || 0) + 1; return m })
const equipCadenceCount = computed(() => Object.keys(cadenceParEquip.value).length)
const recapEquip = computed(() =>
  equipements.value.map(e => ({ id: e.id, nom: e.nom || e.code, n: cadenceParEquip.value[e.id] || 0 }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n)
)
</script>

<style scoped>
.cad { max-width: 1080px; margin: 0 auto; padding: 6px 4px 24px; }
.cad-head { margin-bottom: 20px; }
.cadh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.cadh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.cadh-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0; }
.muted { font-size: 13px; color: #94a3b8; margin: 6px 0 0; }

.ctrl { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.cf { display: flex; flex-direction: column; gap: 5px; }
.cf.grow { flex: 1; min-width: 260px; }
.cf label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.cf select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.unite { padding: 8px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; font-size: 13px; font-weight: 600; color: #0f766e; white-space: nowrap; }

.ed-head { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.prod-search { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; min-width: 220px; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th, .grid td { padding: 7px 10px; border-bottom: 1px solid #eef2f6; text-align: left; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; } .ta-c { text-align: center; }
.desig { color: #94a3b8; font-size: 12px; }
.grid tr.modif { background: #fffbeb; }
.cad-inp { width: 120px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; }
.cad-inp.rempli { border-color: #0f766e; background: #f0fdfa; font-weight: 600; }

.save-bar { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #eef2f6; }
.pending { font-size: 13px; font-weight: 600; color: #b45309; }
.pending.ok { color: #94a3b8; }
.btn-save { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 20px; cursor: pointer; }
.btn-save:disabled { background: #cbd5e1; cursor: not-allowed; }
.msg { font-size: 13px; color: #15803d; margin-top: 12px; font-weight: 600; }
.msg.err { color: #b91c1c; }

.recap { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 14px; }
.recap-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 9px; }
.ri-nom { font-size: 13px; font-weight: 600; color: #334155; }
.ri-cnt { font-size: 13px; font-weight: 800; color: #0f766e; background: #f0fdfa; border-radius: 6px; padding: 2px 9px; }
</style>
