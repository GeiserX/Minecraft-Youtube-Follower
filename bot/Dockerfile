FROM node:20-alpine

# The base image's CA bundle predates the eMudhra distrust (2026-10-20), and Node's
# built-in roots still trust those intermediates: upgrade the bundle and verify
# the Microsoft and Xbox sign-in calls against it.
RUN apk add --no-cache 'ca-certificates-bundle>=20261020-r0'
ENV NODE_OPTIONS=--use-openssl-ca

WORKDIR /app

# Install system dependencies for canvas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Install dependencies (package.json will be mounted as volume in development)
COPY package.json ./
RUN npm install --only=production

# Copy application code (will be overridden by volume mount in docker-compose.yml)
COPY . .

# Create directories for config and logs
RUN mkdir -p /app/config /app/logs

# Note: In development, spectator-bot.js is mounted as a volume from docker-compose.yml
# This allows code changes without rebuilding the image

# Run the bot
CMD ["node", "spectator-bot.js"]

