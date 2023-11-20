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

RUN yarn install --production


CMD echo "{"                                        >  /app/settings.json
CMD echo "  \"httpPort\": $PORT_HTTP,"              >> /app/settings.json
CMD echo "  \"httpsPort\": $PORT_HTTPS,"            >> /app/settings.json
CMD echo "  \"bearerTokens\": $BEARER_TOKENS_JSON"  >> /app/settings.json
CMD echo "}"                                        >> /app/settings.json

CMD ["node", "./server.js"]

EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS