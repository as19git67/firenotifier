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
ARG ARG_SSL_CERT_SUBJ="/C=DE/ST=Bavaria/O=Freiwillige Feuerwehr/CN=example.com"
ENV SSL_CERT_SUBJ=${ARG_SSL_CERT_SUBJ}

RUN yarn install --production
RUN apk update && apk add --no-cache openssl

CMD ["/bin/sh", "./start.sh"]

EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS