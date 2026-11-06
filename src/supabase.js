import { createClient } from '@supabase/supabase-js'

// URL + clé "publishable" en dur. Sans risque : ces 2 valeurs sont de toute
// façon visibles dans le site. Ce sont les règles RLS qui protègent les données.
const SUPABASE_URL = 'https://lpojdepnssxpnsqrrwoc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dyH_MussLiMxLVcjE3QoEA_E2h0XEHw'

// Session liée à l'onglet de navigateur : on stocke la session dans
// sessionStorage (quand disponible) plutôt que localStorage. La connexion
// survit à un rafraîchissement mais est oubliée à la fermeture du navigateur
// → l'identifiant + mot de passe sont redemandés à chaque nouvelle session.
let authStorage
try { authStorage = window.sessionStorage; const t = '__pt'; authStorage.setItem(t, '1'); authStorage.removeItem(t) }
catch (e) { authStorage = undefined }   // repli sur le stockage par défaut si indisponible (ex. navigation privée stricte)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})