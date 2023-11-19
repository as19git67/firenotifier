const https = require('https');
const xml2js = require('xml2js');
const _ = require('underscore');
const {v1: uuidv1} = require('uuid');


const CharacterSetIDs = {
  Unicode: 1,
  GSM_03_38: 2
};

const ReplyMethodIds = {
  Originator_11chars_NoReply: 1,
  Email: 2,
  WebService: 3,
  PhoneNumber: 4,
  URL: 5,
  Reserved: 6,
  ShortCode_NoReply: 7
};

// no sender phone number needed, because senderName is used and recipients can't reply to the message anyway
module.exports.sendSMS = function sendSMS(recipientList, message, clientId, clientSecret, senderName, validityHours) {
  return new Promise((resolve, reject) => {

    const haveSenderNumber = senderName.substring(0, 4) === '+491';

    // senderName = senderName.replace(' ', '_');  // due to a bug in textanywheres backend, spaces are not sent
    if (haveSenderNumber) {
      if (senderName.length > 11) {
        senderName = senderName.substring(0, 11);
      }
    } else {
      if (senderName.length > 11) {
        senderName = senderName.substring(0, 11);
      }
    }

    let validHours;
    try {
      validHours = parseInt(validityHours);
    } catch (e) {
      reject({message: 'sendSMS: validityHours must be integer number of hours'});
    }

    if (recipientList && recipientList.length > 0) {

      let options = {
        host: 'www.textapp.net',
        port: 443,
        path: '/webservice/httpservice.aspx',
        headers: {
          'Content-Type': "application/x-www-form-urlencoded"
        },
        method: 'POST'
      };

      let destinations = '';
      for (let idx = 0; idx < recipientList.length; idx++) {

        if (idx === 0) {
          destinations = encodeURIComponent(recipientList[idx]);
        } else {
          destinations += ',' + encodeURIComponent(recipientList[idx]);
        }
      }

      let charactersetId = CharacterSetIDs.Unicode;
      if (message.length > 70) {
        charactersetId = CharacterSetIDs.GSM_03_38;
      }

      if (message.length > 160) {
        message = message.substring(0, 160);
      }

      const clientMessageReference = encodeURIComponent(uuidv1());

      let data = "method=sendsms" +
        "&returncsvstring=false" +
        "&charactersetid=" + charactersetId +
        "&externallogin=" + clientId +
        "&password=" + clientSecret +
        "&clientbillingreference=" + encodeURIComponent(senderName) +
        "&clientmessagereference=" + clientMessageReference +
        "&originator=" + encodeURIComponent(senderName) +
        "&destinations=" + destinations +
        "&body=" + encodeURIComponent(message) +
        "&validity=" + validHours +
        "&replymethodid=" + ReplyMethodIds.Originator_11chars_NoReply;

      console.log(
        `Calling sendsms for textanywhere with validity of ${validHours} hours and client message reference ${clientMessageReference} for ${recipientList.length} recipients...`);

      _sendRequest(options, data).then(result => {
        result.clientMessageReference = clientMessageReference;
        resolve(result);
      }).catch(reason => {
        reject(reason);
      });
    } else {
      console.log("Not sending SMS for empty recipients list");
      reject({message: 'empty recipients list'});
    }
  });
};

function _sendRequest(options, data) {
  return new Promise((resolve, reject) => {
    let responseData = '';
    let req = https.request(options, function (res) {

      res.on('data', function (chunk) {
        responseData += chunk;
      });

      res.on('end', function () {
        //console.log('textanywhere response: ' + responseData);
        xml2js.parseString(responseData, function (err, xml) {
          if (err) {
            reject(err);
          } else {
            // let failedNumbers = {};
            // const destinations = xml.SendSMSResponse.Destinations;
            // _.each(destinations, function(destination) {
            // });
            const transaction = xml.SendSMSResponse.Transaction[0];
            const code = transaction.Code[0];
            //var transactionsDescription = transaction.Description[0];

            if (code === "1" || code === 1) {
              resolve(xml.SendSMSResponse);
            } else {
              reject({message: transaction.Description[0]});
            }
          }
        });
      });
    });

    req.on('error', function (e) {
      console.log('problem with request to textanywhere api: ' + e.message);
      reject(e);
    });

    // write data to request body
    req.write(data);
    req.end();
  });
}

module.exports.getStatus = function getStatus(clientId, clientSecret, clientMessageReference) {
  return new Promise((resolve, reject) => {
    let options = {
      host: 'www.textapp.net',
      port: 443,
      path: '/webservice/httpservice.aspx',
      headers: {
        'Content-Type': "application/x-www-form-urlencoded"
      },
      method: 'POST'
    };

    let data = "method=getsmsstatus" +
      "&returncsvstring=false" +
      "&externallogin=" + clientId +
      "&password=" + clientSecret +
      "&clientmessagereference=" + clientMessageReference;

    let responseData = '';
    let req = https.request(options, function (res) {

      res.on('data', function (chunk) {
        responseData += chunk;
      });

      res.on('end', function () {
        xml2js.parseString(responseData, function (err, xml) {
          if (err) {
            reject(err);
          } else {
            resolve(xml.GetSMSStatusResponse);
          }
        });
      });
    });

    req.on('error', function (e) {
      console.log('problem with request to textanywhere api: ' + e.message);
      reject(e);
    });

    // write data to request body
    req.write(data);
    req.end();

  });
};
