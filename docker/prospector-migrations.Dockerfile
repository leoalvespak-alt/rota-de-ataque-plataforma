FROM node:22.18-alpine

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile --filter @plataforma/db...

COPY packages/shared packages/shared
COPY packages/db packages/db

CMD ["pnpm", "--filter", "@plataforma/db", "migrate"]
