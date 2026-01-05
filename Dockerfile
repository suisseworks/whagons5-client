# Use Bun for building and serving
FROM oven/bun:1.3.2

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
COPY package.json bun.lockb* package-lock.json* pnpm-lock.yaml* ./

# Install npm (needed for reliable registry authentication)
# Configure .npmrc and install dependencies with npm
# Bun doesn't reliably authenticate with private registries, so we use npm for installation
# Bun can use the node_modules that npm installs
RUN apt-get update && \
    apt-get install -y npm && \
    npm --version && \
    if [ -z "$FONTAWESOME_PACKAGE_TOKEN" ]; then \
      echo "ERROR: FONTAWESOME_PACKAGE_TOKEN is not set!" && exit 1; \
    fi && \
    if [ -z "$BRYNTUM_USERNAME" ] || [ -z "$BRYNTUM_PASSWORD" ]; then \
      echo "ERROR: BRYNTUM_USERNAME and BRYNTUM_PASSWORD must be set!" && exit 1; \
    fi && \
    echo "Configuring npm registries..." && \
    BRYNTUM_AUTH=$(echo -n "$BRYNTUM_USERNAME:$BRYNTUM_PASSWORD" | base64) && \
    echo "@fortawesome:registry=https://npm.fontawesome.com" > .npmrc && \
    echo "@awesome.me:registry=https://npm.fontawesome.com" >> .npmrc && \
    echo "//npm.fontawesome.com/:_authToken=$FONTAWESOME_PACKAGE_TOKEN" >> .npmrc && \
    echo "@bryntum:registry=https://npm.bryntum.com" >> .npmrc && \
    echo "//npm.bryntum.com/:_authToken=$BRYNTUM_AUTH" >> .npmrc && \
    echo "Created .npmrc file" && \
    echo "Bryntum username: $BRYNTUM_USERNAME" && \
    echo ".npmrc contents:" && \
    cat .npmrc && \
    echo "" && \
    echo "Installing dependencies with npm (reliable authentication)..." && \
    npm ci --legacy-peer-deps && \
    echo "Dependencies installed successfully!" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port (Railway/Coolify will set PORT env var)
EXPOSE 3000

# Use serve (via bunx) to serve static files from dist directory
# Listen on port 3000 (serve defaults to 0.0.0.0)
CMD ["bunx", "serve", "dist", "-l", "3000"]

