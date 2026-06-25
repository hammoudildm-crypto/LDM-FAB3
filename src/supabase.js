import { createClient } from '@supabase/supabase-js'

// Les clés sont lues depuis les variables d'environnement VITE_… (jamais en dur).
// En local : fichier .env (non committé). En CI : secrets GitHub Actions.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
