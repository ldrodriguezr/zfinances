# Ejecutar desde la raíz del proyecto: .\scripts\setup-vercel-env.ps1
# Requiere: npm i -g vercel y estar logueado (vercel login)

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "No existe .env.local" -ForegroundColor Red
    exit 1
}

$lines = Get-Content $envFile | Where-Object { $_ -match "^[A-Z]" -and $_ -notmatch "^#" }
foreach ($line in $lines) {
    if ($line -match "^([^=]+)=(.*)$") {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Write-Host "Agregando $name a Vercel (production)..." -ForegroundColor Cyan
        $value | vercel env add $name production --force 2>&1
    }
}
Write-Host "Listo. Haz Redeploy en Vercel." -ForegroundColor Green
