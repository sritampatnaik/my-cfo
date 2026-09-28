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
