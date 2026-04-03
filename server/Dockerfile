FROM node:18-alpine

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S medcare -u 1001

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production --prefer-offline

COPY --chown=medcare:nodejs . .

USER medcare

ENV NODE_ENV=production
ENV PORT=5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

EXPOSE 5000
CMD ["node", "server.js"]
