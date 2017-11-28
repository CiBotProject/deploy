
var localtunnel  = require('localtunnel');
var Botkit = require('botkit');
var Coveralls = require('./modules/coveralls');
var Travis = require('./modules/travis');
var Github = require('./modules/github');
var tokenManager = require("./modules/tokenManager");
var bodyParser = require('body-parser')
const express = require('express');
const app = express();
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

var myUrl = null;

var controller = Botkit.slackbot({
  debug: false
  //include "log: false" to disable logging
  //or a "logLevel" integer from 0 to 7 to adjust logging verbosity
});

var tunnel = localtunnel(3000, function(err, tun) {
    if (err){
      console.log("\n\n***** TUNNEL ERROR *****\n\n", err);
    }// the assigned public url for your tunnel
    // i.e. https://abcdefgjhij.localtunnel.me
    else {
      console.log(tun.url);
      myUrl = tun.url;
    }
});

tunnel.on('close', function() {
    // tunnels are closed
});

var tempIssueName = "",tempIssueBody="",tempIssueBreaker="";

var globals = {
  coverageMap:{},//channel:threshold amount
  repoMap:{},//channel:repo name
  ownerMap:{},//channel:owner name
  yamlMap:{},//channel:true/false [check if yaml exisits or not]
  channelMap:{},//repo: channel name
  defaultThreshold:95,
};
//start the local webserver
app.listen(3000, () => console.log('Example app listening on port 3000!'));

//web server endpoints
//Travis
app.post("/travis",function(req,res){
  var payload = req.body.payload;
  var commit = JSON.parse(payload).commit;
  var repositoryName = JSON.parse(payload).repository.name;
  var channel = globals.channelMap[repositoryName];
  var status = JSON.parse(payload).state;
  console.log(commit,repositoryName,channel,status);

    if(status==="failed"){
      bot.say({
          text: `Build has failed. To create an issue please type "@${bot.identity.name} create issue"`,
          channel: globals.channelMap[repositoryName] // channel Id for #slack_integration
      });
      tempIssueName = `Build with commit_id ${JSON.parse(payload).commit_id} has failed`;
      tempIssueBreaker = JSON.parse(payload).author_email.split('@')[0];
    }
    else{
      Coveralls.getCoverageInfo(commit,globals.coverageMap[channel]).then(function(coverage){

        if(coverage.status==='success')
          bot.say({
              text: coverage.message,
              channel: globals.channelMap[repositoryName] // channel Id for #slack_integration
          });

        if(coverage.status==='failure'){
         var coverageBelowThreshold = globals.coverageMap[channel] - coverage.data.body.covered_percent;
         bot.say({
             text: `Coverage ${coverageBelowThreshold} percent below threshold. To create an issue please type "@${bot.identity.name} create issue"`,
             channel: globals.channelMap[repositoryName] // channel Id for #slack_integration
         });

         tempIssueName = `Coverage ${coverageBelowThreshold} percent below threshold`;
         tempIssueBreaker = JSON.parse(payload).author_email.split('@')[0];
        }
      });
    }

  res.send("ack");
});




// connect the bot to a stream of messages
var bot = controller.spawn({
  token: process.env.SLACK_TOKEN,
}).startRTM()

//add token
controller.hears(['add-token'], ['direct_message'], function(bot, message){
  console.log(message.text);
  let messageArray = message.text.split(' ');
  if(messageArray.length < 2){
    bot.reply(message, `The command syntax is *add-token user=token*`);
    return;
  }
  messageArray = messageArray[1].split('=');

  if(messageArray.length < 2){
    bot.reply(message, `The command syntax is *add-token user=token*`);
    return;
  }

  tokenManager.addToken(messageArray[0], messageArray[1]);
  bot.reply(message, `The user "${messageArray[0]}" token "${messageArray[1]}" is stored:tada::tada::tada:.`)
});
//init repository
controller.hears(['init travis'],['direct_message','direct_mention','mention'],function(bot,message){

  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('travis');

  if(messageArray.indexOf('help')===-1 && messageArray.indexOf('travis')!==-1 && messageArray.indexOf('init')!==-1){
    //repo name has to be word after init
    var repoString = null;

    if((index+1)<messageArray.length)
        repoString = messageArray[index+1];
    //if repo name is provided
    if(repoString!==null){
      //format is owner/repo-name
      var repoContent = repoString.split('/');

      globals.repoMap[message.channel]=repoContent[1];
      globals.ownerMap[message.channel]=repoContent[0];
      globals.channelMap[repoContent[1]]=message.channel;
      //console.log(tokenManager.getToken())
      if(tokenManager.getToken(repoContent[0]) === null){
        bot.reply(message, `Sorry, but token for *${repoContent[0]}* is not found:disappointed:. You can add tokens using the \"*add-token user=token*\" command in a direct message to me. DO NOT send a token where others can see it!`);
        return;
      }

      //create default coverageMap entry
      globals.coverageMap[message.channel]=globals.defaultThreshold;

      Travis.activate(repoContent[0],repoContent[1],function(data){
        bot.reply(message,data.message);
        bot.startConversation(message,askYamlCreation);
      });

    }
    else{
      bot.reply(message,"Please provide the name of the repository to be initialized. Ex init travis <owner>/<repository>");
    }
  }
  else{
    bot.reply(message,helpCommands().init);
  }
});
//helper functions
askYamlCreation = function(response,convo){
  convo.ask('Would you like to create a yaml file (yes/no)?',function(response,convo){
    if(response.text.toLowerCase()==="yes"){
      askLanguageToUse(response,convo);

    }else{
      convo.say("Initialized repository without yaml");
    }
    convo.say("Default coverage threshold for the current repository is set to "+globals.defaultThreshold+"%");
    convo.next();
  });
}

askLanguageToUse = function(response,convo){
  convo.ask('Which language do you want to use? '+Travis.listTechnologies().data.body.join(', '),function(response,convo){
    var yamlStatus = Travis.createYaml(response.text, myUrl,globals.ownerMap[response.channel],globals.repoMap[response.channel]);
    if(yamlStatus.status==='success'){
        //yamlStatus.data.body needs to be passed
        convo.say("I am pushing the yaml file to the github repository ");

        //push yaml to repository
        Github.createRepoContents(globals.ownerMap[response.channel],globals.repoMap[response.channel],yamlStatus.data.body,".travis.yml").then(function(res){
          convo.say("Pushed the yaml file to the github repository ");
        }).catch(function(res){
          convo.say("Error pushing the yaml file to the github repository ");
        });
    }
    else{
        convo.say("Error in creating yaml file");
        convo.say("See https://docs.travis-ci.com/user/languages/ to set up your repository.");
    }
    convo.next();
  });
}

//configure yaml
controller.hears(['configure yaml'],['direct_message','direct_mention','mention'],function(bot,message){
  //start conversation with one user, replies from other users should not affect this conversation
  //TODO: test this functionality by letting a different user reply, expected outcome should be no reply from bot to that user
  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('yaml');


  if(messageArray.indexOf('help')===-1 && messageArray.indexOf('yaml')!==-1 && messageArray.indexOf('configure')!==-1){
    //repo name has to be word after init
    var repoString = null;
    if((index+1)<messageArray.length)
        repoString = messageArray[index+1];
    //if repo name is provided
    if(repoString!==null){
      //format is owner/repo-name
      var repoContent = repoString.split('/');

      globals.repoMap[message.channel]=repoContent[1];
      globals.ownerMap[message.channel]=repoContent[0];
      //create default coverageMap entry
      globals.coverageMap[message.channel]=globals.defaultThreshold;

      bot.startConversation(message,askLanguageToUse);

    }
    else{
      bot.reply(message,"Please provide the name of the repository to be configured. Ex configure yaml <owner>/<repository>");
    }
  }
  else{
    bot.reply(message,helpCommands().configure);
  }
});
//test last build and create issue on failure
controller.hears(['test last build'],['direct_message','direct_mention','mention'],function(bot,message){

  if(!globals.ownerMap[message.channel] && !globals.repoMap[message.channel]){
    bot.reply(message,"Please run init travis <owner>/<repository> before testing last build function");
  }
  else{
    Travis.lastBuild(globals.ownerMap[message.channel],globals.repoMap[message.channel],function(data){
      bot.reply(message,data.message);
      if(data.status==='failure')
        issueCreationConversation(bot,message,`Build failure`,"");
    });
  }
});

//testing issue creation
controller.hears(['create issue'],['direct_message','direct_mention','mention'],function(bot,message){
  if(!globals.ownerMap[message.channel] && !globals.repoMap[message.channel]){
    bot.reply(message,"Please run init travis <owner>/<repository> before testing issue creation");
  }
  else{
    if(tempIssueName!=="")
      issueCreationConversation(bot,message,tempIssueName);
    else
      issueCreationConversation(bot,message,"");
  }
});

//test issue change name
controller.hears(['test change issue'],['direct_message','direct_mention','mention'],function(bot,message){
  if(!globals.ownerMap[message.channel] && !globals.repoMap[message.channel]){
    bot.reply(message,"Please run init travis <owner>/<repository> before testing issue creation");
  }
  else{
    tempIssueName="";
    issueCreationConversation(bot,message,"BUG");
  }
});

//testing Travis
//controller.hears(['test travis','test Travis'],['direct_message','direct_mention','mention'],function(bot,message){
//  bot.reply(message,"Testing travis");
//});

//testing Coveralls and issue creation
controller.hears(['test coveralls','test Coveralls'],['direct_message','direct_mention','mention'],function(bot,message){

  if(!globals.ownerMap[message.channel] && !globals.repoMap[message.channel]){
    bot.reply(message,"Please run init travis <owner>/<repository> before running coveralls");
  }
  else{
    Coveralls.getCoverageInfo("123",globals.coverageMap[message.channel]).then(function(coverage){

      bot.reply(message,coverage.message);

      if(coverage.status==='failure'){
       var coverageBelowThreshold = globals.coverageMap[message.channel] - coverage.data.body.covered_percent;
       issueCreationConversation(bot,message,`Coverage ${coverageBelowThreshold} percent below threshold`);
      }
    });
  }
});


