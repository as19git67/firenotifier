#!/bin/sh

{
  echo "{"
  echo "  \"httpPort\": $PORT_HTTP,"
  echo "  \"httpsPort\": $PORT_HTTPS,"
  echo "  \"bearerTokens\": $BEARER_TOKENS_JSON",
  echo "  \"syncDestination_url\": \"$SYNCDESTINATION_URL\"",
  echo "  \"syncDestination_bearerToken\": \"$SYNCDESTINATION_BEARERTOKEN\"",
  echo "  \"syncDestination_acceptSelfSignedCertificate\": $SYNCDESTINATION_ACCEPTSELFSIGNEDCERTIFICATE",
  echo "  \"sms_client_id\": \"$SMS_CLIENT_ID\","
  echo "  \"sms_client_secret\": \"$SMS_CLIENT_SECRET\","
  echo "  \"sms_sender_nr\": \"$SMS_SENDER_NR\","
  echo "  \"sms_validity_hours\": $SMS_VALIDITY_HOURS,"
  echo "  \"sms_wait_for_status\": $SMS_WAIT_FOR_STATUS,"
  echo "  \"email_smtp_sender_email\": \"$EMAIL_SMTP_SENDER_EMAIL\","
  echo "  \"email_smtp_username\": \"$EMAIL_SMTP_USERNAME\","
  echo "  \"email_smtp_password\": \"$EMAIL_SMTP_PASSWORD\","
  echo "  \"email_smtp_use_ssl\": \"$EMAIL_SMTP_USE_SSL\","
  echo "  \"email_smtp_server_host\": \"$EMAIL_SMTP_SERVER_HOST\","
  echo "  \"email_smtp_server_port\": \"$EMAIL_SMTP_SERVER_PORT\","
  echo "  \"email_postmaster_address\": \"$EMAIL_POSTMASTER_ADDRESS\""
  echo "}"
} >  /app/settings.json


openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout /app/key.pem -out /app/cert.pem -subj "$SSL_CERT_SUBJ"

node ./server.js
