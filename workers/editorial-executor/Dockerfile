FROM node:22.18-alpine

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /workspace

COPY . .
RUN pnpm install --frozen-lockfile --filter @plataforma/worker-editorial-executor...
RUN pnpm --filter @plataforma/shared build
RUN pnpm --filter @plataforma/worker-editorial-executor build

CMD ["pnpm", "--filter", "@plataforma/worker-editorial-executor", "start"]
