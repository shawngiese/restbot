var Botkit = require('botkit')
var request = require('request')
var cheerio = require('cheerio')

var myauthtoken
var message
var urlREST = 'http://localhost:8000/api/v2/'

/* NOTES
v2 supports iHub 16
Since there is no public server to run this, all methods that launch a web browser are disabled.
This is because the bot is working with an iHub server that is not available to the Internet.

v1 supports iHub 3.1
Changes:
* icons for files using custom emoji
* chart image uploaded directly to Slack (if the image is PNG)

Other sample node projects:
* application that converts SMTP alerts to Slack messages
* application that uses IDAPI and SOAP 

Passwords are hard-coded for demonstration purposes. Don't send production passwords 
  in the query string to unencrypted URLs. You can also use this as a method to 
  authenticate access, URLs such as the one used to run a report, will require a
  valid username and password to generate the report. 
Using Cheerio to scrape charts from report HTML, you might find it easier to 
  tell the server where to save images from reports. You can configure the server's 
  web.xml to save images to an accessible location.
This code pulls images from bitmap charts. SVG and HTML5 charts need conversion to bitmap 
  for use in message streams.
rptdesign files do not contain data, just the code necessary to build the report.
rptdocument files contain finished reports with queried data, images and charts.  
  You can convert these files into other document formats like PDF and Excel.
This code is for demonstration purposes, error checking is minimal.
Simple pattern matching is used to trigger code, check that any new trigger text does not 
  match patterns used by another listener.
  
Possible code evolution:
 * check if there is an existing log-in authentication before making a new one
 * enable user authentication
 * consider points to send notifications from iHub server to Slack channel
 * support report parameters in conversation
 * upload chart image into chat instead of relying on external view that will eventually become timeout
 * Get report info - select report then show title, description, type, version, timestamp, owner, permissions
 * combine in SOAP requests
*/

var token = process.env.SLACK_TOKEN

var controller = Botkit.slackbot({
    // reconnect to Slack RTM when connection goes bad
    retry: Infinity,
    debug: false
})

// Assume single team mode if we have a SLACK_TOKEN
if (token) {
    console.log('Starting in single-team mode')
    controller.spawn({
            token: token
        }).startRTM(function (err, bot, payload) {
            if (err) {
                throw new Error(err)
            }

            console.log('Connected to Slack RTM')
        })
        // Otherwise assume multi-team mode - setup beep boop resourcer connection
} else {
    console.log('Starting in Beep Boop multi-team mode')
    require('beepboop-botkit').start(controller, {
        debug: true
    })
}

controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I\'m here!")
})

/* controller.hears(['hello', 'hi'], ['direct_message'], function (bot, message) {
    bot.reply(message, 'Hello <@' + message.user + '>.')
    bot.reply(message, 'It\'s nice to talk to you directly.')
})
*/

controller.hears('.*', ['mention'], function (bot, message) {
    bot.reply(message, 'I hear you.')
})

controller.hears(['who is opentext', 'what is opentext'], ['direct_message', 'direct_mention'], function (bot, message) {
    bot.reply(message, 'Check out http://www.opentext.com/')
})

controller.hears(['tell me more', 'learn', 'enterprise'], ['direct_message', 'direct_mention'], function (bot, message) {
    bot.reply(message, 'Check out http://www.opentext.com/campaigns/enterprise-world-2016')
})

controller.hears('what is information hub', ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'The OpenText™ Information Hub (iHub) is a scalable analytics and data visualization  platform  to design, deploy, and manage secure, interactive web applications, reports, and dashboards. Click <http://www.opentext.com/what-we-do/products/analytics/opentext-information-hub|here> for more information.'
        //Putting inside JSON to enable additional message formatting
    var attachments = [{
        text: text
  }]
    bot.reply(message, {
        attachments: attachments
    })
})

//Generates a URL to open Analytic Studio
/* controller.hears(['open analytic studio', 'open studio'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Click <http://aviatioexample.actuate.com:8700/iportal/wr?userID=flightdemo&password=Demo1234|here> to open Analytic Studio in a web browser.'
        //Putting inside JSON to enable additional message formatting
    var attachments = [{
        text: text
  }]
    bot.reply(message, {
        attachments: attachments
    })
}) */

