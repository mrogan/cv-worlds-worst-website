# The shop's image: the server, its files and the catalogue database, which is built here and never written again.
#
#     docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) .

FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS build
WORKDIR /app
# pnpm at the version (and hash) pinned in package.json's packageManager field.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# No scripts: the only one is `prepare`, which installs git hooks.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY src src
COPY public public
COPY scripts/seed.ts scripts/
COPY data/catalogue.json data/
RUN node scripts/seed.ts
# Readable by the unprivileged runtime user, and by nobody's writes.
RUN chmod -R a+rX,go-w /app

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e
COPY --from=build /app /app
WORKDIR /app
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["--import", "./src/telemetry.ts", "src/server.ts"]
