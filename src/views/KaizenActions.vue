<template>
  <div class="kz">
    <div class="kz-head">
      <div>
        <div class="kz-eyebrow">Lean · 改善 Kaizen / PDCA</div>
        <h1 class="kz-title">Kaizen — Actions d'amélioration</h1>
        <p class="kz-sub">Registre des améliorations continues, suivies selon le cycle PDCA (Plan → Do → Check → Act).</p>
      </div>
    </div>

    <div v-if="besoinMigration" class="kz-setup">
      <b>Table à créer dans Supabase</b> — exécute ce SQL dans l'éditeur SQL, puis recharge :
      <pre>create table if not exists ameliorations (
  id bigserial primary key,
  titre text not null,
  description text default '',
  atelier text default '',
  responsable text default '',
  priorite text default 'Moyenne',
  phase_pdca text default 'Plan',
  statut text default 'À faire',
  gain_attendu text default '',
  date_creation date default current_date,
  date_echeance date,
  date_cloture date,
  actif boolean default true
);</pre>
    </div>

    <p v-if="erreur && !besoinMigration" class="kz-alert">{{ erreur }}</p>
    <p v-if="message" class="kz-ok">{{ message }}</p>

    <section v-if="peutEditer && !besoinMigration" class="kz-form card">
      <div class="kz-form-head">{{ form.id ? 'Modifier l\'action' : 'Nouvelle action d\'amélioration' }}</div>
      <div class="kz-grid">
        <label class="kz-wide">Titre<input v-model="form.titre" placeholder="Ex. Réduire le temps de nettoyage de la MIC 200" /></label>
        <label class="kz-wide">Description / problème<textarea v-model="form.description" rows="2" placeholder="Situation, cause racine, action proposée…"></textarea></label>
        <label>Atelier / zone<input v-model="form.atelier" list="kz-ateliers" placeholder="Ex. Granulation" /><datalist id="kz-ateliers"><option v-for="a in ateliersDispo" :key="a" :value="a" /></datalist></label>
        <label>Responsable<input v-model="form.responsable" placeholder="Nom" /></label>
        <label>Priorité<select v-model="form.priorite"><option>Basse</option><option>Moyenne</option><option>Haute</option></select></label>
        <label>Phase PDCA<select v-model="form.phase_pdca"><option v-for="p in PDCA" :key="p" :value="p">{{ p }}</option></select></label>
        <label>Statut<select v-model="form.statut"><option>À faire</option><option>En cours</option><option>Terminé</option><option>Abandonné</option></select></label>
        <label>Échéance<input type="date" v-model="form.date_echeance" /></label>
        <label class="kz-wide">Gain attendu<input v-model="form.gain_attendu" placeholder="Ex. −30% de temps de changement, moins de rebuts…" /></label>
      </div>
      <div class="kz-acts">
        <button type="button" class="kz-btn" @click="enregistrer" :disabled="sauve">{{ form.id ? 'Mettre à jour' : 'Ajouter' }}</button>
        <button v-if="form.id" type="button" class="kz-btn ghost" @click="reset">Annuler</button>
      </div>
    </section>

    <div v-if="!besoinMigration" class="kz-toolbar">
      <label class="kz-chk"><input type="checkbox" v-model="masquerClos" /> Masquer les actions terminées/abandonnées</label>
      <span class="kz-count">{{ actionsFiltrees.length }} action(s)</span>
    </div>

    <div v-if="!besoinMigration" class="kz-board">
      <div v-for="ph in PDCA" :key="ph" class="kz-col" :class="'c-' + ph.toLowerCase()">
        <div class="kz-col-head"><span class="kz-col-dot"></span>{{ ph }} <span class="kz-col-n">{{ parPhase(ph).length }}</span></div>
        <div class="kz-cards">
          <div v-for="a in parPhase(ph)" :key="a.id" class="kz-c" :class="['p-' + (a.priorite || '').toLowerCase(), { done: a.statut === 'Terminé' || a.statut === 'Abandonné' }]">
            <div class="kz-c-top">
              <span class="kz-c-titre" @click="modifier(a)">{{ a.titre }}</span>
              <span class="kz-c-stat" :class="statutCls(a.statut)">{{ a.statut }}</span>
            </div>
            <div v-if="a.atelier || a.responsable" class="kz-c-meta">
              <span v-if="a.atelier" class="kz-c-at">{{ a.atelier }}</span>
              <span v-if="a.responsable" class="kz-c-resp">👤 {{ a.responsable }}</span>
            </div>
            <div v-if="a.gain_attendu" class="kz-c-gain">🎯 {{ a.gain_attendu }}</div>
            <div class="kz-c-foot">
              <span v-if="a.date_echeance" class="kz-c-ech" :class="{ late: enRetard(a) }">⏱ {{ fmtDate(a.date_echeance) }}</span>
              <span class="kz-c-sp"></span>
              <button v-if="peutEditer && idxPdca(a.phase_pdca) < 3 && a.statut !== 'Terminé'" type="button" class="kz-mini" title="Passer à la phase suivante" @click="avancer(a)">{{ phaseSuivante(a.phase_pdca) }} ▸</button>
              <button v-if="peutEditer" type="button" class="kz-mini ghost" @click="modifier(a)">✎</button>
              <button v-if="peutSupprimer" type="button" class="kz-mini ghost" @click="supprimer(a)">🗑</button>
            </div>
          </div>
          <div v-if="!parPhase(ph).length" class="kz-col-empty">—</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(true))
