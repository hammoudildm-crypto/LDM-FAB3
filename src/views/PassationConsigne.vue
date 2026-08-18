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
const entrantSel = reactive({})
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

const form = reactive({
  date_shift: new Date().toISOString().slice(0, 10),
  shift: 'matin',
  superviseur_sortant: ''
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
  const equipEtat = equipsFab.value
    .map(e => { const v = etatEquip[e.id] || {}; return { id: e.id, code: e.code, nom: e.nom, site: siteEquip(e), etat: v.etat || '', lot: (v.lot || '').trim(), realisees: (v.realisees || '').trim(), aRealiser: (v.aRealiser || '').trim() } })
    .filter(x => x.etat || x.lot || x.realisees || x.aRealiser)
  if (!equipEtat.length) { erreur.value = 'Renseigne au moins un équipement (état, lot ou tâche).'; return }
  enregistrement.value = true
  erreur.value = ''
  const r = await supabase.from('passation_consignes').insert({
    date_shift: form.date_shift,
    shift: form.shift,
    superviseur_sortant: form.superviseur_sortant,
    equipements_etat: equipEtat
  })
  enregistrement.value = false
  if (r.error) { erreur.value = 'Enregistrement échoué : ' + r.error.message; return }
  for (const e of equipsFab.value) etatEquip[e.id] = { etat: '', lot: '', realisees: '', aRealiser: '' }
  await charger()
}

async function prendreConnaissance(c) {
  const nom = entrantSel[c.id]
  if (!nom) { erreur.value = 'Choisis le superviseur entrant avant de valider.'; return }
  erreur.value = ''
  const r = await supabase.from('passation_consignes').update({
    pris_connaissance: true,
    superviseur_entrant: nom,
    pris_connaissance_le: new Date().toISOString()
  }).eq('id', c.id)
  if (r.error) { erreur.value = 'Validation échouée : ' + r.error.message; return }
  await charger()
}

function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function fmtDateTime(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

const nbEnAttente = computed(() => consignes.value.filter(c => !c.pris_connaissance).length)
</script>

<template>
  <div class="pc-page">
    <PageHeader title="Passation de consigne — Production" tone="violet">
      <p class="pc-sub">Transmission entre superviseurs des 3 shifts — état des équipements &amp; tâches par équipement</p>
    </PageHeader>

    <p v-if="erreur" class="pc-err">{{ erreur }}</p>

    <section v-if="peutEditer" class="pc-card">
      <h2 class="pc-title">Nouvelle passation</h2>
      <div class="pc-form">
        <div class="pc-equip-layout">
          <div class="pc-left">
            <label class="pc-field"><span>Date</span><input type="date" v-model="form.date_shift" /></label>
            <label class="pc-field"><span>Shift</span>
              <select v-model="form.shift"><option v-for="s in SHIFTS" :key="s.key" :value="s.key">{{ s.label }}</option></select>
            </label>
            <label class="pc-field"><span>Superviseur sortant</span>
              <select v-model="form.superviseur_sortant"><option value="">— Choisir —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
            </label>
            <div class="pc-nav-sep">🏭 Site de production</div>
            <div class="pc-site-nav">
              <button v-for="st in SITES" :key="st.key" type="button" class="pc-site-btn" :class="['sn-' + st.key, { active: siteSel === st.key }]" @click="siteSel = st.key; phaseSel = ''">
                <span class="sn-lbl">{{ st.label }}</span><span class="sn-n">{{ nbParSite[st.key] }}</span>
              </button>
            </div>
            <div class="pc-nav-sep">Phase (gamme)</div>
            <select v-model="phaseSel" class="pc-phase-sel">
              <option value="">Toutes les phases</option>
              <option v-for="ph in phasesDisponibles" :key="ph" :value="ph">{{ ph }}</option>
            </select>
          </div>
          <div class="pc-equip-right">
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
          <button class="pc-btn" :disabled="enregistrement" @click="enregistrer">{{ enregistrement ? 'Enregistrement…' : 'Enregistrer la consigne' }}</button>
        </div>
      </div>
    </section>

    <section class="pc-card">
      <h2 class="pc-title">Consignes <span v-if="nbEnAttente" class="pc-count">{{ nbEnAttente }} en attente de lecture</span></h2>
      <p v-if="chargement" class="pc-muted">Chargement…</p>
      <p v-else-if="!consignes.length" class="pc-muted">Aucune consigne enregistrée pour l'instant.</p>
      <div v-else class="pc-list">
        <article v-for="c in consignes" :key="c.id" class="pc-item" :class="{ 'pc-nonlu': !c.pris_connaissance }">
          <header class="pc-head">
            <span class="pc-shift">{{ shiftLabel(c.shift) }}</span>
            <span class="pc-datechip">{{ fmtDate(c.date_shift) }}</span>
            <span class="pc-sortant">Sortant : <b>{{ c.superviseur_sortant }}</b></span>
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
            <div v-if="c.pris_connaissance" class="pc-ack ok">✓ Pris connaissance par <b>{{ c.superviseur_entrant }}</b> le {{ fmtDateTime(c.pris_connaissance_le) }}</div>
            <div v-else-if="peutEditer" class="pc-ack-form">
              <select v-model="entrantSel[c.id]"><option value="">— Superviseur entrant —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
              <button class="pc-btn sm" @click="prendreConnaissance(c)">Pris connaissance</button>
            </div>
            <div v-else class="pc-ack pending">En attente de lecture</div>
          </footer>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pc-page { padding: 4px; }
.pc-sub { margin: 4px 0 0; font-size: 13px; opacity: .85; }
.pc-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin: 10px 0; }
.pc-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; margin-top: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.pc-title { margin: 0 0 12px; font-size: 16px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 10px; }
.pc-count { font-size: 11px; font-weight: 700; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 20px; padding: 2px 10px; }
.pc-form { display: flex; flex-direction: column; gap: 14px; }
.pc-row { display: flex; gap: 14px; flex-wrap: wrap; }
.pc-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; }
.pc-field input, .pc-field select { font: inherit; font-weight: 500; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; background: #fff; min-width: 190px; }
.pc-lbl { font-weight: 800; }
.pc-lbl.eq { color: #4c1d95; }
.pc-equip { display: flex; flex-direction: column; gap: 6px; }
.pc-equip-layout { display: flex; gap: 12px; align-items: flex-start; }
.pc-left { flex: 0 0 215px; display: flex; flex-direction: column; gap: 10px; }
.pc-left .pc-field { width: 100%; }
.pc-left .pc-field input, .pc-left .pc-field select { min-width: 0; width: 100%; box-sizing: border-box; }
.pc-nav-sep { font-size: 11px; font-weight: 800; color: #4c1d95; text-transform: uppercase; letter-spacing: .4px; margin-top: 6px; padding-top: 8px; border-top: 1px solid #eef2f7; }
.pc-equip-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.pc-phase-sel { font: inherit; font-weight: 600; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 100%; box-sizing: border-box; color: #0f172a; background: #fff; }
.pc-site-nav { display: flex; flex-direction: column; gap: 6px; }
.pc-site-btn { text-align: left; border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 10px 11px; font: inherit; font-weight: 700; font-size: 12.5px; color: #475569; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 8px; transition: all .12s; }
.pc-site-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
.pc-site-btn .sn-n { font-size: 11px; background: #f1f5f9; border-radius: 20px; padding: 1px 8px; color: #64748b; font-weight: 700; }
.pc-site-btn.active { color: #fff; }
.pc-site-btn.active .sn-n { background: rgba(255,255,255,.25); color: #fff; }
.pc-site-btn.sn-hormonal.active { background: #be185d; border-color: #be185d; }
.pc-site-btn.sn-seche.active { background: #1d4ed8; border-color: #1d4ed8; }
.pc-site-btn.sn-semi.active { background: #a16207; border-color: #a16207; }
.pc-equip-wrap { border: 1px solid #eef2f7; border-radius: 10px; overflow: auto; max-height: 420px; flex: 1; min-width: 0; }
.pc-equip-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.pc-equip-tbl th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 11px; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; z-index: 1; }
.pc-equip-tbl th.ok { color: #047857; }
.pc-equip-tbl th.todo { color: #b45309; }
.pc-equip-tbl td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.pc-equip-tbl input, .pc-equip-tbl select, .pc-equip-tbl textarea { font: inherit; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
.pc-equip-tbl textarea { resize: vertical; line-height: 1.35; min-width: 150px; }
.pc-in-lot { min-width: 80px; }
.pc-eq-nom { font-weight: 700; color: #334155; white-space: nowrap; min-width: 150px; }
.pc-eq-etat.etat-marche { color: #047857; }
.pc-eq-etat.etat-arret { color: #b91c1c; }
.pc-eq-etat.etat-nett { color: #0369a1; }
.pc-eq-etat.etat-maint { color: #7c3aed; }
.pc-eq-etat.etat-dispo { color: #64748b; }
.pc-actions { display: flex; justify-content: flex-end; }
.pc-btn { background: #6d28d9; color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-weight: 700; font-size: 13.5px; cursor: pointer; }
.pc-btn:hover { background: #5b21b6; }
.pc-btn:disabled { opacity: .6; cursor: default; }
.pc-btn.sm { padding: 6px 12px; font-size: 12.5px; }
.pc-muted { color: #94a3b8; font-size: 13px; padding: 8px; }
.pc-list { display: flex; flex-direction: column; gap: 12px; }
.pc-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; background: #fafafa; }
.pc-item.pc-nonlu { border-left: 4px solid #f59e0b; background: #fffbeb; }
.pc-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.pc-shift { font-weight: 800; color: #4c1d95; background: #ede9fe; border-radius: 6px; padding: 2px 10px; font-size: 12.5px; }
.pc-datechip { font-weight: 700; color: #334155; font-size: 12.5px; }
.pc-sortant { font-size: 12.5px; color: #475569; }
.pc-badge { margin-left: auto; font-size: 10.5px; font-weight: 800; color: #92400e; background: #fde68a; border-radius: 20px; padding: 2px 9px; text-transform: uppercase; letter-spacing: .3px; }
.pc-equip-hist { margin: 4px 0 10px; overflow-x: auto; }
.pc-equip-tbl.histo { border: 1px solid #eef2f7; border-radius: 8px; }
.pc-td-txt { white-space: pre-wrap; color: #1e293b; max-width: 260px; }
.pc-etat { font-weight: 700; font-size: 11.5px; border-radius: 5px; padding: 1px 7px; }
.pc-etat.etat-marche { background: #d1fae5; color: #047857; }
.pc-etat.etat-arret { background: #fee2e2; color: #b91c1c; }
.pc-etat.etat-nett { background: #e0f2fe; color: #0369a1; }
.pc-etat.etat-maint { background: #ede9fe; color: #7c3aed; }
.pc-etat.etat-dispo { background: #f1f5f9; color: #64748b; }
.pc-etat.etat-none { background: #f8fafc; color: #94a3b8; }
.pc-site { font-weight: 700; font-size: 11px; border-radius: 5px; padding: 1px 7px; white-space: nowrap; }
.pc-site.site-hormonal { background: #fce7f3; color: #be185d; }
.pc-site.site-semi { background: #fef9c3; color: #a16207; }
.pc-site.site-seche { background: #dbeafe; color: #1d4ed8; }
.mono { font-family: ui-monospace, monospace; }
.pc-eq-full { color: #94a3b8; font-weight: 400; }
.pc-foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
.pc-ack.ok { color: #047857; font-size: 12.5px; font-weight: 600; }
.pc-ack.pending { color: #b45309; font-size: 12.5px; font-weight: 600; }
.pc-ack-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pc-ack-form select { font: inherit; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
@media (max-width: 640px) { .pc-equip-layout { flex-direction: column; } .pc-site-nav { flex-direction: row; flex-wrap: wrap; } .pc-site-nav .pc-site-btn { flex: 1; } .pc-eq-full { display: none; } }
</style>
