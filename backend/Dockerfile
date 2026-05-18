FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Заменяем npm ci на npm install
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]