const peutSupprimer = inject('peutSupprimer', ref(true))

const PDCA = ['Plan', 'Do', 'Check', 'Act']
const actions = ref([])
const erreur = ref(''), message = ref(''), sauve = ref(false)
const besoinMigration = ref(false)
const masquerClos = ref(false)

const vide = () => ({ id: null, titre: '', description: '', atelier: '', responsable: '', priorite: 'Moyenne', phase_pdca: 'Plan', statut: 'À faire', gain_attendu: '', date_echeance: '' })
const form = reactive(vide())
function reset() { Object.assign(form, vide()) }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return { error: r.error, data: all }; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return { data: all, error: null }
}

async function charger() {
  erreur.value = ''
  const r = await fetchAllPaged(() => supabase.from('ameliorations').select('*').eq('actif', true).order('date_creation', { ascending: false }).order('id', { ascending: false }))
  if (r.error) {
    const m = (r.error.message || '').toLowerCase()
    if (m.includes('ameliorations') || m.includes('does not exist') || m.includes('relation') || m.includes('schema cache')) besoinMigration.value = true
    else erreur.value = r.error.message
    return
  }
  besoinMigration.value = false
  actions.value = r.data || []
}
onMounted(charger)

const ateliersDispo = computed(() => [...new Set(actions.value.map(a => (a.atelier || '').trim()).filter(Boolean))].sort())
const actionsFiltrees = computed(() => masquerClos.value ? actions.value.filter(a => a.statut !== 'Terminé' && a.statut !== 'Abandonné') : actions.value)
function parPhase(ph) { return actionsFiltrees.value.filter(a => (a.phase_pdca || 'Plan') === ph) }
function idxPdca(p) { const i = PDCA.indexOf(p); return i < 0 ? 0 : i }
function phaseSuivante(p) { return PDCA[Math.min(3, idxPdca(p) + 1)] }

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.titre.trim()) { erreur.value = 'Le titre est requis.'; return }
  sauve.value = true
  const payload = { titre: form.titre.trim(), description: form.description || '', atelier: form.atelier || '', responsable: form.responsable || '', priorite: form.priorite, phase_pdca: form.phase_pdca, statut: form.statut, gain_attendu: form.gain_attendu || '', date_echeance: form.date_echeance || null }
  if (form.statut === 'Terminé') payload.date_cloture = new Date().toISOString().slice(0, 10)
  try {
    let r
    if (form.id) r = await supabase.from('ameliorations').update(payload).eq('id', form.id).select()
    else r = await supabase.from('ameliorations').insert(payload).select()
    if (r.error) { erreur.value = r.error.message; sauve.value = false; return }
    message.value = form.id ? 'Action mise à jour.' : 'Action ajoutée.'
    reset(); await charger()
  } catch (ex) { erreur.value = 'Échec : ' + (ex && ex.message ? ex.message : ex) }
  sauve.value = false
}

