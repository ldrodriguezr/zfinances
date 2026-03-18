# ZenFinance — Arquitectura base (5 pilares)

## Diagrama de Bloques

```mermaid
flowchart LR
  UI[Frontend Next.js (App Router, shadcn)] -->|Renders + Server Actions| API[Serverless Routes / API]

  subgraph Jobs[Vercel Cron (Free tier)]
    DAILY[Cron diario] --> GMAIL_RUN[Gmail Ingestion Runner]
    MONTH_END[Cron diario (filtra último día)] --> CLOSE[Month-End Closing + Sweep]
    MONTH_END --> NETW[Net Worth Snapshot + Depreciation]
  end

  GMAIL_RUN --> PARSE[HTML->Text + Regex extractor]
  PARSE --> DB[Supabase Postgres (schema personal_finance)]

  API --> DB
  CLOSE --> DB
  NETW --> DB

  DB --> LEDGER[Ledger Engine (double-entry)]
```

## Data flow (resumen)
1. Cron invoca endpoints serverless.
2. Ingesta Gmail: OAuth2 -> listar mensajes -> parsear (HTML->texto + regex) -> guardar `gmail_messages` y `external_transactions`.
3. Posting contable: el engine del ledger crea `transactions` + `transaction_entries` validando balance.
4. Budget/Sweep/Net Worth operan sobre hechos (`transactions.amount_home`, `flow_type`) y snapshots mensuales.

