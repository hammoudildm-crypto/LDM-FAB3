-- Migration 006 : deux emplacements de stock par consommable.
--   Stock MP  = magasin matières premières (réceptions)
--   Stock Fab = au niveau fabrication (point de consommation)
-- Flux : réception → Stock MP → transfert → Fabrication → consommation (sortie).
-- Seuils d'alerte et couverture gérés séparément par emplacement.
-- À exécuter dans le SQL Editor de Supabase après la 005.

-- 1) Colonnes de stock et de seuil par emplacement
alter table public.consommables
  add column if not exists stock_mp   numeric not null default 0,
  add column if not exists stock_fab  numeric not null default 0,
  add column if not exists seuil_mp   numeric not null default 0,
  add column if not exists seuil_fab  numeric not null default 0;

-- 2) Reprise de l'existant : l'ancien stock unique correspond au point de
--    consommation (fabrication). On le bascule vers stock_fab / seuil_fab.
--    (À ajuster manuellement si une partie se trouvait en réalité au magasin MP.)
update public.consommables
  set stock_fab = coalesce(stock_actuel, 0)
  where stock_fab = 0 and coalesce(stock_actuel, 0) <> 0;
update public.consommables
  set seuil_fab = coalesce(seuil_alerte, 0)
  where seuil_fab = 0 and coalesce(seuil_alerte, 0) <> 0;

comment on column public.consommables.stock_mp  is 'Stock au magasin matières premières (MP).';
comment on column public.consommables.stock_fab is 'Stock au niveau fabrication (point de consommation).';
comment on column public.consommables.seuil_mp  is 'Seuil d''alerte du stock MP.';
comment on column public.consommables.seuil_fab is 'Seuil d''alerte du stock fabrication.';

-- 3) Emplacement sur les mouvements + autorisation du type « transfert »
alter table public.mouvements_consommables
  add column if not exists emplacement text not null default 'fab';
-- Reprise : les anciennes sorties/entrées concernaient la fabrication.
update public.mouvements_consommables set emplacement = 'fab' where emplacement is null;

alter table public.mouvements_consommables drop constraint if exists mouvements_consommables_type_check;
alter table public.mouvements_consommables
  add constraint mouvements_consommables_type_check
  check (type in ('entree','sortie','ajustement','transfert'));

comment on column public.mouvements_consommables.emplacement is
  'Emplacement concerné : mp (magasin MP) ou fab (fabrication). Pour un transfert, destination = fab.';
