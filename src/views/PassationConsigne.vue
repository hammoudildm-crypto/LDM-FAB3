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

// Phases de fabrication (Pesée -> Pelliculage), conditionnement exclu
const PHASES_FAB = ['pesée', 'pesee', 'granulation', 'séchage', 'sechage', 'calibrage', 'mélange', 'melange', 'compression', 'remplissage', 'gélul', 'gelul', 'pelliculage']
// Ordre des ateliers selon la gamme de fabrication
const ORDRE_GAMME = [['pesée', 'pesee'], ['granulation'], ['séchage', 'sechage'], ['calibrage', 'mélange', 'melange'], ['compression'], ['remplissage', 'gélul', 'gelul'], ['pelliculage']]
function ordreEquip(e) { const t = (e.type || '').toLowerCase(); for (let i = 0; i < ORDRE_GAMME.length; i++) if (ORDRE_GAMME[i].some(k => t.includes(k))) return i; return 999 }
// Site de production selon le code équipement
function siteEquip(e) { const c = (e.code || '').toUpperCase(); if (c.startsWith('PRH')) return 'hormonal'; if (c === 'PR054') return 'semi'; return 'seche' }
function siteLabel(s) { return s === 'hormonal' ? 'Hormonal' : s === 'semi' ? 'Semi-solide' : 'Forme sèche' }

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
}).sort((a, b) => (ordreEquip(a) - ordreEquip(b)) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })))

const form = reactive({
  date_shift: new Date().toISOString().slice(0, 10),
  shift: 'matin',
  superviseur_sortant: '',
  taches_realisees: '',
  taches_a_realiser: ''
})

function initEtat() {
  for (const e of equipsFab.value) if (!etatEquip[e.id]) etatEquip[e.id] = { etat: '', lot: '', remarque: '' }
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
    .map(e => { const v = etatEquip[e.id] || {}; return { id: e.id, code: e.code, nom: e.nom, site: siteEquip(e), etat: v.etat || '', lot: (v.lot || '').trim(), remarque: (v.remarque || '').trim() } })
    .filter(x => x.etat || x.lot || x.remarque)
  enregistrement.value = true
  erreur.value = ''
  const r = await supabase.from('passation_consignes').insert({
    date_shift: form.date_shift,
    shift: form.shift,
    superviseur_sortant: form.superviseur_sortant,
    taches_realisees: form.taches_realisees || null,
    taches_a_realiser: form.taches_a_realiser || null,
    equipements_etat: equipEtat
  })
  enregistrement.value = false
  if (r.error) { erreur.value = 'Enregistrement échoué : ' + r.error.message; return }
  form.taches_realisees = ''
  form.taches_a_realiser = ''
  for (const e of equipsFab.value) etatEquip[e.id] = { etat: '', lot: '', remarque: '' }
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
      <p class="pc-sub">Transmission entre superviseurs des 3 shifts — état des équipements, tâches réalisées &amp; à réaliser</p>
    </PageHeader>

    <p v-if="erreur" class="pc-err">{{ erreur }}</p>

    <section v-if="peutEditer" class="pc-card">
      <h2 class="pc-title">Nouvelle passation</h2>
      <div class="pc-form">
        <div class="pc-row">
          <label class="pc-field"><span>Date</span><input type="date" v-model="form.date_shift" /></label>
          <label class="pc-field"><span>Shift</span>
            <select v-model="form.shift"><option v-for="s in SHIFTS" :key="s.key" :value="s.key">{{ s.label }}</option></select>
          </label>
          <label class="pc-field"><span>Superviseur sortant</span>
            <select v-model="form.superviseur_sortant"><option value="">— Choisir —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
          </label>
        </div>

        <div class="pc-equip">
          <span class="pc-lbl eq">🏭 État des équipements (fabrication)</span>
          <div class="pc-equip-wrap">
            <table class="pc-equip-tbl">
              <thead><tr><th>Équipement</th><th>Site</th><th>État</th><th>Lot en cours</th><th>Remarque</th></tr></thead>
              <tbody>
                <tr v-for="e in equipsFab" :key="e.id">
                  <td class="pc-eq-nom">{{ e.code }} — {{ e.nom }}</td>
                  <td><span class="pc-site" :class="'site-' + siteEquip(e)">{{ siteLabel(siteEquip(e)) }}</span></td>
                  <td><select v-model="etatEquip[e.id].etat" class="pc-eq-etat" :class="'etat-' + etatClass(etatEquip[e.id].etat)"><option value="">—</option><option v-for="s in ETATS" :key="s" :value="s">{{ s }}</option></select></td>
                  <td><input v-model="etatEquip[e.id].lot" placeholder="N° lot" /></td>
                  <td><input v-model="etatEquip[e.id].remarque" placeholder="Remarque…" /></td>
                </tr>
                <tr v-if="!equipsFab.length"><td colspan="5" class="pc-muted">Aucun équipement de fabrication trouvé.</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <label class="pc-field full"><span class="pc-lbl ok">✅ Tâches réalisées</span><textarea v-model="form.taches_realisees" rows="4" placeholder="Ce qui a été fait pendant le shift…"></textarea></label>
        <label class="pc-field full"><span class="pc-lbl todo">📋 Tâches à réaliser (shift suivant)</span><textarea v-model="form.taches_a_realiser" rows="4" placeholder="Ce qui reste à faire / points de vigilance…"></textarea></label>
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
            <span class="pc-lbl eq">🏭 Équipements</span>
            <table class="pc-equip-tbl histo">
              <thead><tr><th>Équipement</th><th>Site</th><th>État</th><th>Lot</th><th>Remarque</th></tr></thead>
              <tbody>
                <tr v-for="(eq, i) in c.equipements_etat" :key="i">
                  <td class="pc-eq-nom">{{ eq.code }}<span class="pc-eq-full"> — {{ eq.nom }}</span></td>
                  <td><span class="pc-site" :class="'site-' + (eq.site || 'seche')">{{ siteLabel(eq.site || 'seche') }}</span></td>
                  <td><span class="pc-etat" :class="'etat-' + etatClass(eq.etat)">{{ eq.etat || '—' }}</span></td>
                  <td class="mono">{{ eq.lot || '—' }}</td>
                  <td>{{ eq.remarque || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pc-blocks">
            <div class="pc-block"><span class="pc-lbl ok">✅ Tâches réalisées</span><p>{{ c.taches_realisees || '—' }}</p></div>
            <div class="pc-block"><span class="pc-lbl todo">📋 Tâches à réaliser</span><p>{{ c.taches_a_realiser || '—' }}</p></div>
          </div>
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
.pc-field.full { width: 100%; }
.pc-field input, .pc-field select, .pc-field textarea { font: inherit; font-weight: 500; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; background: #fff; }
.pc-field textarea { resize: vertical; line-height: 1.4; }
.pc-field select, .pc-field input { min-width: 190px; }
.pc-lbl { font-weight: 800; }
.pc-lbl.ok { color: #047857; }
.pc-lbl.todo { color: #b45309; }
.pc-lbl.eq { color: #4c1d95; }
.pc-equip { display: flex; flex-direction: column; gap: 6px; }
.pc-equip-wrap { border: 1px solid #eef2f7; border-radius: 10px; overflow: auto; max-height: 320px; }
.pc-equip-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.pc-equip-tbl th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 11px; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; z-index: 1; }
.pc-equip-tbl td { padding: 4px 8px; border-bottom: 1px solid #f1f5f9; }
.pc-equip-tbl input, .pc-equip-tbl select { font: inherit; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%; box-sizing: border-box; }
.pc-eq-nom { font-weight: 700; color: #334155; white-space: nowrap; }
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
.pc-equip-hist { margin: 4px 0 10px; }
.pc-equip-tbl.histo { border: 1px solid #eef2f7; border-radius: 8px; }
.pc-equip-tbl.histo td { padding: 4px 8px; }
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
.pc-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pc-block { background: #fff; border: 1px solid #eef2f7; border-radius: 8px; padding: 8px 10px; }
.pc-block .pc-lbl { font-size: 11.5px; }
.pc-block p { margin: 4px 0 0; font-size: 13px; color: #1e293b; white-space: pre-wrap; line-height: 1.4; }
.pc-foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
.pc-ack.ok { color: #047857; font-size: 12.5px; font-weight: 600; }
.pc-ack.pending { color: #b45309; font-size: 12.5px; font-weight: 600; }
.pc-ack-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pc-ack-form select { font: inherit; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
@media (max-width: 640px) { .pc-blocks { grid-template-columns: 1fr; } .pc-eq-full { display: none; } }
</style>
