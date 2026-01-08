test:
	npx cypress run

open:
	npx cypress open

# Docker commands
# Source .env file if it exists to load environment variables
docker-build:
	@if [ -f .env ]; then \
		set -a; \
		. .env; \
		set +a; \
	fi; \
	if [ -z "$$FONTAWESOME_PACKAGE_TOKEN" ]; then \
		echo "ERROR: FONTAWESOME_PACKAGE_TOKEN is not set!"; \
		echo "Please set it in your .env file or export it:"; \
		echo "  export FONTAWESOME_PACKAGE_TOKEN=your-token-here"; \
		exit 1; \
	fi; \
	if [ -z "$$BRYNTUM_USERNAME" ] || [ -z "$$BRYNTUM_PASSWORD" ]; then \
		echo "ERROR: BRYNTUM_USERNAME and BRYNTUM_PASSWORD must be set!"; \
		echo "Please set them in your .env file or export them:"; \
		echo "  export BRYNTUM_USERNAME=your-email..domain.com"; \
		echo "  export BRYNTUM_PASSWORD=trial"; \
		echo ""; \
		echo "Note: For trial accounts, replace @ with .. in your email"; \
		exit 1; \
	fi; \
	docker build \
		--build-arg FONTAWESOME_PACKAGE_TOKEN="$$FONTAWESOME_PACKAGE_TOKEN" \
		--build-arg BRYNTUM_USERNAME="$$BRYNTUM_USERNAME" \
		--build-arg BRYNTUM_PASSWORD="$$BRYNTUM_PASSWORD" \
		--build-arg VITE_AG_GRID_LICENSE_KEY="$$VITE_AG_GRID_LICENSE_KEY" \
		--build-arg VITE_API_URL="$${VITE_API_URL:-http://localhost:8000}" \
		--build-arg VITE_DEVELOPMENT="$${VITE_DEVELOPMENT:-false}" \
		--build-arg VITE_DOMAIN="$${VITE_DOMAIN:-localhost}" \
		--build-arg VITE_CACHE_ENCRYPTION="$${VITE_CACHE_ENCRYPTION:-false}" \
		--build-arg VITE_ALLOW_UNVERIFIED_LOGIN="$${VITE_ALLOW_UNVERIFIED_LOGIN:-false}" \
		--build-arg VITE_ALLOW_UNVERIFIED_EMAIL_REGEX="$$VITE_ALLOW_UNVERIFIED_EMAIL_REGEX" \
		-t whagons5-client:latest .

docker-run:
	docker run -p 3000:3000 \
		-e PORT=3000 \
		whagons5-client:latest

docker-build-run: docker-build docker-run