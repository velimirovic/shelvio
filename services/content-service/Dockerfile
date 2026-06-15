FROM node:20-alpine AS base
WORKDIR /app
EXPOSE 3000

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

FROM base AS final
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["node", "src/index.js"]
