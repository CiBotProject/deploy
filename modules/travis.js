var clone = require('clone')
const constant = require("./constants.js");
const data = require("./mocks/travisMock.json");
const nock = require("nock");
const request = require("request");
const tokenManager = require("./tokenManager");

let token = "";
let userAgent = "Travis CiBot";
const YAML = require("json2yaml")

const supportedTechs = require("../data/yamlLanguages.json")
const utils = require('./utils')

let urlRoot = "https://api.travis-ci.org";

/**
 * This function:
 * 1. synchronize Travis with Github repositories
 * 2. Activate travis CI for the specified repository with owner
 * @param {String} owner //github owner of repo
 * @param {String} reponame //github repo name
 */
function activate(owner, reponame, callback){
    var resp = constant.getMessageStructure();
    try{
        authenticate(owner, function(){
            let options = {
                url: `${urlRoot}/repos/${owner}/${reponame}`,
                method: 'GET',
                headers:
                {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/json',
                    'Authorization': token
                }
            }

            console.log(options);

            request(options, function(err, res, body){
                if(err) {
                    resp.status = constant.ERROR;
                    resp.message = `Error occured when tried to activate travis for ${owner}/${reponame}:scream:`;
                    resp.data.body = err;
                    console.log(err)
                    callback(resp);
                    return;
                }
                try{
                    body = JSON.parse(body);
                }
                catch(e){
                    resp.status = constant.ERROR;
                    resp.message = `Error occured when tried to activate travis for ${owner}/${reponame}:scream:. Travis-ci.org returns: ${body}`;
                    resp.data.body = e;
                    callback(resp);
                    return;
                }


                options.url = `${urlRoot}/hooks`;
                options.method = "PUT";
                options.json = {
                    hook:{
                        id:body.id,
                        active:true
                    }
                }

                request(options, function(err, res, body){

                    resp.status = constant.SUCCESS;
                    resp.message = `Travis activated for ${owner}/${reponame}`;
                    resp.data.body = body;
                    callback(resp);
                });
            });
        });
    } catch(e){
        resp.status = constant.ERROR;
        resp.message = `Error occured when tried to activate travis for ${owner}/${reponame}:scream:`;
        resp.data.body = e;
        callback(resp);
    }
}

/**
 * This function:
 * 1. synchronize Travis with Github repositories
 * 2. Activate travis CI for the specified repository with owner
 * @param {String} owner //github owner of repo
 * @param {String} reponame //github repo name
 */
function deactivate(owner, reponame, callback){
    var resp = constant.getMessageStructure();
    try{
        authenticate(owner, function(){
            let options = {
                url: `${urlRoot}/repos/${owner}/${reponame}`,
                method: 'GET',
                headers:
                {
                    'User-Agent': userAgent,
                    'Content-Type': 'application/json',
                    'Authorization': token
                }
            }

            console.log(options);

            request(options, function(err, res, body){
                if(err) {
                    resp.status = constant.ERROR;
                    resp.message = `Error occured when tried to deactivate travis for ${owner}/${reponame}:scream:`;
                    resp.data.body = err;
                    callback(resp);
                    return;
                }
                try{
                    body = JSON.parse(body);
                }
                catch(e){
                    resp.status = constant.ERROR;
                    resp.message = `Error occured when tried to deactivate travis for ${owner}/${reponame}:scream:. Travis-ci.org returns: ${body}`;
                    resp.data.body = e;
                    callback(resp);
                    return;
                }


                options.url = `${urlRoot}/hooks`;
                options.method = "PUT";
                options.json = {
                    hook:{
                        id:body.id,
                        active:false
                    }
                }

                request(options, function(err, res, body){

                    resp.status = constant.SUCCESS;
                    resp.message = `Travis deactivated for ${owner}/${reponame}`;
                    resp.data.body = body;
                    callback(resp);
                });
            });
        });
    } catch(e){
        resp.status = constant.ERROR;
        resp.message = `Error occured when tried to deactivate travis for ${owner}/${reponame}:scream:`;
        resp.data.body = e;
        callback(resp);
    }
}
/**
 * This function returns yaml file body for specified technology
 * @param {String} technology
 * @param {String} postUrl URL to post build notifications to
 * @param {String} channel Channel id to return POST requests to
 */
