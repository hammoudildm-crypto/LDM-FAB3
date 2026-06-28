<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const annee = new Date().getFullYear()
const session = ref(null)
const erreur = ref('')

const nbProduits = ref(0)
const lots = ref([])
const planTotal = ref(0)
const conditionnements = ref([])

const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']

async function charger() {
  erreur.value = ''

  const rp = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true)
  if (!rp.error) nbProduits.value = rp.count || 0

  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, produits(designation)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rpp = await supabase.from('plan_production').select('quantite_planifiee').eq('annee', annee)
  if (!rpp.error) planTotal.value = rpp.data.reduce((s, x) => s + Number(x.quantite_planifiee || 0), 0)

  const rc = await supabase.from('conditionnement')
    .select('quantite_entree, quantite_conditionnee, ordres_fabrication(produits(unites_par_boite))')
    .eq('actif', true)
  if (!rc.error) conditionnements.value = rc.data
}

const nbLots = computed(() => lots.value.length)
const lotsParStatut = computed(() => {
  const m = {}
  for (const s of STATUTS) m[s] = 0
  for (const l of lots.value) { if (m[l.statut] != null) m[l.statut]++; else m[l.statut] = 1 }
  return m
})
const lotsEnCours = computed(() => lotsParStatut.value['En cours'] || 0)
const derniersLots = computed(() => lots.value.slice(0, 6))

const totalBoites = computed(() => {
  let t = 0
  for (const c of conditionnements.value) {
    const upb = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits.unites_par_boite : null
    if (c.quantite_conditionnee != null && upb
