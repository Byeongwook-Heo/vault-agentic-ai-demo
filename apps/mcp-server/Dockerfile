# syntax=docker/dockerfile:1.7
FROM public.ecr.aws/docker/library/node:22.23.1-bookworm-slim AS dependencies
WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && curl --fail --silent --show-error --location \
      https://truststore.pki.rds.amazonaws.com/ap-northeast-2/ap-northeast-2-bundle.pem \
      --output /tmp/rds-ca.pem \
    && openssl crl2pkcs7 -nocrl -certfile /tmp/rds-ca.pem \
      | openssl pkcs7 -print_certs -noout >/dev/null \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/mcp-server/package.json apps/mcp-server/package.json
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

FROM dependencies AS build
COPY eslint.config.mjs ./
COPY apps/mcp-server apps/mcp-server
RUN npm run build --workspace=@bob-vault-nhi-demo/mcp-server \
    && npm prune --omit=dev --ignore-scripts

FROM public.ecr.aws/docker/library/node:22.23.1-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /nonexistent app
COPY --from=build --chown=app:app /workspace/node_modules ./node_modules
COPY --from=build --chown=app:app /workspace/apps/mcp-server/dist ./dist
COPY --from=build --chown=app:app /workspace/apps/mcp-server/public ./public
COPY --from=build --chown=app:app /tmp/rds-ca.pem ./certs/rds-ca.pem
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/src/server.js"]
