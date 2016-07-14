var Botkit = require('botkit')
var request = require('request')
var cheerio = require('cheerio')

var myauthtoken
var message

/* NOTES
Passwords are hard-coded for demonstration purposes. Don't send production passwords 
  in the query string to unencrypted URLs.
Using Cheerio to scrape charts from report HTML, you might find it easier to 
  tell the server where to save images from reports. You can configure the server's 
  web.xml to save images to an accessible location.
This code pulls images from bitmap charts. SVG and HTML5 charts need conversion to bitmap 
  for use in message streams.
rptdesign files do not contain data, just the code necessary to build the report.
rptdocument files contain finished reports with queried data, images and charts.  
  You can convert these files into other document formats like PDF and Excel.
Due to the demonstrtive purposes of this code, error checking is minimimal.
Possible code evolution:
 * check if there is an existing log-in authentication before making a new one
 * enable user authentication
 * consider points to send notifications from iHub server to Slack channel
 * support report parameters in conversation
  
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

controller.hears(['hello', 'hi'], ['direct_message'], function (bot, message) {
    bot.reply(message, 'Hello <@' + message.user + '>.')
    bot.reply(message, 'It\'s nice to talk to you directly.')
})

controller.hears('.*', ['mention'], function (bot, message) {
    bot.reply(message, 'I\'m listening.')
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
controller.hears(['open analytic studio', 'open studio'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Click <http://aviatioexample.actuate.com:8700/iportal/wr?userID=flightdemo&password=Demo1234|here> to open Analytic Studio in a web browser.'
        //Putting inside JSON to enable additional message formatting
    var attachments = [{
        text: text
  }]
    bot.reply(message, {
        attachments: attachments
    })
})

//list of commands
controller.hears('help', ['direct_message', 'direct_mention'], function (bot, message) {
    var help = 'I can answer the following requests: \n' +
        '`open crosstabs` create a link to Interactive Crosstabs. Please refresh the link once in browser to log in. \n' +
        '`open studio` create a link to Analytic Studio.\n' +
        '`sales chart` see today\'s country sales.\n' +
        '`sales report` see today\'s sales report.\n' +
        '`share pdf` generates a PDF file to share.\n' +
        '`share spreadsheet` generates an Excel file to share.\n' +
        '`show data` see available data files.\n' +
        '`show files` see files in your home folder.\n' +
        '`top sales` see today\'s top sales agents.\n' 
        bot.reply(message, help)
})

controller.hears(['files', 'show files'], ['direct_message', 'direct_mention'], function (bot, message) {
    //login("aviatioexample.actuate.com", "flightdemo", "Demo1234")
    login(function (myauthtoken) {
        listFileNames(myauthtoken, function (answer) {
            var help = 'These files are available:\n' + answer
            bot.reply(message, help)
        })
    })
})

//Retrieves available data files
controller.hears(['data', 'show data'], ['direct_message', 'direct_mention'], function (bot, message) {
    //login("aviatioexample.actuate.com", "flightdemo", "Demo1234")
    login(function (myauthtoken) {
        listDataNames(myauthtoken, function (answer) {
            var help = 'These data files are available:\n' + answer
            bot.reply(message, help)
        })
    })
})

//Retrieves XLSX file from an rptdocument file
controller.hears(['send spreadsheet', 'share spreadsheet'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        downloadFile(myauthtoken, '500723000100','xlsx', function (answer) {
            var randomNum = Math.ceil(Math.random() * 9999)
            //fs.writeFile("file"+randomNum+".xlsx",answer)
            console.log('Sending response to Slack')
                 var r = request.post('https://slack.com/api/files.upload', function (err, res, body) {

                })
                  
                    var form = r.form()
                    form.append('token', token)
                    form.append('title', 'Sales data Q1')
                    form.append('filename', 'file'+randomNum+'.xlsx')
                    //form.append('file', fs.createReadStream("file.xlsx"))
                    form.append('file', answer,{
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
//Retrieves PDF file from an rptdocument file
controller.hears(['send pdf', 'share pdf'], ['direct_message', 'direct_mention'], function (bot, message) {
    login(function (myauthtoken) {
        downloadFile(myauthtoken, '500723000100', 'pdf', function (answer) {
            var randomNum = Math.ceil(Math.random() * 9999)
                //fs.writeFile("file"+randomNum+".xlsx",answer)
            console.log('Sending response to Slack')
            var r = request.post('https://slack.com/api/files.upload', function (err, res, body) {

            })
            //This can be modified until the request is fired on the next cycle of the event-loop
            var form = r.form()
            form.append('token', token)
            form.append('title', 'Sales data Q1')
            form.append('filename', 'file' + randomNum + '.pdf')
                //form.append('file', fs.createReadStream("file.xlsx"))
            form.append('file', answer, {
                filename: 'file.xlsx'
            })
            form.append('channels', message.channel)
        })
    })
})


//retrieves data in JSON format from a bookmark in a rptdocument
controller.hears(['top sales', 'top sales people'], ['direct_message', 'direct_mention'], function (bot, message) {
    //login("aviatioexample.actuate.com", "flightdemo", "Demo1234")
    login(function (myauthtoken) {
        listTopSales(myauthtoken, function (answer) {
            var help = 'The top 5 sales people for today are:\n' + answer
            bot.reply(message, help)
        })
    })
})

//Displays a chart from a bookmark in a rptdocument

/* controller.hears(['sales chart'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Here is your chart.'
    var attachments = [{
        fallback: text,
        pretext: 'Chart generated for you',
        title: '',
        //image_url: 'https://core.opentext.com/pdfjs/web/viewer.html?shortLink=69f2882a6a81b20a4657bd30f27e79374cd89918533be113',
        image_url: 'https://core.opentext.com/api/v1/s/69f2882a6a81b20a4657bd30f27e79374cd89918533be113/contents/?access_token=undefined',
        title_link: '',
        text: text,
        color: '#7CD197'
  }]

    bot.reply(message, {
        attachments: attachments
    }, function (err, resp) {
        console.log(err, resp)
    })
})
*/

