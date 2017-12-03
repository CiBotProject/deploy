var constants = require('./modules/constants')
var Promise = require('bluebird');
var Botkit = require('botkit');
var Coveralls = require('./modules/coveralls');
var Travis = require('./modules/travis');
var Github = require('./modules/github');
var tokenManager = require("./modules/tokenManager");
var bodyParser = require('body-parser');
// const slack_data = require('data-store')("slack-data",{cwd:"slack-data"});
const express = require('express');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ***************
 *
 * GENERAL STARTUP
 * 
 * ***************
 */

var controller = Botkit.slackbot({
  debug: false,
  json_file_store: 'slack-persistent-storage'
});

var defaultThreshold = 95;

var testing = false;
var myUrl = ''
if (testing) {
  var localtunnel = require('localtunnel');
  var tunnel = localtunnel(3000, { /*subdomain: 'andrewigibektimsamuelsourabh' */},function(err, tun) {
    if (err){
      console.log("\n\n***** TUNNEL ERROR *****\n\n", err);
    }// the assigned public url for your tunnel
    // i.e. https://abcdefgjhij.localtunnel.me
    else {
      myUrl = tun.url;
      console.log(tun.url);
      if(tun.url != myUrl)
        console.log("Url has been changed.. delete yaml file in repo and reinitialize");
    }
  })
  
  tunnel.on('close', function () {
    // tunnels are closed
  });
}
else {
  myUrl = 'http://13.85.65.255:3000';
}

// slack_data.set("defaultThreshold",95);

// connect the bot to a stream of messages
var bot = controller.spawn({
  token: process.env.SLACK_TOKEN,
}).startRTM()

/* *************************
 *
 * EXPRESS APP API ENDPOINTS
 * 
 * *************************
 */
// Liveness tests
app.listen(3000, () => console.log('Example app listening on port 3000'));
app.get('/test', (req, res) => { res.send('Hello') });

//Travis
/**
 * 
 */
app.post("/travis/:channel", function (req, res) {
  let payload = JSON.parse(req.body.payload);
  let commit = payload.commit;
  let channel = req.params.channel;
  console.log(payload);

  var msg = {
    'text': '',
    'channel': channel // channel Id for #slack_integration
  };


  controller.storage.channels.get(channel, function (err, channel_data) {
    if (channel_data) {
      getBreaker = function() {
        Travis.lastBuild(channel_data.owner, channel_data.repo, payload.commit_id, function(resp){
          // console.log(resp);
          Github.getCommitterLoginWithHash(channel_data.owner, channel_data.repo, payload.commit).then( function(breaker){
            channel_data.issue.breaker.push(breaker);
            saveChannelDataLogError(channel_data, 'POST RESPONSE broken')
          });
        });
      }

      if (payload.state === "failed") {
        msg.text = `Build has failed. To create an issue please type "@${bot.identity.name} create issue"`

        channel_data.issue.title = `Build with commit_id ${payload.commit_id} has failed`;
        getBreaker();
        bot.say(msg);
      }
      else {
        Coveralls.getCoverageInfo(commit, channel_data.coverage).then(function (coverage) {
          if (coverage.status === constants.SUCCESS) {
            msg.text = coverage.message;
          }
          else if (coverage.status === constants.FAILURE) {
            var coverageBelowThreshold = channel_data.coverage - coverage.data.body.covered_percent;

            msg.text = `Coverage ${coverageBelowThreshold} percent below threshold. To create an issue please type "@${bot.identity.name} create issue"`

            channel_data.issue.title = `Coverage ${coverageBelowThreshold} percent below threshold`;
            getBreaker();
          }
          bot.say(msg);
        });
      }
    }
    else {
      console.log(`**POST ERROR** Received post from Travis but could not find a channel!\n\nparams: ${JSON.stringify(req.params)}\npayload: ${JSON.stringify(payload)}`)
    }
  });
  res.send("ack");
});

/* ************************
 *
 * BOT CONTROLLER LISTENERS
 * 
 * ************************
 */

/**
 * ADD GITHUB TOKEN TO BOT
 * 
 * TODO: convert this to a team storage
 */
controller.hears(['add-token'], ['direct_message'], function (bot, message) {
  console.log(message.text);
  let messageArray = message.text.split(' ');
  if (messageArray.length < 2) {
    bot.reply(message, `The command syntax is *add-token user=token*`);
    return;
  }
  messageArray = messageArray[1].split('=');

  tokenManager.addToken(messageArray[0], messageArray[1]);
  bot.reply(message, `The user "${messageArray[0]}" token "${messageArray[1]}" is stored :tada::tada::tada:.`)
});

/**
 * RESET THE REPOSITORY
 * 
 * Start a conversation to reset the repository registered to the channel
 */
