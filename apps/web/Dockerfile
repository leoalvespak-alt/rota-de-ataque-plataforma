FROM node:22.18-alpine AS builder
RUN corepack enable
WORKDIR /app
ARG NEXT_PUBLIC_BASE_PATH=/prospector
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
COPY . .
RUN pnpm check:runtime-deps
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @plataforma/shared build \
  && pnpm --filter @plataforma/ui-bridge build \
  && NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072 pnpm --filter @plataforma/web build

FROM node:22.18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
