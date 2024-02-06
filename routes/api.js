import express from 'express';
import passport from 'passport';
import _ from 'underscore';
import nodemailer from 'nodemailer';
import moment from 'moment';
import Handlebars from 'handlebars';
import util from 'util';
import formidable from 'formidable';
import config from '../config.js';
import {smsSendSMS, smsGetStatus} from '../textanywhere.js';
import Data from "../data.js";

const router = express.Router();

moment.locale('de');

let templates = {
  emailSubjectAlarm0: Handlebars.compile("Alarm für die {{whom}} 🔥🚒"),
  emailTextAlarm0: Handlebars.compile("Alarmierung durch Funkmelder. Alarmzeit: {{date_formatted}}"),
  emailTextAlarm0Test: Handlebars.compile("Alarmierung (Probe?) durch Funkmelder. Alarmzeit: {{date_formatted}}"),
  emailHtmlAlarm0: Handlebars.compile("<h2>Alarmierung durch Funkmelder</h2><p>Alarmzeit: {{date_formatted}}</p>"),
  emailHtmlAlarm0Test: Handlebars.compile("<h2>Alarmierung (Probe?) durch Funkmelder</h2><p>Alarmzeit: {{date_formatted}}</p>"),
  smsAlarm0: Handlebars.compile("Alarm für die {{whom}}  - {{date_formatted}} 🔥🚒"),
  smsAlarm0Test: Handlebars.compile("Alarm (Probe?) für die {{whom}}  - {{date_formatted}} 🔥🚒"),

  emailSubjectAlarmWithKeyword: Handlebars.compile("Alarm für die {{whom}} {{keywordEmoji}}"),
  emailTextAlarmWithKeyword: Handlebars.compile("Stichwort: {{keyword}}. Alarmierung durch Alarmfax. Alarmzeit: {{date_formatted}}"),
  emailHtmlAlarmWithKeyword: Handlebars.compile("<h2>Alarmierung durch Alarmfax</h2><p>Alarmzeit: {{date_formatted}}</p><p>Stichwort:" +
    " {{keyword}}</p>"),
  emailTextAlarmWithCompleteInfo: Handlebars.compile(
    " Stichwort: {{keyword}}. Schlagwort: {{catchword}}. Ort: {{address}}. Einsatzmittel:" +
    " {{#each resource}} {{this}}{{/each}}. Karte: {{location}}.{{#if plan}} Einsatzplan: {{plan}}. {{/if}}Alarmierung durch Alarmfax. Alarmzeit:" +
    " {{date_formatted}}."),
  emailHtmlAlarmWithCompleteInfo: Handlebars.compile("<h2>Alarmierung durch Alarmfax</h2><p>Alarmzeit: {{date_formatted}}</p>" + "" +
    '<p>Stichwort: {{keyword}}</p>' +
    '<p>Schlagwort: {{catchword}}</p>' +
    '<p>Ort: {{address}}</p>' +
    '<p><a href="{{location}}" target="_top">Karte</a></p>' +
    '{{#if plan}}<p>Einsatzplan: {{plan}}</p>{{/if}}' +
    '<p>Einsatzmittel: {{#each resource}}<br>{{this}}{{/each}}</p>'),
  smsAlarmWithKeyword: Handlebars.compile("Alarm für die {{whom}} - {{date_formatted}} {{keyword}} {{keywordEmoji}}"),
  smsAlarmWithCompleteInfo: Handlebars.compile("Alarm {{whom}}: {{date_formatted}} {{keyword}} {{catchword}} {{address}}"),

  nonDeliveryReport: Handlebars.compile(
    "<h2>An folgende Adressen konnte die E-Mail nicht zugestellt werden:</h2>{{#each recipients}}<p>{{this}}</p>{{/each}}"),
  smsStatusReport: Handlebars.compile("<h2>SMS konnte an folgende Empfänger nicht korrekt zugestellt werden:</h2>" +
    "<table><tbody>" +
    "{{#each statuses}}<tr>" +
    "<td>{{this.name}}</td><td>{{this.number}}</td><td>{{this.description}}</td><td>{{this.code}}</td>" +
    "</tr>{{/each}}" +
    "</tbody></table>")
};

let notificationHistory = {};

// test post with curl:
// curl --insecure -F groupId=21204 -H "Authorization:Bearer 123abc"  https://localhost:5052/api/send
router.post('/send', passport.authenticate('bearer', {session: false}), async function (req, res, next) {
  const sms_sender_nr = config.get('sms_sender_nr');
  const minWaitMinutes = isNaN(parseInt(config.get('minWaitMinutesToNotifySameGroup'))) ? 2 : parseInt(config.get('minWaitMinutesToNotifySameGroup'));

  const smsConfig = {
    sms_client_id: config.get('sms_client_id'),
    sms_client_secret: config.get('sms_client_secret'),
    sms_validity_hours: isNaN(parseInt(config.get('sms_validity_hours'))) ? 2 : parseInt(config.get('sms_validity_hours')),
    sms_wait_for_status: isNaN(parseInt(config.get('sms_wait_for_status'))) ? 3600 : parseInt(config.get('sms_wait_for_status')),
  };
  const emailConfig = {
    email_postmaster_address: config.get('email_postmaster_address'),
    email_smtp_sender_email: config.get('email_smtp_sender_email'),
    email_smtp_server_host: config.get('email_smtp_server_host'),
    email_smtp_server_port: isNaN(parseInt(config.get('email_smtp_server_port'))) ? 3600 : parseInt(config.get('email_smtp_server_port')),
    email_smtp_use_SSL: (isNaN(parseInt(config.get('email_smtp_use_SSL'))) ? 0 : parseInt(config.get('email_smtp_use_SSL'))) === 1,
    email_smtp_username: config.get('email_smtp_username'),
    email_smtp_password: config.get('email_smtp_password'),
  };

  try {
    const data = new Data();
    let all = await data.getRecipients();

    let fields = await new Promise((resolve, reject) => {
      const form = formidable();
      form.parse(req, function (err, fields, files) {
        if (err) {
          reject(err);
        } else {
          resolve(fields);
        }
      });
    });
    if (!fields) {
      fields = {};
    }

    // convert arrays with one element to element
    _.each(_.keys(fields), function (key) {
      let value = fields[key];
      if (_.isArray(value) && value.length === 1) {
        fields[key] = value[0];
      }
    });

    let groupId = fields.groupId;
    if (groupId) {

      if (_isSameGroupTooEarly(groupId, minWaitMinutes)) {
        res.status(429).json({message: 'ignoring duplicate for groupID ' + groupId});
        return;
      }

      let recipientsByAddress = {sms: {}, smsUseSmsSenderNumber: {}, email: {}};
      for (const recipient of all) {
        let groups = recipient.groups;
        // console.log("groups of recipient: ", groups);
        let recipientGroupsToNotify = _.where(groups, {id: groupId});
        let wildcardGroupsToNotify = _.where(groups, {id: '*'});
        recipientGroupsToNotify = recipientGroupsToNotify.concat(wildcardGroupsToNotify);

        for (const recipientGroupToNotify of recipientGroupsToNotify) {
          // console.log("Recipient " + recipient.lastname + ' is in group ' + groupId);
          switch (recipientGroupToNotify.type) {
            case 'email':
              if (recipient.email) {
                recipientsByAddress.email[recipient.email] = {
                  firstname: recipient.firstname,
                  lastname: recipient.lastname
                };
              }
              break;
            case 'sms':
              if (recipient.sms) {
                if (sms_sender_nr && recipientGroupToNotify.useSmsSenderNumber) {
                  recipientsByAddress.smsUseSmsSenderNumber[recipient.sms] = {
                    firstname: recipient.firstname,
                    lastname: recipient.lastname
                  };
                } else {
                  recipientsByAddress.sms[recipient.sms] = {
                    firstname: recipient.firstname,
                    lastname: recipient.lastname
                  };
                }
              }
              break;
          }
        }
      }
      // let recipients = {sms: Object.keys(recipientsByAddress.sms), email: Object.keys(recipientsByAddress.email)};

      console.log(`${req.user.name} requested to notify group ${groupId}`);
      console.log(`Recipients: ${JSON.stringify(recipientsByAddress)}`);

      let promises = [];

      if (Object.keys(recipientsByAddress.sms).length > 0 ||
        Object.keys(recipientsByAddress.smsUseSmsSenderNumber).length > 0) {
        let textSMS = await _generateTextForSMS(fields);
        // send in the first batch sms where sender is the group name
        if (Object.keys(recipientsByAddress.sms).length > 0) {
          promises.push(_sendSMS(groupId, textSMS, recipientsByAddress.sms, textSMS.sender, smsConfig, emailConfig));
        }
        // now send in a second batch to all recipients where sender should be a number
        if (Object.keys(recipientsByAddress.smsUseSmsSenderNumber).length > 0) {
          promises.push(_sendSMS(groupId, textSMS, recipientsByAddress.smsUseSmsSenderNumber, sms_sender_nr, smsConfig, emailConfig));
        }
      }

      if (Object.keys(recipientsByAddress.email).length > 0) {
        let textEmail = await _generateTextForEmail(fields);
        promises.push(_sendEmail(groupId, textEmail, Object.keys(recipientsByAddress.email), emailConfig));
      }

      Promise.all(promises).then(values => {
        res.json({ok: true});
      }).catch(reason => {
        console.log("Sending notifications failed: " + reason.message ? reason.message : 'unknown');
        res.status(500).json({ok: false, error: reason.message ? reason.message : 'Sending notifications failed'});
      });
    } else {
      console.log("Ignoring request, because groupId is missing in request body.");
      res.status(403).json({error: 'groupId in request body missing'});
    }
  } catch (ex) {
    console.log(ex);
    res.status(500).json({ok: false, error: ex.message ? ex.message : 'Sending notifications failed'});
  }
});

