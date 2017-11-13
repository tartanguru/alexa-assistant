'use strict';

var Alexa = require('alexa-sdk');
var google = require('./node_modules/googleapis');
const AWS = require('aws-sdk');
var fs = require('fs');
var wait = require('wait-one-moment');
const Stream = require("stream");
var lame = require('lame');
var grpc = require('grpc');
var resolve = require('path').resolve;
var volume = require('pcm-volume');

var OAuth2 = google.auth.OAuth2;

var assistant;
var audio_chunk = 0;
var microphoneOpen = true;
var sendingAudio = false;

// create JSON string to hold config
var config = {};

// Load AWS credentials
const Polly = new AWS.Polly();
var s3 = new AWS.S3();

const blank_audio_long = Buffer.alloc(80000,0);

// Get Google Credentials from Evironment Variables - these are set in the Lambda function configuration

const VERSION_NUMBER = '1.1';
var CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
var CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
var REDIRECT_URL = process.env.REDIRECT_URL;
var API_ENDPOINT = process.env.API_ENDPOINT;
var S3_BUCKET = process.env.S3_BUCKET;

var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

// load assistant API proto and bind using grpc

const protoDescriptor = grpc.load({
  file: 'assistant/embedded/v1alpha1/embedded_assistant.proto',
  root: resolve(__dirname, 'proto')
});

const EmbeddedAssistantClient = protoDescriptor.google.assistant.embedded.v1alpha1.EmbeddedAssistant;

const embedded_assistant = protoDescriptor.google.assistant.embedded.v1alpha1;
const callCreds = new grpc.Metadata();


const END_OF_UTTERANCE = 'END_OF_UTTERANCE';
const EVENT_TYPE = 'event_type';
const RESULT = 'result';
const AUDIO_OUT = 'audio_out';

var conversation_State = Buffer.alloc(0);
var error_text;

var APP_ID = undefined; //replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]'; NOTE THIS IS A COMPLETELY OPTIONAL STEP WHICH MAY CAUSE MORE ISSUES THAN IT SOLVES IF YOU DON'T KNOW WHAT YOU ARE DOING

