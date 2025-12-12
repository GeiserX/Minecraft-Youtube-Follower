FROM node:18-alpine

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

# Install dependencies
COPY package.json ./
RUN npm install --only=production

# Copy application code
COPY . .

# Create directories for config and logs
RUN mkdir -p /app/config /app/logs

# Run the bot
CMD ["node", "spectator-bot.js"]

