<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const SHIFTS = [
  { key: 'matin', label: 'Matin (06h–14h)' },
  { key: 'apres-midi', label: 'Après-midi (14h–22h)' },
  { key: 'nuit', label: 'Nuit (22h–06h)' }
]
function shiftLabel(k) { const s = SHIFTS.find(x => x.key === k); return s ? s.label : k }

const ETATS = ['En marche', 'Arrêté', 'Nettoyage', 'Maintenance', 'Disponible']
function etatClass(e) {
  if (e === 'En marche') return 'marche'
  if (e === 'Arrêté') return 'arret'
  if (e === 'Nettoyage') return 'nett'
  if (e === 'Maintenance') return 'maint'
  if (e === 'Disponible') return 'dispo'
  return 'none'
}

const PHASES_FAB = ['pesée', 'pesee', 'granulation', 'séchage', 'sechage', 'calibrage', 'mélange', 'melange', 'compression', 'remplissage', 'gélul', 'gelul', 'pelliculage']
const ORDRE_GAMME = [['pesée', 'pesee'], ['granulation'], ['séchage', 'sechage'], ['calibrage', 'mélange', 'melange'], ['compression'], ['remplissage', 'gélul', 'gelul'], ['pelliculage']]
function ordreEquip(e) { const t = (e.type || '').toLowerCase(); for (let i = 0; i < ORDRE_GAMME.length; i++) if (ORDRE_GAMME[i].some(k => t.includes(k))) return i; return 999 }
function siteEquip(e) { const c = (e.code || '').toUpperCase(); if (c.startsWith('PRH')) return 'hormonal'; if (c === 'PR054') return 'semi'; return 'seche' }
function siteLabel(s) { return s === 'hormonal' ? 'Hormonal' : s === 'semi' ? 'Semi-solide' : 'Forme sèche' }
function ordreSite(e) { const s = siteEquip(e); return s === 'hormonal' ? 0 : s === 'seche' ? 1 : 2 }
const PHASES_NOMS = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage gélules', 'Pelliculage']
function phaseEquip(e) { const i = ordreEquip(e); return i < PHASES_NOMS.length ? PHASES_NOMS[i] : 'Autre' }

const superviseurs = ref([])
const equipements = ref([])
const consignes = ref([])
const chargement = ref(true)
const erreur = ref('')
const enregistrement = ref(false)
const entrant1 = reactive({})
const entrant2 = reactive({})
const pin1Ack = reactive({})
const pin2Ack = reactive({})
async function verifierPin(nom, pin) { if (!nom || !pin) return false; const r = await supabase.rpc('verifier_pin_superviseur', { p_nom: nom, p_pin: String(pin) }); return !r.error && r.data === true }
const etatEquip = reactive({})

const equipsFab = computed(() => equipements.value.filter(e => {
  const t = (e.type || '').toLowerCase()
  return PHASES_FAB.some(ph => t.includes(ph))
}).sort((a, b) => (ordreSite(a) - ordreSite(b)) || (ordreEquip(a) - ordreEquip(b)) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })))

const SITES = [{ key: 'hormonal', label: 'Hormonal' }, { key: 'seche', label: 'Forme sèche' }, { key: 'semi', label: 'Semi-solide' }]
const siteSel = ref('seche')
const phaseSel = ref('')
const phasesDisponibles = computed(() => { const set = new Set(); for (const e of equipsFab.value) if (siteEquip(e) === siteSel.value) set.add(phaseEquip(e)); return [...PHASES_NOMS, 'Autre'].filter(p => set.has(p)) })
const equipsAffiches = computed(() => equipsFab.value.filter(e => siteEquip(e) === siteSel.value && (!phaseSel.value || phaseEquip(e) === phaseSel.value)))
const nbParSite = computed(() => { const m = { hormonal: 0, seche: 0, semi: 0 }; for (const e of equipsFab.value) m[siteEquip(e)] = (m[siteEquip(e)] || 0) + 1; return m })
const resume = computed(() => {
  let marche = 0, arret = 0, maint = 0, taches = 0
  for (const e of equipsFab.value) {
    const et = etatEquip[e.id] || {}
    if (et.etat === 'En marche') marche++
    else if (et.etat === 'Arrêté') arret++
    else if (et.etat === 'Maintenance') maint++
    if ((et.aRealiser || '').trim()) taches++
  }
  return { marche, arret, maint, taches }
})
function imprimer() { window.print() }

