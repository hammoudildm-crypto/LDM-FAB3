-- Migration 016 : n° de lot / opération sur les postes TRS
-- Permet de relier plusieurs postes (shifts) d'une même opération à cheval sur
-- plusieurs shifts, et d'en calculer le temps cumulé (Saisie TRS -> Opérations par lot).
-- À exécuter dans Supabase SQL Editor.

alter table public.trs_postes
  add column if not exists numero_lot text;

-- Accélère le regroupement par lot.
create index if not exists idx_trs_postes_numero_lot
  on public.trs_postes (numero_lot);
