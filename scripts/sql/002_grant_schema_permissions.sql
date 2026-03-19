-- ZenFinance: Permisos para schema personal_finance
-- Ejecutar en Supabase SQL Editor DESPUÉS de 001_personal_finance_schema.sql
-- Soluciona: "permission denied for schema personal_finance"

-- 1) USAGE en el schema (permite ver que existe)
GRANT USAGE ON SCHEMA personal_finance TO anon;
GRANT USAGE ON SCHEMA personal_finance TO authenticated;
GRANT USAGE ON SCHEMA personal_finance TO service_role;

-- 2) Permisos en todas las tablas
GRANT ALL ON ALL TABLES IN SCHEMA personal_finance TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA personal_finance TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA personal_finance TO service_role;

-- 3) Permisos en secuencias (para defaults gen_random_uuid, etc.)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA personal_finance TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA personal_finance TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA personal_finance TO service_role;

-- 4) Permisos en tipos ENUM (usados por las tablas)
GRANT USAGE ON TYPE personal_finance.account_type TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.transaction_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.transaction_source_type TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.entry_side TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.external_txn_status TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.debt_type TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.debt_strategy TO anon, authenticated, service_role;
GRANT USAGE ON TYPE personal_finance.transaction_flow_type TO anon, authenticated, service_role;

-- 5) Default para futuras tablas creadas en el schema
ALTER DEFAULT PRIVILEGES IN SCHEMA personal_finance
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