const form = reactive({
  date_shift: new Date().toISOString().slice(0, 10),
  shift: 'matin',
  superviseur_sortant: '',
  superviseur_sortant_2: '',
  pin_sortant: '',
  pin_sortant_2: ''
})

function initEtat() {
  for (const e of equipsFab.value) if (!etatEquip[e.id]) etatEquip[e.id] = { etat: '', lot: '', realisees: '', aRealiser: '' }
}

async function charger() {
  chargement.value = true
  erreur.value = ''
  const rs = await supabase.from('superviseurs').select('nom').order('nom')
  superviseurs.value = (rs.data || []).map(x => x.nom)
  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  equipements.value = re.data || []
  initEtat()
  const rc = await supabase.from('passation_consignes')
    .select('*')
    .order('date_shift', { ascending: false })
    .order('cree_le', { ascending: false })
    .limit(300)
  if (rc.error) erreur.value = 'Table « passation_consignes » introuvable ou colonne manquante — exécute le SQL fourni. (' + rc.error.message + ')'
  else consignes.value = rc.data || []
  chargement.value = false
}
onMounted(charger)

async function enregistrer() {
  if (!form.superviseur_sortant || !form.shift || !form.date_shift) {
    erreur.value = 'Renseigne la date, le shift et le superviseur sortant.'
    return
  }
  if (!(await verifierPin(form.superviseur_sortant, form.pin_sortant))) { erreur.value = 'Code PIN incorrect pour le superviseur sortant 1.'; return }
  if (form.superviseur_sortant_2 && !(await verifierPin(form.superviseur_sortant_2, form.pin_sortant_2))) { erreur.value = 'Code PIN incorrect pour le superviseur sortant 2.'; return }
  const equipEtat = equipsAffiches.value
    .map(e => { const v = etatEquip[e.id] || {}; return { id: e.id, code: e.code, nom: e.nom, site: siteEquip(e), etat: v.etat || '', lot: (v.lot || '').trim(), realisees: (v.realisees || '').trim(), aRealiser: (v.aRealiser || '').trim() } })
    .filter(x => x.etat || x.lot || x.realisees || x.aRealiser)
  if (!equipEtat.length) { erreur.value = 'Renseigne au moins un équipement de cette phase.'; return }
  enregistrement.value = true
  erreur.value = ''
  const r = await supabase.from('passation_consignes').insert({
    date_shift: form.date_shift,
    shift: form.shift,
    superviseur_sortant: form.superviseur_sortant,
    superviseur_sortant_2: form.superviseur_sortant_2 || null,
    site: siteSel.value,
    phase: phaseSel.value || 'Toutes',
    sortant_signe_le: new Date().toISOString(),
    equipements_etat: equipEtat
  })
  enregistrement.value = false
  if (r.error) { erreur.value = 'Enregistrement échoué : ' + r.error.message; return }
  for (const e of equipsAffiches.value) etatEquip[e.id] = { etat: '', lot: '', realisees: '', aRealiser: '' }
  form.pin_sortant = ''; form.pin_sortant_2 = ''
  await charger()
}

async function prendreConnaissance(c) {
  const n1 = entrant1[c.id]
  if (!n1) { erreur.value = 'Choisis au moins le superviseur entrant 1 avant de valider.'; return }
  if (!(await verifierPin(n1, pin1Ack[c.id]))) { erreur.value = 'Code PIN incorrect pour le superviseur entrant 1.'; return }
  if (entrant2[c.id] && !(await verifierPin(entrant2[c.id], pin2Ack[c.id]))) { erreur.value = 'Code PIN incorrect pour le superviseur entrant 2.'; return }
  erreur.value = ''
  const r = await supabase.from('passation_consignes').update({
    pris_connaissance: true,
    superviseur_entrant: n1,
    superviseur_entrant_2: entrant2[c.id] || null,
    pris_connaissance_le: new Date().toISOString()
  }).eq('id', c.id)
  if (r.error) { erreur.value = 'Validation échouée : ' + r.error.message; return }
  await charger()
}

