-- Migration 003 : activer les KPI « N/A » restants du Tableau de bord.
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

-- =====================================================================
-- Taux de retouche  →  unités retouchées, au même grain que les rebuts
-- =====================================================================
alter table public.trs_postes
  add column if not exists retouches numeric not null default 0;
comment on column public.trs_postes.retouches is
  'Nombre d''unités retouchées (reprises). Sert au KPI « Taux de retouche ».';

-- Notes — les autres KPI réutilisent des données déjà présentes, sans nouvelle
-- table ni colonne :
--  • « Taux d'utilisation capacité » : jours ouvrés × régime de travail (page
--    Suivi de capacité des équipements).
--  • « Coût de production / unité » : PCSU du référentiel produit (produits.pcsu).
--  • « Production à temps » : échéance = fin du mois de lancement de l'OF (PDP).
--  • « Équilibrage de ligne » : équilibre du flux entre phases, calculé depuis
--    les cadences (cadences_produit) — aucune table postes_ligne nécessaire.
--
-- Si une table public.postes_ligne a été créée par une version précédente de
-- cette migration, elle n'est plus utilisée (vous pouvez la supprimer) :
--   drop table if exists public.postes_ligne;
