#!/bin/sh

{
  echo "{"
  echo "  \"timezone\": \"$TZ\","
  echo "  \"httpPort\": \"$PORT_HTTP\","
  echo "  \"httpsPort\": \"$PORT_HTTPS\","
  echo "  \"syncDestination_url\": \"$SYNCDESTINATION_URL\","
  echo "  \"syncDestination_bearerToken\": \"$SYNCDESTINATION_BEARERTOKEN\","
  echo "  \"syncDestination_acceptSelfSignedCertificate\": \"$SYNCDESTINATION_ACCEPTSELFSIGNEDCERTIFICATE\","
  echo "  \"minWaitMinutesToNotifySameGroup\": \"$MIN_WAIT_MINUTES_TO_NOTIFY_SAME_GROUP\","
  echo "  \"sms_client_id\": \"$SMS_CLIENT_ID\","
  echo "  \"sms_client_secret\": \"$SMS_CLIENT_SECRET\","
  echo "  \"sms_sender_nr\": \"$SMS_SENDER_NR\","
  echo "  \"sms_validity_hours\": \"$SMS_VALIDITY_HOURS\","
  echo "  \"sms_wait_for_status\": \"$SMS_WAIT_FOR_STATUS\","
  echo "  \"email_smtp_sender_email\": \"$EMAIL_SMTP_SENDER_EMAIL\","
  echo "  \"email_smtp_username\": \"$EMAIL_SMTP_USERNAME\","
  echo "  \"email_smtp_password\": \"$EMAIL_SMTP_PASSWORD\","
  echo "  \"email_smtp_use_ssl\": \"$EMAIL_SMTP_USE_SSL\","
  echo "  \"email_smtp_server_host\": \"$EMAIL_SMTP_SERVER_HOST\","
  echo "  \"email_smtp_server_port\": \"$EMAIL_SMTP_SERVER_PORT\","
  echo "  \"email_postmaster_address\": \"$EMAIL_POSTMASTER_ADDRESS\""
  echo "}"
} >  /app/settings.json

if [ ! -f /data/key.pem ]
then
  if [ -n "${SSL_CERT_SUBJ:+x}" ]; then
    openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout /data/key.pem -out /data/cert.pem -subj "$SSL_CERT_SUBJ";
  fi
fi
node ./server.js
