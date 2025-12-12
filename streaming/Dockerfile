FROM ubuntu:22.04

# Set environment to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Europe/Madrid

# Install dependencies
RUN apt-get update && apt-get install -y \
    tzdata \
    ffmpeg \
    python3 \
    python3-pip \
    nodejs \
    npm \
    xvfb \
    x11vnc \
    fluxbox \
    pulseaudio \
    alsa-utils \
    curl \
    wget \
    chromium-browser \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Install Node.js dependencies for Puppeteer
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