function modifier(a) {
  Object.assign(form, { id: a.id, titre: a.titre || '', description: a.description || '', atelier: a.atelier || '', responsable: a.responsable || '', priorite: a.priorite || 'Moyenne', phase_pdca: a.phase_pdca || 'Plan', statut: a.statut || 'À faire', gain_attendu: a.gain_attendu || '', date_echeance: a.date_echeance || '' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function avancer(a) {
  const next = phaseSuivante(a.phase_pdca)
  const r = await supabase.from('ameliorations').update({ phase_pdca: next }).eq('id', a.id)
  if (!r.error) { a.phase_pdca = next } else erreur.value = r.error.message
}

async function supprimer(a) {
  if (!confirm('Supprimer l\'action « ' + a.titre + ' » ?')) return
  const r = await supabase.from('ameliorations').update({ actif: false }).eq('id', a.id)
  if (!r.error) await charger(); else erreur.value = r.error.message
}

function fmtDate(d) { if (!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(x.getTime()) ? '' : x.toLocaleDateString('fr-FR') }
function enRetard(a) { if (!a.date_echeance || a.statut === 'Terminé' || a.statut === 'Abandonné') return false; return String(a.date_echeance).slice(0, 10) < new Date().toISOString().slice(0, 10) }
function statutCls(s) { return s === 'Terminé' ? 's-ok' : s === 'En cours' ? 's-run' : s === 'Abandonné' ? 's-off' : 's-todo' }
</script>

<style scoped>
.kz { max-width: 1320px; margin: 0 auto; padding: 4px 2px 40px; }
.kz-head { margin-bottom: 14px; }
.kz-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #e11d48; }
.kz-title { margin: 2px 0 2px; font-size: 24px; font-weight: 800; color: #0f172a; }
.kz-sub { margin: 0; color: #64748b; font-size: 13.5px; }
.kz-setup { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #92400e; margin-bottom: 14px; }
.kz-setup pre { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; margin: 8px 0 0; }
.kz-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.kz-ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; }
.kz-form { padding: 16px; margin-bottom: 18px; }
.kz-form-head { font-weight: 800; color: #0f172a; margin-bottom: 12px; }
.kz-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.kz-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #475569; }
.kz-grid .kz-wide { grid-column: 1 / -1; }
.kz-grid input, .kz-grid select, .kz-grid textarea { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 13px; color: #0f172a; }
.kz-acts { margin-top: 14px; display: flex; gap: 8px; }
.kz-btn { background: #e11d48; color: #fff; border: 0; border-radius: 9px; padding: 9px 16px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.kz-btn.ghost { background: #f1f5f9; color: #334155; }
.kz-toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.kz-chk { font-size: 13px; color: #475569; display: flex; align-items: center; gap: 6px; }
.kz-count { color: #94a3b8; font-size: 12.5px; font-weight: 600; margin-left: auto; }
.kz-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; align-items: start; }
.kz-col { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
.kz-col-head { display: flex; align-items: center; gap: 7px; font-weight: 800; font-size: 13px; color: #0f172a; margin-bottom: 10px; }
.kz-col-dot { width: 9px; height: 9px; border-radius: 50%; }
.c-plan .kz-col-dot { background: #6366f1; } .c-do .kz-col-dot { background: #0891b2; } .c-check .kz-col-dot { background: #d97706; } .c-act .kz-col-dot { background: #16a34a; }
.kz-col-n { margin-left: auto; background: #e2e8f0; color: #475569; font-size: 11px; padding: 1px 8px; border-radius: 999px; }
.kz-cards { display: flex; flex-direction: column; gap: 8px; }
.kz-c { background: #fff; border: 1px solid #e2e8f0; border-left: 3px solid #cbd5e1; border-radius: 9px; padding: 9px 11px; }
.kz-c.p-haute { border-left-color: #ef4444; } .kz-c.p-moyenne { border-left-color: #f59e0b; } .kz-c.p-basse { border-left-color: #94a3b8; }
.kz-c.done { opacity: .62; }
.kz-c-top { display: flex; align-items: flex-start; gap: 8px; }
.kz-c-titre { font-weight: 700; font-size: 13px; color: #0f172a; cursor: pointer; flex: 1; }
.kz-c-titre:hover { color: #e11d48; }
.kz-c-stat { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.s-ok { background: #ecfdf5; color: #047857; } .s-run { background: #eff6ff; color: #1d4ed8; } .s-todo { background: #f1f5f9; color: #64748b; } .s-off { background: #fef2f2; color: #b91c1c; }
.kz-c-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; font-size: 11px; color: #64748b; }
.kz-c-at { background: #eef2ff; color: #4338ca; padding: 1px 7px; border-radius: 999px; font-weight: 600; }
.kz-c-gain { margin-top: 6px; font-size: 11.5px; color: #475569; }
.kz-c-foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.kz-c-ech { font-size: 11px; color: #64748b; } .kz-c-ech.late { color: #b91c1c; font-weight: 700; }
.kz-c-sp { flex: 1; }
.kz-mini { border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 3px 7px; font: inherit; font-size: 11px; font-weight: 700; color: #334155; cursor: pointer; }
.kz-mini.ghost { color: #94a3b8; }
.kz-mini:hover { background: #f8fafc; }
.kz-col-empty { text-align: center; color: #cbd5e1; padding: 14px; font-size: 13px; }
@media (max-width: 900px) { .kz-grid { grid-template-columns: repeat(2, 1fr); } .kz-board { grid-template-columns: 1fr 1fr; } }
@media (max-width: 560px) { .kz-board { grid-template-columns: 1fr; } }
</style>
