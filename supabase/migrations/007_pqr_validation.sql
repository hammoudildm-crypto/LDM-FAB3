-- Migration 007 : Protocole de validation des procédés de fabrication (module PQR)
-- Un protocole de validation par produit + ses lots de validation (généralement 3 lots consécutifs).
-- À exécuter dans le SQL Editor de Supabase.

create table if not exists public.pqr_validation_protocoles (
  id             bigserial primary key,
  produit_id     bigint not null,
  reference      text,
  approche       text,                                 -- prospective / concurrente / retrospective
  nature         text,                                 -- initiale / revalidation / transfert
  nb_lots        integer not null default 3,
  portee         text,
  criteres       text,
  responsable    text,
  statut         text not null default 'brouillon',    -- brouillon / en_cours / valide / cloture
  date_protocole date,
  conclusion     text,
  actif          boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (produit_id)
);

create table if not exists public.pqr_validation_lots (
  id               bigserial primary key,
  protocole_id     bigint not null references public.pqr_validation_protocoles(id) on delete cascade,
  numero_lot       text,
  taille_lot       numeric,
  date_fabrication date,
  statut           text not null default 'prevu',      -- prevu / en_cours / conforme / non_conforme
  ecarts           text,
  ordre            integer not null default 0
);

create index if not exists idx_pqr_val_lots_protocole on public.pqr_validation_lots(protocole_id);

comment on table public.pqr_validation_protocoles is 'Protocole de validation des procédés de fabrication (PQR), un par produit.';
comment on table public.pqr_validation_lots is 'Lots de validation rattachés à un protocole (3 lots consécutifs typiquement).';
