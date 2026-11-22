-- Migration 009 : motifs d'arrêt « vide de ligne » dans la Saisie TRS.
-- Ajoute VDLG (vide de ligne général) et VDLP (vide de ligne partiel) comme
-- arrêts organisationnels, au même grain (minutes) que les autres motifs.
-- Ils réduisent le temps de fonctionnement, donc la disponibilité (et le TRS).
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

alter table public.trs_postes
  add column if not exists arret_vdlg_min integer not null default 0;
comment on column public.trs_postes.arret_vdlg_min is
  'Minutes de vide de ligne GÉNÉRAL (VDLG) — nettoyage/vide complet de la ligne lors d''un changement de produit ou de campagne.';

alter table public.trs_postes
  add column if not exists arret_vdlp_min integer not null default 0;
comment on column public.trs_postes.arret_vdlp_min is
  'Minutes de vide de ligne PARTIEL (VDLP) — vide de ligne entre lots d''un même produit (même campagne).';
