# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY backend/package*.json ./
RUN npm ci --production

# Copy source code
COPY backend/src ./src

# Run migrations on startup (optional - can be run manually)
# CMD ["sh", "-c", "npm run migrate && npm start"]

EXPOSE 3000

CMD ["npm", "start"]