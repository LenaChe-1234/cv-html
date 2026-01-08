# 1) Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# 2) Runtime stage
FROM ghcr.io/puppeteer/puppeteer:24.34.0
WORKDIR /app

# Copy app artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Copy BOTH package.json + package-lock.json
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json

# IMPORTANT: install deps into /app/node_modules as root, then drop privileges
USER root
RUN npm ci --omit=dev && npm cache clean --force

# Now run as non-root
USER pptruser

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]