-- Migration 012 : objectif / cible de TRS par équipement.
-- Permet de fixer une cible de TRS par machine et d'alerter quand le réalisé
-- passe sous l'objectif. Valeur = fraction 0–1 (ex. 0.75 = 75 %). Null = on
-- applique l'objectif par défaut du site (réglé dans l'app).
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

alter table public.equipements
  add column if not exists objectif_trs real;
comment on column public.equipements.objectif_trs is
  'Objectif / cible de TRS (fraction 0–1) pour cet équipement. Null = objectif par défaut du site.';