controller.hears(['sales chart'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Here is your chart.'
    var imageURL
    var url = 'http://aviatioexample.actuate.com:8700/iportal/iv?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__report=%2FHome%2Fflightdemo%2Fcharts.rptdocument&__bookmark=mypng&__format=html&userID=flightdemo&password=Demo1234'
    var url2 ='http://aviatioexample.actuate.com:8700/iportal/iv?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__report=%2FHome%2Fflightdemo%2FInteractive%20Chart%20Filtering%20Details.rptdocument&__format=html&userID=flightdemo&password=Demo1234'
    request(url2, function (error, response, html) {
            if (!error && response.statusCode == 200) {
                var $ = cheerio.load(html)
                imageURL = $('img').attr('src')+'&userID=flightdemo&password=Demo1234'
                console.log(imageURL)
                var attachments = [{
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
                })
            } else {
                bot.reply(message, 'Sorry, the server is not available.')
            }
        })
})

//Generates a PDF from a report
controller.hears(['sales report', 'open report'], ['direct_message', 'direct_mention'], function (bot, message) {
    var text = 'Here is your report.'
    var attachments = [{
        fallback: text,
        pretext: 'Report generated for you',
        title: 'Download the PDF.',
        title_link: 'http://aviatioexample.actuate.com:8700/iportal/executereport.do?__locale=en_US&__vp=Default%20Volume&volume=Default%20Volume&closex=true&__executableName=%2FPublic%2FUnshipped%20Orders%201H2013.rptdesign%3B1&__requesttype=immediate&__format=pdf&__wait=True&userID=flightdemo&password=Demo1234',
        text: text,
        color: '#7CD197'
  }]

    bot.reply(message, {
        attachments: attachments
    }, function (err, resp) {
        console.log(err, resp)
    })
})

//Starts conversation to select data to open in crosstab
controller.hears(['open crosstab', 'crosstab', 'make crosstab'], ['direct_message', 'direct_mention'], function (bot, message) {
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
                        "text": "Click <" + urlPath + "|here> to open " + fileChoices[choice] + " with Interactive Crosstabs."
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
})

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
        url: 'http://restapitest.actuate.com:5000/ihub/v1/login',
        method: 'POST',
        headers: headers,
        json: true,
        form: {
            'username': 'flightdemo',
            'password': 'Demo1234'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the response body
            myauthtoken = body.AuthId
                //console.log(token)
            return callback(myauthtoken)
        }
    })
}

function countFiles(myauthtoken) {
    // Set the headers
    //var request = '';
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'authId': myauthtoken,
            'folderId': '40000000100'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the response body
            var count = body.TotalCount
            console.log(count)
        } else {
            console.log(error)
        }
    })
}

function listFileNames(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'authId': myauthtoken,
            'folderId': '540000000100'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.ItemList.File.length; i++) {
                var obj = body.ItemList.File[i]
                answer += obj.Name + '\n'
                console.log(obj.Name)
            }
            return callback(answer)
        } else {
            console.log(error)
        }

    })
}

function fileArray(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'authId': myauthtoken,
            'folderId': '740000000100'
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

function listDataNames(myauthtoken, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/files',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'authId': myauthtoken,
            'folderId': '740000000100'
        }
    }

    // Start the request
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // Print out the JSON contents
            var answer = ''
            for (var i = 0; i < body.ItemList.File.length; i++) {
                var obj = body.ItemList.File[i]
                answer += obj.Name + '\n'
                console.log(obj.Name)
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
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/visuals/500723000100/bookmarks/table',
        method: 'GET',
        headers: headers,
        json: true,
        qs: {
            'authId': myauthtoken,
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

function downloadFile(myauthtoken, fileid, format, callback) {
    // Set the headers
    var headers = {
        'User-Agent': 'bottalk/0.0.1'
    }

    // Configure the request, encoding set to null to capture the return file in raw format
    var options = {
        url: 'http://restapitest.actuate.com:5000/ihub/v1/visuals/'+fileid+'/'+format,
        method: 'GET',
        headers: headers,
        encoding: null,
        json: true,
        qs: {
            'authId': myauthtoken,
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
            'authId': myauthtoken,
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