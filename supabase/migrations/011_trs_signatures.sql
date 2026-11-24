-- Migration 011 : traçabilité des saisies TRS par poste.
-- Ajoute « Fait par » (opérateur qui a relevé le poste) et « Vérifié par »
-- (vérificateur / chef de poste) pour chaque ligne trs_postes.
-- Champs texte libres, facultatifs — ils n'affectent aucun calcul de TRS.
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

alter table public.trs_postes
  add column if not exists fait_par text;
comment on column public.trs_postes.fait_par is
  'Nom de la personne ayant relevé / saisi le poste (opérateur).';

alter table public.trs_postes
  add column if not exists verifie_par text;
comment on column public.trs_postes.verifie_par is
  'Nom de la personne ayant vérifié le poste (chef de poste / vérificateur).';