//list of commands
controller.hears('help', ['direct_message', 'direct_mention'], function (bot, message) {
    var help = 'I can answer the following requests: \n' +
        '`job schedule` display scheduled jobs and their next start time.\n' +
        '`job status` display job status and the completion time.\n' +
        '`open crosstabs` DISABLED select a data file to open in Interactive Crosstabs.\n' +
        '`open studio` DISABLED create a link to Analytic Studio.\n' +
        '`run report` DISABLED create link to run today\'s sales report.\n' +
        '`sales chart` generate and upload chart of today\'s sales.\n' +
        '`share pdf` generate and upload a PDF into chat.\n' +
        '`share spreadsheet` generate and upload an Excel file into chat.\n' +
        '`show data` see available data files.\n' +
		'`show report info` display file details for a report.\n' +		
        '`show reports` see files in your home folder.\n' +
        '`top customers` display today\'s top customers.\n' +
        '`top sales` display today\'s top sales agents.\n'
    bot.reply(message, help)
})

controller.hears(['reports', 'show reports'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listFileNames(myauthtoken, function (answer) {
            var help = 'These reports are available:\n' + answer
            bot.reply(message, help)
        })
    })
})

controller.hears(['job schedule', 'jobs scheduled', 'job scheduled'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listJobsScheduled(myauthtoken, function (answer) {
			var help = "There are no scheduled jobs."
			if (answer) { 
				help = 'These jobs are scheduled for the following times:\n' + answer
				}
            bot.reply(message, help)
        })
    })
})

controller.hears(['job status', 'jobs status'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listJobsCompleted(myauthtoken, function (answer) {
            var help = "There are no jobs run recently."
			if (answer) {
				var help = 'Here is the status of your last 10 reports:\n' + answer
				}
            bot.reply(message, help)
        })
    })
})


//Retrieves available data files
controller.hears(['data', 'show data'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listDataNames(myauthtoken, function (answer) {
            var help = 'These data files are available:\n' + answer
            bot.reply(message, help)
        })
    })
})

//Retrieves XLSX file from an rptdocument file and uploads it to Slack
// https://api.slack.com/methods/files.upload
controller.hears(['send spreadsheet', 'share spreadsheet'], ['direct_message', 'direct_mention'], function (bot, message) {
        login(function (myauthtoken) {
            downloadFile(myauthtoken, '444200000100', 'xlsx', function (answer) {
                var randomNum = Math.ceil(Math.random() * 9999)
                    //fs.writeFile("file"+randomNum+".xlsx",answer)
                console.log('Sending response to Slack')
                var r = request.post('https://slack.com/api/files.upload', function (err, res, body) {

                })

                var form = r.form()
                form.append('token', token)
                form.append('title', 'Sales data Q1')
                form.append('filename', 'file' + randomNum + '.xlsx')
                    //form.append('file', fs.createReadStream("file.xlsx"))
                form.append('file', answer, {
                    filename: 'file.xlsx'
                })
                form.append('channels', message.channel)
                    //Difficulty with botkit api so make a file upload using normal POST... above
                    /*           
             bot.api.files.upload({
                    //file: fs.createReadStream("file.xlsx"),
                    file: answer,{
                        filename: 'file.xlsx'
                        }
                    filename: "file"+randomNum+".xlsx",
                    filetype: "xlsx",
                    channels: message.channel
                },function(err,res) {
                    if (err) {
                        console.log("Failed to add file :(",err)
                        bot.reply(message, 'Sorry, there has been an error: '+err)
                    }
                })
            */
            })
        })
    })
    //Retrieves PDF file from an rptdocument file and uploads it to Slack
