# frontend/Dockerfile
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

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

WORKDIR /app/frontend

EXPOSE 3000

CMD ["pnpm", "dev"]