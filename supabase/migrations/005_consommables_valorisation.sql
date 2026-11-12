-- Migration 005 : valorisation des consommables (prix unitaire).
-- À exécuter dans le SQL Editor de Supabase après la 004.
-- Le code article utilise la colonne « reference » déjà créée en 004.

alter table public.consommables
  add column if not exists prix_unitaire numeric not null default 0;
comment on column public.consommables.prix_unitaire is
  'Prix unitaire (DA) pour valoriser le stock : valeur = stock_actuel × prix_unitaire.';