controller.hears(['send pdf', 'share pdf'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        downloadFile(myauthtoken, '444200000100', 'pdf', function (answer) {
            var randomNum = Math.ceil(Math.random() * 9999)
                //fs.writeFile("file"+randomNum+".xlsx",answer)
            console.log('Sending response to Slack')
            var r = request.post('https://slack.com/api/files.upload', function (err, res, body) {

                })
                //This request can be modified until the request is fired on the next cycle of the event-loop
            var form = r.form()
            form.append('token', token)
            form.append('title', 'Sales data Q1')
            form.append('filename', 'file' + randomNum + '.pdf')
            form.append('file', answer, {
                filename: 'file.xlsx'
            })
            form.append('channels', message.channel)
        })
    })
})


//retrieves data in JSON format from a bookmark in a rptdocument
controller.hears(['top sales', 'top sales people'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listTopSales(myauthtoken, function (answer) {
            var help = 'The top 5 sales people for today are:\n' + answer
            bot.reply(message, help)
        })
    })
})

//retrieves data in JSON format from a resultset in a rptdocument
controller.hears(['top customers', 'top customer'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        listTopCustomers(myauthtoken, function (answer) {
            var help = 'The top 5 customers for today are:\n' + answer
            bot.reply(message, help)
        })
    })
})


// This example downloads the chart image and then uploads it to Slack. The image is then stored in Slack.
controller.hears(['sales chart', 'chart'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Here is your chart. Image is valid for 24 hours.'
    var imageURL
    var url = 'http://aviatioexample.actuate.com:8700/iportal/iv?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__report=%2FHome%2Fflightdemo%2Fcharts.rptdocument&__bookmark=mypng&__format=html&userID=flightdemo&password=Demo1234'
    var url2 = 'http://localhost:8700/iportal/iv?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__report=%2FHome%2Fadministrator%2FInteractive%20Chart%20Filtering%20Details.rptdocument&__format=html&userID=Administrator&password=PASSWORD'
    request(url2, function (error, response, html) {
        if (!error && response.statusCode == 200) {
            var $ = cheerio.load(html)
            imageURL = $('img').attr('src') + '&userID=Administrator&password=PASSWORD'
            console.log(imageURL)
                /* var attachments = [{
                    fallback: text,
                    pretext: 'Chart generated for you',
                    title: '',
                    image_url: imageURL,
                    title_link: '',
                    text: text,
                    color: '#7CD197'
                }]
                bot.reply(message, {
                    attachments: attachments
                }, function (err, resp) {
                    console.log(err, resp)
                }) */

            downloadImage(imageURL, function (answer) {
                var randomNum = Math.ceil(Math.random() * 9999)
                console.log('Sending image to Slack')
                var r = request.post('https://slack.com/api/files.upload', function (err, res, body) {

                    })
                    //This request can be modified until the request is fired on the next cycle of the event-loop
                var form = r.form()
                form.append('token', token)
                form.append('title', 'Sales chart')
                form.append('filename', 'file' + randomNum + '.png')
                form.append('file', answer, {
                    filename: 'file.xlsx'
                })
                form.append('channels', message.channel)
            })


        } else {
            bot.reply(message, 'Sorry, the server is not available.')
        }
    })
})

//code to display file information by request
controller.hears(['get report info', 'get info', 'report info', 'show report info'], ['direct_message', 'direct_mention'], function (bot, message) {
    var fileChoices = []

    askData = function (response, convo) {
        login(function (myauthtoken) {
            fileArray(myauthtoken, function (answer) {
                var fileList = ''
                for (var i = 0; i < answer.itemList.file.length; i++) {
                    var obj = answer.itemList.file[i]
                    fileChoices[i + 1] = obj.name
                    fileList += (i + 1) + ') ' + obj.name + '\n'
                }
                console.log(answer)
                var help = 'These reports are available:\n' + fileList + '\nWhich file do you want to see additional information about?'
                convo.ask(help, function (response, convo) {
                    showFileInfo(response, answer, convo)
                    convo.next()
                })
            })
        })
    }

    showFileInfo = function (response, answer, convo) {
        var choice = (parseInt(response.text))
        console.log(choice)
        if (choice <= answer.itemList.file.length && choice > 0) {
            var attachments = [{
                fallback: answer.itemList.file[choice - 1].name + " details",
                pretext: "Report file details",
                title: answer.itemList.file[choice - 1].name,
                text: answer.itemList.file[choice - 1].description,
                "fields": [
                    {
                        "title": "Version",
                        "value": answer.itemList.file[choice - 1].version,
                        "short": true
            },
                    {
                        "title": "Type",
                        "value": answer.itemList.file[choice - 1].fileType.toLowerCase(),
                        "short": true
            },
                    {
                        "title": "Timestamp",
                        "value": answer.itemList.file[choice - 1].timeStamp,
                        "short": true
            },
                    {
                        "title": "Owner",
                        "value": answer.itemList.file[choice - 1].owner,
                        "short": true
            }
         ]
                }]
            bot.reply(message, {
                attachments: attachments
            }, function (err, resp) {
                console.log(err, resp)
            })
            convo.next()
                //console.log(convo.status)
        } else {
            convo.say('That was not a valid selection. Please start get info again.')
            convo.next()
            console.log('conversation stopped')
        }
    }
    bot.startConversation(message, askData)
})

