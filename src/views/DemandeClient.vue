<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const anneeCourante = new Date().getFullYear()

const produits = ref([])
const lignes = ref([])
const chargement = ref(true)
const erreur = ref('')
const message = ref('')
const migrationManquante = ref(false)

const filtreAnnee = ref(anneeCourante)
const rech = ref('')

const form = reactive({ id: null, produit_id: '', annee: anneeCourante, mois: new Date().getMonth() + 1, quantite_demandee: '', commentaire: '' })
function resetForm() { Object.assign(form, { id: null, produit_id: '', annee: filtreAnnee.value, mois: new Date().getMonth() + 1, quantite_demandee: '', commentaire: '' }) }
function toNum(v) { return v === '' || v === null ? null : Number(v) }

async function chargerTout() {
  erreur.value = ''; chargement.value = true
  const rp = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  const rd = await supabase.from('demande_client').select('*').eq('actif', true)
    .order('annee', { ascending: false }).order('mois', { ascending: false }).order('id', { ascending: false })
  if (rd.error) {
    // Table absente : la migration 002 n'a pas encore été exécutée.
    if (/does not exist|relation|schema cache/i.test(rd.error.message || '')) migrationManquante.value = true
    else erreur.value = rd.error.message
    lignes.value = []
  } else { migrationManquante.value = false; lignes.value = rd.data || [] }
  chargement.value = false
}
onMounted(chargerTout)

const produitsMap = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
function libProduit(id) { const p = produitsMap.value[id]; return p ? (p.code_pf + ' — ' + (p.designation || '')) : ('#' + id) }

const annees = computed(() => {
  const s = new Set([anneeCourante]); lignes.value.forEach(l => s.add(Number(l.annee))); return [...s].sort((a, b) => b - a)
})
const produitsFiltres = computed(() => {
  const q = rech.value.trim().toLowerCase(); if (!q) return produits.value
  return produits.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})
const lignesFiltrees = computed(() => lignes.value
  .filter(l => Number(l.annee) === Number(filtreAnnee.value))
  .map(l => ({ ...l, lib: libProduit(l.produit_id) }))
  .sort((a, b) => (a.mois - b.mois) || a.lib.localeCompare(b.lib)))
