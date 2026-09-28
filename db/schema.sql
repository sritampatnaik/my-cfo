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

-- One row per economic event with its current type: reversed entries and the reversals that cancel
-- them are dropped, leaving originals and the latest adjustment. Sums match the full ledger.
create or replace view effective_transactions as
select t.*
from transactions t
where t.entry_type <> 'reversal'
  and not exists (
    select 1 from transactions r where r.adjusts_id = t.id and r.entry_type = 'reversal'
  );

create table if not exists chats (
  id text primary key,
  title text not null default 'New chat',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_updated_at_idx on chats (updated_at desc);

create table if not exists chat_messages (
  id text primary key,
  chat_id text not null references chats (id) on delete cascade,
  position integer not null,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_id_idx on chat_messages (chat_id, position);
