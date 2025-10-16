FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src/ ./src/

RUN npm install

FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

USER node

EXPOSE 6556

CMD ["node", "dist/main.js"]
