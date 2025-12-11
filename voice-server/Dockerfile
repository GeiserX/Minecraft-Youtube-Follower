FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --only=production

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/config /app/logs

# Expose ports
EXPOSE 8080 8081/udp 8082/udp

# Run the server
CMD ["node", "voice-server.js"]

