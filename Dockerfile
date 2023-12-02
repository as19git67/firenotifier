# syntax=docker/dockerfile:1

# example docker run:
# docker run --env=PORT_HTTP=8000 --env=PORT_HTTPS=8008 --env="SSL_CERT_SUBJ=/C=DE/ST=Bavaria/O=Feuerwehr XYZ/CN=firenotifier.example.com" --env="BEARER_TOKENS_JSON={ \"aagkdd\": \"testapp\" }" -p 8008:8008 -p 8000:8000 -d ghcr.io/as19git67/firenotifier:main

FROM node:18-alpine
WORKDIR /app
COPY . .

VOLUME ["/data"]

ARG ARG_PORT_HTTP=5002
ENV PORT_HTTP=${ARG_PORT_HTTP}
ARG ARG_PORT_HTTPS=5052
ENV PORT_HTTPS=${ARG_PORT_HTTPS}
ARG ARG_BEARER_TOKENS_JSON="{}"
ENV BEARER_TOKENS_JSON=${ARG_BEARER_TOKENS_JSON}
ARG ARG_SSL_CERT_SUBJ="/C=DE/ST=Bavaria/O=Freiwillige Feuerwehr/CN=example.com"
ENV SSL_CERT_SUBJ=${ARG_SSL_CERT_SUBJ}

ARG ARG_SMS_CLIENT_ID=""
ENV SMS_CLIENT_ID=${ARG_SMS_CLIENT_ID}
ARG ARG_SMS_CLIENT_SECRET=""
ENV SMS_CLIENT_SECRET=${ARG_SMS_CLIENT_SECRET}
ARG ARG_SMS_SENDER_NR=""
ENV SMS_SENDER_NR=${ARG_SMS_SENDER_NR}
ARG ARG_SMS_VALIDITY_HOURS=1
ENV SMS_VALIDITY_HOURS=${ARG_SMS_VALIDITY_HOURS}
ARG ARG_SMS_WAIT_FOR_STATUS=3600
ENV SMS_WAIT_FOR_STATUS=${ARG_SMS_WAIT_FOR_STATUS}
ARG ARG_EMAIL_SMTP_SENDER_EMAIL="alarm@example.com"
ENV EMAIL_SMTP_SENDER_EMAIL=${ARG_EMAIL_SMTP_SENDER_EMAIL}
ARG ARG_EMAIL_SMTP_USERNAME="alarm@example.com"
ENV EMAIL_SMTP_USERNAME=${ARG_EMAIL_SMTP_USERNAME}
ARG ARG_EMAIL_SMTP_PASSWORD="geheim"
ENV EMAIL_SMTP_PASSWORD=${ARG_EMAIL_SMTP_PASSWORD}
ARG ARG_EMAIL_SMTP_USE_SSL=FALSE
ENV EMAIL_SMTP_USE_SSL=${ARG_EMAIL_SMTP_USE_SSL}
ARG ARG_EMAIL_SMTP_SERVER_HOST="smtp.example.com"
ENV EMAIL_SMTP_SERVER_HOST=${ARG_EMAIL_SMTP_SERVER_HOST}
ARG ARG_EMAIL_SMTP_SERVER_PORT="587"
ENV EMAIL_SMTP_SERVER_PORT=${ARG_EMAIL_SMTP_SERVER_PORT}
ARG ARG_EMAIL_POSTMASTER_ADDRESS="postmaster@example.com"
ENV EMAIL_POSTMASTER_ADDRESS=${ARG_EMAIL_POSTMASTER_ADDRESS}



RUN yarn install --production
RUN apk update && apk add --no-cache openssl

CMD ["/bin/sh", "./start.sh"]

EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS
