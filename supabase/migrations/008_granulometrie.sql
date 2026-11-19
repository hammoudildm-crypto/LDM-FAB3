-- Migration 008 : enregistrement des analyses granulométrie & densité (par lot).
-- À exécuter dans le SQL Editor de Supabase.

create table if not exists public.granulo_analyses (
  id           bigserial primary key,
  produit_id   bigint,
  numero_lot   text,
  libelle      text,
  date_analyse date,
  masse        numeric,
  tamis        jsonb,     -- [{ "taille": 125, "retenu": 7.9 }, ...]
  taps         jsonb,     -- [{ "label": "V0", "v": 106 }, ...]
  d10          numeric,
  d50          numeric,
  d90          numeric,
  dens_app     numeric,
  dens_tass    numeric,
  hausner      numeric,
  carr         numeric,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_granulo_lot on public.granulo_analyses(numero_lot);

comment on table public.granulo_analyses is 'Analyses granulométrie (tamisage) et densité/compressibilité par lot.';

-- RLS (convention du projet : RLS activé + 4 policies to authenticated)
alter table public.granulo_analyses enable row level security;
create policy "granulo sel" on public.granulo_analyses for select to authenticated using (true);
create policy "granulo ins" on public.granulo_analyses for insert to authenticated with check (true);
create policy "granulo upd" on public.granulo_analyses for update to authenticated using (true);
create policy "granulo del" on public.granulo_analyses for delete to authenticated using (true);
