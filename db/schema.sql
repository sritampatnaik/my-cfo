create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  bank text,
  filename text not null,
  object_key text not null unique,
  uploaded_at timestamptz not null default now(),
  status text not null default 'uploaded',
  period_year smallint,
  period_month smallint
);

alter table statements add column if not exists period_year smallint;
alter table statements add column if not exists period_month smallint;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references statements (id) on delete cascade,
  posted_on date not null,
  description text not null,
  amount numeric(14, 2) not null,
  currency text not null default 'SGD',
  kind text,
  jev_confidence numeric(6, 4),
  created_at timestamptz not null default now()
);

create index if not exists transactions_posted_on_idx on transactions (posted_on);
create index if not exists transactions_statement_id_idx on transactions (statement_id);

alter table statements add column if not exists booked_at timestamptz;

alter table transactions add column if not exists status text not null default 'draft';
alter table transactions add column if not exists booked_at timestamptz;
alter table transactions add column if not exists entry_type text not null default 'original';
alter table transactions add column if not exists adjusts_id uuid references transactions (id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_status_check') then
    alter table transactions add constraint transactions_status_check
      check (status in ('draft', 'booked'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'transactions_entry_type_check') then
    alter table transactions add constraint transactions_entry_type_check
      check (entry_type in ('original', 'reversal', 'adjustment'));
  end if;
end $$;

create index if not exists transactions_adjusts_id_idx on transactions (adjusts_id);

-- Booked entries are immutable: corrections must be posted as new reversal/adjustment rows.
create or replace function prevent_booked_transaction_change() returns trigger as $$
begin
  if old.status = 'booked' then
    raise exception 'Booked transactions cannot be changed or deleted'
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$ language plpgsql;

drop trigger if exists transactions_booked_immutable on transactions;
create trigger transactions_booked_immutable
  before update or delete on transactions
  for each row execute function prevent_booked_transaction_change();
