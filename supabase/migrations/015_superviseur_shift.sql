-- Migration 015 : superviseur de shift sur la saisie TRS.
-- Ajoute la colonne « superviseur » à trs_postes (nom du superviseur de shift,
-- en complément de fait_par / verifie_par). Renseignée depuis l'organigramme
-- (personnel dont la fonction contient « superviseur »).
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

alter table public.trs_postes add column if not exists superviseur text;
