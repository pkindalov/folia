FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

# Run as non-root user (built into the node image)
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 1337

CMD ["node", "index.js"]
