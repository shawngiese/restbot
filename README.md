# restbot

## Overview
Node.js based Slack bot using the botkit frameworks. This bot can be hosted with [Beep Boop](https://beepboophq.com/docs/article/overview) hosting platform or can be run from behind your firewall where it will connect to a private server and the Slack server. The Slack API documentation can be found [here](https://api.slack.com/). The code is working ONLY with the latest Information Hub server. If you want to see the code for the previous release check the releases of this repository.

## Assumptions

This is a prototype. It is not using SSL for connections, it is not using OAUTH, and it defaults to an administrators account for everyone.

A few additional assumptions:
* If you are deploying this with the Docker service from Beep Boop, you need a [Beep Boop](https://beepboophq.com) account and a GitHub fork of this project. Otherwise you can run this script locally.
* If running this code locally (useful for debug) install node.js on your computer.
* You have installed git on your computer (so NPM install will work).
* You have a Slack team account with sufficient rights to add a bot and generate a Slack API token.
* You have an Information Hub 16 server installed and the username/password in this code matches an account on your server. The default is username Administrator with no password. This is set in the login function and in the URL to grab the sales chart.
* Get the fileID for TopSales.rptdesign and add that to the Share PDF, Share Excel, Top Sales, and Top Customers scripts.... currently there is no search for the file.

If you want to use this with an earlier version of Information Hub, check out the release of iHub REST v1 only. The earlier version uses a different authentication method and different endpoints than version 16.


## Usage

### Resources
The resources folder contains sample reports that are used in the by the bot. Copy these to Documents > Home > administrator.
If you 
Also, if you are using Slack, you might want to make custom emojis for the file types. You can find the iHub icons in your installation of iHub C:\OpenText\InformationHub\modules\BIRTiHub\iHub\web\birtservice\iportal\activePortal\images. 

This bot refers to them with the following emoji names:
:rdes:
:rdoc:
:pdf:
:xls:
:xlsx:
:data:
:datades:
:pass:
:fail:
:sched:

![](/resources/emoji.png)

### Run locally
Running the chatbot locally, from your laptop, is very useful for debugging. All of the console output will appear in the terminal you are using to run node. This is also useful if you have resources you want your chatbot to use that are not publically available on the Internet.

1. Get your Slack API token from the Manage > Custom Integrations page of your Slack Team.

2. Download the chatbot from GitHub and uncompress it to a folder.

3. Run 'npm install' in the root of the chatbot folder to install chatbot dependencies.

4. Replace the following line in index.js. Your token should be within quotation marks.
 ```    
 var token = process.env.SLACK_TOKEN
 ```
 with

 ```   
    var token = your slack token
 ```

  **Do not upload your token to a public repository.
  ** In Windows you could also set the token as an environmental variable with the command:

 ```
    set SLACK_TOKEN=<YOUR_SLACK_TOKEN>
	echo %SLACK_TOKEN%
 ```    
5. Run the chatbot with the command `node index.js`

 *Mac OS X or Linux*
```
	SLACK_TOKEN=<YOUR_SLACK_TOKEN> npm start
```    

Things are looking good if the console prints something like:

	Initializing Botkit v0.5.1
	info: ** No persistent storage method specified! Data may be lost when process shuts down.
	info: ** Setting up custom handlers for processing Slack messages
	Starting in single-team mode
	info: ** API CALL: https://slack.com/api/rtm.start
	notice: ** BOT ID: ihub16 ...attempting to connect to RTM!
	notice: RTM websocket opened
	Connected to Slack RTM
	
If you see something like:
	Starting in Beep Boop multi-team mode
	error: Invalid BEEPBOOP_RESOURCER environment variable...

Then check some of the possible reasons that happened:

* Your slack token is incorrect.
* You tried to add the token to your system environment but it did not work. Use the echo command to check if the variable is correctly set.
	
### Run in BeepBoop
If you have linked your local repo with the Beep Boop service (check [here](https://beepboophq.com/0_o/my-projects)), changes pushed to the remote master branch will automatically deploy. After making a commit to your GitHub repository, Beep Bop is notified and it clones your GitHub repository. Then Beep Bop starts building a Docker instance with your bot inside. You can see the Docker build notifications [here](https://beepboophq.slack.com/messages). Check these notifications if your bot is not appearing in the beepboop interface because there might be a problem building the Docker instance.

After a successful Docker build, the Docker instance is given a build number and available for activation. If you have your bot already running, and there are no errors in the Docker or node.js then this occurs automatically and the old bot is replaced as soon as the new bot is available.

## Acknowledgements

This code uses the [botkit](https://github.com/howdyai/botkit) npm module by the fine folks at Howdy.ai.

## License

See the [LICENSE](LICENSE.md) file (MIT).