// REST call to get the groups and recipients
router.get('/data', passport.authenticate('bearer', {session: false}), async function (req, res, next) {
    try {
      const data = new Data();
      const all = {
        groups: await data.getGroups(),
        recipients: await data.getRecipients()
      };
      res.status(200).json(all);
      console.log("Updated configuration file saved");
    } catch (ex) {
      console.log(ex);
      res.status(500).json({ok: false, error: ex.message ? ex.message : 'Get groups and recipients failed'});
    }
  }
);

// REST call to set the groups and recipients
router.post('/data', passport.authenticate('bearer', {session: false}), async function (req, res, next) {
    if (req.body) {
      try {
        const data = new Data();

        if (req.body.groups && _.isArray(req.body.groups)) {
          await data.setGroups(req.body.groups);
        }
        if (req.body.recipients && _.isArray(req.body.recipients)) {
          await data.setRecipients(req.body.recipients);
        }
        console.log("Updated configuration file saved");
        res.end();
      } catch (ex) {
        console.log(ex);
        res.status(500).json({ok: false, error: ex.message ? ex.message : 'Set groups/recipients failed'});
      }
    } else {
      console.log('Bad request: data missing in request body');
      res.status(400).end();
    }
  }
);

function _isSameGroupTooEarly(groupId, minWaitMinutes) {
  const lastMessageDate = notificationHistory[groupId];
  const now = moment();

  let isTooEarly = false;

  if (lastMessageDate) {
    const earliest = moment(lastMessageDate).add(minWaitMinutes, 'minutes');
    if (now.isBefore(earliest)) {
      console.log(`Multiple send requests for group (${groupId}). Earliest possible again: ${earliest.format('LTS')}`);
      isTooEarly = true;
    } else {
      notificationHistory[groupId] = now;
    }
  } else {
    notificationHistory[groupId] = now;
  }
  return isTooEarly;
}

