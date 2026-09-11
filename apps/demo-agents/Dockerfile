FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/package.json
COPY packages/emitter/package.json packages/emitter/package.json
COPY apps/demo-agents/package.json apps/demo-agents/package.json
RUN pnpm install --frozen-lockfile --filter @agentscope/demo-agents...
COPY packages/contract packages/contract
COPY packages/emitter packages/emitter
COPY apps/demo-agents apps/demo-agents
RUN pnpm --filter @agentscope/demo-agents... build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/demo-agents ./apps/demo-agents
EXPOSE 3002
CMD ["node", "apps/demo-agents/dist/server-main.js"]