var handlers = {
    
    'LaunchRequest': function () {

        // Check for required environment variables and throw spoken error if not present
        
        if (error_text){
            this.emit(':tell', error_text);   
        }
        if (!CLIENT_ID){
            this.emit(':tell','ERROR! Client ID is not set in Lambda Environment Variables','ERROR! Client ID is not set in Lambda Environment Variables')
        }
        if (!CLIENT_SECRET){
            this.emit(':tell','ERROR! Client Secret is not set in Lambda Environment Variables','ERROR! Client Secret is not set in Lambda Environment Variables')
        }
        if (!REDIRECT_URL){
            this.emit(':tell','ERROR! Redirect URL is not set in Lambda Environment Variables','ERROR! Redirect URL is not set in Lambda Environment Variables')
        }
        if (!API_ENDPOINT){
            this.emit(':tell','ERROR! API endpoint is not set in Lambda Environment Variables','ERROR! API Endpoint is not set in Lambda Environment Variables')
        }
        if (!S3_BUCKET){
            this.emit(':tell','ERROR! S3 Bucket is not set in Lambda Environment Variables','ERROR! S3 Bucket is not set in Lambda Environment Variables')
        }
        
        if (!this.event.session.user.accessToken) {
            this.emit(':tellWithLinkAccountCard', "You must link your Google account to use this skill. Please use the link in the Alexa app to authorise your Google Account.");
        } else {
            //authenticate(session.user.accessToken);
            this.emit(':ask', "How may I help?");
        }
    },

    'SearchIntent': function (overrideText) {
        
        console.log('Starting Search Intent');
        
        
        // Function variables
        var setupStart = new Date().getTime();
        var encodeStart;
        var encodeTotal;
        var pollyStart;
        var pollyTotal;
        var audioSendStart;
        var audioSendTotal;
        var responseWaitStart;
        var responseWaitTotal;
        var uploadStart;
        var uploadTotal;
        var setupTotal;
        var audioLength = 0;
        var searchFunction = this;
        var googleUtternaceText;
        var audioPresent = false;
        

            
        // Check for required environment variables and throw spoken error if not present
        
        if (!CLIENT_ID){
            this.emit(':tell','ERROR! Client ID is not set in Lambda Environment Variables','ERROR! Client ID is not set in Lambda Environment Variables')
        }
        if (!CLIENT_SECRET){
            this.emit(':tell','ERROR! Client Secret is not set in Lambda Environment Variables','ERROR! Client Secret is not set in Lambda Environment Variables')
        }
        if (!REDIRECT_URL){
            this.emit(':tell','ERROR! Redirect URL is not set in Lambda Environment Variables','ERROR! Redirect URL is not set in Lambda Environment Variables')
        }
        if (!API_ENDPOINT){
            this.emit(':tell','ERROR! API endpoint is not set in Lambda Environment Variables','ERROR! API Endpoint is not set in Lambda Environment Variables')
        }
        if (!S3_BUCKET){
            this.emit(':tell','ERROR! S3 Bucket Name is not set in Lambda Environment Variables','ERROR! S3 Bucket Name is not set in Lambda Environment Variables')
        }

        
        // Check for optional environment variables otherwise set to defaults
        
        
        var DEBUG_MODE = process.env.DEBUG_MODE;
        
    
        var POLLY_VOICE = process.env.POLLY_VOICE;
        
        // Whilst the Assistant API is US only 'Joey' seems to to be the best option for recognition
        if (!POLLY_VOICE){
            POLLY_VOICE = 'Joey';
        }
        
        
        var CHUNK_SIZE = process.env.CHUNK_SIZE;
        if (!CHUNK_SIZE){
            CHUNK_SIZE = 32000;
        }
        
        console.log('CHUNK_SIZE: ' + CHUNK_SIZE);
        
        var SEND_SPEED = process.env.SEND_SPEED;
        if (!SEND_SPEED){
            SEND_SPEED = 0.1;
        }
        
        console.log('SEND_SPEED: ' + SEND_SPEED);
        
        
        // See if text value recieved from Alexa is being over-ridden with value in environment variable
        var UTTERANCE_TEXT =  process.env.UTTERANCE_TEXT;
        var alexaUtteranceText;
        
        // No environent variable set
        if (!UTTERANCE_TEXT){
            // Have we recieved an direct utterance from another intent?
            if (overrideText){
                alexaUtteranceText = overrideText;
                console.log("Utterance recieved from another intent: " + overrideText);
                
            } else {
            // use detected utterance  
            alexaUtteranceText = this.event.request.intent.slots.search.value;
            var alexaUtteranceText_original = this.event.request.intent.slots.search.value;
            }
        } else {
            // otherwise use value in environment variable
            alexaUtteranceText = UTTERANCE_TEXT;
            console.log('Utternace text overidden in environment variables: ' + UTTERANCE_TEXT);
        }

        
        console.log('Input text to be processed is "' + alexaUtteranceText +'"');
        var ACCESS_TOKEN = this.event.session.user.accessToken;

        
        // Check whether we have a valid authentication token
        if (!ACCESS_TOKEN) { 
            // We haven't so cretae an account link card
            this.emit(':tellWithLinkAccountCard', "You must link your Google account to use this skill. Please use the link in the Alexa app to authorise your Google Account.");
        
        } else {
                 
            console.log('Starting Google Assistant');
            // console.log(ACCESS_TOKEN);

            // authenticate against OAuth using session accessToken
            
            oauth2Client.setCredentials({access_token: ACCESS_TOKEN });
            const call_creds = grpc.credentials.createFromGoogleCredential(oauth2Client);
            var channelCreds = grpc.credentials.createSsl(null);
            var combinedCreds = grpc.credentials.combineChannelCredentials(channelCreds, call_creds);
            assistant = new EmbeddedAssistantClient(API_ENDPOINT, combinedCreds);  

            const options = {};
            // create a timed event incase something causes the skill to stall
            // This will stop the skill from timing out
            wait(8, 'seconds', function() { 
                if (audioPresent == false){
                  searchFunction.emit(':tell',"I wasn't able to talk to Google - please try again") 
                }
                            
                        
            })
            
            // Create new GRPC stub to communicate with Assistant API
            const conversation = assistant.converse(callCreds, options);
            
            //Deal with errors from Google API
            // These aren't necessarily all bad unless they are fatal
            conversation.on('error', err => {
              console.log('***There was a Google error**', err);
            });
            
            conversation.on('end', () => {
                console.log('End of response from GRPC stub');
                responseWaitTotal = new Date().getTime() - responseWaitStart;
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
                    wait(0.1, 'seconds', function() {
                        console.log('Emiting blank sound');
                        searchFunction.emit(':tell'," ");
                    });
                }
                
            });
            
            
            // Create Audio Configuration before we send any commands
            // We are using linear PCM as the input and output type so encoding value is 1
 
            console.log("Creating Audio config");
            console.log('Current ConversationState is');
            console.log(conversation_State.toString());
            

            var audioSetupConfig;

            
            if (conversation_State.length < 1){
                console.log('No prior ConverseResponse')
                audioSetupConfig = {config: 
                        { 
                            audio_in_config: { encoding: 1, sample_rate_hertz: 16000 },
                            audio_out_config: { encoding: 1, sample_rate_hertz: 16000, volume_percentage: 100 } 
                        }
                       }
            } else {
                console.log('Prior ConverseResponse detected')
                audioSetupConfig = {config: 
                    { 
                        audio_in_config: { encoding: 1, sample_rate_hertz: 16000 },
                        audio_out_config: { encoding: 1, sample_rate_hertz: 16000, volume_percentage: 100 }, 
                        converse_state: {conversation_state: conversation_State}
                    }
                   }
            }
            
            // Send audio config to API
            conversation.write(audioSetupConfig);
            
            
            
            // Function to Split up audio part into chunks for sending to Google API in real time to simulate spoken request
            // This function is courtesy of Richard vowles https://github.com/rvowles/node-assistant
            
            
            var setupConversationAudioRequestStream = function (converseStream) {
                const audioPipe = new Stream.Writable();
                console.log('created audioPipe');

                    audioPipe._write = (chunk, enc, next) => {

                        console.log('Polly audio data recieved');

                        // Save total Polly respponse time
                        pollyTotal = new Date().getTime() - pollyStart;
                        
                        audioSendStart = new Date().getTime();

                        if (!chunk.length) {
                            console.log('ignoring');
                            return;
                        }
                        
                        
                        const parts = Math.ceil(chunk.length / CHUNK_SIZE);
                        console.log('chunk length is ' + chunk.length);
                        console.log("Parts = " + parts);
                        const partLength = CHUNK_SIZE/32000;    

                        audio_chunk++;
                        // Delay sending of all chunk data for this part until all previous chuncks have been sent
                        
                        
                        wait(partLength*parts*audio_chunk*SEND_SPEED, 'seconds', function() {    
                            for (let count = 0; count < parts; count++) {
                                //console.log('part: ' + count)
                                wait(partLength*count*SEND_SPEED, 'seconds', function() {
                                    //console.log('Sending Part: ' + count );
                                    sendTimedData (chunk, CHUNK_SIZE, count, converseStream);
                                });
                            }
                        });
                        next();
                };
                audioPipe.on('end', () => {
                    console.log('end of audio');
                    converseStream.end();
                });
                return audioPipe;
            };
            
            // Save total setup time in milliseconds
            setupTotal = new Date().getTime() - setupStart;
            

            // Google Assistant API does not accept text input        
            // So we convert Alexa result text to audio stream using AWS Polly
            
            pollyStart = new Date().getTime();
            const audioRequestStream = setupConversationAudioRequestStream(conversation);
            audio_chunk = -1;
            
            // sendingAudio variable is used to track as to whether we should keep sending utterance audio to API
            // This will be set to FALSE once "END_OF_UTTERANCE" message is recieved from Google API
            sendingAudio = true;
            
            const params = {
                'Text': alexaUtteranceText,
                'OutputFormat': 'pcm',
                'VoiceId': POLLY_VOICE,
                'SampleRate': '16000',
                'TextType': 'text',
            };

            // If utterance is 'stop' then we will send pre-recorded polly audio to reduce AWS charges
            if (alexaUtteranceText === "STOP"){
                console.log('Send stop command pcm');
                var readStop = fs.createReadStream('./stop.pcm');
                readStop.pipe(audioRequestStream);
 
            // 'cancel' command
            } else if (alexaUtteranceText === "CANCEL"){
                console.log('Send cancel command pcm');
                var readCancel = fs.createReadStream('./cancel.pcm');
                readCancel.pipe(audioRequestStream);
                
            // 'exit' command
            } else if (alexaUtteranceText === "exit"){
                console.log('Send exit command pcm');
                var readExit = fs.createReadStream('./exit.pcm');
                readExit.pipe(audioRequestStream);
 
            // Otherwise we send utterance text to Polly
            } else {
            
                var pollyAudio = Polly.synthesizeSpeech(params, (err, data) => {
                    if (err) {
                        console.log('There was a polly error: ' + err.code, err)
                    } else if (data) {
                        if (data.AudioStream instanceof Buffer) {
                            // Initiate the source
                            console.log('Recieved polly audio');

                            // Add 5 seconds of silence to stream - this is needed so that Assistant API can detect end of utterance event
                            var totalLength = blank_audio_long.length + data.AudioStream.length;
                            var combinedAudio = Buffer.concat([data.AudioStream, blank_audio_long] , totalLength);    
                            // convert AudioStream into a readable stream
                            var bufferStream = new Stream.PassThrough();
                            bufferStream.end(combinedAudio);
                            // Pipe into chunker for sending to Google API
                            bufferStream.pipe(audioRequestStream);
                        }
                    } 
                })
            }
            
            // Deal with responses from API
            conversation.on('data', function(ConverseResponse) {
                //console.log(ConverseResponse);
                if (ConverseResponse.converse_response == EVENT_TYPE){

                  if (ConverseResponse.event_type ){
                      // Look for "END_OF_UTTERANCE" event
                      if (ConverseResponse.event_type == END_OF_UTTERANCE){
                          console.log('End of Utterance received')
                          // Set sendingAudio to false so that we will stop streaming audio to API
                          sendingAudio = false;
                          conversation.end();
                          audioSendTotal = new Date().getTime() - audioSendStart;
                          console.log('Audio Send Total time is ' + audioSendTotal + 'ms');
                          responseWaitStart = new Date().getTime();
                      }
                  }

                }

                // Deal with RESULTS TYPE
                else if (ConverseResponse.converse_response == RESULT){
                    console.log('Result received');
                    // check there is actually a value in result
                    if (ConverseResponse.result ){

                        if (ConverseResponse.result.spoken_request_text){
                          console.log('Request text is: '+ JSON.stringify(ConverseResponse.result.spoken_request_text));
                            googleUtternaceText = JSON.stringify(ConverseResponse.result.spoken_request_text);
                           
                        }
                        if (ConverseResponse.result.microphone_mode){
                            if (ConverseResponse.result.microphone_mode == 'CLOSE_MICROPHONE'){
                                microphoneOpen = false;
                                console.log('closing microphone');
                            } else if (ConverseResponse.result.microphone_mode == 'DIALOG_FOLLOW_ON'){
                                microphoneOpen = true;
                                console.log('keeping microphone open');
                            } 
                        }
                        if (ConverseResponse.result.conversation_state) {
                            if (ConverseResponse.result.conversation_state.length > 0 ) {
                                conversation_State = ConverseResponse.result.conversation_state;
                                
                                console.log('Conversation state changed');
                                console.log('Conversation state var is:', conversation_State)
                                
                            }
                        }
                    }

                }
                
                // Deal with audio data from API
 
                else if (ConverseResponse.converse_response == AUDIO_OUT){
 
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
 
            });
            

 
             ///////////////////////////////////////////////
            
            //               START OF FUNCTIONS           //
            
            ////////////////////////////////////////////////
            
            
 
 
            // This function sends a chunk of audio data to the Assistant API via grpc
            var sendTimedData = function (chunk, size, count, converseStream){

                // Only send the chunk if the END_of_UTTERANCE command hasn't been received
                if (sendingAudio == true){
                    //console.log('sending to API');
                    const converseRequest = new embedded_assistant.ConverseRequest();
                    const end = ((count + 1) * size) > chunk.length ? chunk.length : ((count + 1) * size);
                    const bit = new Uint8Array(chunk.slice(count * size, end));
                    converseRequest.setAudioIn(bit);
                    try {
                         converseStream.write(converseRequest);
                    }
                    catch (err) {
                        console.error(err);
                    }
                } else {
                    console.log('End of utterance recieved - not sending data');
                }

            }

            // This function take the response fromt the API and re-encodes using LAME
            // There is lots of reading and writing from temp files which isn't ideal
            // but I couldn't get piping to/from LAME work reliably in Lambda

            var encode = function () {

                console.log('Starting Transcode');
                
                encodeStart = new Date().getTime();

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
                });

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
                    const filename = `response-${Date.now()}.mp3`;
                    var params = {Bucket: S3_BUCKET, Key: filename, Body: pass};
                    s3.upload(params, function(err, data) {
                        if (err) {
                            searchFunction.emit(':tell', 'There was an error uploading to S3. Please ensure that the S3 Bucket name is correct in the environment variables and IAM permissions are set correctly');
                            console.log('There was an error uploading to S3 ' + err);

                        } else {
                            // Upload has been sucessfull - we can know issue an alexa response based upon microphone state
                            uploadTotal = new Date().getTime() - uploadStart;
                            
                            var signedURL;
                            // create a signed URL to the MP3 that expires after 5 seconds - this should be plenty of time to allow alexa to load and cache mp3
                            var signedParams = {Bucket: S3_BUCKET, Key: filename, Expires: 5, ResponseContentType: 'audio/mpeg'};
                            console.log('signed url params', signedParams);

                            s3.getSignedUrl('getObject', signedParams, function (err, url) {

                                if (err) {
                                    console.error('Get signed URL error', err);
                                }

                                if (url){
                                    console.log('signed url successful', url);

                                    // ampersands are not valid in SSML so we need to escape these out with &amp;
                                    url = url.replace(/&/g, '&amp;'); // replace ampersands    
                                    signedURL = url;

                                    var cardContent = 
                                    '*********************************************************************************\n' +
                                    'DEBUG INFORMATION - Delete "DEBUG_MODE" environment variable to disable this card\n' +
                                    '*********************************************************************************\n' +
                                    'Skill Version:               ' + VERSION_NUMBER + '\n\n' +
                                    'Alexa heard:                 ' + alexaUtteranceText_original + '\n' +
                                    'Google assistant heard:       ' + googleUtternaceText + '\n' +
                                    'Polly voice was:             ' + POLLY_VOICE + '\n' +
                                    'Audio chunk size was:        ' + CHUNK_SIZE + '\n' +
                                    'Audio send speed multiplyer: ' + SEND_SPEED + '\n' +
                                    '*******************************PROCESSING TIMES**********************************\n' +
                                    'Setup Total time was:           ' + setupTotal + 'ms\n' + 
                                    'Polly Total time was:           ' + pollyTotal + 'ms\n' +
                                    'Audio Total Send Time was:      ' + audioSendTotal + 'ms\n' +
                                    'Response Wait time was:         ' + responseWaitTotal + 'ms\n' +
                                    'Encode Total time was:          ' + encodeTotal + 'ms\n' +
                                    'Total Upload time was:          ' + uploadTotal + 'ms\n\n\n' ;

                                    console.log(cardContent);
                                    var cardTitle = 'Google Assistant Debug';

                                    var speechOutput = '<audio src="' + signedURL + '"/>'; 
                                    // If API has requested Microphone to stay open then will create an Alexa 'Ask' response
                                    if (microphoneOpen == true){
                                        console.log('Microphone is open so keeping session open');
                                        console.log('Total runtime: ' + (new Date().getTime() - setupStart) );
                                        cardContent = cardContent + ('Total runtime: ' + (new Date().getTime() - setupStart) + 
                                        '\nMore detailed debug information can be found in the Cloud Watch logs' );
                                        //
                                        if (DEBUG_MODE){
                                            console.log
                                            searchFunction.emit(':askWithCard', speechOutput, null, cardTitle, cardContent);
                                        } 
                                        else {
                                            console.log(':ask', speechOutput);
                                            searchFunction.emit(':ask', speechOutput);
                                        }
                                    // Otherwise we create an Alexa 'Tell' command which will close the session
                                    } else{
                                        console.log('Microphone is closed so closing session');
                                        console.log('Total runtime: ' + (new Date().getTime() - setupStart) );
                                        cardContent = cardContent + ('Total runtime: ' + (new Date().getTime() - setupStart) +
                                        '\nMore detailed debug information can be found in the Cloud Watch logs' );
                                        if (DEBUG_MODE){
                                            searchFunction.emit(':tellWithCard', speechOutput, cardTitle, cardContent);
                                        } else {
                                            if (DEBUG_MODE) {
                                                console.log(':tell', speechOutput);
                                            }
                                            searchFunction.emit(':tell', speechOutput);
                                        }
                                    }
                                } else {
                                    searchFunction.emit(':tell', 'There was an error creating the signed URL. Please ensure that the S3 Bucket name is correct in the environment variables and IAM permissions are set correctly');
                                }
                            });
                        }
                    });
                    return pass;
                }

                // When encoding of MP3 has finished we upload the result to S3
                encoder.on('finish', function () {
                    encodeTotal = new Date().getTime() - encodeStart;
                    console.log('Encode Total time is ' + encodeTotal + 'ms');
                    uploadStart = new Date().getTime();
                    // Close the MP3 file
                    writemp3.end();
                    console.error('Encoding done!');
                    console.error('Streaming mp3 file to s3');
                    // Create read stream from MP3 file
                    var readmp3 = fs.createReadStream('/tmp/response.mp3');
                    // Pipe to S3 upload function
                    readmp3.pipe(uploadFromStream(s3));
                });        


                // Pipe output of PCM file reader to the gain process
                readpcm.pipe(vol);
                // pipe the pcm output of the gain process to the LAME encoder
                vol.pipe(encoder);
                // Pipe output of LAME encoder into MP3 file writer
                encoder.pipe(writemp3);

            }




     /// end of else /////       
       
          
        };
    
    
    },
    
    'Unhandled': function() {
        console.log('Unhandled event');
        
        var message = 'STOP';
        if (microphoneOpen == true){
            this.emit('SearchIntent', message);
        }
    },
    
    'AMAZON.StopIntent' : function () {
        console.log('Stop Intent')
        var message = 'STOP';
        if (microphoneOpen == true){
            this.emit('SearchIntent', message);
        }
        
            
    },
    'AMAZON.CancelIntent' : function () {
        console.log('Cancel Intent');
        var message = 'CANCEL';
        if (microphoneOpen == true){
            this.emit('SearchIntent', message);
        }
    },
        
    
    'SessionEndedRequest': function () {
        console.log('Session ended request');
        
        console.log(`Session has ended with reason ${this.event.request.reason}`)
        
        // Google Assistant will keep the conversation thread open even if we don't give a response to an ask.
        // We need to close the conversation if an ask response is not given (which will end up here)
        // The easiset way to do this is to just send a stop command and this will close the conversation for us
        // (this is against Amazons guides but we're not submitting this!)
        var message = 'STOP';
        if (microphoneOpen == true){
            this.emit('SearchIntent', message);
        }
        
    }
};

module.exports.googleAssistant = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    // Create DynamoDB Table
    //alexa.dynamoDBTableName = 'AlexaAssistantSettings';
    alexa.execute();
};