async function _getGroupNameById(groupId) {
  const data = new Data();
  const groups = await data.getGroups();
  let group = _.findWhere(groups, {id: groupId});
  if (!group) {
    group = _.findWhere(groups, {id: '*'});
  }
  if (group) {
    return group.name ? group.name : group.id;
  } else {
    return groupId;
  }
}

async function _getGroupResponsibleEmailById(groupId, postmasterEmail) {
  const data = new Data();
  const groups = await data.getGroups();
  let group = _.findWhere(groups, {id: groupId});
  if (!group) {
    group = _.findWhere(groups, {id: '*'});
  }
  if (group) {
    return group.responsible ? group.responsible : postmasterEmail;
  } else {
    return postmasterEmail;
  }
}

function _isFirstSaturdayOfMonthBetween11And12(datetime) {
  var dayOfWeek = datetime.day();
  if (dayOfWeek === 6) {   // saturday?
    var dayOfMonth = datetime.date();
    if (dayOfMonth < 8) {   // only first saturday
      var eleven = moment(datetime).hour(11).minute(0).second(0).millisecond(0);
      var twelve = moment(datetime).hour(12).minute(0).second(0).millisecond(0);
      return datetime.isAfter(eleven) && datetime.isBefore(twelve);
    }
  }
  return false;
}

function _makeKeywordEmoji(data) {
  if (!data.keyword) {
    data.keyword = '';
  }
  let keywordEmoji = data.keyword;
  switch (data.keyword.replace(/\s/g, '').toUpperCase()) {
    case 'THL1':
      keywordEmoji = "🚒";
      break;
    case 'THL2':
      keywordEmoji = "🚒🚒";
      break;
    case 'THL3':
      keywordEmoji = "🚒🚒🚒";
      break;
    case 'THLWASSER':
      keywordEmoji = "🚒🚣";
      break;
    case 'THLGROSS':
      keywordEmoji = "🚒❗";
      break;
    case 'THLUNWETTER':
      keywordEmoji = "🚒🌩⚡️";
      break;
    case 'B1':
      keywordEmoji = "🔥";
      break;
    case 'B2':
      keywordEmoji = "🔥🔥";
      break;
    case 'B3':
      keywordEmoji = "🔥🔥🔥";
      break;
    case 'B4':
      keywordEmoji = "🔥🔥🔥🔥";
      break;
    case 'B5':
      keywordEmoji = "🔥🔥🔥🔥🔥";
      break;
    case 'B6':
      keywordEmoji = "🔥🔥🔥🔥🔥🔥";
      break;
    case 'BSCHIENE':
      keywordEmoji = "🔥🚂🛤️";
      break;
    default:
      keywordEmoji = "👨🏻‍🚒";
  }
  return keywordEmoji;
}

function _makeAddress(data) {
  const street = _.isArray(data.street) && data.street.length > 0 ? data.street[0] : data.street;
  const streetnumber = _.isArray(data.streetnumber) && data.streetnumber.length > 0 ? data.streetnumber[0] : data.streetnumber;
  const city = _.isArray(data.city) && data.city.length > 0 ? data.city[0] : data.city;
  const object = _.isArray(data.object) && data.object.length > 0 ? data.object[0] : data.object;
  const streetParts = [];
  if (street) {
    streetParts.push(street);
  }
  if (streetnumber) {
    streetParts.push(streetnumber);
  }
  let streetAddress = streetParts.join(' ');
  let addressParts = [];
  if (streetAddress) {
    addressParts.push(streetAddress);
  }
  if (city) {
    addressParts.push(city);
  }
  if (object) {
    addressParts.push(object);
  }
  return addressParts.join(', ');
}

