FROM node:20-alpine

WORKDIR /app

# Copy package files. vendor/ holds the packed @omj21/mcp21 tarball that
# package.json references as file:vendor/…, so it must exist before npm ci.
COPY package*.json ./
COPY vendor ./vendor

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 5050

# Start the application
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
