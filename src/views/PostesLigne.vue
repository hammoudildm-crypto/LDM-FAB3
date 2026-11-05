<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const equipements = ref([])
const postes = ref([])
const ligneId = ref('')
const chargement = ref(true)
const erreur = ref('')
const message = ref('')
const migrationManquante = ref(false)

const form = reactive({ id: null, libelle: '', temps_cycle_sec: '' })
function resetForm() { Object.assign(form, { id: null, libelle: '', temps_cycle_sec: '' }) }
function toNum(v) { return v === '' || v === null ? null : Number(v) }

async function chargerTout() {
  erreur.value = ''; chargement.value = true
  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (!re.error) equipements.value = re.data || []
  const rp = await supabase.from('postes_ligne').select('*').eq('actif', true).order('equipement_id').order('ordre')
  if (rp.error) {
    if (/does not exist|relation|schema cache/i.test(rp.error.message || '')) migrationManquante.value = true
    else erreur.value = rp.error.message
    postes.value = []
  } else { migrationManquante.value = false; postes.value = rp.data || [] }
  chargement.value = false
}
onMounted(chargerTout)

function libLigne(e) { return (e.code ? e.code + ' — ' : '') + (e.nom || ('#' + e.id)) }
const postesLigne = computed(() => postes.value.filter(p => String(p.equipement_id) === String(ligneId.value)).sort((a, b) => (a.ordre - b.ordre)))
const lignesAvecPostes = computed(() => { const s = new Set(postes.value.map(p => String(p.equipement_id))); return s.size })

