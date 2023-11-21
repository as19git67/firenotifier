#!/bin/bash

{
  echo "{"
  echo "  \"httpPort\": $PORT_HTTP,"
  echo "  \"httpsPort\": $PORT_HTTPS,"
  echo "  \"bearerTokens\": $BEARER_TOKENS_JSON"
  echo "}"
} >  /app/settings.json

node ./server.js
