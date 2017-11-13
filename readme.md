# alexa-assistant

Implementation of the Google Assistant API for Alexa

# Release 1.1

Minor change to STOP and CANCEL intents to only trigger assistant if follow-on mode is true

### THIS SKILL IS FOR PERSONAL USE ONLY AND IS NOT ENDORSED BY GOOGLE OR AMAZON. WHILST THIS SKILL USES AN OFFICIAL GOOGLE API, IT WILL NEVER PASS AMAZON CERTIFICATION DUE TO THE WAY THE RESPONSES ARE HOSTED.

This skill is an implementation of the official Google Assistant API wrapped as an Alexa skill. It supports many of the same functions as the Raspberry Pi version of the Google Assistant but there are some limitations in functionality due to the Amazon Echo platform. It is limited to 500 requests a day and only supports US English (although it is usable in the UK). It supports local search, IFTTT and should support most Actions as long as the responses are less than 90 seconds and don't require use of the Home app.

NOTE - this skill is built against the beta version of the Assistant API so it may stop working if an API update is released (which will happen eventually - an updated version of this skill will be released in that event)

The following features are **NOT** supported: -

1. Alarms and timers. Use Alexa for these.

1. Device location. If you have a Home address set in your google account then it will use that as a default. NOTE:- if you are in Europe and want weather forecasts in metric then just ask the assistant to "Change my units to Celsius".

1. Playing music, news, or podcasts is not supported.

1. Account linking for third party services requires owning a Google Home and installing the Google Home application. This affects using services like Uber, or connecting to home automation devices like Hue.

1. Multiple Users are not supported - it will only use the Google account linked through the Alexa app

1. Asking Google Assistant to change volume. You will need to ask Alexa directly.

A short demo of the skill in action is here:-

