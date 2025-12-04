# Use Bun for building and serving
FROM oven/bun:1.3.2

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

# Create .npmrc with FontAwesome token (Docker doesn't substitute vars in COPY)
# Use $FONTAWESOME_PACKAGE_TOKEN from ARG (available in RUN commands)
RUN if [ -z "$FONTAWESOME_PACKAGE_TOKEN" ]; then \
      echo "ERROR: FONTAWESOME_PACKAGE_TOKEN is not set!" && exit 1; \
    fi && \
    echo "@fortawesome:registry=https://npm.fontawesome.com/" > .npmrc && \
    echo "@awesome.me:registry=https://npm.fontawesome.com/" >> .npmrc && \
    echo "//npm.fontawesome.com/:_authToken=$FONTAWESOME_PACKAGE_TOKEN" >> .npmrc && \
    echo "Created .npmrc with FontAwesome token"

# Install dependencies (Bun reads package-lock.json or creates bun.lockb)
# Bun respects .npmrc for registry authentication
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose port (Railway/Coolify will set PORT env var)
EXPOSE 3000

# Use serve (via bunx) to serve static files from dist directory
# Listen on port 3000 (serve defaults to 0.0.0.0)
CMD ["bunx", "serve", "dist", "-l", "3000"]