async function _generateTextForSMS(data) {
  const now = moment();
  const whom = await _getGroupNameById(data.groupId);
  const date_formatted = now.format('DD.MM. LT');
  const testAlarm = _isFirstSaturdayOfMonthBetween11And12(now);

  let templateName = 'smsAlarm0';
  if (data.keyword && !testAlarm) {
    templateName = 'smsAlarmWithKeyword';
  }
  if (data.keyword && data.catchword && !testAlarm) {
    templateName = 'smsAlarmWithCompleteInfo';
  }

  // if (testAlarm) {
  //   templateName = templateName + 'Test';
  // }

  let keywordEmoji = _makeKeywordEmoji(data);
  let address = _makeAddress(data);
  let resource = data.resource ? data.resource : '';
  const text = templates[templateName](
    {
      whom: whom,
      date_formatted: date_formatted,
      keyword: data.keyword,
      keywordEmoji: keywordEmoji,
      catchword: data.catchword,
      resource: resource,
      address: address
    });
  if (text.length > 160) {
    return {text: text.substring(0, 160), sender: whom};
  } else {
    return {text: text, sender: whom};
  }
}

function _generateLocationLink(longitude, latitude) {
  // let address = latitude.toLocaleString('en-US', {minimumFractionDigits: 8}) + "," +
  //               longitude.toLocaleString('en-US', {minimumFractionDigits: 8});
  // let addressEncoded = encodeURIComponent(address);
  // return `http://maps.google.com/?q=${addressEncoded}`;
  if (longitude && latitude) {
    const latStr = latitude.toLocaleString('en-US', {minimumFractionDigits: 8});
    const lonStr = longitude.toLocaleString('en-US', {minimumFractionDigits: 8});

    // return `http://maps.apple.com/?daddr=${latStr}%2C${lonStr}&dirflg=c&t=m`; // with route
    return `http://maps.apple.com/?daddr=${latStr}%2C${lonStr}&t=m`; // with route

    // use car route from graphhopper to the destination
    // return `https://www.openstreetmap.org/directions?engine=graphhopper_car&route=48.24511%2C10.98660%3B${latStr}%2C${lonStr}`;

    // return `http://www.openstreetmap.org/?mlat=${latStr}&mlon=${lonStr}&zoom=17`;
  } else {
    return '';
  }
}

async function _generateTextForEmail(data) {
  let now = moment();
  const whom = await _getGroupNameById(data.groupId);
  const date_formatted = now.format('LLLL');
  const testAlarm = _isFirstSaturdayOfMonthBetween11And12(now);

  const keywordEmoji = _makeKeywordEmoji(data);
  const location = _generateLocationLink(data.longitude, data.latitude);
  const address = _makeAddress(data);
  const resource = data.resource ? (_.isArray(data.resource) ? data.resource : [data.resource]) : [];

  // plain text
  let templateName = 'emailTextAlarm0';
  if (data.keyword && !testAlarm) {
    templateName = 'emailTextAlarmWithKeyword';
  }
  if (data.keyword && data.catchword && !testAlarm) {
    templateName = 'emailTextAlarmWithCompleteInfo';
  }
  if (testAlarm) {
    templateName = templateName + 'Test';
  }
  const text = templates[templateName](
    {
      whom: whom,
      date_formatted: date_formatted,
      keyword: data.keyword,
      keywordEmoji: keywordEmoji,
      catchword: data.catchword,
      resource: resource,
      address: address,
      location: location,
      plan: data.plan
    });

  // html text
  templateName = 'emailHtmlAlarm0';
  if (data.keyword && !testAlarm) {
    templateName = 'emailHtmlAlarmWithKeyword';
  }
  if (data.keyword && data.catchword && !testAlarm) {
    templateName = 'emailHtmlAlarmWithCompleteInfo';
  }
  if (testAlarm) {
    templateName = templateName + 'Test';
  }
  const textHtml = templates[templateName](
    {
      whom: whom,
      date_formatted: date_formatted,
      keyword: data.keyword,
      keywordEmoji: keywordEmoji,
      catchword: data.catchword,
      resource: resource,
      address: address,
      location: location,
      plan: data.plan
    });

  templateName = 'emailSubjectAlarm0';
  if (data.keyword && !testAlarm) {
    templateName = 'emailSubjectAlarmWithKeyword';
  }
  const subject = templates[templateName](
    {
      whom: whom,
      date_formatted: date_formatted,
      keyword: data.keyword,
      keywordEmoji: keywordEmoji,
      catchword: data.catchword,
      resource: resource,
      address: address,
      location: location
    });

  return {text: text, textHtml: textHtml, subject: subject};
}