//Generates a PDF from a report
/* controller.hears(['sales report', 'open report', 'run report'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Q1 Un-Shipped Orders.'
    var attachments = [{
        fallback: text,
        pretext: 'The following link generates your report.',
        title: 'Run report as PDF.',
        title_link: 'http://aviatioexample.actuate.com:8700/iportal/executereport.do?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__executableName=%2FPublic%2FUnshipped%20Orders%201H2013.rptdesign%3B1&__requesttype=immediate&__format=pdf&__wait=True&userID=flightdemo&password=Demo1234',
        text: text,
        color: '#7CD197'
  }]

    bot.reply(message, {
        attachments: attachments
    }, function (err, resp) {
        console.log(err, resp)
    })
}) */

//Starts conversation to select data to open in crosstab
/*controller.hears(['open crosstab', 'crosstab', 'make crosstab'], ['direct_message', 'direct_mention'], function (bot, message) {
    var fileChoices = []
    
    askData = function (response, convo) {
        login(function (myauthtoken) {
            fileArray(myauthtoken, function (answer) {
                var fileList = ''
                for (var i = 0; i < answer.ItemList.File.length; i++) {
                    var obj = answer.ItemList.File[i]
                    fileChoices[i + 1] = obj.Name
                    fileList += (i + 1) + ' ' + obj.Name + '\n'
                }
                var help = 'These data files are available:\n' + fileList + '\nWhich file do you want to open?'
                convo.ask(help, function (response, convo) {
                    generateURL(response, convo)
                    convo.next()
                })
            })
        })
    }

    generateURL = function (response, convo) {
        var choice = parseInt(response.text)
        console.log(choice)
        if (choice <= fileChoices.length && choice > 0) {
            var urlPath = 'http://aviatioexample.actuate.com:8700/iportal/da?__data=/Resources/Data%20Objects/' + encodeURIComponent(fileChoices[choice]) + '&userID=flightdemo&password=Demo1234'
                //convo.say('Click <'+ urlPath+ '|here> to open Interactive Crosstabs.')
            convo.say({
                "attachments": [
                    {
                        "text": "Click <" + urlPath + "|here> to open " + fileChoices[choice] + " with Interactive Crosstabs. \nPlease refresh the link once in browser to log in. "
                    }
                ]
            })
            console.log(convo.status)
        } else {
            convo.say('That was not a valid selection.')
            console.log('conversation stopped')
        }
    }
    bot.startConversation(message, askData)
}) */

controller.hears('.*', ['direct_message', 'direct_mention'], function (bot, message) {
    bot.reply(message, 'Sorry <@' + message.user + '>, I don\'t understand. \n')
})


function login(callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    // Configure the request
    var options = {
        url: urlREST + 'login',
        method: 'POST',
        headers: headers,
        json: true,
        form: {
            'username': 'Administrator',
            'password': ''
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the response body
            myauthtoken = body.authToken
            console.log(body)
            return callback(myauthtoken)
        }
    })
}

function countFiles(myauthtoken) {
    // Set the headers
    //var request = '';
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'search': '/Home/administrator/*'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the response body
            var count = body.totalCount
            console.log(count)
        } else {
            console.log(error)
        }
    })
}

