# syntax=docker/dockerfile:1

ENV PORT_HTTP=5002
ENV PORT_HTTPS=5052

FROM node:18-alpine
WORKDIR /app
COPY . .
RUN echo $'{\n\
  \"httpPort\": \"$PORT_HTTP\",\n\
  \"httpsPort\": \"$PORT_HTTPS\",\n\
  \"bearerTokens\": {,\n\
   }\n\
}' > /app/settings.json

RUN yarn install --production
CMD ["node", "./bin/www"]
EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS