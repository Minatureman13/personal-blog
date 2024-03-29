FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY lib/ ./lib/
COPY public/ ./public/
COPY views/ ./views/
COPY server.js .

CMD ["node", "server.js"]
