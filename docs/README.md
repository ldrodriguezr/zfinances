# ZenFinance — módulos core (estado base)

## 1) Flujo de Caja / Ledger
- Ledger double-entry (`transactions` + `transaction_entries`)
- Multi-moneda con `fx_rates` por `rate_date`
- Validación de balance por trigger (debits == credits)

## 2) ZBB Presupuesto Proactivo
- `monthly_budgets` + `budget_lines`
- ejecución y alerts 75/90/100 (modelo de tabla base)

## 3) Deudas Avanzado
- `debts` (revolvente vs cuotas fijas), `debt_promotions` (tasa cero) y simulación base

## 4) Net Worth / Assets
- `assets` + depreciación lineal mensual y snapshots mensuales en `net_worth_snapshots`

## 5) Sweep-to-Debt
- cierre mensual por último día del mes (cron)
- calcula `surplus = income_home - expense_home`
- aplica regla `percent_of_surplus` y prioriza con Snowball/Avalanche

