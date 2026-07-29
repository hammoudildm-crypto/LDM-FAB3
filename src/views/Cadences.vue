<template>
  <div class="cad">
    <div class="cad-head">
      <div>
        <div class="cadh-eyebrow">Référentiel</div>
        <h1 class="cadh-title">Cadences & paramètres par équipement</h1>
        <p class="cadh-sub">Cadence par produit + temps de nettoyage, réglage et rendement par équipement. Alimente le suivi de capacité et l'ordonnancement.</p>
      </div>
    </div>

    <section class="card">
      <div class="ctrl">
        <div class="cf grow">
          <label>Équipement</label>
          <select v-model="selEquip" @change="chargerEditeur">
            <option value="">— Choisir un équipement ({{ equipements.length }}) —</option>
            <optgroup v-for="g in equipParAtelierListe" :key="g.aid" :label="g.nom">
              <option v-for="e in g.equipements" :key="e.id" :value="e.id">{{ libelleEquip(e) }}</option>
            </optgroup>
          </select>
        </div>
        <div class="cf hint" v-if="selEquip">
          <label>Unité de cadence</label>
          <div class="unite">{{ uniteHint }}</div>
        </div>
      </div>
      <p v-if="chargement" class="muted">Chargement…</p>
    </section>

    <!-- Paramètres Ratio de l'équipement -->
    <section v-if="selEquip && !chargement" class="card">
      <h2 class="card-title">Paramètres de temps — {{ equipNom }}</h2>
      <div class="params">
        <div class="pgroup">
          <div class="pg-title">Capacité</div>
          <div class="pg-fields">
            <label class="pfield"><span>Machines <em>(EQUIPEMENT)</em></span><input type="number" min="1" step="1" v-model="paramEdit.nb_machines" /></label>
            <label class="pfield"><span>Postes <em>(Shift)</em></span><input type="number" min="1" max="3" step="1" v-model="paramEdit.postes" /></label>
            <label class="pfield"><span>TEP <em>(h effectives / poste)</em></span><input type="number" min="0" step="any" v-model="paramEdit.tep" /></label>
            <div class="pfield"><span>TRS réel <em>(historique)</em></span><div class="trs-disp" :class="trsReel ? trsCls(trsReel.trs) : 'trs-muted'"><template v-if="trsChargementReel">…</template><template v-else-if="trsReel">{{ (trsReel.trs * 100).toFixed(1) }} %</template><template v-else>—</template></div></div>
          </div>
          <div class="trs-cap" v-if="trsReel">Disponibilité {{ (trsReel.dispo * 100).toFixed(0) }} % · Performance {{ (trsReel.perf * 100).toFixed(0) }} % · Qualité {{ (trsReel.qualite * 100).toFixed(0) }} % — {{ trsReel.nbPostes }} poste(s), {{ fmtD(trsReel.du) }} → {{ fmtD(trsReel.au) }}</div>
          <div class="trs-cap none" v-else-if="selEquip && !trsChargementReel">Aucune saisie TRS pour cet équipement.</div>
        </div>
        <div class="pgroup">
          <div class="pg-title">Nettoyage & réglage (heures)</div>
          <div class="pg-fields">
            <label class="pfield"><span>VDLP <em>(nettoyage partiel / lot)</em></span><input type="number" min="0" step="any" v-model="paramEdit.vdlp" /></label>
            <label class="pfield"><span>VDLT <em>(nettoyage général / campagne)</em></span><input type="number" min="0" step="any" v-model="paramEdit.vdlt" /></label>
            <label class="pfield"><span>REGLAGE <em>(changement format / campagne)</em></span><input type="number" min="0" step="any" v-model="paramEdit.reglage" /></label>
            <label class="pfield"><span>Holding time <em>de la campagne</em></span><input type="number" min="0" step="any" v-model="paramEdit.dht" /></label>
          </div>
        </div>
      </div>
      <div class="save-bar">
        <span class="pending" v-if="paramsModifies">Paramètres modifiés</span>
        <span class="pending ok" v-else>Paramètres à jour</span>
        <button class="btn-save" :disabled="!paramsModifies || sauvegardeP" @click="enregistrerParams">{{ sauvegardeP ? 'Enregistrement…' : 'Enregistrer les paramètres' }}</button>
      </div>
      <p v-if="messageP" class="msg" :class="{ err: messagePErr }">{{ messageP }}</p>
    </section>

    <!-- Cadences produit -->
    <section v-if="selEquip && !chargement" class="card">
      <div class="ed-head">
        <h2 class="card-title">Cadences produit — {{ nbRenseignees }} produit(s) cadencé(s)</h2>
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
                <input type="number" min="0" step="any" class="cad-inp" :class="{ rempli: Number(cadEdit[p.id]) > 0 }" v-model="cadEdit[p.id]" placeholder="—" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="save-bar">
        <span class="pending" v-if="nbChangements">{{ nbChangements }} modification(s) en attente</span>
        <span class="pending ok" v-else>Aucune modification</span>
        <button class="btn-save" :disabled="!nbChangements || sauvegarde" @click="enregistrer">{{ sauvegarde ? 'Enregistrement…' : 'Enregistrer' }}</button>
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
const chargement = ref(true), sauvegarde = ref(false), sauvegardeP = ref(false)
const selEquip = ref(''), filtre = ref('')
const message = ref(''), messageErr = ref(false), messageP = ref(''), messagePErr = ref(false)

