FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/index.js"]
