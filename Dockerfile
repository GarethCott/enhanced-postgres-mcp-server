FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the project
RUN npm run build

# Make the entry point executable
RUN chmod +x dist/index.js

# Set default command
ENTRYPOINT ["node", "dist/index.js"] 