FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 10000
CMD ["npm", "start"]
