'use strict';


var Alexa = require('alexa-sdk');
var google = require('googleapis');
const AWS = require('aws-sdk');
var fs = require('fs');
var every = require('every-moment');
var wait = require('wait-one-moment');
const Stream = require("stream");

var resolve = require('path').resolve;
var volume = require('pcm-volume');
var request = require('request');
var xmlescape = require('xml-escape');

// load native modules
var lame = require('./lib/node_modules/lame');
var grpc = require('./lib/node_modules/grpc')


var OAuth2 = google.auth.OAuth2;
var firstRunText = 'REPEAT AFTER ME Welcome to the unofficial Google Assistant skill for the Amazon Echo. For other languages and local search results, please open the Google Assistant app on your phone and complete the language and address settings.'

// create JSON object to hold config
var config = {};

// Load AWS credentials

var s3 = new AWS.S3();

// Get Google Credentials from Evironment Variables - these are set in the Lambda function configuration

const VERSION_NUMBER = '1.1';
var CLIENT_ID
var CLIENT_SECRET
var REDIRECT_URL
var API_ENDPOINT = process.env.API_ENDPOINT;
var S3_BUCKET = process.env.S3_BUCKET;
var PROJECT_ID

var oauth2Client 

// load assistant API proto and bind using grpc

const protoDescriptor = grpc.load({
  file: 'assistant/embedded/v1alpha2/embedded_assistant.proto',
  root: resolve(__dirname, 'proto')
});

const EmbeddedAssistantClient = protoDescriptor.google.assistant.embedded.v1alpha2.EmbeddedAssistant;

const embedded_assistant = protoDescriptor.google.assistant.embedded.v1alpha12

const END_OF_UTTERANCE = 'END_OF_UTTERANCE';
const EVENT_TYPE = 'event_type';
const RESULT = 'result';
const AUDIO_OUT = 'audio_out';
var locale

var settingsError
var settingsLoaded = false
var registeredwithAPI = false
var jsonError = false
var configJson


var APP_ID = undefined; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]'; NOTE THIS IS A COMPLETELY OPTIONAL STEP WHICH MAY CAUSE MORE ISSUES THAN IT SOLVES IF YOU DON'T KNOW WHAT YOU ARE DOING

getSecretParams();


function getSecretParams() {
    
    var secretParams = {
      Bucket: S3_BUCKET, 
      Key: "client_secret.json"
    };
    console.log('Getting JSON')
    s3.getObject(secretParams, function(err, data) {
       if (err) {
            settingsError = 'I could not load the client secret file from S3. Please make sure that you have uploaded it into the correct place on the S3 bucket'
            settingsLoaded = true
        }

       else {

           configJson = JSON.parse(new Buffer(data.Body).toString("utf8"));
           console.log(configJson)
           if (configJson.hasOwnProperty('web')){
                console.log('Valid JSON found')
                CLIENT_SECRET = configJson.web.client_secret
                CLIENT_ID = configJson.web.client_id
                PROJECT_ID = configJson.web.project_id
                REDIRECT_URL = configJson.web.redirect_uris[0]                  
                oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)

               if (configJson.hasOwnProperty('registered')){
                   console.log('Registration with API is completed')
                   registeredwithAPI = true
                   settingsLoaded = true
                   jsonError = false

               } else {
                   console.log('Registration with API is not completed')
                   settingsLoaded = true
               }

            } else {
               settingsLoaded = true
               settingsError = 'The client secret file was not configured for a web based client. Please ensure you follow the instructions when creating the credentials in the Google API console'
                    }
            }
     });


}

