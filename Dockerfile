FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 ekuiper-manager \
    && useradd --system --uid 1001 --gid ekuiper-manager ekuiper-manager \
    && mkdir -p /var/lib/ekuiper-manager \
    && chown -R ekuiper-manager:ekuiper-manager /var/lib/ekuiper-manager

COPY --from=build --chown=ekuiper-manager:ekuiper-manager /app/.next/standalone ./
COPY --from=build --chown=ekuiper-manager:ekuiper-manager /app/.next/static ./.next/static
COPY --from=build --chown=ekuiper-manager:ekuiper-manager /app/public ./public
COPY --from=build --chown=ekuiper-manager:ekuiper-manager /app/database ./database
COPY --from=build --chown=ekuiper-manager:ekuiper-manager /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --chown=ekuiper-manager:ekuiper-manager docker-entrypoint.sh /usr/local/bin/ekuiper-manager-entrypoint
RUN chmod 755 /usr/local/bin/ekuiper-manager-entrypoint

USER ekuiper-manager
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/ekuiper-manager-entrypoint"]
CMD ["node", "server.js"]
