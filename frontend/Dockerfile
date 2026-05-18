FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Создаем .env файл во время сборки
RUN echo "VITE_API_URL=http://localhost:8081/api" > .env
RUN echo "VITE_WS_URL=ws://localhost:8081" >> .env

RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]