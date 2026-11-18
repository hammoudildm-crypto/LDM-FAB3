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