function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function fmtDateTime(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

const nbEnAttente = computed(() => consignes.value.filter(c => !c.pris_connaissance).length)
function fmtDateLong(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
const consignesGroupees = computed(() => {
  const parJour = {}
  for (const c of consignes.value) { const j = c.date_shift || '?'; if (!parJour[j]) parJour[j] = {}; const sh = c.shift || '?'; if (!parJour[j][sh]) parJour[j][sh] = []; parJour[j][sh].push(c) }
  const jours = Object.keys(parJour).sort((a, b) => String(b).localeCompare(String(a)))
  return jours.map(j => ({ jour: j, shifts: SHIFTS.filter(sh => parJour[j][sh.key]).map(sh => ({ key: sh.key, label: sh.label, items: parJour[j][sh.key] })) }))
})
</script>

<template>
  <div class="pc-page">
    <PageHeader title="Passation de consigne — Production" tone="violet">
      <button type="button" class="pc-print no-print" @click="imprimer">🖨️ Imprimer / PDF</button>
    </PageHeader>

    <p v-if="erreur" class="pc-err">{{ erreur }}</p>


    <section v-if="peutEditer" class="pc-card">
      <h2 class="pc-title">Nouvelle passation</h2>

      <div class="pc-relay">
        <div class="relay-side out">
          <div class="relay-tag">Poste sortant · {{ shiftLabel(form.shift) }}</div>
          <div class="relay-name">{{ form.superviseur_sortant || '— superviseur —' }}<span v-if="form.superviseur_sortant_2"> &amp; {{ form.superviseur_sortant_2 }}</span></div>
        </div>
        <div class="relay-arrow" aria-hidden="true">
          <span class="relay-chip">passe la main</span>
          <svg viewBox="0 0 48 24" width="46" height="22"><path d="M2 12 H40 M32 5 L42 12 L32 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="relay-side in">
          <div class="relay-tag">Poste entrant</div>
          <div class="relay-name muted">Signe à la prise de poste</div>
        </div>
      </div>

      <div class="pc-summary">
        <div class="sum ok"><div class="sum-v">{{ resume.marche }}</div><div class="sum-l">En marche</div></div>
        <div class="sum warn" :class="{ hot: resume.arret }"><div class="sum-v">{{ resume.arret }}</div><div class="sum-l">À l'arrêt</div></div>
        <div class="sum maint"><div class="sum-v">{{ resume.maint }}</div><div class="sum-l">Maintenance</div></div>
        <div class="sum todo" :class="{ hot: resume.taches }"><div class="sum-v">{{ resume.taches }}</div><div class="sum-l">Tâches à réaliser</div></div>
      </div>

      <div class="pc-form">
        <div class="pc-equip-layout">
          <div class="pc-left">
            <div class="pc-grp">
              <div class="pc-grp-h"><span class="pc-grp-ic">🕐</span>Poste</div>
              <div class="pc-grp-row">
                <label class="pc-field"><span>Date</span><input type="date" v-model="form.date_shift" /></label>
                <label class="pc-field"><span>Shift</span>
                  <select v-model="form.shift"><option v-for="s in SHIFTS" :key="s.key" :value="s.key">{{ s.label }}</option></select>
                </label>
              </div>
            </div>

            <div class="pc-grp out">
              <div class="pc-grp-h"><span class="pc-grp-ic">👤</span>Superviseur sortant</div>
              <div class="pc-pair">
                <label class="pc-field grow"><span>Responsable 1</span>
                  <select v-model="form.superviseur_sortant"><option value="">— Choisir —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
                </label>
                <label class="pc-field pin"><span>🔒 PIN</span>
                  <input type="password" v-model="form.pin_sortant" placeholder="••••" autocomplete="off" />
                </label>
              </div>
              <div class="pc-pair">
                <label class="pc-field grow"><span>Responsable 2 · optionnel</span>
                  <select v-model="form.superviseur_sortant_2"><option value="">— Aucun —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
                </label>
                <label class="pc-field pin"><span>🔒 PIN</span>
                  <input type="password" v-model="form.pin_sortant_2" placeholder="••••" autocomplete="off" />
                </label>
              </div>
            </div>

            <div class="pc-grp">
              <div class="pc-grp-h"><span class="pc-grp-ic">🏭</span>Sélection</div>
              <div class="pc-filters">
                <div class="pc-filter-col">
                  <div class="pc-nav-sep">Site</div>
                  <div class="pc-site-nav">
                    <button v-for="st in SITES" :key="st.key" type="button" class="pc-site-btn" :class="['sn-' + st.key, { active: siteSel === st.key }]" @click="siteSel = st.key; phaseSel = ''">
                      <span class="sn-lbl">{{ st.label }}</span><span class="sn-n">{{ nbParSite[st.key] }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="pc-equip-right">
            <div class="pc-phase-top">
              <div class="pc-nav-sep">Phase</div>
              <div class="pc-phase-nav">
                <button type="button" class="pc-phase-btn" :class="{ active: !phaseSel }" @click="phaseSel = ''">Toutes</button>
                <button v-for="ph in phasesDisponibles" :key="ph" type="button" class="pc-phase-btn" :class="{ active: phaseSel === ph }" @click="phaseSel = ph">{{ ph }}</button>
              </div>
            </div>
            <span class="pc-lbl eq">🏭 État &amp; tâches — {{ siteLabel(siteSel) }}<span v-if="phaseSel"> · {{ phaseSel }}</span></span>
            <div class="pc-equip-wrap">
              <table class="pc-equip-tbl">
                <thead><tr><th>Équipement</th><th>État</th><th>Lot</th><th class="ok">✅ Tâches réalisées</th><th class="todo">📋 Tâches à réaliser</th></tr></thead>
                <tbody>
                  <tr v-for="e in equipsAffiches" :key="e.id">
                    <td class="pc-eq-nom">{{ e.code }} — {{ e.nom }}</td>
                    <td><select v-model="etatEquip[e.id].etat" class="pc-eq-etat" :class="'etat-' + etatClass(etatEquip[e.id].etat)"><option value="">—</option><option v-for="s in ETATS" :key="s" :value="s">{{ s }}</option></select></td>
                    <td><input v-model="etatEquip[e.id].lot" class="pc-in-lot" placeholder="N° lot" /></td>
                    <td><textarea v-model="etatEquip[e.id].realisees" rows="2" placeholder="Fait…"></textarea></td>
                    <td><textarea v-model="etatEquip[e.id].aRealiser" rows="2" placeholder="À faire…"></textarea></td>
                  </tr>
                  <tr v-if="!equipsAffiches.length"><td colspan="5" class="pc-muted">Aucun équipement pour ce site.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="pc-actions">
          <button class="pc-btn" :disabled="enregistrement" @click="enregistrer">{{ enregistrement ? 'Enregistrement…' : ('Enregistrer — ' + siteLabel(siteSel) + (phaseSel ? ' · ' + phaseSel : ' · toutes phases')) }}</button>
        </div>
      </div>
    </section>

    <section class="pc-card">
      <h2 class="pc-title">Consignes <span v-if="nbEnAttente" class="pc-count">{{ nbEnAttente }} en attente de lecture</span></h2>
      <p v-if="chargement" class="pc-muted">Chargement…</p>
      <p v-else-if="!consignes.length" class="pc-muted">Aucune consigne enregistrée pour l'instant.</p>
      <div v-else class="pc-groupes">
        <div v-for="g in consignesGroupees" :key="g.jour" class="pc-jour">
          <h3 class="pc-jour-t">📅 {{ fmtDateLong(g.jour) }}</h3>
          <div v-for="sh in g.shifts" :key="sh.key" class="pc-shift-grp">
            <div class="pc-shift-t" :class="'sh-' + sh.key">{{ sh.label }} <span class="pc-shift-n">{{ sh.items.length }} consigne(s)</span></div>
            <div class="pc-list">
              <article v-for="c in sh.items" :key="c.id" class="pc-item" :class="{ 'pc-nonlu': !c.pris_connaissance }">
                <header class="pc-head">
                  <span v-if="c.site || c.phase" class="pc-sitephase">{{ siteLabel(c.site || 'seche') }}<template v-if="c.phase && c.phase !== 'Toutes'"> · {{ c.phase }}</template></span>
            <span class="pc-sortant">Sortant : <b>{{ c.superviseur_sortant }}{{ c.superviseur_sortant_2 ? ' & ' + c.superviseur_sortant_2 : '' }}</b></span>
            <span v-if="!c.pris_connaissance" class="pc-badge">Non lu</span>
          </header>

          <div v-if="c.equipements_etat && c.equipements_etat.length" class="pc-equip-hist">
            <table class="pc-equip-tbl histo">
              <thead><tr><th>Équipement</th><th>Site</th><th>État</th><th>Lot</th><th class="ok">✅ Réalisé</th><th class="todo">📋 À réaliser</th></tr></thead>
              <tbody>
                <tr v-for="(eq, i) in c.equipements_etat" :key="i">
                  <td class="pc-eq-nom">{{ eq.code }}<span class="pc-eq-full"> — {{ eq.nom }}</span></td>
                  <td><span class="pc-site" :class="'site-' + (eq.site || 'seche')">{{ siteLabel(eq.site || 'seche') }}</span></td>
                  <td><span class="pc-etat" :class="'etat-' + etatClass(eq.etat)">{{ eq.etat || '—' }}</span></td>
                  <td class="mono">{{ eq.lot || '—' }}</td>
                  <td class="pc-td-txt">{{ eq.realisees || '—' }}</td>
                  <td class="pc-td-txt">{{ eq.aRealiser || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="pc-muted">Aucun détail équipement.</p>

          <footer class="pc-foot">
            <div v-if="c.pris_connaissance" class="pc-ack ok">✓ Pris connaissance par <b>{{ c.superviseur_entrant }}{{ c.superviseur_entrant_2 ? ' & ' + c.superviseur_entrant_2 : '' }}</b> le {{ fmtDateTime(c.pris_connaissance_le) }}</div>
            <div v-else-if="peutEditer" class="pc-ack-form">
              <select v-model="entrant1[c.id]"><option value="">— Entrant 1 —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
              <input type="password" v-model="pin1Ack[c.id]" class="pc-pin" placeholder="PIN 1" autocomplete="off" />
              <select v-model="entrant2[c.id]"><option value="">— Entrant 2 (opt.) —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
              <input type="password" v-model="pin2Ack[c.id]" class="pc-pin" placeholder="PIN 2" autocomplete="off" />
              <button class="pc-btn sm" @click="prendreConnaissance(c)">Signer (pris connaissance)</button>
            </div>
            <div v-else class="pc-ack pending">En attente de lecture</div>
          </footer>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Passation de consigne — design moderne (violet ProdTrack) */
.pc-page { padding: 4px 4px 40px; }
.pc-page :deep(h1) { font-size: 20px !important; }
.pc-sub { margin: 4px 0 0; font-size: 12px; opacity: .9; }
.pc-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 9px 13px; border-radius: 10px; font-size: 13px; margin: 12px 0; }

.pc-card { background: #fff; border: 1px solid #eef0f4; border-radius: 14px; padding: 10px 13px; margin-top: 10px; box-shadow: 0 1px 3px rgba(15,23,42,.05); }
.pc-title { margin: 0 0 9px; font-size: 12.5px; font-weight: 800; letter-spacing: -.01em; color: #1e1b3a; display: flex; align-items: center; gap: 8px; padding-left: 8px; border-left: 3px solid #7c3aed; }
.pc-count { font-size: 11px; font-weight: 800; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 20px; padding: 3px 11px; }

.pc-form { display: flex; flex-direction: column; gap: 10px; }
.pc-row { display: flex; gap: 14px; flex-wrap: wrap; }
.pc-field { display: flex; flex-direction: column; gap: 3px; font-size: 9px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; color: #94a3b8; }
.pc-field input, .pc-field select { font: inherit; font-weight: 600; text-transform: none; letter-spacing: 0; font-size: 11.5px; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; color: #0f172a; background: #fff; min-width: 120px; transition: border-color .12s, box-shadow .12s; }
.pc-field input:focus, .pc-field select:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,.12); }
.pc-lbl { font-weight: 800; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
.pc-lbl.eq { color: #6d28d9; }

.pc-equip-layout { display: flex; gap: 12px; align-items: flex-start; }
.pc-left { flex: 0 0 320px; display: flex; flex-direction: column; gap: 8px; }
.pc-left .pc-field { width: 100%; }
.pc-left .pc-field input, .pc-left .pc-field select { min-width: 0; width: 100%; box-sizing: border-box; }
.pc-nav-sep { font-size: 10px; font-weight: 800; color: #6d28d9; text-transform: uppercase; letter-spacing: .08em; margin-top: 8px; padding-top: 10px; border-top: 1px solid #ece8f8; }
.pc-filters { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
.pc-filter-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
.pc-filters .pc-nav-sep { margin-top: 0; padding-top: 0; border-top: none; }
.pc-equip-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }

.pc-phase-nav { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.pc-phase-btn { text-align: left; border: 1px solid #e6e2f4; background: #fff; border-radius: 9px; padding: 8px 11px; font: inherit; font-weight: 700; font-size: 12px; color: #64748b; cursor: pointer; transition: all .12s; }
.pc-phase-btn:hover { border-color: #c4b5fd; background: #faf9fe; }
.pc-phase-btn.active { background: #6d28d9; border-color: #6d28d9; color: #fff; box-shadow: 0 2px 6px rgba(109,40,217,.28); }
.pc-site-nav { display: flex; flex-direction: row; flex-wrap: nowrap; gap: 6px; }
.pc-site-btn { flex: 1; min-width: 0; text-align: center; border: 1px solid #e6e2f4; background: #fff; border-radius: 10px; padding: 7px 6px; font: inherit; font-weight: 800; font-size: 10.5px; color: #475569; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px; transition: all .12s; }
.pc-site-btn:hover { border-color: #c4b5fd; background: #faf9fe; }
.pc-site-btn .sn-n { font-size: 11px; background: #f1f5f9; border-radius: 20px; padding: 2px 9px; color: #64748b; font-weight: 800; }
.pc-site-btn.active { color: #fff; border-color: transparent; box-shadow: 0 3px 10px rgba(15,23,42,.16); }
.pc-site-btn.active .sn-n { background: rgba(255,255,255,.28); color: #fff; }
.pc-site-btn.sn-hormonal.active { background: linear-gradient(135deg, #db2777, #be185d); }
.pc-site-btn.sn-seche.active { background: linear-gradient(135deg, #7c3aed, #4f46e5); }
.pc-site-btn.sn-semi.active { background: linear-gradient(135deg, #d97706, #a16207); }

.pc-equip-wrap { border: 1px solid #eef2f7; border-radius: 12px; overflow: auto; max-height: 300px; flex: 1; min-width: 0; }
.pc-equip-tbl { width: 100%; border-collapse: collapse; font-size: 10.5px; }
.pc-equip-tbl th { position: sticky; top: 0; background: #f5f3fb; text-align: left; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #6d28d9; padding: 5px 6px; border-bottom: 1px solid #e6e2f4; white-space: nowrap; z-index: 1; }
.pc-equip-tbl th.ok { color: #047857; }
.pc-equip-tbl th.todo { color: #b45309; }
.pc-equip-tbl td { padding: 3px 6px; border-bottom: 1px solid #f4f2fa; vertical-align: top; }
.pc-equip-tbl tbody tr:hover td { background: #faf9fe; }
.pc-equip-tbl input, .pc-equip-tbl select, .pc-equip-tbl textarea { font: inherit; padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 7px; width: 100%; box-sizing: border-box; }
.pc-equip-tbl input:focus, .pc-equip-tbl select:focus, .pc-equip-tbl textarea:focus { outline: none; border-color: #a78bfa; }
.pc-equip-tbl textarea { resize: vertical; line-height: 1.25; min-width: 140px; }
.pc-in-lot { min-width: 80px; }
.pc-eq-nom { font-weight: 800; color: #334155; white-space: nowrap; min-width: 115px; font-size: 10.5px; }
.pc-eq-etat { font-weight: 700; }
.pc-eq-etat.etat-marche { color: #047857; }
.pc-eq-etat.etat-arret { color: #b91c1c; }
.pc-eq-etat.etat-nett { color: #0369a1; }
.pc-eq-etat.etat-maint { color: #7c3aed; }
.pc-eq-etat.etat-dispo { color: #64748b; }

.pc-actions { display: flex; justify-content: flex-end; }
.pc-btn { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; border-radius: 9px; padding: 8px 14px; font-weight: 800; font-size: 12px; cursor: pointer; box-shadow: 0 3px 10px rgba(109,40,217,.28); transition: filter .12s, transform .05s; }
.pc-btn:hover { filter: brightness(1.06); }
.pc-btn:active { transform: translateY(1px); }
.pc-btn:disabled { opacity: .55; cursor: default; box-shadow: none; }
.pc-btn.sm { padding: 7px 14px; font-size: 12.5px; border-radius: 9px; }

.pc-muted { color: #94a3b8; font-size: 13px; padding: 8px; }
.pc-list { display: flex; flex-direction: column; gap: 12px; }
.pc-groupes { display: flex; flex-direction: column; gap: 16px; }
.pc-jour-t { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: capitalize; border-bottom: 2px solid #ede9fe; padding-bottom: 5px; }
.pc-shift-grp { margin-bottom: 12px; margin-left: 2px; }
.pc-shift-t { font-weight: 800; font-size: 12.5px; padding: 6px 13px; border-radius: 9px; margin-bottom: 10px; display: inline-flex; align-items: center; gap: 8px; }
.pc-shift-n { font-size: 11px; background: rgba(0,0,0,.10); border-radius: 20px; padding: 2px 9px; }
.pc-shift-t.sh-matin { background: #fef9c3; color: #a16207; }
.pc-shift-t.sh-apres-midi { background: #ffedd5; color: #c2410c; }
.pc-shift-t.sh-nuit { background: #e0e7ff; color: #4338ca; }

.pc-item { border: 1px solid #eceaf4; border-radius: 11px; padding: 9px 12px; background: #fff; transition: box-shadow .12s; }
.pc-item:hover { box-shadow: 0 2px 10px rgba(15,23,42,.06); }
.pc-item.pc-nonlu { border-left: 4px solid #f59e0b; background: #fffdf7; }
.pc-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.pc-shift { font-weight: 800; color: #6d28d9; background: #ede9fe; border-radius: 7px; padding: 3px 11px; font-size: 12.5px; }
.pc-datechip { font-weight: 700; color: #334155; font-size: 12.5px; }
.pc-sitephase { font-weight: 800; color: #4f46e5; background: #eef2ff; border: 1px solid #e0e7ff; border-radius: 7px; padding: 3px 10px; font-size: 11.5px; }
.pc-sortant { font-size: 12.5px; color: #9a3412; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 7px; padding: 3px 10px; }
.pc-badge { margin-left: auto; font-size: 10px; font-weight: 800; color: #92400e; background: #fde68a; border-radius: 20px; padding: 3px 10px; text-transform: uppercase; letter-spacing: .05em; }
.pc-equip-hist { margin: 6px 0 12px; overflow-x: auto; }
.pc-equip-tbl.histo { border: 1px solid #eef2f7; border-radius: 10px; }
.pc-td-txt { white-space: pre-wrap; color: #1e293b; max-width: 260px; }

.pc-etat { font-weight: 800; font-size: 11px; border-radius: 6px; padding: 2px 8px; }
.pc-etat.etat-marche { background: #d1fae5; color: #047857; }
.pc-etat.etat-arret { background: #fee2e2; color: #b91c1c; }
.pc-etat.etat-nett { background: #e0f2fe; color: #0369a1; }
.pc-etat.etat-maint { background: #ede9fe; color: #7c3aed; }
.pc-etat.etat-dispo { background: #f1f5f9; color: #64748b; }
.pc-etat.etat-none { background: #f8fafc; color: #94a3b8; }
.pc-site { font-weight: 800; font-size: 11px; border-radius: 6px; padding: 2px 8px; white-space: nowrap; }
.pc-site.site-hormonal { background: #fce7f3; color: #be185d; }
.pc-site.site-semi { background: #fef9c3; color: #a16207; }
.pc-site.site-seche { background: #ede9fe; color: #4f46e5; }
.mono { font-family: ui-monospace, monospace; }
.pc-eq-full { color: #94a3b8; font-weight: 400; }

.pc-foot { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #eceaf4; }
.pc-ack.ok { color: #047857; font-size: 12.5px; font-weight: 700; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9px; padding: 7px 12px; display: inline-block; }
.pc-ack.pending { color: #b45309; font-size: 12.5px; font-weight: 700; }
.pc-ack-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: #f0fdfa; border: 1px solid #cffafe; border-radius: 11px; padding: 9px 11px; }
.pc-ack-form select { font: inherit; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
.pc-ack-form select:focus, .pc-pin:focus { outline: none; border-color: #14b8a6; }
.pc-pin { font: inherit; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 90px; }

@media (max-width: 720px) {
  .pc-equip-layout { flex-direction: column; }
  .pc-left { flex-basis: auto; width: 100%; box-sizing: border-box; }
  .pc-eq-full { display: none; }
}

/* --- Bandeau relais --- */
.pc-relay { display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch; margin-bottom: 9px; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(15,23,42,.06); }
.relay-side { padding: 7px 12px; display: flex; flex-direction: column; gap: 2px; justify-content: center; }
.relay-side.out { background: linear-gradient(135deg, #fff7ed, #ffedd5); }
.relay-side.in { background: linear-gradient(135deg, #ecfeff, #cffafe); text-align: right; }
.relay-tag { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.relay-side.out .relay-tag { color: #c2410c; }
.relay-side.in .relay-tag { color: #0e7490; }
.relay-name { font-size: 12.5px; font-weight: 800; color: #0f172a; }
.relay-name.muted { font-size: 11px; font-weight: 600; color: #64748b; }
.relay-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0 16px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; }
.relay-chip { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; opacity: .92; }

/* --- Tuiles résumé --- */
.pc-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 9px; }
.sum { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 9px; text-align: center; }
.sum-v { font-size: 16px; font-weight: 800; line-height: 1; color: #94a3b8; }
.sum-l { font-size: 9px; font-weight: 700; color: #64748b; margin-top: 3px; }
.sum.ok { border-color: #a7f3d0; background: #ecfdf5; } .sum.ok .sum-v { color: #047857; }
.sum.warn { border-color: #e2e8f0; } .sum.warn.hot { border-color: #fecaca; background: #fef2f2; } .sum.warn.hot .sum-v { color: #dc2626; }
.sum.maint { border-color: #ddd6fe; background: #f5f3ff; } .sum.maint .sum-v { color: #7c3aed; }
.sum.todo { border-color: #e2e8f0; } .sum.todo.hot { border-color: #fde68a; background: #fffbeb; } .sum.todo.hot .sum-v { color: #b45309; }

/* --- Barre d'outils --- */
.pc-toolbar { display: flex; justify-content: flex-end; margin-top: 10px; }
.pc-print { font: inherit; font-size: 12px; font-weight: 700; padding: 7px 13px; border-radius: 9px; border: 1.5px solid #ddd6fe; background: #f5f3ff; color: #6d28d9; cursor: pointer; }
.pc-print:hover { background: #ede9fe; }

/* --- Impression / PDF --- */
@media print {
  .no-print, .pc-toolbar, .pc-actions, .pc-ack-form, .pc-add, .pc-del { display: none !important; }
  .pc-card, .pc-relay, .pc-item, .sum { box-shadow: none !important; break-inside: avoid; }
  .pc-page { padding: 0; }
  .pc-left { background: #fff !important; }
  select, input, textarea { border: none !important; padding: 0 !important; }
  .pc-equip-tbl th { background: #f3f4f6 !important; }
}

/* --- Bandeau de gauche : groupes --- */
.pc-left { background: transparent; border: 0; padding: 0; gap: 8px; }
.pc-grp { background: #fff; border: 1px solid #eceaf4; border-radius: 11px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 2px rgba(15,23,42,.03); }
.pc-grp.out { background: linear-gradient(180deg, #fffaf5, #fff); border-color: #fbe3ce; }
.pc-grp-h { display: flex; align-items: center; gap: 6px; font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #6d28d9; }
.pc-grp.out .pc-grp-h { color: #c2410c; }
.pc-grp-ic { font-size: 13px; }
.pc-grp-row { display: flex; gap: 9px; }
.pc-grp-row .pc-field { flex: 1; }
.pc-pair { display: flex; gap: 9px; align-items: flex-end; }
.pc-pair .pc-field.grow { flex: 1; min-width: 0; }
.pc-pair .pc-field.pin { flex: 0 0 76px; }
.pc-pair .pc-field.pin input { width: 100%; box-sizing: border-box; text-align: center; letter-spacing: .15em; }
.pc-grp .pc-nav-sep { margin-top: 0; padding-top: 0; border-top: none; color: #94a3b8; }
.pc-grp .pc-filters { gap: 10px; }
.pc-phase-top { margin-bottom: 10px; }
</style>
