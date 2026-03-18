# ZenFinance — Algoritmo de extracción Gmail (seguro)

## Objetivo
Dado un correo bancario “ruidoso”, extraer:
- `occurredAt` (fecha de la operación)
- `currency` y `amount`
- `externalReference` (folio/referencia/autorización)
- `merchant` (comercio/beneficiario)
- `fxRate` (si el correo lo incluye)

## Estrategia (2 fases)
1. **Normalización**: HTML -> texto (strip de `script/style`, convertir tags a saltos de línea, decodificar entidades básicas), luego whitespace cleanup.
2. **Heurísticas determinísticas + regex defensiva**:
   - Fecha: ISO `YYYY-MM-DD` primero, luego `DD/MM/YYYY` o `DD-MM-YYYY`; fallback por keywords.
   - Moneda: buscar `CRC|USD|COL` o símbolos `₡` / `US$`.
   - Monto: encontrar candidatos numéricos cercanos a keywords como `TOTAL|MONTO|IMPORTE|AMOUNT|NETO`; parsear separadores decimal/miles de forma robusta.
   - Referencia: keyword-driven (`REFERENCIA|REF\.?|FOLIO|AUTORIZACIÓN|TICKET|COMPROBANTE|N° DE TRANSACCION`) + captura `A-Z0-9` y `-`.
   - Comercios: buscar keywords (`COMERCIO|BENEFICIARIO|RECEPTOR|ORDENANTE|EMISOR|DESCRIPCIÓN`) y capturar ventana corta alrededor; fallback por “mejor línea” con letras y sin dígitos al inicio.

## Regex núcleo (referencia)
### Fecha ISO
`\\b(\\d{4}-\\d{2}-\\d{2})\\b`

### Fecha D/M/Y
`\\b(0?[1-9]|[12]\\d|3[01])[-/](0?[1-9]|1[0-2])[-/](\\d{2,4})\\b`

### Referencia
`\\b(?:REFERENCIA|REF\\.?|FOLIO|AUTORIZACI[ÓO]N|TICKET|COMPROBANTE|N[°o]\\s*DE\\s*TRANSACCION)\\s*[:\\-]?\\s*\\b([A-Z0-9][A-Z0-9\\-]{5,})\\b`

### FX (si existe)
`(?:TIPO\\s*DE\\s*CAMBIO|TC|FX)\\s*[:\\-]?\\s*\\b([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,8})|[0-9]+(?:[.,][0-9]{1,8})?)\\b`

## Idempotencia
Se calcula `idempotency_key = sha256(userId | gmailMessageId | occurredAt | amount | currency | externalReference)`
para evitar duplicados durante ingesta.

