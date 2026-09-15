FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --frozen-lockfile

COPY packages/contract packages/contract
COPY apps/frontend apps/frontend
RUN pnpm --filter @agentscope/frontend... build

FROM nginx:1.29-alpine AS runtime

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
