#!/usr/bin/env bash
set -euo pipefail

: "${OPENAI_API_KEY:?Need to set OPENAI_API_KEY}"
CHROMA_URL="${CHROMA_URL:-http://localhost:8001}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}"

if command -v docker >/dev/null 2>&1; then
  DC_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC_CMD="docker-compose"
else
  echo "Docker not found in PATH" >&2
  exit 1
fi

echo "-> Starting containers: postgres, chromadb"
$DC_CMD up -d postgres chromadb

echo "-> Waiting for ChromaDB at $CHROMA_URL ..."
for i in $(seq 1 60); do
  if curl -fsS "$CHROMA_URL" >/dev/null 2>&1; then
    echo "Chroma ready"
    break
  fi
  sleep 1
done

if ! curl -fsS "$CHROMA_URL" >/dev/null 2>&1; then
  echo "ChromaDB did not start" >&2
  exit 1
fi

pushd backend >/dev/null

if [ ! -d node_modules ]; then
  if command -v pnpm >/dev/null 2>&1; then
    echo "-> Installing dependencies with pnpm..."
    pnpm install
  else
    echo "-> Installing backend dependencies with npm..."
    npm install
  fi
fi

echo "-> Running seed: src/rag/seed/seed-pubmed.ts"
if command -v pnpm >/dev/null 2>&1; then
  pnpm --filter backend exec ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts
else
  npx ts-node -r tsconfig-paths/register src/rag/seed/seed-pubmed.ts
fi

popd >/dev/null

echo "✅ Seed finished. RAG ready."
