-- Migration 013 : chronométrage SMED détaillé des changements de format/série.
-- Une session = un changement chronométré, avec la liste des opérations et,
-- pour chacune, si elle est INTERNE (machine arrêtée) ou EXTERNE (préparée
-- machine en marche). Le temps d'arrêt réel = somme des opérations internes ;
-- l'objectif SMED est de convertir l'interne en externe et de le réduire.
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

create table if not exists public.smed_sessions (
  id              bigserial primary key,
  equipement_id   text,                                    -- id de l'équipement (comparé en texte côté app)
  date            date not null default current_date,
  produit_avant   text,
  produit_apres   text,
  temps_cible_min integer,                                 -- cible de temps d'arrêt (min)
  operations      jsonb not null default '[]'::jsonb,      -- [{ nom, type:'interne'|'externe', duree }]
  commentaire     text,
  actif           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_smed_sessions_eq on public.smed_sessions(equipement_id);
comment on table public.smed_sessions is 'Sessions SMED : chronométrage détaillé d''un changement (opérations interne/externe) pour réduire les temps d''arrêt.';

-- RLS (convention du projet : RLS activé + 4 policies to authenticated)
alter table public.smed_sessions enable row level security;
create policy "smed sel" on public.smed_sessions for select to authenticated using (true);
create policy "smed ins" on public.smed_sessions for insert to authenticated with check (true);
create policy "smed upd" on public.smed_sessions for update to authenticated using (true);
create policy "smed del" on public.smed_sessions for delete to authenticated using (true);
