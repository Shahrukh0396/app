FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile --filter @scanflow/api...
ENV DATABASE_URL=postgresql://scanflow:scanflow@localhost:5432/scanflow
RUN pnpm --filter @scanflow/types build \
  && pnpm --filter @scanflow/api exec prisma generate \
  && pnpm --filter @scanflow/api build
RUN pnpm --filter @scanflow/api deploy --prod --legacy /out

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
