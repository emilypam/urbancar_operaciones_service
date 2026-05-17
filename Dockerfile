FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3004

CMD ["node", "dist/server.js"]
