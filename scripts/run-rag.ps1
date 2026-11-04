param(
  [string]$ChromaUrl = ${env:CHROMA_URL},
  [string]$OpenAiBaseUrl = ${env:OPENAI_BASE_URL}
)

if (-not $env:OPENAI_API_KEY) {
  Write-Error "OPENAI_API_KEY не задан. Установите переменную окружения и повторите запуск."
  exit 1
}

if (-not $ChromaUrl) { $ChromaUrl = 'http://localhost:8001' }
if (-not $OpenAiBaseUrl) { $OpenAiBaseUrl = 'https://api.openai.com/v1' }

function Get-DockerComposeInfo {
  if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    return @{ exe = 'docker-compose'; args = @() }
  } elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    return @{ exe = 'docker'; args = @('compose') }
  }
  throw "Docker не найден в PATH"
}

try {
  $dcInfo = Get-DockerComposeInfo
} catch {
  Write-Error $_
  exit 1
}

Write-Host "-> Запускаю контейнеры: postgres, chromadb"
$cmdArgs = @()
if ($dcInfo.args) { $cmdArgs += $dcInfo.args }
$cmdArgs += 'up','-d','postgres','chromadb'
& $dcInfo.exe @cmdArgs

Write-Host "-> Ожидаю доступности ChromaDB на $ChromaUrl ..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Invoke-WebRequest -Uri $ChromaUrl -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $ready) {
  Write-Error "ChromaDB недоступен по $ChromaUrl"
  exit 1
}

Push-Location backend

if (-not (Test-Path node_modules)) {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "-> Устанавливаю зависимости через pnpm (workspace)..."
    pnpm install
  } else {
    Write-Host "-> Устанавливаю backend зависимости через npm..."
    npm install
  }
}

Write-Host "-> Запускаю seed: src/rag/seed/seed-pubmed.ts"
try {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm --filter backend exec ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts
  } else {
    npx ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts
  }
} catch {
  Write-Error "Ошибка при запуске seed: $_"
  Pop-Location
  exit 1
}

Pop-Location

Write-Host "✅ Seed завершён. RAG готов к использованию."
