-- ZenFinance: esquema relacional base (5 pilares)
-- Ejecutable contra Supabase Postgres en schema `personal_finance`.

create extension if not exists pgcrypto;

create schema if not exists personal_finance;

-- =========================
-- 1) ENUMS
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type personal_finance.account_type as enum ('LIQUIDITY','CREDIT');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type personal_finance.transaction_status as enum ('PENDING','PROCESSED','CONCILIATED','REJECTED');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_source_type') then
    create type personal_finance.transaction_source_type as enum ('MANUAL','GMAIL','P2P','SWEEP');
  end if;

  if not exists (select 1 from pg_type where typname = 'entry_side') then
    create type personal_finance.entry_side as enum ('DEBIT','CREDIT');
  end if;

  if not exists (select 1 from pg_type where typname = 'external_txn_status') then
    create type personal_finance.external_txn_status as enum ('NEW','PARSED','MATCHED','IGNORED','ERROR');
  end if;

  if not exists (select 1 from pg_type where typname = 'debt_type') then
    create type personal_finance.debt_type as enum ('REVOLVING','INSTALLMENT');
  end if;

  if not exists (select 1 from pg_type where typname = 'debt_strategy') then
    create type personal_finance.debt_strategy as enum ('SNOWBALL','AVALANCHE');
  end if;

  if not exists (select 1 from pg_type where typname = 'transaction_flow_type') then
    create type personal_finance.transaction_flow_type as enum ('INCOME','EXPENSE','TRANSFER');
  end if;
end $$;

-- =========================
-- 2) LIMPIEZA (from_scratch)
-- =========================
-- Nota: esto es destructivo. Útil para crear desde cero.
drop table if exists personal_finance.transaction_entries cascade;
drop table if exists personal_finance.reconciliations cascade;
drop table if exists personal_finance.gmail_messages cascade;
drop table if exists personal_finance.gmail_connections cascade;
drop table if exists personal_finance.external_transactions cascade;
drop table if exists personal_finance.transaction_entries_balance cascade;
drop table if exists personal_finance.transactions cascade;
drop table if exists personal_finance.budget_alerts cascade;
drop table if exists personal_finance.sinking_funds cascade;
drop table if exists personal_finance.sinking_fund_contributions cascade;
drop table if exists personal_finance.budget_lines cascade;
drop table if exists personal_finance.monthly_budgets cascade;
drop table if exists personal_finance.debt_amortization_runs cascade;
drop table if exists personal_finance.debt_extra_payments cascade;
drop table if exists personal_finance.debt_promotions cascade;
drop table if exists personal_finance.debts cascade;
drop table if exists personal_finance.asset_valuation_snapshots cascade;
drop table if exists personal_finance.subscriptions cascade;
drop table if exists personal_finance.subscription_transaction_matches cascade;
drop table if exists personal_finance.assets cascade;
drop table if exists personal_finance.net_worth_snapshots cascade;
drop table if exists personal_finance.sweep_debt_payments cascade;
drop table if exists personal_finance.month_end_closings cascade;
drop table if exists personal_finance.sweep_rules cascade;
drop table if exists personal_finance.fx_rates cascade;
drop table if exists personal_finance.categories cascade;
drop table if exists personal_finance.currencies cascade;
drop table if exists personal_finance.accounts cascade;
drop table if exists personal_finance.user_settings cascade;

-- =========================
-- 3) TABLAS CORE
-- =========================

-- 3.1 User settings
create table personal_finance.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_currency char(3) not null default 'CRC',
  debt_strategy personal_finance.debt_strategy not null default 'AVALANCHE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table personal_finance.user_settings enable row level security;
create policy "user_settings_is_owner"
on personal_finance.user_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 3.2 Accounts (liquidez y crédito)
create table personal_finance.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  name text not null,
  account_type personal_finance.account_type not null,
  currency char(3) not null,
  credit_limit numeric(20,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table personal_finance.accounts enable row level security;
create policy "accounts_owner_select"
on personal_finance.accounts
for select using (user_id = auth.uid());
create policy "accounts_owner_insert"
on personal_finance.accounts
for insert with check (user_id = auth.uid());
create policy "accounts_owner_update"
on personal_finance.accounts
for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts_owner_delete"
on personal_finance.accounts
for delete using (user_id = auth.uid());

-- 3.3 Currencies (catálogo)
create table personal_finance.currencies (
  code char(3) primary key,
  name text
);

-- No RLS para catálogo global (puedes habilitarlo si quieres multitenant real).

-- 3.4 FX rates (por fecha, exacto)
create table personal_finance.fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  base_currency char(3) not null,
  quote_currency char(3) not null,
  rate_date date not null,
  rate numeric(20,10) not null,
  source text not null default 'ECB',
  created_at timestamptz not null default now(),
  unique (user_id, base_currency, quote_currency, rate_date),
  constraint fx_rate_positive check (rate > 0)
);

