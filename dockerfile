FROM node:15.14.0

RUN mkdir -p /app

COPY . /app

WORKDIR /app

RUN npm ci

CMD ["npm","start"]
