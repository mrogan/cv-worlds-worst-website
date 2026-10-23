# The shop's image: the server, its files and the catalogue database, which is built here and never written again.
#
#     docker build --build-arg GIT_COMMIT=$(git rev-parse HEAD) .

FROM node:24.22.0-alpine3.24@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
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

FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:59c479c9b8c123e66047315c968aa2d35e31ae5149c856e4110a79c8b3563f0b
COPY --from=build /app /app
WORKDIR /app
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["--import", "./src/telemetry.ts", "src/server.ts"]