[![Alt text](https://img.youtube.com/vi/KA3W6eR_6LY/0.jpg)](https://youtu.be/KA3W6eR_6LY)

# KNOWN ISSUES

1. **This skill uses chargeable services on Amazon Web Services - although these *should* be free for the first 12 months of use if you are a new user of AWS. Otherwise the costs will be approx $5.20 per year based upon 1000 calls to the skill a month. See the AWS Charges section below for more details**

1. If you unlink the skill to your account and then re-enable it then the skill might keep asking for you to re-link every hour. You can resolve this by going to this page and removing the Alexa Skill https://myaccount.google.com/permissions?pli=1. Relink the skill via the alexa web app https://alexa.amazon.com You should then be able to relink the skill permanently.

1. You will need to give Google Assistant access to the following features on your Google account. If you do not give access to these then the skill will not work and you it will tell you "There are some things I need to set up in the Google Home app first". (This is a Google policy not mine). If you are concerned about privacy, then you could use a new google account just for this skill and not login using this account elsewhere

    1. Web & App Activity - Make sure the box marked "Include Chrome browsing history and activity from websites and apps that use Google Services" is also checked
    2. Location History
    3. Device Information
    4. Voice & Audio Activity
    
4. Shopping lists are supported - you will need to use the Google Express app to see them, or if you are not in the US or don't want to use the app then you can access the shopping list here: - https://www.google.com/express/shoppinglist/

5. Recognition accuracy and response time. The Google Assistant API only supports voice input and Alexa only makes the text of a spoken enquiry available to a skill. Therefore the skill has to take the text recognised by Alexa, convert it to speech and then send this to Google. This takes time and can potentially reduce accuracy - there isn't much that can be done about this unless Google opens up a text interface or Amazon allow access to the raw audio from the Alexa request.

6. The Google API only supports the US version of the Google Assistant and is US English only, however it will still work in other countries. Local services *should* work if you set a home/work addresses in your google account as per the instructions here:- https://support.google.com/maps/answer/3093979?co=GENIE.Platform%3DDesktop&hl=en

7. Responses from the assistant are returned as audio. Alexa is limited, as part of an SSML spoken response, to playing back MP3 files that are less then 90 seconds. If the Assistant response is longer than this then it will be truncated.

8. Audio quality. The skill has to convert the Assistant output into a 48kb/s MP3 for use with Alexa which means that the audio loses some fidelity in the process.


### SECURITY WARNING. In order for this skill to work the response from Google must be made available as a publicly accessible mp3 file. Rather than host this in an open AWS S3 bucket, the bucket and it’s contents are kept private but a temporary publicly signed URL is created by AWS which expires after 5 seconds. These URLs are unique and typically over 600 characters long (see example below). 

```
https://XXXXXXXXXXXXXXX.s3-eu-west-1.amazonaws.com/XXXXXXXXXXXXXXX?AWSAccessKeyId=ASXXXXXXXXXX6AVQQ&amp;Expires=1497107703&amp;Signature=BoNNOAcm0VhEVy9jcQqCeP9gkWw%3D&amp;response-content-type=audio%2Fmpeg&amp;x-amz-security-token=FQoDYXdzEI3%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDHC4OE%2BjSG18yTrmnyLpAfoDMxG%2BWPPphnXnkTjw6SmFP8AulH1woW5ZkmrQn5zafK1Sbbv1S8L1n0GzJlRuV8vcT4fijUjek3zJ%2F0NJEYI18enHwyiERD0SXXXXXXXXXXXX%2F9gwI98rw8cKeK9VM1iqhDpPZZxkCJ0Xy0dWfNCe8vuP4j9ZQHMeuSESBU8WrjzXsvZGDn2b8HuenlEVJp0WaH68qUWBuJpGvEDmeAooD7hA%2Fr4XCm8ZS%2FZqa4i05QvbmRX8mjn8eRwgb%2FRBPS190IswaGoxOa9vgSXASRewWJfMjftjM6XXXXXXXXXXKL%2B878kF
```

### In theory anyone who has the URL can access the response, however this URL never leaves the secure AWS skill environment so it cannot be hijacked/intercepted, and due to the very short 5 second period that the mp3 file is exposed via this single link, the chances of someone being able to undertake a brute force attack to find out the URL are statistically close to zero. The S3 bucket can be securely accessed from your AWS account at any time from https://console.aws.amazon.com/s3/

### IF THIS IS NOT ACCEPTABLE TO YOU THEN PLEASE DO NOT INSTALL THIS SKILL! 

# AWS CHARGES
This Skill uses AWS Polly and S3 which are normally charged on a pay as you go basis (this is charged by Amazon not me). There is a free trial tier of these for one year from first use and the resource usage of this skill *should* fall within the limits of this free tier but this will depend on how often you personally use the skill. After 12 months, or beyond those free limits, usage will be chargable. 

**IF PAYING AWS CHARGES IS NOT ACCEPTABLE TO YOU THEN PLEASE DO NOT INSTALL THIS SKILL**

A breakdown of estimated charges based upon 1000 uses per month are below. These figures are taken from https://aws.amazon.com/s3/pricing/ and https://aws.amazon.com/polly/pricing/ as of 4th June 2017.

Assuming your S3 bucket is in the US East (Northern Virginia) Region, the S3 fees based upon 1000 requests to the skill are calculated as follows:

|Monthly Usage|Calculation|Monthly Cost|
|-------------|-----------|--------|
|2000 PUT requests|2000 x $0.005/1000|$ 0.01|
|2000 GET requests per month|2000 x $0.005/1000|$ 0.01|
|0.1GB of Storage per month|0.1 x $0.023|$ 0.01|

**Annual cost = $0.36**


|Monthly Usage|Calculation|Monthly Cost|
|-------------|-----------|--------|
|1000 requests of 100 characters(100,000 characters)|100000 x $0.000004|$ 0.40|

**Annual cost = $4.80 per year**
                                        
You can view your charges for the current billing period at any time on the Amazon Web Services web site, by logging into your Amazon Web Services account, and clicking “Account Activity” under “Your Web Services Account”.

The skill uses local PCM files for "STOP', "CANCEL" and "EXIT" commands to reduce the number of Polly calls.

**AGAIN - IF PAYING AWS CHARGES IS NOT ACCEPTABLE TO YOU THEN PLEASE DO NOT INSTALL THIS SKILL**

# CREDITS

Paul Hibbert for producing the installation video.

Richard Vowles for his Typescript based Google Assistant client which gave me some pointers on getting the API running in pure node.js https://github.com/rvowles/node-assistant

John JDuo, Pete Bready and Mark Riley for proof reading these installation instructions and testing beta versions.

# SETUP INSTRUCTIONS (VIDEO)

Paul Hibbert has created a rather fine set of installation instructions here:-

[![Alt text](https://img.youtube.com/vi/2KzbJyTQTZE/0.jpg)](https://www.youtube.com/watch?v=2KzbJyTQTZE)

# SETUP INSTRUCTIONS (TEXT)

To run the skill you need to do a number of things: -

1. Clone this repository
3. deploy the example code in Lambda.
3. configure the Alexa skill to use Lambda.
4. get an API key from Google.
5. link skill to your Google Account.

## Clone this repository

You may either clone this repository or for it if you would like to make modifications.

```shell
git clone git@github.com/grocky/alexa-assistant
```

## AWS Lambda Setup (Part 1)

If you do not have an account already, go to http://aws.amazon.com/. You will need to set-up an AWS account (the basic one will do fine) if you don't have one already. Make sure you use the same Amazon account that your Echo device is registered to. **Note - you will need a credit or debit card to set up an AWS account - there is no way around this. Please see the AWS Charges section above**
Once your account is set, you will need to configure your environment with access keys. Follow this [Getting Started Guide](http://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) for steps to set up your environment.

In the project directory, run `npm install` to install all of the project dependencies.

Copy the example environment variable file that will hold your secret credentials and configurations:

```shell
cp serverless.env.yaml.example serverless.env.yaml
```

We will fill this in later after setting up your Google and Alexa applications.

Let's deploy the lambda function now to ensure the environment is set up.

```
npm run deploy
```

This will establish a new cloudformation stack that will create the Lambda Function, S3 Buckets, and policies necessary for the Alexa skill.

> **TODO**: describe an easy way to find the lambda function ARN.

## Alexa Skill Setup (Part 1)

**NOTE - if you have already installed my previous Google Skill and have used the "google" invocation name for this then you will either have to use a different invocation name for this skill or rename/delete the older Google skill**

1. In a new browser tab/window go to the Alexa Console (https://developer.amazon.com/edw/home.html and select Alexa on the top menu)
1. If you have not registered as an Amazon Developer then you will need to do so. Fill in your details and ensure you answer "NO" for "Do you plan to monetize apps by charging for apps or selling in-app items" and "Do you plan to monetize apps by displaying ads from the Amazon Mobile Ad Network or Mobile Associates?"

![alt text](screenshots/payment.jpeg)

1. Once you are logged into your account go to to the Alexa tab at the top of the page.
2. Click on the yellow "Get Started" button under Alexa Skills Kit.

![alt text](screenshots/getting_started.jpeg)

3. Click the "Add a New Skill" yellow box towards the top right.

![alt text](screenshots/add_new_skill.jpeg)

4. You will now be on the "Skill Information" page.
5. Set "Custom Interaction Model" as the Skill type
6. Select the language as English (US), English (UK) - **Note German is not currently supported and won't be until the Google Assistant API supports it**
6. Set the "Name" to 

    ```
    Google Assistant for Alexa
    ```
    
8. You can set the "Invocation Name" to whatever you want although some names work better than others. I have found that "google" or "my assistant" seem to work well. The name you choose will be the activation name e.g. "Alexa, ask my assistant how long will it take to drive to London?". For these instructions we will set "google" as the invocation name, so in this case you would say: "Alexa, Ask google who is the queen of england". For best results the invocation name should be lowercase **NOTE - if you have already installed my previous Google Skill and have used the "google" invocation name for this then you will either have to use a different invocation name for this skill or rename/delete the older Google skill.**

8. Leave the Global Fields settings to "No".
9. Click "Save" and then click "Next".

![Skill infrormation](screenshots/skill_information.png)

10. You will now be on the "Interaction Model" page.
11. Copy the text below into the "Intent Schema" box.

    ```
    {
      "intents": [
        {
          "intent": "AMAZON.StopIntent"
        },
        {
          "intent": "AMAZON.CancelIntent"
        },
        {
          "slots": [
            {
              "name": "search",
              "type": "SEARCH"
            }
          ],
          "intent": "SearchIntent"
        }
      ]
    }
    ```
![alt text](screenshots/intent_schema.jpeg)

12. Under Custom Slot Types:-
13. Type into the "Enter Type" field (NOTE - this is capitalised) :-
    ```
    SEARCH
    ```
    
14. Copy the text below and paste into the "Enter Values" box and then click "Add"

    ```
    who is the queen
    why is the sky blue
    ```
![alt text](screenshots/slot_types.jpeg)

15. Copy the text below and paste them into the Sample Utterances box.

    ```
    SearchIntent {search}
    ```
![alt text](screenshots/utterances.jpeg) 

16. Click "Save" and then "Next".
17. You will now be on the "Configuration" page.
18. Select "AWS Lambda ARN (Amazon Resource Name)" for the skill Endpoint Type.
19. Paste into the "Default" box the ARN you copied earlier from the AWS Lambda setup.
19. Leave "Provide geographical region endpoints?" set to "No"

![alt text](screenshots/endpoint.jpeg) 

20. Select "Yes" for Account Linking

At this point we will pause the setup of the skill and setup the google API. Copy the two Redirect URLs lower down the page you are currently on (one will start with https://layla.amazon.com/api/skill/link the other https://pitangui.amazon.com/api/skill/link - see screenshot below) and paste them into a Notepad document on windows or TextEdit on mac. We will need these during the setup of the Google API and later on in the setup of the Lambda function

![alt text](screenshots/redirect.jpeg)

**Leave this page open as we will come back to it after we have setup the Google Assistant API**

### Enable Google Assistant API:-
To enable access to the Google Assistant API, do the following:

1. In a **new** browser tab or window, go to the Cloud Platform Console here https://console.cloud.google.com/project (If this is the first time you have use the google developer console then you will need to agree to the Terms of service on the pop-up box.)
![alt text](screenshots/google_terms.jpg)

2. Click on "Select a project" and then the "+" button to create a new project
![alt text](screenshots/new_google_project.jpg)

3. Give the project a name, it doesn't really matter what it is but it needs to be unique so Google will add a series of numbers to the end of the name if somebody has already used it. Press create.
4. You will be taken to a new page. It will take about 15 seconds for the project to be created. Look for a notification within the blue bar at the top of the page. Once the project is created click on the notification and then select the "Create Project: XXX" where XXX is the name that you gave the project.

![alt text](screenshots/google_notification.jpg)

5. Click on this link: - https://console.developers.google.com/apis/api/embeddedassistant.googleapis.com/overview This will take you to a page entitled "API manager".
6. Click on the blue text near the top that says "ENABLE".

![alt text](screenshots/enable.jpeg)

7. Once the next page had loaded - click on "Create Credentials"

![alt text](screenshots/create_credentials.jpeg)

8. Make sure "Google Assistant API" is selected under "Which API are you using?"
9. Under "Where will you be calling the API from?" select "Web server (e.g. node.js, Tomcat)
9. Under "What data will you be accessing?" select "User data".
9. Click on the blue "What credentials do I need?" button.

![alt text](screenshots/credentials_1.jpeg)

10. On the next page set the Name to :-

    ```
    google_assistant
    ```
    
10. Under Authorised redirect URIs, paste the first of the "Redirect URLS" from the skill setup page and hit "Enter"
11. A second box will appear - into this paste the second "Redirect URL" and then hit "Enter" again
12. Click the blue "Create client ID" button.

![alt text](screenshots/credentials_2.jpeg)

13. On the next page the Email address field should auto populate with your Google account email address
14. In the "Product name shown to users" enter:-

    ```
    Assistant
    ```

15. Click on the blue "Continue" button.

![alt text](screenshots/credentials_3.jpeg)

16. On the next page click on the blue text that says "I'll do this later"

![alt text](screenshots/credentials_4.jpeg)

17. A new page will appear. Click on the OAuth 2.0 client ID called "google_assistant"

![alt text](screenshots/credentials_5.jpeg)

18. Copy the text in the Client ID box (excluding the Client ID text) and paste it into a new line in your Notepad/TextEdit document 

![alt text](screenshots/client_id.jpeg)

19. Copy the text in the Client Secret box (excluding the Client Secret text) and paste it into a new line in your Notepad/TextEdit document 

![alt text](screenshots/client_secret.jpeg)

You can now close this tab/window


## Alexa Skill Setup (Part 2)

1. Return to the Alexa skill page that we paused at earlier
2. In the Authorization URL paste the following: -

    ```
    https://accounts.google.com/o/oauth2/auth?access_type=offline
    ```
2. Delete the existing text from the "Client ID" field (it will probably say "alexa-skill")  
3. Copy the Client ID from your Notepad/TextEdit document (HINT - it's the longer of the two) and paste it into the Client ID box

![alt text](screenshots/linking_1.jpeg)

4. Under Domain List : Press "Add domain" and enter:-

    ```
    google.com
    ```

5. Press "Add domain" again for a second box into which enter:-

    ```
    googleapis.com
    ```

6. Under Scope: Press "Add Scope" and enter:-

    ```
    https://www.googleapis.com/auth/assistant-sdk-prototype
    ```
    
7. Press "add scope" again for a second box into which enter:-

    ```
    https://www.googleapis.com/auth/script.external_request
    ```
    
![alt text](screenshots/linking_2.jpeg)

8. Under Authorisation Grant Type make sure "Auth Code Grant" is selected.
9. The Access Token URI should be set to: -
    
    ```
    https://accounts.google.com/o/oauth2/token
    ```

10. Copy the Client Secret from your Notepad/TextEdit document (HINT - it's the shorter of the two) and paste it into the Client Secret box
11. Leave Client Authentication Scheme as "HTTP Basic"
12. Leave eveything under Permission unselected.
13. Paste into the Privacy Policy URL box: -

    ```
    https://www.google.com/policies/privacy/
    ```
![alt text](screenshots/linking_3.jpeg)    

14. Click "Save" and then "Next".

15. There is no need to go any further through the process i.e. submitting for certification. There is no point in testing the skill on the next page as the simulator cannot authenticate against the Google API. 

**You can now close this window/tab - makes sure you save your Notepad/TextEdit file somewhere safe in case you need these details again**


## AWS Lambda Setup (Part 2)

1. Return to the Lambda Function page we left open earlier.
2. Click on the Lambda function "Code" tab.

![alt text](screenshots/code_tab.jpeg) 

4. Go to the Environment Variables that you created earlier
3. Paste the google Client Secret from your Notepad/TextEdit doc into the value field for the CLIENT_SECRET variable.
4. Paste the google Client ID from your Notepad/TextEdit doc into the value field for the CLIENT_ID variable.
5. If you are based in UK/Europe then paste the "Redirect URL" from the skill setup page that starts with "https://pitangui.amazon.com/api/skill/link" into the REDIRECT_URL variable. If you are based in the US then paste the one that starts with "https://layla.amazon.com/api/skill/link/"

![alt text](screenshots/environment_variables_2.jpeg)

6. Hit "Save" at the top (**Not "Save and Test"** If you do press this then just ignore the error that appears)


## Linking the skill to your Google Account

1. In order to use the Google Assistant, you must share certain activity data with Google. The Google Assistant needs this data to function properly; this is not specific to the SDK.

2. Open the Activity Controls page https://myaccount.google.com/activitycontrols for the Google account that you want to use with the Assistant. Ensure the following toggle switches are enabled (blue):

    1. Web & App Activity - Make sure the box marked "Include Chrome browsing history and activity from websites and apps that use Google Services" is also checked 
    2. Location History
    3. Device Information
    4. Voice & Audio Activity
    
3. Launch the Google skill by asking "Alexa, open google" (or whatever invocation name you gave e.g. "my assistant"
4. The skill will tell you if you have forgotten to set any environment variables or if there any other set-up issues
4. You will then be prompted to link your account through the Alexa app.
5. Select the Google account you want to use (it does not have to be the one you authorised the API with) and then make sure you click "Allow" on the Google authorisation page. 

![alt text](screenshots/authorise.jpeg)

6. If you have problems linking through the IOS or Android app then please try the web based version of the Alexa app here:- http://alexa.amazon.com

6. NOTE - you can deauthorise the app at any time by removing it from your google account by going here https://myaccount.google.com/permissions?pli=1 and removing the app called "Assistant"

![alt text](screenshots/app_remove.jpeg)

7. If you want local searches to work then you will need to set a home and work address as per these instructions :- https://support.google.com/maps/answer/3093979?co=GENIE.Platform%3DDesktop&hl=en


The S3 bucket can be accessed from your AWS account at any time from AWS https://console.aws.amazon.com/s3/

# OPTIONAL ENVIRONMENT VARIABLES

There are a number of optional environment variables that can be set. These are for debugging purposes and may break things!

|Key           |Description            |Possible Values| Default Value (if variable is not set)|
|--------------| ----------------------|---------------|----------------------------|
|DEBUG_MODE|Produces an Alexa card for each response showing debug information such as the utternace detected by Alexa, the utterance detected by Google along with a breakdown of processing time.|true|(No effect unless set)| 
|POLLY_VOICE|Voice used for Polly text to speech|[Polly Docs](http://docs.aws.amazon.com/polly/latest/dg/voicelist.html)|Joey|
|CHUNK_SIZE|The size in bytes of the PCM audio chunks to be sent to the API. The API will send an error if this is too big|integer|32000 (1 second of PCM)|
|SEND_SPEED|The skill will try and send chucks in real time. This variable will act as a multiplier. 1 = realtime, <1 faster than real time, >1 slower than real time. Faster than real time is best used with large chunk sizes. The API will send an error if the chunks are sent too fast|Float |0.1 (once every 100ms to speed up responses. This is significantly faster than real time, but we are using a large chunk size and a small number of chunks so we can get away with it!)|
|UTTERANCE_TEXT|Override the Alexa speech to text and send a specific phrase to Polly|string|(No effect unless set)|