function listFileNames(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'search': '/Home/administrator/*.rptdesign,*.rptdocument'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.itemList.file.length; i++) {
                var obj = body.itemList.file[i]
                if (obj.fileType == 'RPTDESIGN') {
                    answer += ':rdes: ' + obj.name.replace(/.rptdesign/i, '') + ' v' + obj.version + '\n └ from ' + obj.timeStamp.substring(4) + '\n'
                        //console.log(obj.name)
                }
                if (obj.fileType == 'RPTDOCUMENT') {
                    answer += ':rdoc: ' + obj.name.replace(/.rptdocument/i, '') + ' v' + obj.version + '\n └ from ' + obj.timeStamp.substring(4) + '\n'
                        //console.log(obj.name)
                }
            }
            console.log(body)
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function fileArray(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'search': '/Home/administrator/*.rptdesign,*.rptdocument'
        }
    }

    // Start the request and send back the JSON response
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            return callback(body)
        } else {
            console.log(error)
        }

    })
}

function listDataNames(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'search': '/Resources/Data Objects/*.data'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.itemList.file.length; i++) {
                var obj = body.itemList.file[i]
                if (obj.fileType == 'DATA') {
                    answer += ':data: ' + obj.name.replace(/.data/i, '') + '\n'
                        //console.log(obj.name)
                }
                if (obj.fileType == 'DATADESIGN') {
                    answer += ':datades: ' + obj.name.replace(/.datadesign/i, '') + '\n'
                        //console.log(obj.name)
                }
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function listTopSales(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'visuals/444200000100/bookmarks/table',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'format': 'json'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.data.length; i++) {
                var obj = body.data[i]
                answer += obj.SalesPerson + '\n'
                console.log(obj.SalesPerson)
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}


function listTopCustomers(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'visuals/444200000100/resultsets/TopCustomers_4',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'format': 'json'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.data.length; i++) {
                var obj = body.data[i]
                answer += obj.CUSTOMERNAME + '\n'
                console.log(obj.CUSTOMERNAME)
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function listJobsScheduled(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'jobs',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'type': 'scheduled',
            'fetchDirection': 'true'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.jobs.length; i++) {
                var obj = body.jobs[i]
                answer += ':sched: ' + obj.jobName + '\n   └» ' + obj.nextStartTime.substring(4) + '\n'
                    //console.log(obj.jobName)
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function listJobsCompleted(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request
    var options = {
        url: urlREST + 'jobs',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'type': 'completed',
			'fetchSize': '10',
            'fetchDirection': 'false'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.jobs.length; i++) {
                var obj = body.jobs[i]
                if (obj.state == 'Succeeded') {
                    answer += ':pass: ' + obj.jobName + '\n   └─ ' + obj.completionTime.substring(4) + '\n'
                        //console.log(obj.name)
                }
                if (obj.state == 'Failed') {
                    answer += ':fail: ' + obj.jobName + '\n   └─ ' + obj.completionTime.substring(4) + '\n'
                        //console.log(obj.name)
                }
                console.log(obj.jobName)
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function downloadFile(myauthtoken, fileid, format, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
        'AuthToken': myauthtoken
    }

    // Configure the request, encoding set to null to capture the return file in raw format
    var options = {
        url: urlREST + 'visuals/' + fileid + '/' + format,
        method: 'GET',
        headers: headers,
        encoding: null,
        json: true,
        qs: {
            'format': 'json'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            console.log('iHub file received')
            return callback(body)
        } else {
            console.log(error)
        }

    })
}

function downloadImage(urlImage, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1',
    }

    // Configure the request, encoding set to null to capture the return file in raw format
    var options = {
        url: urlImage,
        method: 'GET',
        headers: headers,
        encoding: null,
        json: false,
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            console.log('iHub image received')
            return callback(body)
        } else {
            console.log(error)
        }

    })
}


//not used right now
function upFile(file) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'https://slack.com/api/files.upload',
        method: 'POST',
        headers: headers,
        encoding: null,
        json: true,
        qs: {
            'format': 'json'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            return callback(body)
        } else {
            console.log(error)
        }

    })
}