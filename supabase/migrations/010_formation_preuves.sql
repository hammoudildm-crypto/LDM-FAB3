-- Migration 010 : preuve (évidence) de formation jointe à chaque enregistrement.
-- Une preuve par enregistrement de formation : photo ou PDF, stocké en data URL
-- base64 (les images sont compressées côté navigateur avant envoi).
-- Table séparée pour NE PAS alourdir les requêtes de la matrice/enregistrements
-- (qui chargent tout en select *) : la donnée n'est lue qu'à l'ouverture d'une preuve.
-- À exécuter dans le SQL Editor de Supabase (ou via la CLI : supabase db push).

create table if not exists public.formation_preuves (
  id                bigserial primary key,
  enregistrement_id bigint not null references public.formation_enregistrements(id) on delete cascade,
  nom               text,                                   -- nom de fichier d'origine
  mime              text,                                   -- image/jpeg, application/pdf…
  data              text not null,                          -- contenu en data URL base64
  taille            integer,                                -- taille indicative (caractères base64)
  created_at        timestamptz not null default now(),
  unique (enregistrement_id)                                -- une preuve par enregistrement (remplaçable)
);

create index if not exists idx_formation_preuves_enr on public.formation_preuves(enregistrement_id);
comment on table public.formation_preuves is 'Preuve/évidence de formation (photo ou PDF en base64) rattachée à un enregistrement de formation. Une preuve par enregistrement.';

-- RLS (convention du projet : RLS activé + 4 policies to authenticated)
alter table public.formation_preuves enable row level security;
create policy "form preuves sel" on public.formation_preuves for select to authenticated using (true);
create policy "form preuves ins" on public.formation_preuves for insert to authenticated with check (true);
create policy "form preuves upd" on public.formation_preuves for update to authenticated using (true);
create policy "form preuves del" on public.formation_preuves for delete to authenticated using (true);
