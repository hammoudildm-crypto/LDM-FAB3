-- Migration 002 : Échéance de livraison sur les OF  →  KPI « Production à temps »
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).
--
-- Note : le KPI « Takt Time » s'appuie désormais sur le Plan directeur de
-- production (table plan_production), où la demande est déjà représentée —
-- aucune table de demande séparée n'est nécessaire.
--
-- % de lots dont la fin de fabrication est <= à l'échéance visée.

alter table public.ordres_fabrication
  add column if not exists date_echeance date;

comment on column public.ordres_fabrication.date_echeance is
  'Échéance de livraison visée (date cible). Sert au KPI « Production à temps ».';