const totalAnnee = computed(() => lignesFiltrees.value.reduce((s, l) => s + Number(l.quantite_demandee || 0), 0))

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.produit_id) { erreur.value = 'Produit obligatoire.'; return }
  if (!(Number(form.quantite_demandee) >= 0)) { erreur.value = 'Quantité demandée invalide.'; return }
  const payload = {
    produit_id: form.produit_id, annee: Number(form.annee), mois: Number(form.mois),
    quantite_demandee: toNum(form.quantite_demandee), commentaire: form.commentaire.trim() || null, actif: true
  }
  const res = form.id
    ? await supabase.from('demande_client').update(payload).eq('id', form.id)
    : await supabase.from('demande_client').upsert(payload, { onConflict: 'produit_id,annee,mois' })
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Demande mise à jour.' : 'Demande enregistrée.'
  resetForm(); await chargerTout()
}
function modifier(l) {
  Object.assign(form, { id: l.id, produit_id: l.produit_id, annee: l.annee, mois: l.mois, quantite_demandee: l.quantite_demandee ?? '', commentaire: l.commentaire || '' })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function supprimer(l) {
  if (!confirm('Supprimer la demande ' + libProduit(l.produit_id) + ' — ' + MOIS[l.mois - 1] + ' ' + l.annee + ' ?')) return
  const res = await supabase.from('demande_client').update({ actif: false }).eq('id', l.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
</script>

<template>
  <div class="dc">
    <div class="dc-head">
      <div>
        <h1 class="dc-title">Demande client</h1>
        <p class="dc-sub">Demande mensuelle par produit — alimente le KPI <b>Takt Time</b> du Tableau de bord.</p>
      </div>
    </div>

    <div v-if="migrationManquante" class="dc-warn">
      La table <code>demande_client</code> n'existe pas encore. Exécutez la migration
      <code>supabase/migrations/002_demande_client_echeance.sql</code> dans le SQL Editor de Supabase, puis rechargez.
    </div>

    <template v-else>
      <div class="dc-card dc-form">
        <h2 class="dc-ct">{{ form.id ? 'Modifier la demande' : 'Nouvelle demande' }}</h2>
        <div class="dc-grid">
          <label class="wide">Produit
            <input v-model="rech" type="search" class="dc-search" placeholder="Filtrer par code ou désignation…" />
            <select v-model="form.produit_id">
              <option value="">— choisir —</option>
              <option v-for="p in produitsFiltres" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option>
            </select>
          </label>
          <label>Année<input v-model.number="form.annee" type="number" min="2020" max="2100" /></label>
          <label>Mois
            <select v-model.number="form.mois"><option v-for="(m, i) in MOIS" :key="i" :value="i + 1">{{ m }}</option></select>
          </label>
          <label>Quantité demandée (boîtes)<input v-model="form.quantite_demandee" type="number" min="0" placeholder="0" /></label>
          <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
        </div>
        <div class="dc-actions">
          <button type="button" class="btn-primary" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Enregistrer' }}</button>
          <button v-if="form.id" type="button" class="btn-ghost" @click="resetForm">Annuler</button>
          <span v-if="message" class="dc-ok">{{ message }}</span>
          <span v-if="erreur" class="dc-err">{{ erreur }}</span>
        </div>
      </div>

      <div class="dc-bar">
        <label>Année
          <select v-model.number="filtreAnnee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
        </label>
        <span class="dc-tot">Total {{ filtreAnnee }} : <b>{{ fmt(totalAnnee) }}</b> boîtes · {{ lignesFiltrees.length }} ligne(s)</span>
      </div>

      <div class="dc-card">
        <table class="dc-tbl">
          <thead><tr><th>Mois</th><th>Produit</th><th class="r">Quantité demandée</th><th>Commentaire</th><th class="c">Actions</th></tr></thead>
          <tbody>
            <tr v-for="l in lignesFiltrees" :key="l.id">
              <td class="mo">{{ MOIS[l.mois - 1] }}</td>
              <td class="pr">{{ l.lib }}</td>
              <td class="r q">{{ fmt(l.quantite_demandee) }}</td>
              <td class="cm">{{ l.commentaire || '—' }}</td>
              <td class="c"><button type="button" class="lk" @click="modifier(l)">Modifier</button><button type="button" class="lk del" @click="supprimer(l)">Supprimer</button></td>
            </tr>
            <tr v-if="!chargement && !lignesFiltrees.length"><td colspan="5" class="vide">Aucune demande saisie pour {{ filtreAnnee }}.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dc { padding: 18px 22px 40px; max-width: 1100px; margin: 0 auto; color: #1e293b; }
.dc-head { margin-bottom: 16px; }
.dc-title { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; border-left: 4px solid #6366f1; padding-left: 12px; }
.dc-sub { margin: 6px 0 0 16px; font-size: 13px; color: #64748b; }
.dc-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 14px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.6; }
.dc-warn code { background: #fef3c7; padding: 1px 6px; border-radius: 5px; font-size: 12.5px; }
.dc-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; box-shadow: 0 6px 18px rgba(30, 41, 59, .05); padding: 16px 18px; margin-bottom: 16px; }
.dc-ct { margin: 0 0 12px; font-size: 14px; font-weight: 800; color: #4338ca; }
.dc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 14px; }
.dc-grid label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 700; color: #475569; }
.dc-grid label.wide { grid-column: 1 / -1; }
.dc-grid input, .dc-grid select, .dc-search { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; font-size: 13.5px; font-weight: 500; color: #0f172a; background: #fff; }
.dc-search { margin-bottom: 4px; }
.dc-grid input:focus, .dc-grid select:focus, .dc-search:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, .14); }
.dc-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.btn-primary { background: #6366f1; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; }
.btn-primary:hover { background: #4f46e5; }
.btn-ghost { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
.dc-ok { color: #15803d; font-size: 13px; font-weight: 700; }
.dc-err { color: #b91c1c; font-size: 13px; font-weight: 700; }
.dc-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 2px 10px; flex-wrap: wrap; }
.dc-bar label { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: #475569; }
.dc-bar select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600; }
.dc-tot { font-size: 13px; color: #334155; }
.dc-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.dc-tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; font-weight: 700; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e8edf3; }
.dc-tbl th.r, .dc-tbl td.r { text-align: right; } .dc-tbl th.c, .dc-tbl td.c { text-align: center; }
.dc-tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.dc-tbl tbody tr:last-child td { border-bottom: 0; }
.dc-tbl .mo { font-weight: 700; color: #4338ca; white-space: nowrap; }
.dc-tbl .pr { color: #334155; }
.dc-tbl .q { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.dc-tbl .cm { color: #94a3b8; }
.dc-tbl .vide { text-align: center; color: #94a3b8; padding: 22px; }
.lk { background: none; border: 0; color: #4f46e5; font-size: 12.5px; font-weight: 700; cursor: pointer; padding: 2px 8px; }
.lk.del { color: #dc2626; }
.lk:hover { text-decoration: underline; }
@media (max-width: 760px) { .dc-grid { grid-template-columns: 1fr 1fr; } }
</style>
