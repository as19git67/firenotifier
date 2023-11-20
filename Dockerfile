# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /app
COPY . .

ENV PORT_HTTP=5002
ENV PORT_HTTPS=5052
ENV BEARER_TOKENS_JSON="{}"

#RUN echo $'{\n\
#  \"httpPort\": "$PORT_HTTP",\n\
#  \"httpsPort\": "$PORT_HTTPS",\n\
#  \"bearerTokens\": {\n\
#   }\n\
#}' > /app/settings.json

RUN echo "{"                                      >  /app/settings.json
RUN echo "  \"httpPort\": $PORT_HTTP,"              >> /app/settings.json
RUN echo "  \"httpsPort\": $PORT_HTTPS,"            >> /app/settings.json
RUN echo "  \"bearerTokens\": $BEARER_TOKENS_JSON"  >> /app/settings.json
RUN echo "}"                                      >> /app/settings.json

RUN yarn install --production
CMD ["node", "./server.js"]
EXPOSE $PORT_HTTP
EXPOSE $PORT_HTTPS