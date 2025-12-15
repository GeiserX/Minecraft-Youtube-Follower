# Use Node.js image with Puppeteer pre-configured
FROM node:18-slim

# Set environment to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Madrid
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Install dependencies including Chromium and FFmpeg
RUN apt-get update && apt-get install -y \
    tzdata \
    ffmpeg \
    python3 \
    python3-pip \
    xvfb \
    x11-utils \
    # Chromium dependencies
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    fonts-liberation \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Install Node.js dependencies
COPY package.json .
RUN npm install --only=production

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/config /app/logs

# Set up virtual display
ENV DISPLAY=:99

# Run startup script
CMD ["python3", "streaming-service.py"]
