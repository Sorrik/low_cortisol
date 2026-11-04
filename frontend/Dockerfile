# frontend/Dockerfile
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# Копируем ВСЕ package.json до install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/contract/package.json ./packages/contract/
COPY frontend/package.json ./frontend/

# Теперь pnpm знает о frontend и ставит его зависимости
RUN pnpm install --frozen-lockfile

# Копируем код
COPY packages/contract ./packages/contract
COPY frontend ./frontend

# dist пакета contract не хранится в git
RUN pnpm --filter @lowcor/contract build

WORKDIR /app/frontend

EXPOSE 3000

CMD ["pnpm", "dev"]