function _sendSMS(groupId, textSMS, recipientsByAddress, sender, smsConfig, emailConfig) {
  return new Promise((resolve, reject) => {
    const recipients = Object.keys(recipientsByAddress);
    // console.log("Sending SMS (" + textSMS.text + ") to group " + groupId);
    let t = textSMS.text;
    if (t && t.length > 40) {
      t = t.substring(0, 40) + '...';
    }
    console.log(`Sending SMS (${t}) to group ${groupId}`);

    const clientId = smsConfig.sms_client_id;
    const clientSecret = smsConfig.sms_client_secret;
    const validityHours = smsConfig.sms_validity_hours;

    let testMode = !!config.get('TEST');
    if (testMode) {
      console.log("TEST MODE: not sending SMS");
      resolve(recipients);
    } else {

      smsSendSMS(recipients, textSMS.text, clientId, clientSecret, sender, validityHours).then(results => {
        let failed = _.reject(results.Destinations[0].Destination, function (destination) {
          return destination.Code[0] === '1' || destination.Code[0] === 1;
        });
        let failedRecipients = _.map(failed, function (d) {
          const number = d.Number[0];
          let recipient = recipientsByAddress[number];
          if (!recipient) {
            console.log("Destination data of unknown recipient was ", d);
            recipient = {
              lastname: 'unknown',
              firstname: 'unknown'
            };
          }
          return {
            number: number,
            code: d.Code[0],
            description: 'not accepted by textanywhere',
            name: recipient.lastname + ', ' + recipient.firstname
          };
        });

        resolve(recipients);
        const waitSecondsUntilRetrievingStatus = smsConfig.sms_wait_for_status;
        console.log(`Waiting ${waitSecondsUntilRetrievingStatus} seconds until status for sent sms will be retrieved.`);

        setTimeout(function () {
          console.log("Retrieve status for sent SMS...");
          smsGetStatus(clientId, clientSecret, results.clientMessageReference).then(results => {

            // todo fix prev failed to include only really failed entries
            console.log("previously collected failed recipients: ", failedRecipients);
            failedRecipients = [];

            console.log("Results of request to get SMS send statuses:");
            console.log(JSON.stringify(results));

            _.each(results.Statuses[0].Status, function (status) {
              const number = status.Destination[0];
              let recipient = recipientsByAddress[number];
              if (!recipient) {
                console.log("Destination data of unknown status recipient was ", status.Destination);
                recipient = {
                  lastname: 'unknown',
                  firstname: 'unknown'
                };
              }
              // add only failed destinations
              let statusCode = parseInt(status.StatusCode[0]);
              if (isNaN(statusCode) || statusCode !== 400) {
                let description = status.StatusDescription[0];
                switch (statusCode) {
                  case 502:
                    description = `Fehler vom Mobilfunkbetreiber`;
                    break;
                  case 503:
                    description = `keine Zustellung innerhalb ${validityHours} Stunden`;
                    break;
                  case 504:
                    description = `ungültige Telefonnummer`;
                    break;
                  case 511:
                    description = `Grund unbekannt`;
                    break;
                  case 512:
                    description = `vorübergehend keine Verbindung zum Empfängergerät`;
                    break;
                  case 513:
                    description = `Nachricht vom Netz zurückgewiesen`;
                    break;
                }
                failedRecipients.push(
                  {
                    number: number,
                    code: statusCode,
                    description: description,
                    name: recipient.lastname + ', ' + recipient.firstname
                  });
              }
            });
            let sortedRecipientStatuses = _.sortBy(failedRecipients, 'name');

            // console.log("SMS Statuses: ", sortedRecipientStatuses);
            _sendSmsStatusEmail(groupId, sortedRecipientStatuses, emailConfig).then(() => {
              console.log('SMS delivery status email sent');
            }).catch(reason => {
              console.log("ERROR sending SMS delivery status email: " + reason.message);
            });
          }).catch(reason => {
            console.log("Error while requesting statuses for sent SMS: ", reason);
          });
        }, 1000 * waitSecondsUntilRetrievingStatus);

      }).catch(reason => {
        reject(reason);
      });

    }
  });
}

