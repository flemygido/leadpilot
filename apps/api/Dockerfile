FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/db/package*.json packages/db/
COPY packages/core/package*.json packages/core/
RUN npm install --workspace=apps/api --workspace=packages/db --workspace=packages/core

# Generate Prisma client
COPY packages/db/prisma packages/db/prisma
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Copy source
COPY apps/api apps/api
COPY packages/db packages/db
COPY packages/core packages/core
COPY tsconfig.base.json .

# Build
RUN npm run build --workspace=apps/api

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
