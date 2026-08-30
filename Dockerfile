FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY server/package*.json ./
RUN npm install --production

COPY server ./server
COPY --from=frontend-builder /app/dist ./server/public

WORKDIR /app/server

EXPOSE 3001
CMD ["node", "src/server.js"]
