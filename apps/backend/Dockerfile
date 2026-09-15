FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile

COPY packages/contract packages/contract
COPY apps/backend apps/backend
RUN pnpm --filter @agentscope/backend... build
RUN pnpm deploy --legacy --filter @agentscope/backend --prod /runtime

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=build /runtime ./

EXPOSE 3001
CMD ["node", "dist/main.js"]