const cadEdit = reactive({})
let original = {}, rowIds = {}
const paramEdit = reactive({ nb_machines: 1, postes: 3, tep: 8, dht: 0, vdlp: 0, vdlt: 0, reglage: 0 })
let paramOrig = {}
const CHAMPS_P = ['nb_machines', 'postes', 'tep', 'dht', 'vdlp', 'vdlt', 'reglage']
const DEF_P = { nb_machines: 1, postes: 3, tep: 8, dht: 0, vdlp: 0, vdlt: 0, reglage: 0 }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}
async function chargerCadences() { cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('id, equipement_id, produit_id, cadence_nominale, mode')) }
async function chargerEquip() { equipements.value = await fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)) }

onMounted(async () => {
  produits.value = await fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot').eq('actif', true))
  ateliers.value = await fetchAllPaged(() => supabase.from('ateliers').select('id, code, nom').eq('actif', true))
  await chargerEquip()
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

function libelleEquip(e) { if (!e) return ''; const c = e.code ? String(e.code) : '', n = e.nom ? String(e.nom) : ''; return (c && n) ? c + ' · ' + n : (c || n) }
const equipNom = computed(() => libelleEquip(equipById.value[selEquip.value]))
const phaseCourante = computed(() => { const e = equipById.value[selEquip.value]; return e ? phaseDeType(e.type) : null })
const estCond = computed(() => phaseCourante.value === 'conditionnement')
const uniteHint = computed(() => estCond.value ? 'unités / heure (conditionnement)' : 'kg / heure (fabrication)')
const uniteCourte = computed(() => estCond.value ? 'u/h' : 'kg/h')

function chargerEditeur() {
  for (const k of Object.keys(cadEdit)) delete cadEdit[k]
  original = {}; rowIds = {}; message.value = ''; messageP.value = ''
  if (!selEquip.value) return
  for (const c of cadences.value) {
    if (c.equipement_id !== selEquip.value) continue
    const v = Number(c.cadence_nominale || 0)
    cadEdit[c.produit_id] = v ? String(v) : ''
    original[c.produit_id] = v; rowIds[c.produit_id] = c.id
  }
  const e = equipById.value[selEquip.value] || {}
  paramOrig = {}
  for (const k of CHAMPS_P) { const v = (e[k] === null || e[k] === undefined) ? DEF_P[k] : Number(e[k]); paramEdit[k] = v; paramOrig[k] = v }
  chargerTRSReel(selEquip.value)
}

// ---- TRS réel mesuré (depuis trs_postes, même formule que Suivi TRS) ----
const MOTIFS_TRS = ['arret_panne_min', 'arret_format_min', 'arret_nettoyage_min', 'arret_reglage_min', 'arret_maintenance_min', 'arret_attente_min', 'arret_autre_min']
const trsReel = ref(null)
const trsChargementReel = ref(false)
function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' }
}
async function chargerTRSReel(equipId) {
  trsReel.value = null
  if (!equipId) return
  trsChargementReel.value = true
  const rows = await fetchAllPaged(() => supabase.from('trs_postes').select('*').eq('actif', true).eq('equipement_id', equipId))
  trsChargementReel.value = false
  if (!rows.length) return
  let ouverture = 0, fonct = 0, theo = 0, prodPerf = 0, ecoule = 0, fonctPerf = 0, prodQual = 0, rebutsQual = 0, du = null, au = null
  for (const s of rows) {
    const to = Number(s.temps_ouverture_min) || 0
    let arr = 0; for (const m of MOTIFS_TRS) arr += Number(s[m]) || 0
    const tf = Math.max(0, to - arr)
    ouverture += to; fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { ecoule += Number(s.production_realisee) || 0; fonctPerf += tf }
    else if (cd.value > 0) { theo += (tf / 60) * cd.value; prodPerf += Number(s.production_realisee) || 0; prodQual += Number(s.production_realisee) || 0; rebutsQual += Number(s.rebuts) || 0 }
    if (s.date) { if (!du || s.date < du) du = s.date; if (!au || s.date > au) au = s.date }
  }
  const dispo = ouverture ? fonct / ouverture : 0
  const perf = theo ? Math.min(1, prodPerf / theo) : (fonctPerf ? Math.min(1, ecoule / fonctPerf) : 0)
  const qualite = prodQual ? Math.max(0, (prodQual - rebutsQual) / prodQual) : 1
  trsReel.value = { dispo, perf, qualite, trs: dispo * perf * qualite, nbPostes: rows.length, du, au }
}
function fmtD(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function trsCls(t) { return t >= 0.85 ? 'tr-g' : t >= 0.6 ? 'tr-a' : 'tr-r' }

const produitsAffiches = computed(() => {
  const q = filtre.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})
const nbRenseignees = computed(() => produits.value.filter(p => Number(cadEdit[p.id]) > 0).length)
function estModifie(pid) { return (Number(cadEdit[pid]) || 0) !== (original[pid] || 0) }
const nbChangements = computed(() => produits.value.filter(p => estModifie(p.id)).length)
const paramsModifies = computed(() => CHAMPS_P.some(k => (Number(paramEdit[k]) || 0) !== (paramOrig[k] || 0)))

async function enregistrer() {
  if (!nbChangements.value) return
  sauvegarde.value = true; message.value = ''; messageErr.value = false
  const inserts = [], updates = [], deletes = []
  for (const p of produits.value) {
    const nv = Number(cadEdit[p.id]) || 0, ov = original[p.id] || 0
    if (nv === ov) continue
    if (nv > 0 && rowIds[p.id]) updates.push({ id: rowIds[p.id], cadence_nominale: nv })
    else if (nv > 0) inserts.push({ equipement_id: selEquip.value, produit_id: p.id, cadence_nominale: nv })
    else if (nv === 0 && rowIds[p.id]) deletes.push(rowIds[p.id])
  }
  try {
    for (const u of updates) { const r = await supabase.from('cadences_produit').update({ cadence_nominale: u.cadence_nominale }).eq('id', u.id); if (r.error) throw r.error }
    if (inserts.length) { const r = await supabase.from('cadences_produit').insert(inserts); if (r.error) throw r.error }
    if (deletes.length) { const r = await supabase.from('cadences_produit').delete().in('id', deletes); if (r.error) throw r.error }
    await chargerCadences(); chargerEditeur()
    message.value = `Enregistré : ${updates.length} mise(s) à jour, ${inserts.length} ajout(s), ${deletes.length} suppression(s).`
  } catch (e) { messageErr.value = true; message.value = 'Erreur : ' + (e.message || e) } finally { sauvegarde.value = false }
}

async function enregistrerParams() {
  if (!paramsModifies.value) return
  sauvegardeP.value = true; messageP.value = ''; messagePErr.value = false
  const patch = {}
  for (const k of CHAMPS_P) patch[k] = Number(paramEdit[k]) || 0
  try {
    const r = await supabase.from('equipements').update(patch).eq('id', selEquip.value)
    if (r.error) throw r.error
    await chargerEquip(); chargerEditeur()
    messageP.value = 'Paramètres enregistrés.'
  } catch (e) { messagePErr.value = true; messageP.value = 'Erreur : ' + (e.message || e) + ' — as-tu exécuté le SQL d\'ajout des colonnes ?' } finally { sauvegardeP.value = false }
}

const cadenceParEquip = computed(() => { const m = {}; for (const c of cadences.value) if (Number(c.cadence_nominale) > 0) m[c.equipement_id] = (m[c.equipement_id] || 0) + 1; return m })
const equipCadenceCount = computed(() => Object.keys(cadenceParEquip.value).length)
const recapEquip = computed(() => equipements.value.map(e => ({ id: e.id, nom: libelleEquip(e), code: e.code, n: cadenceParEquip.value[e.id] || 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n))
</script>

<style scoped>
.cad { max-width: 1080px; margin: 0 auto; padding: 6px 4px 24px; }
.cad-head { margin-bottom: 20px; }
.cadh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.cadh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.cadh-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0 0 14px; }
.muted { font-size: 13px; color: #94a3b8; margin: 6px 0 0; }

.ctrl { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.cf { display: flex; flex-direction: column; gap: 5px; }
.cf.grow { flex: 1; min-width: 260px; }
.cf label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.cf select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.unite { padding: 8px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; font-size: 13px; font-weight: 600; color: #0f766e; white-space: nowrap; }

.params { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
@media (max-width: 760px) { .params { grid-template-columns: 1fr; } }
.pgroup { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 14px; }
.pg-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #0f766e; margin-bottom: 12px; }
.pg-fields { display: flex; flex-wrap: wrap; gap: 12px; }
.pfield { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 130px; }
.pfield span { font-size: 12px; font-weight: 600; color: #334155; }
.pfield em { font-style: normal; color: #94a3b8; font-weight: 400; font-size: 11px; }
.pfield input { margin-top: auto; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; }
.trs-disp { margin-top: auto; padding: 7px 10px; border: 1px solid #99f6e4; border-radius: 7px; font-size: 15px; font-weight: 800; text-align: right; background: #f0fdfa; }
.trs-disp.tr-g { color: #15803d; } .trs-disp.tr-a { color: #b45309; } .trs-disp.tr-r { color: #b91c1c; }
.trs-disp.trs-muted { color: #cbd5e1; font-weight: 600; background: #f8fafc; border-color: #eef2f6; }
.trs-cap { font-size: 12px; color: #334155; margin-top: 10px; }
.trs-cap.none { color: #94a3b8; }

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