function createYaml(technology, postUrl, channel){
    let resp = constant.getMessageStructure();

    if(!supportedTechs.hasOwnProperty(technology.toLowerCase())){
        resp.status = constant.FAILURE;
        resp.message = `Sorry I can't create yaml for ${technology}`;
        resp.data = null;
        return resp;
    }
    let techJson = clone(supportedTechs[technology.toLocaleLowerCase()]);

    if (postUrl !== undefined){
        techJson.notifications.webhooks.urls.push(`${postUrl}/travis/${channel}`);
    }

    let yaml = YAML.stringify( techJson );
    console.log(yaml)
    resp.status = constant.SUCCESS;
    resp.message = `The content of yaml file for ${technology}`;
    resp.data.body = utils.encodeBase64(yaml);

    return resp;
}

/**
 * This function returns list of supported technologies in JSON format
 */
function listTechnologies(){
    let available = [];
    for (k in supportedTechs) {
        available.push(k.charAt(0).toUpperCase() + k.slice(1));
    }
    let response = constant.getMessageStructure();
    response.status = constant.SUCCESS;
    response.message = "The list of supported technologies";
    response.data.body = available;

    return response;
}

/**
 * This function returns the last build status for specified repo
 * @param {String} owner
 * @param {String} repo
 */
function lastBuild(owner, reponame, callback){

    let resp = constant.getMessageStructure();

    let options = {
        url: `${urlRoot}/repos/${owner}/${reponame}/builds`,
        method: 'GET',
        headers:
        {
            'User-Agent': userAgent,
            'Content-Type': 'application/json',
            'Authorization': token
        }
    }

    request(options, function(err, res, body){
        //console.log(body);
        let json = JSON.parse(body);

        let lastBuildId = json.builds[0].id;
        let lastBuildState = json.builds[0].state;
        if(lastBuildState === 'failed'){
            json.commits.filter(function(path){
                return path.id === json.builds[0].commit_id;
            }).forEach(function(path){
                resp.status = constant.FAILURE;
                resp.message = `The last build for ${owner}/${reponame} failed`;
                resp.data.body = path;
                resp.data.blame.push(path.author_email);
                callback(resp);
            });
        } else if(lastBuildState === 'success'){
            resp.status = constant.SUCCESS;
            resp.message = `The last build for ${owner}/${reponame} succeed`;
            callback(resp);
        }
    });
}

function badge(owner, repo){
    return `[![Build Status](https://img.shields.io/travis/${owner}/${repo}.svg)](https://travis-ci.org/${owner}/${repo})`
}

/**
 * The function authenticate user using github token
 * @param {*} user 
 * @param {*} callback 
 */
function authenticate(user, callback){
    githubToken = tokenManager.getToken(user);
    let options = {
        url: `${urlRoot}/auth/github`,
        method: 'POST',
        headers:
        {
            'User-Agent': userAgent,
            'Content-Type': 'application/json',
            'Authorization': token
        },
        json:{
            github_token:githubToken
        }
    }

    request(options, function(err, res, body){
        if(err) throw err;

        console.log("TRAVIS TOKEN:", body.access_token, body, githubToken);
        token = "token " + body.access_token;
        callback(body.access_token);
    })
}

module.exports.activate = activate;//activates travis for repo. Params: owner, reponame, callback
module.exports.deactivate = deactivate;//deactivates the travis for repo. Params: owner, reponame, callback
module.exports.lastBuild = lastBuild;//returns last build state. Params: owner, reponame, callback
module.exports.createYaml = createYaml;//create the yaml for specified technology. Params: technology
module.exports.listTechnologies = listTechnologies;//list supported technologies. No params.

module.exports.badge = badge;
module.exports.travisToken = authenticate;
function listAccounts(){
    let accounts = nock("https://api.travis-ci.org")
        .get("/accounts")
        .reply(200, JSON.stringify(data.accounts));

    travis.accounts.get(function(err, res){

    });

    let response = constant.getMessageStructure();
    response.status = constant.SUCCESS;
    response.message = `Here is the build list for ${owner}/${reponame}`;
    response.body = accounts;

    return response;
}

function listBuilds(owner, reponame){
    let builds = nock("https://api.travis-ci.org")
        .get(`/repos/${owner}/${repo}/builds`)
        .reply(200, JSON.stringify(data.list_builds));

    travis.repos(owner, reponame).builds.get(function(err, res){

    });
    let response = constant.getMessageStructure();
    response.status = constant.SUCCESS;
    response.message = `Here is the build list for ${owner}/${reponame}`;
    response.body = builds;

    return response;
}
