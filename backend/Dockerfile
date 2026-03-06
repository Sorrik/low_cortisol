# backend/Dockerfile
FROM node:22-alpine

# Включаем pnpm (встроено в Node 22+)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Копируем файлы монорепо (чтобы pnpm увидел workspace)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contract/package.json ./packages/contract/
COPY backend/package.json ./backend/

# Устанавливаем все зависимости
RUN pnpm install --frozen-lockfile

# Копируем весь код
COPY packages/contract ./packages/contract
COPY backend ./backend

# Собираем пакет contract (генерирует JS из TS)
RUN pnpm --filter @lowcor/contract build

# Работаем внутри backend папки
WORKDIR /app/backend

EXPOSE 3000

# Запуск в development режиме
CMD ["pnpm", "start:dev"]