# Stage 1: Base
FROM node:18-alpine AS base
WORKDIR /app
# Install libc6-compat if needed for some native deps (optional but recommended for max compatibility)
RUN apk add --no-cache libc6-compat

# Stage 2: Dependencies (For Build & Dev)
FROM base AS deps
COPY package.json package-lock.json ./
# Install all dependencies (including devDependencies)
RUN npm ci

# Stage 3: Development
# Target this stage for local development: docker build --target dev -t my-app-dev .
FROM deps AS dev
COPY . .
EXPOSE 4000
# Ensure you mount your volume in docker-compose for hot reload to work efficiently
CMD ["npm", "run", "dev"]

# Stage 4: Builder
FROM deps AS builder
COPY . .
# Build the TypeScript project
RUN npm run build

# Stage 5: Production Dependencies
# Re-install only production dependencies to keep image size small
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

# Stage 6: Production Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy only necessary files
COPY --from=prod-deps --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER expressjs

EXPOSE 4000

CMD ["npm", "start"]