async function _sendEmail(groupId, textEmail, emailAddresses, emailConfig) {
  console.log("Sending email to " + util.inspect(emailAddresses, {colors: true, depth: 10}));

  const postmasterEmail = emailConfig.email_postmaster_address;

  // create reusable transport method (opens pool of SMTP connections)
  let smtpTransport = nodemailer.createTransport({
    direct: false,
    host: emailConfig.email_smtp_server_host,
    port: emailConfig.email_smtp_server_port,
    secureConnection: emailConfig.email_smtp_use_SSL,
    auth: {
      user: emailConfig.email_smtp_username,
      pass: emailConfig.email_smtp_password
    }
  });

  const fromAddress = emailConfig.email_smtp_sender_email;

  const emailMessage = textEmail.text;
  const emailMessageHtml = textEmail.textHtml;
  const emailSubject = textEmail.subject;

  let toAddress = '';
  for (let aIdx = 0; aIdx < emailAddresses.length; aIdx++) {
    if (aIdx === 0) {
      toAddress = emailAddresses[aIdx];
    } else {
      toAddress += ',' + emailAddresses[aIdx];
    }
  }

  // setup e-mail data with unicode symbols
  let mailOptions = {
    from: fromAddress, // sender address
    to: toAddress, // list of receivers
    subject: emailSubject, // Subject line
    text: emailMessage, // plaintext body
    html: emailMessageHtml // html body
  };

  let testMode = !!config.get('TEST');
  if (testMode) {
    console.log("TEST MODE: not sending Email");
    return emailAddresses;
  } else {

    // send mail with defined transport object
    const info = await new Promise((resolve, reject) => {
      smtpTransport.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("ERROR sending email:", error.message);
          reject(error);
        } else {
          resolve(info);
        }
      });
    });

    let accepted = info.accepted;
    let rejected = info.rejected;

    const responsibleEmail = await _getGroupResponsibleEmailById(groupId, postmasterEmail);
    if (responsibleEmail && rejected.length > 0) {
      mailOptions.to = responsibleEmail;
      mailOptions.subject = 'Zurückgewiesene Emails';
      mailOptions.text = '';
      mailOptions.html = templates.nonDeliveryReport({recipients: rejected});
      smtpTransport.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("ERROR sending NDR email: " + error.message);
        } else {
          console.log('NDR email sent');
        }
        return accepted;
      });
    } else {
      return accepted;
    }
  }

}

async function _sendSmsStatusEmail(groupId, statuses, emailConfig) {
  // create reusable transport method (opens pool of SMTP connections)
  let smtpTransport = nodemailer.createTransport({
    direct: false,
    host: emailConfig.email_smtp_server_host,
    port: emailConfig.email_smtp_server_port,
    secureConnection: emailConfig.email_smtp_use_SSL,
    auth: {
      user: emailConfig.email_smtp_username,
      pass: emailConfig.email_smtp_password
    }
  });

  const fromAddress = emailConfig.email_smtp_sender_email;
  const responsibleEmail = await _getGroupResponsibleEmailById(groupId, emailConfig.email_postmaster_address);

  if (responsibleEmail && statuses.length > 0) {
    let mailOptions = {
      from: fromAddress, // sender address
      to: responsibleEmail,
      subject: 'Fehler bei der SMS-Zustellung',
      html: templates.smsStatusReport({statuses: statuses}) // html body
    };

    await new Promise((resolve, reject) => {
      smtpTransport.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

}

export default router;
