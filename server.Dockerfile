FROM node:20-alpine
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod

COPY . .

RUN pnpm build

EXPOSE 8080

CMD ["node", "dist/index.js"]
