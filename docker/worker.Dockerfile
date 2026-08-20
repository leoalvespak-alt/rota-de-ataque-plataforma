FROM node:22.18-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm check:runtime-deps
RUN pnpm install --frozen-lockfile --filter "{./workers/**}..."
RUN pnpm -r --filter "{./workers/**}..." --if-present build
RUN chmod 755 /app/docker/worker-entrypoint.sh
ENV NODE_ENV=production
CMD ["node", "--version"]
