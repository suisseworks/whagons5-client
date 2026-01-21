# Use latest Bun image (includes Node 20+ required by Firebase packages)
FROM oven/bun:latest

WORKDIR /app

# Accept build arguments for environment variables
ARG FONTAWESOME_PACKAGE_TOKEN
ARG BRYNTUM_USERNAME
ARG BRYNTUM_PASSWORD
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
# Note: BRYNTUM_USERNAME and BRYNTUM_PASSWORD are used in RUN commands, not set as ENV

# Copy package files
COPY package.json bun.lock* bun.lockb* package-lock.json* pnpm-lock.yaml* ./

# Create .npmrc from build args and install dependencies
RUN set -ex && \
    if [ -z "$FONTAWESOME_PACKAGE_TOKEN" ]; then \
      echo "ERROR: FONTAWESOME_PACKAGE_TOKEN is not set!" && exit 1; \
    fi && \
    if [ -z "$BRYNTUM_USERNAME" ] || [ -z "$BRYNTUM_PASSWORD" ]; then \
      echo "ERROR: BRYNTUM_USERNAME and BRYNTUM_PASSWORD must be set!" && exit 1; \
    fi && \
    BRYNTUM_AUTH=$(echo -n "$BRYNTUM_USERNAME:$BRYNTUM_PASSWORD" | base64) && \
    echo "@fortawesome:registry=https://npm.fontawesome.com" > .npmrc && \
    echo "@awesome.me:registry=https://npm.fontawesome.com" >> .npmrc && \
    echo "//npm.fontawesome.com/:_authToken=$FONTAWESOME_PACKAGE_TOKEN" >> .npmrc && \
    echo "@bryntum:registry=https://npm.bryntum.com" >> .npmrc && \
    echo "//npm.bryntum.com/:_authToken=$BRYNTUM_AUTH" >> .npmrc && \
    echo "=== Starting dependency installation ===" && \
    bun install && \
    echo "=== Verifying installation ===" && \
    ls -la node_modules/.bin/vite && \
    ls -la node_modules/@firebase/auth && \
    ls -la node_modules/firebase && \
    echo "=== Dependencies installed successfully ==="

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port (Railway/Coolify will set PORT env var)
EXPOSE 3000

# Use serve (via bunx) to serve static files from dist directory
# Listen on port 3000 (serve defaults to 0.0.0.0)
CMD ["bunx", "serve", "-s", "dist", "-l", "3000"]


