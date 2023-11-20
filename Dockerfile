# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /app
COPY . .

ARG ARG_PORT_HTTP=5002
ENV PORT_HTTP=${ARG_PORT_HTTP}
ARG ARG_PORT_HTTPS=5052
ENV PORT_HTTPS=${ARG_PORT_HTTPS}
ARG ARG_BEARER_TOKENS_JSON="{}"
ENV BEARER_TOKENS_JSON=${ARG_BEARER_TOKENS_JSON}

RUN echo "{"                                      >  /app/settings.json
RUN echo "  \"httpPort\": $PORT_HTTP,"              >> /app/settings.json
RUN echo "  \"httpsPort\": $PORT_HTTPS,"            >> /app/settings.json
RUN echo "  \"bearerTokens\": $BEARER_TOKENS_JSON"  >> /app/settings.json
RUN echo "}"                                      >> /app/settings.json

RUN yarn install --production
CMD ["node", "./server.js"]
EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS