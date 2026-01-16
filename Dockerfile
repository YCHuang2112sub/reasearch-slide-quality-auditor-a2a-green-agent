# Use Node.js 20 (standard for AgentBeats)
FROM node:20-slim

# Install system dependencies for canvas and PDF processing
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    curl \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose the A2A port
EXPOSE 9009

# Entrypoint as required by AgentBeats
# It must accept --host, --port, and --card-url
ENTRYPOINT ["npx", "tsx", "src/server.ts"]
CMD ["--host", "0.0.0.0", "--port", "9009"]
