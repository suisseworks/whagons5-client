# Build stage - Use Bun for faster installs and builds
FROM oven/bun:1.3.2 AS builder

WORKDIR /app

# Accept build arguments for environment variables
ARG FONTAWESOME_PACKAGE_TOKEN
ARG VITE_AG_GRID_LICENSE_KEY
ARG VITE_API_URL
ARG VITE_DEVELOPMENT=false
ARG VITE_DOMAIN
ARG VITE_CACHE_ENCRYPTION
ARG VITE_ALLOW_UNVERIFIED_LOGIN
ARG VITE_ALLOW_UNVERIFIED_EMAIL_REGEX

# Set environment variables for build
ENV FONTAWESOME_PACKAGE_TOKEN=$FONTAWESOME_PACKAGE_TOKEN
ENV VITE_AG_GRID_LICENSE_KEY=$VITE_AG_GRID_LICENSE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_DEVELOPMENT=$VITE_DEVELOPMENT
ENV VITE_DOMAIN=$VITE_DOMAIN
ENV VITE_CACHE_ENCRYPTION=$VITE_CACHE_ENCRYPTION
ENV VITE_ALLOW_UNVERIFIED_LOGIN=$VITE_ALLOW_UNVERIFIED_LOGIN
ENV VITE_ALLOW_UNVERIFIED_EMAIL_REGEX=$VITE_ALLOW_UNVERIFIED_EMAIL_REGEX

# Copy package files
COPY package.json bun.lockb* package-lock.json* pnpm-lock.yaml* ./

# Copy .npmrc if it exists (needed for FontAwesome auth)
COPY .npmrc* ./

# Install dependencies (Bun reads package-lock.json or creates bun.lockb)
# Bun respects .npmrc for registry authentication
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Production stage - Use Caddy for serving static files
FROM caddy:2.8-alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/caddy

# Copy Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Expose port (Railway/Coolify will set PORT env var)
EXPOSE 80

# Caddy automatically reads PORT env var
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

