FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
