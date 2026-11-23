-- Skema Warkop POS untuk Supabase PostgreSQL.
-- Jalankan seluruh file ini di SQL Editor Supabase.
-- Frontend hanya boleh memakai anon key, bukan service_role key.

create extension if not exists pgcrypto;

-- Trigger sinkronisasi:
-- 1) Last-write-wins: tulis ulang dari klien yang lebih lama (updated_at lebih kecil) diabaikan.
-- 2) updated_at dari klien dipertahankan (maksimal 5 menit ke depan agar jam salah tidak "menang" selamanya).
-- 3) synced_at selalu diisi server dan dipakai klien sebagai cursor tarik data,
--    sehingga baris yang dibuat offline berjam-jam lalu tetap terambil perangkat lain.
create or replace function public.set_sync_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.updated_at is null then
    new.updated_at = now();
  end if;
  new.updated_at = least(new.updated_at, now() + interval '5 minutes');
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at = now();
  return new;
end;
$$;

create table if not exists public.products (
  id uuid primary key,
  name text not null,
  price bigint not null check (price >= 0),
  cost bigint not null default 0 check (cost >= 0),
  image_url text,
  category text not null default 'Umum',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.transactions (
  id uuid primary key,
  day date not null,
  created_at timestamptz not null default now(),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total bigint not null check (total >= 0),
  pay text not null check (pay in ('tunai', 'qris')),
  received bigint not null default 0 check (received >= 0),
  change bigint not null default 0 check (change >= 0),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key,
  date date not null,
  category text not null default 'Lainnya',
  amount bigint not null check (amount > 0),
  note text not null default '',
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Migrasi untuk database yang sudah dibuat dengan versi lama (aman dijalankan ulang).
alter table public.products add column if not exists synced_at timestamptz not null default now();
alter table public.transactions add column if not exists synced_at timestamptz not null default now();
alter table public.expenses add column if not exists synced_at timestamptz not null default now();
alter table public.products alter column price type bigint;
alter table public.products add column if not exists cost bigint not null default 0 check (cost >= 0);
alter table public.products add column if not exists image_url text;
alter table public.transactions alter column total type bigint;
alter table public.transactions alter column received type bigint;
alter table public.transactions alter column change type bigint;
alter table public.expenses alter column amount type bigint;

create index if not exists idx_products_synced_at on public.products (synced_at);
create index if not exists idx_transactions_synced_at on public.transactions (synced_at);
create index if not exists idx_expenses_synced_at on public.expenses (synced_at);

create index if not exists idx_transactions_day on public.transactions (day);
create index if not exists idx_expenses_date on public.expenses (date);
create index if not exists idx_products_deleted_at on public.products (deleted_at);

drop trigger if exists trg_products_updated_at on public.products;
drop trigger if exists trg_products_sync on public.products;
create trigger trg_products_sync
before insert or update on public.products
for each row execute function public.set_sync_columns();

drop trigger if exists trg_transactions_updated_at on public.transactions;
drop trigger if exists trg_transactions_sync on public.transactions;
create trigger trg_transactions_sync
before insert or update on public.transactions
for each row execute function public.set_sync_columns();

drop trigger if exists trg_expenses_updated_at on public.expenses;
drop trigger if exists trg_expenses_sync on public.expenses;
create trigger trg_expenses_sync
before insert or update on public.expenses
for each row execute function public.set_sync_columns();

alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;

revoke all on public.products from anon;
revoke all on public.transactions from anon;
revoke all on public.expenses from anon;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;

drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated
on public.products for select
to authenticated
using (true);

drop policy if exists products_insert_authenticated on public.products;
create policy products_insert_authenticated
on public.products for insert
to authenticated
with check (true);

drop policy if exists products_update_authenticated on public.products;
create policy products_update_authenticated
on public.products for update
to authenticated
using (true)
with check (true);

drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated
on public.products for delete
to authenticated
using (true);

drop policy if exists transactions_select_authenticated on public.transactions;
create policy transactions_select_authenticated
on public.transactions for select
to authenticated
using (true);

drop policy if exists transactions_insert_authenticated on public.transactions;
create policy transactions_insert_authenticated
on public.transactions for insert
to authenticated
with check (true);

drop policy if exists transactions_update_authenticated on public.transactions;
create policy transactions_update_authenticated
on public.transactions for update
to authenticated
using (true)
with check (true);

drop policy if exists transactions_delete_authenticated on public.transactions;
create policy transactions_delete_authenticated
on public.transactions for delete
to authenticated
using (true);

drop policy if exists expenses_select_authenticated on public.expenses;
create policy expenses_select_authenticated
on public.expenses for select
to authenticated
using (true);

drop policy if exists expenses_insert_authenticated on public.expenses;
create policy expenses_insert_authenticated
on public.expenses for insert
to authenticated
with check (true);

drop policy if exists expenses_update_authenticated on public.expenses;
create policy expenses_update_authenticated
on public.expenses for update
to authenticated
using (true)
with check (true);

drop policy if exists expenses_delete_authenticated on public.expenses;
create policy expenses_delete_authenticated
on public.expenses for delete
to authenticated
using (true);

-- Fungsi lama (versi sebelumnya) sudah tidak dipakai.
drop function if exists public.set_updated_at();
