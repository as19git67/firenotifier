#!/bin/sh

{
  echo "{"
  echo "  \"httpPort\": $PORT_HTTP,"
  echo "  \"httpsPort\": $PORT_HTTPS,"
  echo "  \"bearerTokens\": $BEARER_TOKENS_JSON"
  echo "}"
} >  /app/settings.json


openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout /app/key.pem -out /app/cert.pem -subj "$SSL_CERT_SUBJ"

node ./server.js