alter table personal_finance.fx_rates enable row level security;
create policy "fx_rates_owner"
on personal_finance.fx_rates
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3.5 Categories (Category > Subcategory > Tag)
create table personal_finance.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  name text not null,
  level smallint not null,
  parent_category_id uuid references personal_finance.categories(id) on delete cascade,
  category_kind text not null default 'EXPENSE', -- extensible: INCOME/EXPENSE/TRANSFER
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, level, parent_category_id, name),
  constraint categories_level_range check (level between 1 and 3),
  constraint categories_parent_null_if_level_1 check ((level = 1 and parent_category_id is null) or level > 1)
);

alter table personal_finance.categories enable row level security;
create policy "categories_owner"
on personal_finance.categories
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================
-- 4) Ledger Double-Entry (Flujo de Caja)
-- =========================

create table personal_finance.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  source_type personal_finance.transaction_source_type not null,
  occurred_at timestamptz not null,
  description text,
  merchant text,
  external_reference text,
  source_message_id text,
  flow_type personal_finance.transaction_flow_type not null,

  -- Para que Budget/Sweep no dependan de sumar entradas duplicadas.
  amount_currency numeric(20,6) not null default 0,
  currency char(3) not null default 'CRC',
  fx_rate numeric(20,10) not null default 1,
  amount_home numeric(20,6) not null default 0,

  -- Taxonomía opcional
  category_level1_id uuid references personal_finance.categories(id) on delete set null,
  category_level2_id uuid references personal_finance.categories(id) on delete set null,
  tag_level3_id uuid references personal_finance.categories(id) on delete set null,

  status personal_finance.transaction_status not null default 'PROCESSED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, external_reference)
);

alter table personal_finance.transactions enable row level security;
create policy "transactions_owner"
on personal_finance.transactions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.transaction_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  transaction_id uuid not null references personal_finance.transactions(id) on delete cascade,
  account_id uuid not null references personal_finance.accounts(id) on delete restrict,
  side personal_finance.entry_side not null,
  currency char(3) not null,
  amount numeric(20,6) not null,
  fx_rate numeric(20,10) not null,
  home_amount numeric(20,6) not null,
  entry_description text,
  created_at timestamptz not null default now(),
  constraint entry_amount_positive check (amount > 0),
  constraint entry_fx_rate_positive check (fx_rate > 0)
);

alter table personal_finance.transaction_entries enable row level security;
create policy "transaction_entries_owner"
on personal_finance.transaction_entries
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Balance constraint: Debits(home_amount) == Credits(home_amount)
create or replace function personal_finance.fn_assert_transaction_balanced(p_transaction_id uuid)
returns void
language plpgsql
as $$
declare
  home_debits numeric(20,6);
  home_credits numeric(20,6);
  diff numeric(20,6);
begin
  select coalesce(sum(home_amount),0)
    into home_debits
    from personal_finance.transaction_entries
   where transaction_id = p_transaction_id and side = 'DEBIT';

  select coalesce(sum(home_amount),0)
    into home_credits
    from personal_finance.transaction_entries
   where transaction_id = p_transaction_id and side = 'CREDIT';

  diff := home_debits - home_credits;

  if abs(diff) > 0.01 then
    raise exception 'Ledger not balanced for transaction_id=%: diff=%', p_transaction_id, diff;
  end if;
end;
$$;

create or replace function personal_finance.trg_transaction_entries_balance()
returns trigger
language plpgsql
as $$
begin
  perform personal_finance.fn_assert_transaction_balanced(coalesce(new.transaction_id, old.transaction_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists transaction_entries_balance on personal_finance.transaction_entries;
create trigger transaction_entries_balance
after insert or update or delete on personal_finance.transaction_entries
for each row execute function personal_finance.trg_transaction_entries_balance();

-- =========================
-- 5) Ingesta Gmail + Reconciliación
-- =========================

create table personal_finance.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  provider text not null default 'gmail',
  email_address text not null,
  refresh_token text not null,
  token_status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (user_id, email_address)
);