//setting Coveralls threshold
controller.hears(['set coverage threshold','set threshold'],['direct_message','direct_mention','mention'],function(bot,message){
  //TODO add bounds between 0 - 100 as it is percentage
  var messageArray = message.text.split(' ');
  var index = messageArray.indexOf('to');

  //repo name has to be word after init
  if((index+1)<messageArray.length){
      globals.coverageMap[message.channel] = parseInt(messageArray[index+1]);
      bot.reply(message,"The coverage threshold has been set to "+globals.coverageMap[message.channel]);
  }
  else{
      bot.reply(message,"Please provide the coverage threshold. Ex set coverage threshold to <number>");
  }
});

//help section
//TODO:test last build help
controller.hears(['help'],['direct_message','direct_mention','mention'],function(bot,message){
  var messageArray = message.text.split(' ');

  if(messageArray.indexOf('init')!==-1){
      bot.reply(message,helpCommands().init);
  }
  else if(messageArray.indexOf('configure')!==-1){
    bot.reply(message,helpCommands().configure);
  }
  else if(messageArray.indexOf('issue')!==-1){
    if (messageArray.indexOf('change')!==-1){
      bot.reply(message,helpCommands().existing_issue);
    }
    else {
      bot.reply(message,helpCommands().issue);
    }
  }
  else if(messageArray.indexOf('coveralls')!==-1){
    bot.reply(message,helpCommands().coveralls);
  }
  else {
    bot.reply(message,"*_help init_*, *_help configure_*, *_help issue_*, *_help change issue_*, *_help coveralls_*");
  }
});

function helpCommands(){
  return{
    init:"*_init travis <owner>/<repository>_*",
    configure:"*_configure yaml <owner>/<repository>_*",
    issue:"*_test issue_*",
    existing_issue:"*_test change issue_*",
    coveralls:"*_test coveralls_*"
  }
}

/*HELPER FUNCTIONS*/
function initializeRepository(bot,message,repoName,framework){
  setTimeout(function(){
    bot.reply(message,"Done");
  },7000);
}

function issueCreationConversation(bot,message,issueTitle){
  if(issueTitle)
    tempIssueName = issueTitle;
  else {
    tempIssueName = "";
  }
  bot.startConversation(message,askToCreateIssue);
}
//helper functions
/*askToCreateIssue = function(response,convo){
  convo.ask('Do you want to create an issue (yes/no)?',function(response,convo){
    if(response.text.toLowerCase()==="yes"){
      if(tempIssueName===""){
        askToCreateNewIssue(response,convo);
      }
      else{
        askToCreateExistingIssue(response,convo);
      }
    }
    else{
      convo.say("I'll not create the issue");
    }
    convo.next();
  });
}*/
askToCreateIssue = function(response,convo){
    if(tempIssueName===""){
      askToCreateNewIssue(response,convo);
    }
    else{
      askToCreateExistingIssue(response,convo);
    }
}

askToCreateNewIssue = function(response,convo){
  convo.ask('Please enter the name of the issue',function(response,convo){
    tempIssueName = response.text;
    convo.say("I'm creating an issue titled *"+tempIssueName+"*");
    askToAssignPeople(response,convo);
    convo.next();
  });
}

askToCreateExistingIssue = function(response,convo){

  if(tempIssueName.includes("Coverage")){
    tempIssueBody = "Coveralls failure";
  }
  else if(tempIssueName.includes("Build")){
    tempIssueBody = "Build failure";
  }
  else{
    tempIssueBody = "";
  }

  convo.ask('Current issue title is set to *'+tempIssueName+'*. Do you want to change the title of the issue (yes/no)?',function(response,convo){
    if(response.text.toLowerCase()==="yes"){
      askToCreateNewIssue(response,convo);
    }
    else{
      askToAssignPeople(response,convo);
    }
    convo.next();
  });
}

askToAssignPeople = function(response,convo){
  convo.ask('Please enter a comma-separated list of github usernames to the issue. Ex user1,user2,user3...',function(response,convo){
    var listOutput = response.text;
    console.log(response.text);

    var listOfassignees = listOutput.split(",");

    convo.say("I am going to create an issue titled *"+tempIssueName+"* and assign it to "+listOutput);

    repo = globals.repoMap[response.channel];
    owner = globals.ownerMap[response.channel];



    var tempObject = {
      'body': `Automatically generated issue ${tempIssueBody}`,
      'assignees': listOfassignees,
      'breaker': tempIssueBreaker
    };

    console.log(repo, owner, tempObject, tempIssueName);

    Github.createGitHubIssue(repo,owner,Github.createIssueJSON(repo,owner,tempIssueName,tempObject))
    .then(function(res){
      console.log(res.message);
      bot.reply(response, res.message);
      //convo.say(res.message);
    }, function(res){

      console.log(res.message);
      bot.reply(response, res.message);
      //convo.say(res.message);
    });

    tempIssueName = "";
    tempIssueBreaker = "";
    tempIssueBody = "";
    convo.next();

  });
}
