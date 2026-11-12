<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const CATS_SUGG = ['Nettoyage', 'Protection / EPI', 'Emballage', 'Étiquetage', 'Divers']

const consommables = ref([])
const mouvements = ref([])
const recherche = ref('')
const catSel = ref('')
const formOuvert = ref(false)
const erreur = ref('')
const message = ref('')
const nouv = reactive({ nom: '', categorie: '', unite: 'unité', stock_actuel: 0, seuil_alerte: 0 })
const mvtModal = ref(null)
const editModal = ref(null)

async function charger() {
  erreur.value = ''
  const rc = await supabase.from('consommables').select('*').order('categorie', { nullsFirst: true }).order('nom')
  if (rc.error) erreur.value = rc.error.message; else consommables.value = rc.data || []
  const rm = await supabase.from('mouvements_consommables').select('*').order('date_mvt', { ascending: false }).order('id', { ascending: false }).limit(100)
  if (!rm.error) mouvements.value = rm.data || []
}
onMounted(charger)

const categories = computed(() => [...new Set(consommables.value.map(c => c.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
const filtres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return consommables.value.filter(c => (!catSel.value || c.categorie === catSel.value) && (!q || (c.nom || '').toLowerCase().includes(q) || (c.reference || '').toLowerCase().includes(q)))
})
const nbAlerte = computed(() => consommables.value.filter(c => Number(c.stock_actuel) > 0 && Number(c.stock_actuel) <= Number(c.seuil_alerte)).length)
const nbRupture = computed(() => consommables.value.filter(c => Number(c.stock_actuel) <= 0).length)
const mvtMois = computed(() => { const n = new Date(); return mouvements.value.filter(m => { const d = new Date(m.date_mvt); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length })
const mvtsAffiches = computed(() => mouvements.value.slice(0, 40))

function etatClass(c) { const s = Number(c.stock_actuel), se = Number(c.seuil_alerte); if (s <= 0) return 'rupture'; if (s <= se) return 'alerte'; return 'ok' }
function etatLabel(c) { const s = Number(c.stock_actuel), se = Number(c.seuil_alerte); if (s <= 0) return 'Rupture'; if (s <= se) return 'À commander'; return 'OK' }
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const nomDe = (id) => { const c = consommables.value.find(x => x.id === id); return c ? c.nom : '—' }
const labelType = (t) => t === 'entree' ? 'Entrée' : t === 'sortie' ? 'Sortie' : 'Ajustement'

async function ajouter() {
  const nom = (nouv.nom || '').trim(); if (!nom) { erreur.value = 'Le nom est requis.'; return }
  const r = await supabase.from('consommables').insert({ nom, categorie: nouv.categorie || null, unite: nouv.unite || 'unité', stock_actuel: Number(nouv.stock_actuel) || 0, seuil_alerte: Number(nouv.seuil_alerte) || 0 })
  if (r.error) { erreur.value = r.error.message; return }
  Object.assign(nouv, { nom: '', categorie: '', unite: 'unité', stock_actuel: 0, seuil_alerte: 0 })
  formOuvert.value = false; message.value = 'Consommable ajouté.'; await charger()
}
function editer(c) { editModal.value = { ...c } }
async function validerEdit() {
  const e = editModal.value
  const r = await supabase.from('consommables').update({ nom: e.nom, categorie: e.categorie || null, unite: e.unite || 'unité', reference: e.reference || null, seuil_alerte: Number(e.seuil_alerte) || 0, stock_actuel: Number(e.stock_actuel) || 0 }).eq('id', e.id)
  if (r.error) { erreur.value = r.error.message; return }
  editModal.value = null; message.value = 'Consommable modifié.'; await charger()
}
async function supprimer(c) {
  if (!confirm('Supprimer « ' + c.nom + ' » et son historique de mouvements ?')) return
  const r = await supabase.from('consommables').delete().eq('id', c.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Consommable supprimé.'; await charger()
}

function ouvrirMvt(c, type) { mvtModal.value = { consommable_id: c.id, nom: c.nom, unite: c.unite, type, quantite: 0, date_mvt: new Date().toISOString().slice(0, 10), atelier: '', motif: '', stockAvant: Number(c.stock_actuel) || 0 } }
const stockApres = computed(() => { const m = mvtModal.value; if (!m) return 0; const q = Number(m.quantite) || 0; return m.type === 'sortie' ? m.stockAvant - q : m.type === 'entree' ? m.stockAvant + q : q })
async function validerMvt() {
  const m = mvtModal.value; const q = Number(m.quantite) || 0
  if (q <= 0) { erreur.value = 'Quantité invalide.'; return }
  const ri = await supabase.from('mouvements_consommables').insert({ consommable_id: m.consommable_id, type: m.type, quantite: q, date_mvt: m.date_mvt, atelier: m.atelier || null, motif: m.motif || null })
  if (ri.error) { erreur.value = ri.error.message; return }
  const ru = await supabase.from('consommables').update({ stock_actuel: stockApres.value }).eq('id', m.consommable_id)
  if (ru.error) erreur.value = ru.error.message
  mvtModal.value = null; message.value = 'Mouvement enregistré.'; await charger()
}
</script>

<template>
  <div class="conso-page">
    <PageHeader title="Gestion des consommables" tone="#b45309"
      subtitle="Stock, entrées/sorties et alertes des consommables (sacs polyéthylène, torchons, gants, bavettes…)." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok" @click="message = ''">{{ message }}</p>

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-v">{{ consommables.length }}</div><div class="kpi-l">Références</div></div>
      <div class="kpi alerte"><div class="kpi-v">{{ nbAlerte }}</div><div class="kpi-l">En alerte (≤ seuil)</div></div>
      <div class="kpi rupture"><div class="kpi-v">{{ nbRupture }}</div><div class="kpi-l">Ruptures (stock 0)</div></div>
      <div class="kpi"><div class="kpi-v">{{ mvtMois }}</div><div class="kpi-l">Mouvements ce mois</div></div>
    </div>

    <section class="card">
      <div class="tb">
        <input v-model="recherche" class="search" placeholder="Rechercher un consommable…" />
        <div class="cat-chips">
          <button class="chip" :class="{ on: !catSel }" @click="catSel = ''">Toutes</button>
          <button v-for="c in categories" :key="c" class="chip" :class="{ on: catSel === c }" @click="catSel = (catSel === c ? '' : c)">{{ c }}</button>
        </div>
        <button v-if="peutEditer" class="btn" @click="formOuvert = !formOuvert">＋ Ajouter</button>
      </div>

      <div v-if="formOuvert && peutEditer" class="add-form">
        <input v-model="nouv.nom" class="f-nom" placeholder="Nom (ex. Sac polyéthylène 50 L)" @keyup.enter="ajouter" />
        <input v-model="nouv.categorie" list="cats" placeholder="Catégorie" />
        <input v-model="nouv.unite" list="unites" placeholder="Unité" />
        <input v-model.number="nouv.stock_actuel" type="number" placeholder="Stock initial" />
        <input v-model.number="nouv.seuil_alerte" type="number" placeholder="Seuil alerte" />
        <button class="btn" @click="ajouter">Enregistrer</button>
        <button class="btn ghost" @click="formOuvert = false">Annuler</button>
      </div>
      <datalist id="cats"><option v-for="c in CATS_SUGG" :key="c" :value="c" /></datalist>
      <datalist id="unites"><option value="unité" /><option value="paquet" /><option value="boîte" /><option value="rouleau" /><option value="kg" /><option value="L" /><option value="paire" /><option value="carton" /></datalist>

      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Consommable</th><th>Catégorie</th><th>Unité</th><th class="r">Stock</th><th class="r">Seuil</th><th>État</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
          <tbody>
            <tr v-for="c in filtres" :key="c.id">
              <td class="nom">{{ c.nom }}<span v-if="c.reference" class="ref">{{ c.reference }}</span></td>
              <td>{{ c.categorie || '—' }}</td>
              <td class="unit">{{ c.unite }}</td>
              <td class="r stock" :class="etatClass(c)">{{ fmt(c.stock_actuel) }}</td>
              <td class="r seuil">{{ fmt(c.seuil_alerte) }}</td>
              <td><span class="badge" :class="etatClass(c)">{{ etatLabel(c) }}</span></td>
              <td v-if="peutEditer" class="r act">
                <button class="mini in" @click="ouvrirMvt(c, 'entree')" title="Entrée de stock">＋</button>
                <button class="mini out" @click="ouvrirMvt(c, 'sortie')" title="Sortie de stock">－</button>
                <button class="mini" @click="editer(c)" title="Modifier">✎</button>
                <button class="mini danger" @click="supprimer(c)" title="Supprimer">✕</button>
              </td>
            </tr>
            <tr v-if="!filtres.length"><td :colspan="peutEditer ? 7 : 6" class="vide">Aucun consommable. Clique « ＋ Ajouter » pour commencer.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">Derniers mouvements</h2>
      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Consommable</th><th>Type</th><th class="r">Qté</th><th>Atelier / service</th><th>Motif</th></tr></thead>
          <tbody>
            <tr v-for="m in mvtsAffiches" :key="m.id">
              <td>{{ fmtDate(m.date_mvt) }}</td>
              <td class="nom">{{ nomDe(m.consommable_id) }}</td>
              <td><span class="mtag" :class="m.type">{{ labelType(m.type) }}</span></td>
              <td class="r" :class="m.type === 'sortie' ? 'q-out' : 'q-in'">{{ m.type === 'sortie' ? '−' : '+' }}{{ fmt(m.quantite) }}</td>
              <td>{{ m.atelier || '—' }}</td>
              <td class="motif">{{ m.motif || '—' }}</td>
            </tr>
            <tr v-if="!mvtsAffiches.length"><td colspan="6" class="vide">Aucun mouvement enregistré.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="mvtModal" class="modal-back" @click.self="mvtModal = null">
      <div class="modal">
        <div class="modal-h" :class="mvtModal.type"><span>{{ mvtModal.type === 'entree' ? 'Entrée de stock' : 'Sortie de stock' }} — {{ mvtModal.nom }}</span><button class="x" @click="mvtModal = null">✕</button></div>
        <div class="modal-b">
          <label>Quantité ({{ mvtModal.unite }})<input v-model.number="mvtModal.quantite" type="number" min="0" /></label>
          <label>Date<input v-model="mvtModal.date_mvt" type="date" /></label>
          <label>Atelier / service<input v-model="mvtModal.atelier" placeholder="(optionnel)" /></label>
          <label>Motif<input v-model="mvtModal.motif" placeholder="(optionnel)" /></label>
          <p class="modal-info">Stock : <b>{{ fmt(mvtModal.stockAvant) }}</b> → après : <b :class="stockApres < 0 ? 'neg' : ''">{{ fmt(stockApres) }}</b></p>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="mvtModal = null">Annuler</button><button class="btn" @click="validerMvt">Valider</button></div>
      </div>
    </div>

    <div v-if="editModal" class="modal-back" @click.self="editModal = null">
      <div class="modal">
        <div class="modal-h"><span>Modifier — {{ editModal.nom }}</span><button class="x" @click="editModal = null">✕</button></div>
        <div class="modal-b">
          <label>Nom<input v-model="editModal.nom" /></label>
          <label>Catégorie<input v-model="editModal.categorie" list="cats" /></label>
          <label>Unité<input v-model="editModal.unite" list="unites" /></label>
          <label>Référence<input v-model="editModal.reference" placeholder="(optionnel)" /></label>
          <label>Seuil d'alerte<input v-model.number="editModal.seuil_alerte" type="number" /></label>
          <label>Stock actuel (correction)<input v-model.number="editModal.stock_actuel" type="number" /></label>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="editModal = null">Annuler</button><button class="btn" @click="validerEdit">Enregistrer</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conso-page { color: #1b2733; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; cursor: pointer; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid #b45309; }
.kpi-v { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; }
.kpi-l { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 3px; }
.kpi.alerte { border-left-color: #d97706; } .kpi.alerte .kpi-v { color: #b45309; }
.kpi.rupture { border-left-color: #dc2626; } .kpi.rupture .kpi-v { color: #dc2626; }

.tb { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.search { flex: 1 1 240px; min-width: 200px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; }
.cat-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #475569; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.chip:hover { border-color: #fcd34d; background: #fffbeb; }
.chip.on { background: #b45309; border-color: #b45309; color: #fff; }
.btn { background: #b45309; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 11px; margin-bottom: 12px; }
.add-form input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; width: 130px; }
.add-form .f-nom { flex: 1 1 220px; width: auto; min-width: 200px; }

.tbl-scroll { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 800; padding: 8px 12px; border-bottom: 2px solid #eef2f6; white-space: nowrap; }
.tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td.nom { font-weight: 700; color: #0f172a; }
.tbl td .ref { display: block; font-size: 11px; font-weight: 500; color: #94a3b8; font-family: ui-monospace, monospace; }
.tbl td.unit { color: #64748b; }
.tbl td.seuil { color: #64748b; }
.stock { font-weight: 800; font-variant-numeric: tabular-nums; }
.stock.ok { color: #0f172a; } .stock.alerte { color: #b45309; } .stock.rupture { color: #dc2626; }
.badge { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.badge.ok { background: #dcfce7; color: #166534; } .badge.alerte { background: #fef3c7; color: #92400e; } .badge.rupture { background: #fee2e2; color: #b91c1c; }
.act { white-space: nowrap; }
.mini { width: 28px; height: 26px; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 6px; cursor: pointer; font-size: 13px; margin-left: 3px; }
.mini:hover { background: #eef2f6; }
.mini.in { color: #15803d; border-color: #bbf7d0; } .mini.in:hover { background: #dcfce7; }
.mini.out { color: #b45309; border-color: #fde68a; } .mini.out:hover { background: #fef3c7; }
.mini.danger { color: #dc2626; } .mini.danger:hover { background: #fee2e2; border-color: #fecaca; }
.vide { text-align: center; color: #94a3b8; padding: 22px; }
.mtag { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; }
.mtag.entree { background: #dcfce7; color: #166534; } .mtag.sortie { background: #fef3c7; color: #92400e; } .mtag.ajustement { background: #e2e8f0; color: #475569; }
.q-in { color: #15803d; font-weight: 700; } .q-out { color: #b45309; font-weight: 700; }
.motif { color: #475569; }

.modal-back { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
.modal { background: #fff; border-radius: 14px; width: 420px; max-width: 94vw; box-shadow: 0 24px 60px rgba(2,8,23,.3); overflow: hidden; }
.modal-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px; background: #f1f5f9; font-weight: 800; font-size: 14px; color: #0f172a; }
.modal-h.entree { background: #dcfce7; } .modal-h.sortie { background: #fef3c7; }
.modal-h .x { background: none; border: 0; font-size: 18px; color: #64748b; cursor: pointer; }
.modal-b { padding: 16px; display: flex; flex-direction: column; gap: 11px; }
.modal-b label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; }
.modal-b input { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; }
.modal-info { margin: 2px 0 0; font-size: 13px; color: #475569; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 11px; }
.modal-info .neg { color: #dc2626; }
.modal-f { display: flex; justify-content: flex-end; gap: 8px; padding: 13px 16px; border-top: 1px solid #eef2f6; }
</style>