alter table personal_finance.gmail_connections enable row level security;
create policy "gmail_connections_owner"
on personal_finance.gmail_connections
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.gmail_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  received_at timestamptz,
  subject text,
  snippet text,
  extraction_status text not null default 'PENDING',
  extraction_error text,
  created_at timestamptz not null default now(),
  unique (user_id, gmail_message_id)
);

alter table personal_finance.gmail_messages enable row level security;
create policy "gmail_messages_owner"
on personal_finance.gmail_messages
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.external_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  source_type text not null default 'GMAIL_BANKING',
  external_reference text not null,
  occurred_at timestamptz,
  currency char(3),
  amount numeric(20,6),
  merchant text,
  parse_confidence numeric(5,2),
  raw jsonb,
  status personal_finance.external_txn_status not null default 'PARSED',
  created_at timestamptz not null default now(),
  unique (user_id, external_reference)
);

alter table personal_finance.external_transactions enable row level security;
create policy "external_transactions_owner"
on personal_finance.external_transactions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  external_transaction_id uuid not null references personal_finance.external_transactions(id) on delete cascade,
  transaction_id uuid not null references personal_finance.transactions(id) on delete cascade,
  method text not null default 'auto',
  reconciled_at timestamptz not null default now(),
  unique (external_transaction_id)
);

alter table personal_finance.reconciliations enable row level security;
create policy "reconciliations_owner"
on personal_finance.reconciliations
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================
-- 6) Presupuestación Proactiva (ZBB + Sinking Funds + Alerts)
-- =========================

create table personal_finance.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  month_start date not null,
  currency char(3) not null default 'CRC',
  income_total_home numeric(20,6) not null default 0,
  available_home numeric(20,6) not null default 0,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start)
);

alter table personal_finance.monthly_budgets enable row level security;
create policy "monthly_budgets_owner"
on personal_finance.monthly_budgets
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references personal_finance.monthly_budgets(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  category_level1_id uuid not null references personal_finance.categories(id) on delete restrict,
  budget_amount_home numeric(20,6) not null,
  spent_amount_home numeric(20,6) not null default 0,
  execution_pct numeric(6,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (budget_id, category_level1_id)
);

alter table personal_finance.budget_lines enable row level security;
create policy "budget_lines_owner"
on personal_finance.budget_lines
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.sinking_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  name text not null,
  category_level1_id uuid references personal_finance.categories(id) on delete set null,
  annual_target_home numeric(20,6) not null,
  contribution_monthly_home numeric(20,6) not null,
  target_month int not null check (target_month between 1 and 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table personal_finance.sinking_funds enable row level security;
create policy "sinking_funds_owner"
on personal_finance.sinking_funds
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.sinking_fund_contributions (
  id uuid primary key default gen_random_uuid(),
  sinking_fund_id uuid not null references personal_finance.sinking_funds(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  month_start date not null,
  amount_home numeric(20,6) not null,
  created_at timestamptz not null default now(),
  unique (sinking_fund_id, month_start)
);

alter table personal_finance.sinking_fund_contributions enable row level security;
create policy "sinking_fund_contributions_owner"
on personal_finance.sinking_fund_contributions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  budget_id uuid not null references personal_finance.monthly_budgets(id) on delete cascade,
  category_level1_id uuid not null references personal_finance.categories(id) on delete restrict,
  threshold_pct smallint not null check (threshold_pct in (75,90,100)),
  triggered_at timestamptz not null default now(),
  unique (budget_id, category_level1_id, threshold_pct)
);

alter table personal_finance.budget_alerts enable row level security;
create policy "budget_alerts_owner"
on personal_finance.budget_alerts
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================
-- 7) Deudas Avanzado
-- =========================

create table personal_finance.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  debt_type personal_finance.debt_type not null,
  name text not null,
  currency char(3) not null,
  apr_annual numeric(6,4),
  min_payment_home numeric(20,6),
  current_balance_home numeric(20,6) not null default 0,
  is_active boolean not null default true,
  debt_account_id uuid references personal_finance.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table personal_finance.debts enable row level security;
create policy "debts_owner"
on personal_finance.debts
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.debt_promotions (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references personal_finance.debts(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  label text not null,
  promo_start_month date not null,
  promo_end_month date not null,
  promo_apr_annual numeric(6,4) not null default 0,
  created_at timestamptz not null default now(),
  unique (debt_id, label, promo_start_month)
);

alter table personal_finance.debt_promotions enable row level security;
create policy "debt_promotions_owner"
on personal_finance.debt_promotions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.debt_extra_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  debt_id uuid not null references personal_finance.debts(id) on delete cascade,
  payment_date timestamptz not null default now(),
  amount_home numeric(20,6) not null,
  source text not null default 'SWEEP',
  related_transaction_id uuid references personal_finance.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table personal_finance.debt_extra_payments enable row level security;
create policy "debt_extra_payments_owner"
on personal_finance.debt_extra_payments
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.debt_amortization_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  run_at timestamptz not null default now(),
  strategy personal_finance.debt_strategy not null,
  input jsonb not null,
  result jsonb not null
);

alter table personal_finance.debt_amortization_runs enable row level security;
create policy "debt_amortization_runs_owner"
on personal_finance.debt_amortization_runs
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================
-- 8) Patrimonio Neto (Assets + Depreciation + Snapshots + Subscriptions)
-- =========================

create table personal_finance.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  asset_type text not null,
  name text not null,
  currency char(3) not null,
  purchase_value numeric(20,6) not null,
  purchase_date date not null,
  depreciation_rate_annual numeric(8,4) not null default 0,
  residual_value_home numeric(20,6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table personal_finance.assets enable row level security;
create policy "assets_owner"
on personal_finance.assets
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.asset_valuation_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references personal_finance.assets(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  snapshot_date date not null,
  value_home numeric(20,6) not null,
  created_at timestamptz not null default now(),
  unique (asset_id, snapshot_date)
);

alter table personal_finance.asset_valuation_snapshots enable row level security;
create policy "asset_valuation_snapshots_owner"
on personal_finance.asset_valuation_snapshots
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  merchant_signature text not null,
  category_level1_id uuid references personal_finance.categories(id) on delete set null,
  recurring_amount_home numeric(20,6),
  start_date date not null,
  last_seen_at date,
  next_due_at date,
  interval_months int not null default 1,
  confidence numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, merchant_signature, start_date)
);

alter table personal_finance.subscriptions enable row level security;
create policy "subscriptions_owner"
on personal_finance.subscriptions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.subscription_transaction_matches (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references personal_finance.subscriptions(id) on delete cascade,
  transaction_id uuid not null references personal_finance.transactions(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  matched_at timestamptz not null default now(),
  unique (transaction_id)
);

alter table personal_finance.subscription_transaction_matches enable row level security;
create policy "subscription_transaction_matches_owner"
on personal_finance.subscription_transaction_matches
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  month_end date not null,
  assets_home_total numeric(20,6) not null,
  liabilities_home_total numeric(20,6) not null,
  net_worth_home_total numeric(20,6) not null,
  computed_at timestamptz not null default now(),
  unique (user_id, month_end)
);

alter table personal_finance.net_worth_snapshots enable row level security;
create policy "net_worth_snapshots_owner"
on personal_finance.net_worth_snapshots
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =========================
-- 9) Sweep-to-Debt
-- =========================

create table personal_finance.sweep_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  active boolean not null default true,
  percent_of_surplus numeric(5,2) not null default 100,
  created_at timestamptz not null default now()
);

alter table personal_finance.sweep_rules enable row level security;
create policy "sweep_rules_owner"
on personal_finance.sweep_rules
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.month_end_closings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  month_start date not null,
  month_end date not null,
  net_income_home numeric(20,6) not null,
  total_expenses_home numeric(20,6) not null,
  surplus_home numeric(20,6) not null,
  status text not null default 'CLOSED',
  computed_at timestamptz not null default now(),
  unique (user_id, month_end)
);

alter table personal_finance.month_end_closings enable row level security;
create policy "month_end_closings_owner"
on personal_finance.month_end_closings
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table personal_finance.sweep_debt_payments (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references personal_finance.month_end_closings(id) on delete cascade,
  user_id uuid not null references personal_finance.user_settings(user_id) on delete cascade,
  debt_id uuid not null references personal_finance.debts(id) on delete cascade,
  amount_home numeric(20,6) not null,
  generated_transaction_id uuid references personal_finance.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (closing_id, debt_id)
);

alter table personal_finance.sweep_debt_payments enable row level security;
create policy "sweep_debt_payments_owner"
on personal_finance.sweep_debt_payments
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