function setup (requester) {
    
    // This isn't massively efficient code but it only needs to run once!
    
    var ACCESS_TOKEN = requester.event.session.user.accessToken;
    console.log('token')
    console.log(ACCESS_TOKEN)
    //authenticate against Google OAUTH2
    oauth2Client.setCredentials({access_token: ACCESS_TOKEN });
    const call_creds = grpc.credentials.createFromGoogleCredential(oauth2Client);
    var channelCreds = grpc.credentials.createSsl(null);
    var combinedCreds = grpc.credentials.combineChannelCredentials(channelCreds, call_creds);
    //Create Stub
    var assistant = new EmbeddedAssistantClient(API_ENDPOINT, combinedCreds);
    var bearer = 'Bearer ' + ACCESS_TOKEN
    var registrationModelURL = 'https://embeddedassistant.googleapis.com/v1alpha2/projects/' + PROJECT_ID + '/deviceModels/'
    var registrationInstanceURL = 'https://embeddedassistant.googleapis.com/v1alpha2/projects/' + PROJECT_ID + '/devices/'

    // Start the request
    //Registering Model
    var registerModel = function (callback) {
        var deviceModel = {
          "project_id": PROJECT_ID,
          "device_model_id": PROJECT_ID,
          "manifest": {
            "manufacturer": "Assistant SDK developer",
            "product_name": "Alexa Assistant v1",
            "device_description": "Alexa Assistant Skill v1"
          },
          "device_type": "action.devices.types.LIGHT",
          "traits": ["action.devices.traits.OnOff"]
        }
        var deviceModelString = JSON.stringify(deviceModel)
        var POSToptionsModel = {
          url: registrationModelURL,
          method: 'POST',
          headers: {
              'Authorization': bearer,
              'Content-Type': 'application/json'
             },
            body: deviceModelString
        };
        request(POSToptionsModel, function (error, response, body) {
            if (error){
                callback(error, null);
            } else if (response){
                var bodyJSON = JSON.parse(body)
                if (bodyJSON.error){
                    console.log('error code recieved')
                    if (bodyJSON.error.code == 409){
                        console.log('Device already exists')
                        callback (null, bodyJSON)
                    } else {
                        callback (bodyJSON, null)
                    }
                } else {
                    callback (null, bodyJSON)
                }
            }
        })
    }

    //Registering instance
    var registerInstance = function (id, callback) {
        var instanceModel = {
            "id": id,
            "model_id": id,
            "nickname": "Alexa Assistant v1",
            "clientType": "SDK_SERVICE"
          }
        var instanceModelString = JSON.stringify(instanceModel)
        var POSToptionsInstance = {
          url: registrationInstanceURL,
          method: 'POST',
          headers: {
              'Authorization': bearer,
              'Content-Type': 'application/json'
             },
            body: instanceModelString
        };
        request(POSToptionsInstance, function (error, response, body) {
            if (error){
                callback(error, null);
            } else if (response){
                var bodyJSON = JSON.parse(body)
                if (bodyJSON.error){
                    console.log('error code recieved')
                    if (bodyJSON.error.code == 409){
                        console.log('Instance already exists')
                        callback (null, bodyJSON)
                    } else {
                        callback (bodyJSON, null)
                    }
                } else {
                    callback (null, bodyJSON)
                }
            }
        })
    }

    // lets register the model and instance - we only need to do this once
    registerModel (function(err, result)  {
        if(err){
            console.log ('Got Model register error', err)
            settingsError = 'There was an error registering the Model with the Google API. The first time that you run the skill, make sure that you are logged into the same google account that created the API'
            registeredwithAPI = true
        } else if (result){
            console.log('Got positive model response' + result)
            registerInstance (PROJECT_ID, function(err, result){
                if (err){
                    console.log('Error:', err)
                    settingsError = 'There was an error registering the Instance with the Google API. The first time that you run the skill, make sure that you are logged into the same Google account that created the API'
                    registeredwithAPI = true
                } else if (result){
                    console.log('Got positive Instance response' )
                    var jsondata = configJson
                    jsondata['registered'] = true
                    var jsonpayload = JSON.stringify(jsondata)
                    var params = {
                        Bucket: S3_BUCKET, 
                        Key: "client_secret.json", 
                        Body: jsonpayload,
                        ContentType: "application/json"
                    }
                    s3.upload(params, function(err, data) {
                        if (err){
                        console.log('S3 upload error: ' + err) 
                            settingsError = 'There was an error uploading to S3. Please ensure that the S3 Bucket name is correct in the environment variables and IAM permissions are set correctly'
                            registeredwithAPI = true

                        } else{
                            configJson['registered'] = true
                            requester.attributes['microphone_open'] = false;
                            registeredwithAPI = true
                        }
                    })
                  }
            })
        }
    })
}

var handlers = {
    'LaunchRequest': function () {
        var launchRequest = this
        
        if (!launchRequest.event.session.user.accessToken) {
                settingsError = null
                settingsLoaded = false
                jsonError = true
                this.emit(':tellWithLinkAccountCard', "You must link your Google account to use this skill. Please use the link in the Alexa app to authorise your Google Account. If you are repeatedly asked to do this every hour then please see the troubleshooting steps on the github page github.com/tartanguru/alexa-assistant");
            }
        
         else {   
            if (jsonError == true){
                getSecretParams()
            }
            // Wait for the client secret file to load from S3
            wait(0.1, 'seconds', function() {
                if(settingsLoaded == false) {
                    console.log('Waiting for setup to complete');
                    this.start();
                } else {
                    console.log('Setup Complete')
                    if (settingsError){
                        console.log('There was an error: ' + settingsError)
                        var errorSpeech = settingsError
                        settingsError = null
                        settingsLoaded = false
                        jsonError = true
                        launchRequest.emit(':tellWithCard', errorSpeech, "Setup Error", errorSpeech)
                    }
                     else {
                        if (registeredwithAPI == false){
                            console.log ('Not Registered with API')
                            setup(launchRequest)
                            wait(0.1, 'seconds', function() {
                                if(registeredwithAPI == false) {
                                    console.log('Waiting for regisration to complete');
                                    this.start();
                                } else {
                                    console.log('Registration Function Complete')
                                    if (settingsError){
                                        console.log('There was an error: ' + settingsError)
                                        var errorSpeech = settingsError
                                        settingsError = null
                                        settingsLoaded = false
                                        registeredwithAPI = false
                                        launchRequest.emit(':tellWithCard', errorSpeech, "Setup Error", settingsError)
                                    } else {
                                       launchRequest.emit('SearchIntent', firstRunText); 
                                    }
                                }
                            })   
                        }
                        else  {   
                            launchRequest.emit('SearchIntent', 'Hello');  
                        }
                    };        
                }
            })
        }
    },
    
    
    'SearchIntent': function (overrideText) {
        
        var overideLocale = 'en-US'
        console.log('Locale is:- ' + locale)
        if (locale == 'en-GB' || locale == 'de-DE' || locale == 'en-AU' || locale == 'en-CA' || locale == 'en-IN' || locale == 'ja-JP' || locale == 'fr-FR'){
            overideLocale = locale
            
        }
        var searchFunction = this
        // Function variables
        var audioLength = 0
        var googleResponseText = ''
        var audioPresent = false
        var microphoneOpen = true
        var audio_chunk = 0;
        var conversation_State = Buffer.alloc(0)
        // See if text value recieved from Alexa is being over-ridden with value in environment variable
        var alexaUtteranceText;
        // Have we recieved an direct utterance from another intent?
        if (overrideText){
            alexaUtteranceText = overrideText;
            console.log("Utterance recieved from another intent: " + overrideText)
        } else {
        // use detected utterance  
            alexaUtteranceText = searchFunction.event.request.intent.slots.search.value
        }
        console.log('Input text to be processed is "' + alexaUtteranceText +'"')

        console.log('Starting Search Intent')
        
        
        var ACCESS_TOKEN = searchFunction.event.session.user.accessToken;
        // Check whether we have a valid authentication token
        if (!ACCESS_TOKEN) {
            
            settingsError = null
            settingsLoaded = false
            jsonError = true
            // We haven't so create an account link card
            searchFunction.emit(':tellWithLinkAccountCard', "You must link your Google account to use this skill. Please use the link in the Alexa app to authorise your Google Account. If you are repeatedly asked to do this every hour then please see the troubleshooting steps on the github page. github.com/tartanguru/alexa-assistant");
        } 
        
        else {

            

            if (jsonError==true){
                getSecretParams()
            }

            // create a timed event incase something causes the skill to stall whilst loasding settings from S3
            // This will stop the skill from timing out
            wait(5, 'seconds', function() { 
                if (settingsLoaded == false){
                  searchFunction.emit(':tell',"There was a problem loading the settings from the S3 Bucket") 
                }        
            })

            // Wait for the client secret file to load from S3
           wait(0.02, 'seconds', function() {
                if(settingsLoaded == false) {
                    console.log('Waiting for setup to complete');
                    this.start();
                } else {
                    if (settingsError){

                        var errorSpeech = settingsError
                        settingsError = null
                        settingsLoaded = false
                        jsonError = true
                        searchFunction.emit(':tellWithCard', errorSpeech, "Setup Error", errorSpeech)

                    } 
                        else {

                            if (registeredwithAPI == false){
                                console.log ('Not Registered with API')
                                setup(searchFunction)
                                wait(0.1, 'seconds', function() {
                                    if(registeredwithAPI == false) {
                                        console.log('Waiting for registration to complete');
                                        this.start();
                                    } else {
                                        console.log('Registration Complete')
                                        if (settingsError){
                                            console.log('There was an error: ' + settingsError)
                                            var errorSpeech = settingsError
                                            settingsError = null
                                            settingsLoaded = false
                                            registeredwithAPI = false
                                            searchFunction.emit(':tellWithCard', errorSpeech, "Setup Error", settingsError)
                                        } else {
                                           searchFunction.emit('SearchIntent', firstRunText); 
                                        }
                                    }
                                })   
                            }
                            else  {   
                                console.log('token')
                                        console.log(ACCESS_TOKEN)
                                        createassistant(ACCESS_TOKEN, searchFunction)  
                            }                
                        }
                    }
                })
            }
        
        
  
    function createassistant (token, searchFunction ){
        // authenticate against OAuth using session accessToken
        oauth2Client.setCredentials({access_token: token });
        const call_creds = grpc.credentials.createFromGoogleCredential(oauth2Client);
        var channelCreds = grpc.credentials.createSsl(null);
        var combinedCreds = grpc.credentials.combineChannelCredentials(channelCreds, call_creds);
        var assistant = new EmbeddedAssistantClient(API_ENDPOINT, combinedCreds); 
            const options = {};
        // create a timed event incase something causes the skill to stall
        // This will stop the skill from timing out
        wait(9, 'seconds', function() { 
            if (audioPresent == false){
              searchFunction.emit(':tell', "I wasn't able to talk to Google - please try again") 
            }          
        })

        // Create new GRPC stub to communicate with Assistant API
        const callCreds = new grpc.Metadata();
        const conversation = assistant.assist(callCreds, options);
        //Deal with errors from Google API
        conversation.on('error', err => {
          console.log('***There was a Google error**' + err);
            searchFunction.emit(':tell', "The Google API returned an error which was:- " + JSON.stringify(err)) 
        });
        conversation.on('end', () => {
            console.log('End of response from GRPC stub');
            // close resonse file which will then trigger encode
            responseFile.end();
        });
        // create file into which we will stream pcm response from Google
        // Closing the stream into this file will trigger encoding into MP3
        console.log ('Creating temp response file') 
        var responseFile = fs.createWriteStream("/tmp/response.pcm",{flags: 'w'},{encoding: 'buffer'});
        responseFile.on('finish', function () {
            console.log('temp response file has been written');
            const stats = fs.statSync("/tmp/response.pcm")
            const fileSizeInBytes = stats.size
            console.log('files size is '+ fileSizeInBytes)

            // Check whether response file has any content. If it doesn't then we have a response
            // with no audio
            if (fileSizeInBytes > 0 ){
                // encode MP3
                encode();
            } else {
                // Save setting and exit

                // have a short pause until exiting

                    console.log('Emiting blank sound')
                    searchFunction.emit(':tell',"I didn't get an audio response from the Google Assistant")

            }

        });
        // Create Audio Configuration before we send any commands
        // We are using linear PCM as the input and output type so encoding value is 1

        console.log("Creating Audio config");
        //config if no previous conversation_state
        var setupConfigTemplate1 = {
            config: { 
                audio_out_config: { 
                    encoding: 1, 
                    sample_rate_hertz: 16000, 
                    volume_percentage: 100  
                },
                dialog_state_in: {
                    language_code: overideLocale
                },
                device_config: {
                    device_id: PROJECT_ID,
                    device_model_id: PROJECT_ID
                },
                text_query: alexaUtteranceText
            }
        }
        //config if there is a previous conversation_state
        var setupConfigTemplate2 = {
            config: { 
                audio_out_config: { 
                    encoding: 1, 
                    sample_rate_hertz: 16000, 
                    volume_percentage: 100  
                },
                dialog_state_in: {
                    conversation_state: conversation_State,
                    language_code: overideLocale
                },
                device_config: {
                    device_id: PROJECT_ID,
                    device_model_id: PROJECT_ID
                },
                text_query: alexaUtteranceText
            }
        }

        var setupConfig = {}

        if (!searchFunction.attributes['CONVERSTION_STATE']){
            console.log('No prior ConverseResponse')
             setupConfig = setupConfigTemplate1

        } else {
            console.log('Prior ConverseResponse detected')
            conversation_State = Buffer.from(searchFunction.attributes['CONVERSTION_STATE'])
            setupConfig = setupConfigTemplate2


        }

        console.log('Current ConversationState is ', conversation_State);
        
        // Send config request to API
        conversation.write(setupConfig);

        // Deal with responses from API
        conversation.on('data', function(ConverseResponse) {

            // Deal with RESULTS TYPE

                // check there is actually a value in result
                if (ConverseResponse.dialog_state_out ){
                    console.log('Dialog state out recieved')
                    if (ConverseResponse.dialog_state_out.supplemental_display_text){

                        googleResponseText = googleResponseText + xmlescape(JSON.stringify(ConverseResponse.dialog_state_out.supplemental_display_text))
                        console.log('Supplemental text is: '+ googleResponseText);
                    }
                    if (ConverseResponse.dialog_state_out.microphone_mode){
                        if (ConverseResponse.dialog_state_out.microphone_mode == 'CLOSE_MICROPHONE'){

                            microphoneOpen = false;
                            searchFunction.attributes['microphone_open'] = false
                            console.log('closing microphone');

                        } else if (ConverseResponse.dialog_state_out.microphone_mode == 'DIALOG_FOLLOW_ON'){
                            microphoneOpen = true;
                            searchFunction.attributes['microphone_open'] = true
                            console.log('keeping microphone open');
                        } 
                    }
                    if (ConverseResponse.dialog_state_out.conversation_state){
                        if (ConverseResponse.dialog_state_out.conversation_state.length > 0 ){
                            conversation_State = ConverseResponse.dialog_state_out.conversation_state;

                            console.log('Conversation state changed');
                            console.log('Conversation state var is:')
                            searchFunction.attributes['CONVERSTION_STATE'] = conversation_State.toString();

                        }
                    }
                }

            // Deal with audio data from API

            if (ConverseResponse.audio_out){
                //console.log('audio received')
                var audio_chunk = ConverseResponse.audio_out.audio_data;
                if (audio_chunk instanceof Buffer) {
                    audioLength = audioLength + audio_chunk.length;

                    if (audioPresent == false){
                        audioPresent = true;

                    }
                    // Total length of MP3's in alexa skills must be less than 90 seconds.
                    if ( audioLength <= (90*16*16000/8)){  // Seconds x Bits per sample x samples per second / 8 to give bytes per second
                        responseFile.write(audio_chunk);

                    } else {
                        // we won't write any more timestamps
                        console.log ('Ignoring audio data as it is longer than 90 seconds')

                    }

                };

            }

        })
    }
            
    // This function takes the response fromt the API and re-encodes using LAME
    // There is lots of reading and writing from temp files which isn't ideal
    // but I couldn't get piping to/from LAME work reliably in Lambda

    function encode() {

        console.log('Starting Transcode');
        // Read the linear PCM response from file and create stream
        var readpcm = fs.createReadStream('/tmp/response.pcm');
        readpcm.on('end', function () {  
            console.log('pcm stream read complete')
        });
        // Create file to which MP3 will be written
        var writemp3 = fs.createWriteStream('/tmp/response.mp3');
        // Log when MP3 file is written
        writemp3.on('finish', function () {
          console.log('mp3 has been written');
            // Create read stream from MP3 file
            var readmp3 = fs.createReadStream('/tmp/response.mp3');
            // Pipe to S3 upload function
            readmp3.pipe(uploadFromStream(s3));
        })
        // Create LAME encoder instance
        var encoder = new lame.Encoder({
              // input
              channels: 1,        // 1 channels (MONO)
              bitDepth: 16,       // 16-bit samples
              sampleRate: 16000,  // 16,000 Hz sample rate

              // output
              bitRate: 48,
              outSampleRate: 16000,
              mode: lame.JOINTSTEREO // STEREO (default), JOINTSTEREO, DUALCHANNEL or MONO
            }); 

        // The output from the google assistant is much lower than Alexa so we need to apply a gain
        var vol = new volume();
        // Set volume gain on google output to be +75%
        // Any more than this then we risk major clipping
        vol.setVolume(1.75);
        // Create function to upload MP3 file to S3 
        function uploadFromStream(s3) {
            var pass = new Stream.PassThrough();
            var filename = searchFunction.event.session.user.userId
            var params = {Bucket: S3_BUCKET, Key: filename, Body: pass};
            s3.upload(params, function(err, data) {
                if (err){
                console.log('S3 upload error: ' + err) 
                    searchFunction.emit(':tell', 'There was an error uploading to S3. ');

                } else{
                    // Upload has been sucessfull - we can know issue an alexa response based upon microphone state
                    var signedURL;
                    // create a signed URL to the MP3 that expires after 5 seconds - this should be plenty of time to allow alexa to load and cache mp3
                    var signedParams = {Bucket: S3_BUCKET, Key: filename, Expires: 10, ResponseContentType: 'audio/mpeg'};
                    s3.getSignedUrl('getObject', signedParams, function (err, url) {

                        if (url){
                            // escape out any illegal XML characters;
                            url = xmlescape(url)
                            signedURL = url;

                            // if response text is blank just add a speaker icon to response
                            if (googleResponseText == ''){
                                googleResponseText = '"🔊"'
                            }

                            // remove any REPEAT AFTER ME form alexa utterance 
                            var cleanUtterance = alexaUtteranceText.replace('REPEAT AFTER ME ', '');

                            var cardContent = 'Request:<br/><i>' + cleanUtterance + '</i><br/><br/>Supplemental Response:<br/>' + googleResponseText
                            // replace carriage returns with breaks
                            cardContent = cardContent.replace(/\\n/g, '<br/>');
                            // deal with any \&quot;
                            cardContent = cardContent.replace(/\\&quot;/g, '&quot;');
                            console.log(cardContent);
                            var cardTitle = 'Google Assistant for Alexa'
                            // Let remove any (playing sfx)
                            cardContent = cardContent.replace(/(\(playing sfx\))/g, '🔊');
                            var speechOutput = '<audio src="' + signedURL + '"/>'; 
                            var template = {
                                "type": "BodyTemplate1",
                                "token": "bt1",
                                "backButton": "HIDDEN",
                                "title": cardTitle,
                                "textContent": {
                                    "primaryText": {
                                        "text": cardContent,
                                        "type": "RichText"
                                    }
                                }
                            }
                            searchFunction.response.speak(speechOutput)
                            if (searchFunction.event.context.System.device.supportedInterfaces.Display) {
                                searchFunction.response.renderTemplate(template);
                            }
                            // If API has requested Microphone to stay open then will create an Alexa 'Ask' response
                            // We also keep the microphone on the launchintent 'Hello' request as for some reason the API closes the microphone

                            if (microphoneOpen == true || alexaUtteranceText == 'Hello'){
                                console.log('Microphone is open so keeping session open')                        
                                searchFunction.response.listen(" ");
                                searchFunction.emit(':responseReady');    
                            } 
                            // Otherwise we create an Alexa 'Tell' command which will close the session
                            else{
                                console.log('Microphone is closed so closing session')
                                searchFunction.response.shouldEndSession(true)
                                    searchFunction.emit(':responseReady')

                            }
                        } else {
                            searchFunction.emit(':tell', 'There was an error creating the signed URL.');
                        } 
                    });

                  }
                });
                return pass;
            }

            // When encoding of MP3 has finished we upload the result to S3
            encoder.on('finish', function () {
                // Close the MP3 file
                wait(0.1, 'seconds', function() { 
                    console.error('Encoding done!');
                    console.error('Streaming mp3 file to s3');    
                    writemp3.end();             
                })
            });        


            // Pipe output of PCM file reader to the gain process
            readpcm.pipe(vol);
            // pipe the pcm output of the gain process to the LAME encoder
            vol.pipe(encoder);
            // Pipe output of LAME encoder into MP3 file writer
            encoder.pipe(writemp3);

        }
    },
    
    'Unhandled': function() {
        console.log('Unhandled event');
        this.emit(':ask', "I'm not sure what you said. Can you repeat please");

    },
    
    'AMAZON.StopIntent' : function () {
        console.log('Stop Intent')
        var message = 'stop';
        if (this.attributes['microphone_open'] == true){
            this.emit('SearchIntent', message);
        }else {
            this.emit(':tell', 'Stopped');
        }      
    },
    'AMAZON.HelpIntent' : function () {
        console.log('Help Intent')
        var message = 'What can you do';
        this.emit('SearchIntent', message);
    },
    'AMAZON.CancelIntent' : function () {
        console.log('Cancel Intent')
        var message = 'cancel';
        if (this.attributes['microphone_open'] == true){
            this.emit('SearchIntent', message);
        } else {
            this.emit(':tell', 'Cancelled');
        }
    },
    'AMAZON.NoIntent' : function () {
        console.log('No Intent')
        var message = 'no';
        if (this.attributes['microphone_open'] == true){
            this.emit('SearchIntent', message);
        }
    },
    'AMAZON.YesIntent' : function () {
        console.log('Yes Intent')
        var message = 'yes';
        if (this.attributes['microphone_open'] == true){
            this.emit('SearchIntent', message);
        }
    },
        
    
    'SessionEndedRequest': function () {
        console.log('Session ended request');
        console.log(`Session has ended with reason ${this.event.request.reason}`)

        // Google Assistant will keep the conversation thread open even if we don't give a response to an ask.
        // We need to close the conversation if an ask response is not given (which will end up here)
        // The easiset way to do this is to just send a goodbye command and this will close the conversation for us
        // (this is against Amazons guides but we're not submitting this!)
        var message = 'goodbye';
        if (this.attributes['microphone_open'] == true){
            this.emit('SearchIntent', message);
        }
        
    }
};


exports.handler = function(event, context, callback){
    var alexa = Alexa.handler(event, context);
    locale = event.request.locale
    alexa.registerHandlers(handlers);
    //Create DynamoDB Table
    alexa.dynamoDBTableName = 'AlexaAssistantSkillSettings';
    alexa.execute();
};




