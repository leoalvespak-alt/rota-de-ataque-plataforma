FROM node:22.18-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
CMD ["node", "--version"]