controller.hears(['reset travis'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  bot.startConversation(message, askChannelReset);
});

/**
 * INITIALIZE REPOSITORY
 */
controller.hears(['init travis'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {

  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('travis');

  if (messageArray.indexOf('help') === -1 && messageArray.indexOf('travis') !== -1 && messageArray.indexOf('init') !== -1) {

    controller.storage.channels.get(message.channel, function (err, channel_info) {
      console.log(err)
      console.log(channel_info)
      if (channel_info) {
        bot.reply(message, 'This channel has already been initialized.');
        bot.reply(message, 'Reset this channel using the command `reset travis` to initialize another repository.')
        return;
      }
      else {
        //repo name has to be word after init
        var repoString = null;

        if ((index + 1) < messageArray.length)
          repoString = messageArray[index + 1];
        //if repo name is provided
        if (repoString !== null) {
          //format is owner/repo-name
          let repoContent = repoString.split('/');
          let owner = repoContent[0];
          let repo = repoContent[1];

          //console.log(tokenManager.getToken())
          if (tokenManager.getToken(repoContent[0]) === null) {
            bot.reply(message, `Sorry, but token for *${repoContent[0]}* is not found :disappointed:. You can add tokens using the \"*add-token user=token*\" command in a direct message to me. DO NOT send a token where others can see it!`);
            return;
          }

          // Enable issues before activating Travis
          Github.enableIssues(owner, repo).then(function () {
            Travis.activate(owner, repo, function (data) {
              bot.reply(message, data.message);
              if (data.status == constants.ERROR) {
                console.log(data);
                return
              }

              // we have successfully initialized the repo, so store the mapping
              var mapping = {
                'id': message.channel,
                'owner': owner,
                'repo': repo,
                'coverage': defaultThreshold,
                'issue': {
                  'breaker': [],
                  'title': '',
                  'body': ''
                }
              }
              saveChannelDataLogError(mapping, 'init travis', function() {
                bot.reply(message, `Coverage threshold for the current repository is set to ${defaultThreshold}%`);
                bot.startConversation(message, askYamlCreation);
              })
            });
          });
        }
        else {
          bot.reply(message, "Please provide the name of the repository to be initialized. Ex init travis <owner>/<repository>");
        }
      }
    })

  }
  else {
    bot.reply(message, helpCommands().init);
  }
});

/**
 * CONFIGURE YAML FILE
 */
controller.hears(['configure yaml'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  //start conversation with one user, replies from other users should not affect this conversation
  //TODO: test this functionality by letting a different user reply, expected outcome should be no reply from bot to that user
  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('yaml');

  getChannelDataOrPromptForInit(message, 'configure yaml', function (channel_data) {
    bot.startConversation(message, askYamlCreation);
  });
});

/**
 * CREATE AN ISSUE
 * 
 * This will create an issue. If an issue has come up on this channel, the details for that issue will be automatically
 * populated. Otherwise, users will be able to create any issue they want on the registered repo.
 * 
 */
controller.hears(['create issue'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  console.log(message)
  getChannelDataOrPromptForInit(message, 'create issue', function (channel_data) {
    bot.startConversation(message, askToCreateIssue);
  })
});

/**
 * SET THE COVERALLS THRESHOLD
 * 
 * Set the coveralls threshold for a repository on a channel
 */
controller.hears(['set coverage threshold', 'set threshold'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  //TODO add bounds between 0 - 100 as it is percentage
  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('to');

  //repo name has to be word after init
  getChannelDataOrPromptForInit(message, 'set threshold', function (channel_data) {
    if ((index + 1) < messageArray.length) {
      channel_data.coverage = parseInt(messageArray[index + 1]);
      controller.storage.channels.save(channel_data, function (err) {
        if (err) {
          bot.reply(message, 'There was an error changing the coverage');
        }
        else {
          bot.reply(message, `The coverage threshold has been set to ${channel_data.coverage}`);
        }
      })
    }
    else {
      bot.reply(message, "Please provide the coverage threshold. Ex set coverage threshold to <number>");
    }
  })
});

/**
 * SEND HELP MESSAGES
 * 
 * TODO: test last build help
 */
controller.hears(['^help'], ['direct_message', 'direct_mention', 'mention'], function (bot, message) {
  var messageArray = message.text.split(' ');

  if (messageArray.indexOf('init') !== -1) {
    bot.reply(message, helpCommands().init);
  }
  else if (messageArray.indexOf('reset') !== -1) {
    bot.reply(message, helpCommands().reset);
  }
  else if (messageArray.indexOf('configure') !== -1) {
    bot.reply(message, helpCommands().configure);
  }
  else if (messageArray.indexOf('issue') !== -1) {
    bot.reply(message, helpCommands().issue);
  }
  else if (messageArray.indexOf('coveralls') !== -1) {
    bot.reply(message, helpCommands().coveralls);
  }
  else if (messageArray.indexOf('token') !== -1) {
    bot.reply(message, helpCommands().token);
  }
  else {
    bot.reply(message, "Type one of the following commands to learn more:\n*_help init_*, *_help reset_*, *_help configure yaml_*, *_help issue_*, *_help coveralls_*, *_help token_*");
  }
});

/* ************************
 *
 * GENERAL HELPER FUNCTIONS
 * 
 * ************************
 */

/**
 * Second level help commands to report to user
 */
function helpCommands() {
  return {
    init: "Command: *_init travis <owner>/<repository>_* -- Initialize a travis/coveralls integration for a channel",
    reset: "Command: *_reset travis_* -- Remove the travis/coveralls integration from a channel",
    configure: "Command: *_configure yaml <owner>/<repository>_* -- If you chose not to create a .yaml file whith the command *_init travis_*, you may use this command to generate the file later. The operation will fail if the .yaml file already exists.",
    issue: "Command: *_create issue_* -- Create an issue for a repository that has been initialized",
    coveralls: "Command: [*_set coverage threshold_*/*_set threshold_*] *_to <number>_* -- Set the coveralls threshold to a specific number. You will be alerted when coverage falls below this.",
    token: `Command: *_add-token_* *_<owner>=<token>_* -- Register a token with the bot to enable repositories under a specific owner. You will not be able to initialize repos under an owner until a token has been registered for them. Note: To prevent others from seeing your token, this command can *_ONLY_* be used in a direct chat with @${bot.identity.name} !`
  }
}

/**
 * 
 * @param {*} bot 
 * @param {*} message 
 * @param {*} repoName 
 * @param {*} framework 
 */
function initializeRepository(bot, message, repoName, framework) {
  setTimeout(function () {
    bot.reply(message, "Done");
  }, 7000);
}

/**
 * 
 * @param {*} message 
 * @param {*} location 
 * @param {*} callback 
 */
function getChannelDataOrPromptForInit(message, location, callback) {
  controller.storage.channels.get(message.channel, function (err, channel_data) {
    if (callback === undefined) {
      callback = location
      location = '';
    }
    else {
      location += ' ';
    }
    if (channel_data) {
      callback(channel_data);
    }
    else {
      console.log(`Error getting ${location}channel data.\nChannel: ${message.channel}\nerr: ${err}`);
      bot.reply(message, "Please run init travis <owner>/<repository> before calling this method");
    }
  })
}

/**
 * Save channel data. Log an error message if save fails. Otherwise, execute a desired success function
 * @param {*} data data to save in the data store
 * @param {*} location code location called -- used when logging error
 * @param {*} onSuccess function to call if save succeeds (optional)
 */
function saveChannelDataLogError(data, location, onSuccess) {
  if (onSuccess === undefined) {
    onSuccess = function (){};
  }
  location += ' ';
  
  controller.storage.channels.save(data, function (err) {
    if (err) {
      console.log(`Data save ${location}failed.\ndata: ${JSON.stringify(data)}\nerror: ${err}`)
    }
    else {
      if (onSuccess) {
        onSuccess();
      }
    }
  })
}


/* *****************************
 *
 * CONVERSATION HELPER FUNCTIONS
 * 
 * *****************************
 */

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askChannelReset(response, convo) {
  convo.ask('Would you like to delete the yaml file from the repo (yes/no)?', function (response, convo) {
    getChannelDataOrPromptForInit(convo.source_message, 'askChannelReset', function (channel_data) {
      if (response.text.toLowerCase() === "yes") {
        Github.deleteFile(channel_data.owner, channel_data.repo, '.travis.yml').then(function (res) {
          convo.say(`Yaml file successfully deleted.`);
          convo.next();
        }, function (res) {
          convo.say(`Error deleting the yaml file.`);
          convo.next();
        })
      } else if (response.text.toLowerCase() === "no") {
        convo.say("The yaml file has been left alone.");
        convo.next();
      }
      else {
        convo.say("I consider this response to be a 'no'. I have left the yaml file.");
        convo.next();
      }
      Travis.deactivate(channel_data.owner, channel_data.repo, function (data) {
        convo.say(data.message);
      });
      controller.storage.channels.delete(channel_data.id, function (err) {
        console.log(err)
        if (err) {
          convo.say(`There was an error resetting this channel: ${err}`);
          convo.next();
          return;
        }
      });
      convo.say(`The channel has been reset. It was initialized to ${channel_data.owner}/${channel_data.repo}`);
    });
    convo.next();
  })
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askYamlCreation(response, convo) {
  convo.ask('Would you like to create a yaml file (yes/no)?', function (response, convo) {
    if (response.text.toLowerCase() === "yes") {
      askLanguageToUse(response, convo)
    } else if (response.text.toLowerCase() === "no") {
      convo.say("Alright, I will not create a yaml file after all.");
    }
    else {
      convo.say("I consider this response to be a 'no'. I will not create a yaml file.");
    }
    convo.next();
  });
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askLanguageToUse(response, convo) {
  convo.ask('Which language do you want to use? ' + Travis.listTechnologies().data.body.join(', '), function (response, convo) {
    getChannelDataOrPromptForInit(convo.source_message, 'askLanguageToUse', function (channel_data) {
      let repo = channel_data.repo;
      let owner = channel_data.owner;
      var yamlStatus = Travis.createYaml(response.text, myUrl, channel_data.id);
      convo.say(yamlStatus.message)
      if (yamlStatus.status === 'success') {
        //yamlStatus.data.body needs to be passed
        convo.say("Pushing the yaml file to the github repository ");

        //push yaml to repository
        Github.createRepoContents(owner, repo, yamlStatus.data.body, ".travis.yml").then(function (res) {
          console.log('push successful')
          convo.say("Push successful");
        }).catch(function (res) {

          convo.say("Error pushing the yaml file to the github repository. Please try and run init travis <owner>/<reponame> ensuring correct details ");
          controller.storage.channels.delete(channel_data.id, function (err) {
            if (err)
              console.log(`Tried resetting channel ${channel_data.id}; received error ${err}`)
          })
        });
      }
      convo.next();
    })
  });
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askToCreateIssue(response, convo) {
  getChannelDataOrPromptForInit(convo.source_message, 'askToCreateIssue', function (channel_data) {
    if (channel_data.issue.title === "") {
      askToCreateNewIssue(response, convo);
    }
    else {
      askToCreateExistingIssue(response, convo);
    }
  })
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askToCreateNewIssue(response, convo) {
  getChannelDataOrPromptForInit(convo.source_message, 'askToCreateNewIssue', function (channel_data) {
    convo.ask('Please enter the name of the issue', function (response, convo) {
      channel_data.issue.title = response.text;
      saveChannelDataLogError(channel_data, 'askToCreateNewIssue', function () {

        convo.say(`I'm creating an issue titled *${channel_data.issue.title}*`);
        askToAssignPeople(response, convo);
        convo.next();
      })
    });
  })
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askToCreateExistingIssue(response, convo) {
  getChannelDataOrPromptForInit(convo.source_message, 'askToCreateExistingIssue', function (channel_data) {
    let name = channel_data.issue.title;
    let body = '';

    if (name.includes("Coverage")) {
      channel_data.issue.body = "Coveralls failure";
    }
    else if (name.includes("Build")) {
      channel_data.issue.body = "Build failure";
    }
    saveChannelDataLogError(channel_data, 'askToCreateExistingIssue', function () {

      convo.ask(`Current issue title is set to *${name}*. Do you want to change the title of the issue (yes/no)?`, function (response, convo) {
        if (response.text.toLowerCase() === "yes") {
          askToCreateNewIssue(response, convo);
        }
        else {
          askToAssignPeople(response, convo);
        }
        convo.next();
      });
    });
  })
}

/**
 * 
 * @param {*} response 
 * @param {*} convo 
 */
function askToAssignPeople(response, convo) {
  getChannelDataOrPromptForInit(convo.source_message, 'askToAssignPeople', function (channel_data) {
    convo.ask('Please enter a comma-separated list of github usernames to the issue. Ex user1,user2,user3...', function (response, convo) {
      let listOutput = response.text;
      console.log(response.text);

      // split and strip assignees
      let listOfassignees = listOutput.split(",").map(function (item) {
        return item.trim();
      });;
      var issueName = channel_data.issue.title

      convo.say(`I am going to create an issue titled *${issueName}* and assign it to ` + listOutput);

      let repo = channel_data.repo;
      let owner = channel_data.owner;

      var tempObject = {
        'body': `Automatically generated issue ${channel_data.issue.body}`,
        'assignees': listOfassignees,
        'breaker': channel_data.issue.breaker
      };

      console.log(repo, owner, tempObject, issueName);

      Github.createGitHubIssue(repo, owner, Github.createIssueJSON(repo, owner, issueName, tempObject))
        .then(function (res) {
          console.log(res.message);
          bot.reply(response, res.message);
          //convo.say(res.message);
        }, function (res) {

          console.log(res.message);
          bot.reply(response, res.message);
          //convo.say(res.message);
        });

      channel_data.issue.title = '';
      channel_data.issue.body = '';
      channel_data.issue.breaker = [];
      saveChannelDataLogError(channel_data, 'askToAssignPeople', function () {
        convo.next();
      });
    });
  })
}