# Image untuk API. Frontend di-serve terpisah oleh nginx (lihat deploy/nginx.conf)
# karena hasil build-nya statis.
#
# Catatan: API memakai `node_modules` di root repo (Express, Prisma, JWT, dsb.
# tercatat di package.json root), jadi build dan runtime sama-sama dari root.

# --- Stage 1: build ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server
RUN npx prisma generate --schema server/prisma/schema.prisma \
  && npm run build:api

# --- Stage 2: runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Client Prisma hasil generate dan CLI `prisma` (devDependency) tidak ikut
# `npm ci --omit=dev`, padahal keduanya dibutuhkan saat start: client untuk
# query, CLI untuk `migrate deploy`.
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/server/dist ./server/dist
COPY server/prisma ./server/prisma

# `migrate deploy` aman diulang: migrasi yang sudah tercatat tidak dijalankan lagi.
CMD ["sh", "-c", "npx prisma migrate deploy --schema server/prisma/schema.prisma && node server/dist/server.js"]