// Efficience d'équilibrage de la ligne sélectionnée : Σ cycles / (nb postes × goulot) × 100
const equilibrage = computed(() => {
  const arr = postesLigne.value.map(p => Number(p.temps_cycle_sec) || 0).filter(c => c > 0)
  if (arr.length < 2) return null
  const somme = arr.reduce((s, v) => s + v, 0), goulot = Math.max(...arr)
  return { eff: somme / (arr.length * goulot) * 100, goulot, n: arr.length, somme }
})
const effColor = computed(() => { const e = equilibrage.value; if (!e) return '#94a3b8'; return e.eff >= 90 ? '#16a34a' : (e.eff >= 80 ? '#d97706' : '#dc2626') })

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!ligneId.value) { erreur.value = 'Choisir d\'abord une ligne (équipement).'; return }
  if (!form.libelle.trim()) { erreur.value = 'Libellé du poste obligatoire.'; return }
  if (!(Number(form.temps_cycle_sec) >= 0)) { erreur.value = 'Temps de cycle invalide.'; return }
  const base = { equipement_id: ligneId.value, libelle: form.libelle.trim(), temps_cycle_sec: toNum(form.temps_cycle_sec), actif: true }
  let res
  if (form.id) res = await supabase.from('postes_ligne').update(base).eq('id', form.id)
  else {
    const ordre = (postesLigne.value.reduce((m, p) => Math.max(m, Number(p.ordre) || 0), 0)) + 1
    res = await supabase.from('postes_ligne').insert({ ...base, ordre })
  }
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Poste mis à jour.' : 'Poste ajouté.'
  resetForm(); await chargerTout()
}
function modifier(p) { Object.assign(form, { id: p.id, libelle: p.libelle, temps_cycle_sec: p.temps_cycle_sec ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function supprimer(p) {
  if (!confirm('Supprimer le poste « ' + p.libelle + ' » ?')) return
  const res = await supabase.from('postes_ligne').update({ actif: false }).eq('id', p.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}
const fmt1 = (n) => (Number(n || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })
</script>

<template>
  <div class="pl">
    <div class="pl-head">
      <div>
        <h1 class="pl-title">Équilibrage de ligne — postes de travail</h1>
        <p class="pl-sub">Temps de cycle de chaque poste d'une ligne — alimente le KPI <b>Équilibrage de ligne</b> du Tableau de bord.</p>
      </div>
    </div>

    <div v-if="migrationManquante" class="pl-warn">
      La table <code>postes_ligne</code> n'existe pas encore. Exécutez la migration
      <code>supabase/migrations/003_kpi_restants.sql</code> dans le SQL Editor de Supabase, puis rechargez.
    </div>

    <template v-else>
      <div class="pl-bar">
        <label>Ligne (équipement)
          <select v-model="ligneId">
            <option value="">— choisir une ligne —</option>
            <option v-for="e in equipements" :key="e.id" :value="e.id">{{ libLigne(e) }}</option>
          </select>
        </label>
        <span class="pl-count">{{ lignesAvecPostes }} ligne(s) déjà configurée(s)</span>
      </div>

      <template v-if="ligneId">
        <div class="pl-metric" v-if="equilibrage">
          <div class="pm-box">
            <span class="pm-l">Efficience d'équilibrage</span>
            <span class="pm-v" :style="{ color: effColor }">{{ fmt1(equilibrage.eff) }}%</span>
            <span class="pm-h">Σ cycles {{ fmt1(equilibrage.somme) }}s · {{ equilibrage.n }} postes · goulot {{ fmt1(equilibrage.goulot) }}s · cible ≥ 90%</span>
          </div>
        </div>
        <div class="pl-metric pm-hint" v-else>Ajoutez au moins 2 postes pour calculer l'efficience d'équilibrage de cette ligne.</div>

        <div class="pl-card pl-form">
          <h2 class="pl-ct">{{ form.id ? 'Modifier le poste' : 'Nouveau poste' }}</h2>
          <div class="pl-grid">
            <label class="wide">Libellé du poste<input v-model="form.libelle" placeholder="ex. Alimentation, Compression, Sertissage…" /></label>
            <label>Temps de cycle (s/unité)<input v-model="form.temps_cycle_sec" type="number" min="0" step="any" placeholder="0" /></label>
          </div>
          <div class="pl-actions">
            <button type="button" class="btn-primary" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Ajouter' }}</button>
            <button v-if="form.id" type="button" class="btn-ghost" @click="resetForm">Annuler</button>
            <span v-if="message" class="pl-ok">{{ message }}</span>
            <span v-if="erreur" class="pl-err">{{ erreur }}</span>
          </div>
        </div>

        <div class="pl-card">
          <table class="pl-tbl">
            <thead><tr><th class="c">#</th><th>Poste</th><th class="r">Temps de cycle</th><th class="c">Goulot</th><th class="c">Actions</th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in postesLigne" :key="p.id" :class="{ gou: equilibrage && Number(p.temps_cycle_sec) === equilibrage.goulot }">
                <td class="c num">{{ i + 1 }}</td>
                <td class="lib">{{ p.libelle }}</td>
                <td class="r cy">{{ fmt1(p.temps_cycle_sec) }} s</td>
                <td class="c">{{ equilibrage && Number(p.temps_cycle_sec) === equilibrage.goulot ? '●' : '' }}</td>
                <td class="c"><button type="button" class="lk" @click="modifier(p)">Modifier</button><button type="button" class="lk del" @click="supprimer(p)">Supprimer</button></td>
              </tr>
              <tr v-if="!postesLigne.length"><td colspan="5" class="vide">Aucun poste pour cette ligne.</td></tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-else class="pl-empty">Choisis une ligne ci-dessus pour saisir ou consulter ses postes de travail.</div>
    </template>
  </div>
</template>

<style scoped>
.pl { padding: 18px 22px 40px; max-width: 1000px; margin: 0 auto; color: #1e293b; }
.pl-head { margin-bottom: 16px; }
.pl-title { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; border-left: 4px solid #e11d48; padding-left: 12px; }
.pl-sub { margin: 6px 0 0 16px; font-size: 13px; color: #64748b; }
.pl-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 14px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; }
.pl-warn code { background: #fef3c7; padding: 1px 6px; border-radius: 5px; font-size: 12.5px; }
.pl-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 2px 14px; flex-wrap: wrap; }
.pl-bar label { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #475569; }
.pl-bar select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 11px; font-size: 13.5px; font-weight: 600; min-width: 260px; }
.pl-count { font-size: 12.5px; color: #94a3b8; }
.pl-metric { margin-bottom: 14px; }
.pm-box { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; box-shadow: 0 6px 18px rgba(30, 41, 59, .05); padding: 14px 18px; display: flex; flex-direction: column; gap: 3px; }
.pm-l { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; }
.pm-v { font-size: 30px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; }
.pm-h { font-size: 12px; color: #64748b; }
.pm-hint { font-size: 13px; color: #64748b; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 12px; padding: 12px 16px; }
.pl-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; box-shadow: 0 6px 18px rgba(30, 41, 59, .05); padding: 16px 18px; margin-bottom: 16px; }
.pl-ct { margin: 0 0 12px; font-size: 14px; font-weight: 800; color: #be123c; }
.pl-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 12px 14px; }
.pl-grid label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: #475569; }
.pl-grid label.wide { grid-column: auto; }
.pl-grid input { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13.5px; font-weight: 500; color: #0f172a; }
.pl-grid input:focus { outline: none; border-color: #e11d48; box-shadow: 0 0 0 3px rgba(225, 29, 72, .12); }
.pl-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.btn-primary { background: #e11d48; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; }
.btn-primary:hover { background: #be123c; }
.btn-ghost { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.pl-ok { color: #15803d; font-size: 13px; font-weight: 700; } .pl-err { color: #b91c1c; font-size: 13px; font-weight: 700; }
.pl-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pl-tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; font-weight: 700; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e8edf3; }
.pl-tbl th.r, .pl-tbl td.r { text-align: right; } .pl-tbl th.c, .pl-tbl td.c { text-align: center; }
.pl-tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.pl-tbl .num { color: #94a3b8; width: 34px; } .pl-tbl .lib { font-weight: 700; color: #334155; }
.pl-tbl .cy { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.pl-tbl tr.gou { background: #fff1f2; } .pl-tbl tr.gou .cy { color: #be123c; }
.pl-tbl .vide { text-align: center; color: #94a3b8; padding: 20px; }
.lk { background: none; border: 0; color: #e11d48; font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 2px 8px; } .lk.del { color: #dc2626; } .lk:hover { text-decoration: underline; }
.pl-empty { color: #94a3b8; font-size: 14px; padding: 24px 4px; }
@media (max-width: 640px) { .pl-grid { grid-template-columns: 1fr; } }
</style>
