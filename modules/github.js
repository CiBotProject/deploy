var nock = require('nock');
var Promise = require('bluebird');
var request = require('request');
var _ = require('underscore');

// var token = 'token ' + process.env.GITHUB_TOKEN;

var urlRoot = process.env.GITHUB_URL ? process.env.GITHUB_TOKEN : "https://api.github.com";

const mockData = require("./mocks/githubMock.json");

var tokenManager = require('./tokenManager.js');
const utils = require('./utils')
const constants = require('./constants.js');

// Signature to append to all generated issues
var issueBodySignature = '\n\nCreated by CiBot!';

/**
 * Get the contents of the root directory of a specified repository for a specified user.
 * 
 * @param {string} owner the name of the owner of the repository
 * @param {string} repo  the name of the repository whose root contents will be returned
 */
function getRepoContents(owner, repo)
{
	// var myMockData = mockData.getRepoContents.success
	// var mockMe = nock(urlRoot)
	// .get(`${urlRoot}/repos/${owner}/${repo}/contents/${file}`)
	// .reply(myMockData.statusCode, JSON.stringify(myMockData.message));
	
    var options =
    {
        url: `${urlRoot}/repos/${owner}/${repo}/contents`,
        method: 'GET',
        headers:
        {
            'User-Agent': 'CiBot',
            'Content-Type': 'application/json',
            'Authorization': 'token ' + tokenManager.getToken(owner)
        }
    };

    return new Promise(function(resolve, reject)
    {
        request(options, function(error, response, body)
        {
            var contents = JSON.parse(body);
			resolve(contents);
        });
    });
}

/**
 * Get the contents of a specified file in a specified repo for a specified user.
 * 
 * @param {string} owner the name of the owner of the repository
 * @param {string} repo the name of the repository holding the file
 * @param {string} file the name of the file to be read
 */
function getFileContents(owner, repo, file) {

	var options =
	{
		url: `${urlRoot}/repos/${owner}/${repo}/contents/${file}`,
		method: 'Get',
		headers:
		{
			'User-Agent': 'CiBot',
			'Content-Type': 'application/json',
			'Authorization': 'token ' + tokenManager.getToken(owner)
		}
	};

	return new Promise(function(resolve, reject)
	{
		request(options, function(error, response, body)
		{
			var contents = JSON.parse(body);
			resolve(contents);
		});
	});
}

/**
 * Get the SHA of a specified file in the root directory of a specified repository for a specified user.
 * 
 * @param {string} owner the name of the owner of the repository
 * @param {string} repo the name of the repository whose root directory contains the file
 * @param {string} file the name of the file whose SHA will be returned
 */
function getFileSha(owner, repo, file)
{	
    var options =
    {
        url: `${urlRoot}/repos/${owner}/${repo}/contents/${file}`,
        method: 'GET',
        headers:
        {
            'User-Agent': 'CiBot',
            'Content-Type': 'application/json',
            'Authorization': 'token ' + tokenManager.getToken(owner)
        }
    };

    return new Promise(function(resolve, reject)
    {
        request(options, function(error, response, body)
        {
            var contents = JSON.parse(body);
            var sha = contents.sha.toString();
            resolve(sha);
        });
    });
}

/**
 * Create a specified file in the root directory of a specified repository for a specified user.
 * 
 * PRECONDITION: The specified file does not already exist in the root of the repository.
 * 
 * @param {string} owner the name of the owner of the repository
 * @param {string} repo the name of the repository in which the file will be created
 * @param {string} content the contents of the file that will be created
 * @param {string} file the name of the file that will be created
 */
function createRepoContents(owner, repo, content, file)
{
    var options =
    {
        url: `${urlRoot}/repos/${owner}/${repo}/contents/${file}`,
        method: 'PUT',
        headers:
        {
            'User-Agent': 'CiBot',
            'Content-Type': 'application/json',
            'Authorization': 'token ' + tokenManager.getToken(owner)
        },
        json:
        {
            'path': file,
            'message': `[CiBot] Create ${file}`,
            'content': `${content}`
        }
    };

    return new Promise(function(resolve, reject)
    {
        request(options, function(error, response, body)
        {
			if(response.statusCode == '201')
			{
				var message = constants.getMessageStructure();
				message['status'] = constants.SUCCESS;
				message['message'] = `The ${file} file was successfully created in ${owner}/${repo}`;
				resolve(message);
			}
			else
			{
				var message = constants.getMessageStructure();
				message['status'] = constants.FAILURE;
				message['message'] = `There was a problem creating the ${file} file in ${owner}/${repo}`;
				reject(message);
			}
        });
    });
}

// createRepoContents('timothy-dement','coveralls-test','# Test Content','.travis.yml')
// .then(function(response)
// {
// 	console.log(response);
// })
// .catch(function(response)
// {
// 	console.log(response);
// })

/**
 * Overwrite the contents of a specified file in the root directory of a specified repository for a specified user.
 * 
 * PRECONDITION: The file exists in the root of the repository.
 * 
 * @param {*} owner the name of the owner of the repository
 * @param {*} repo the name of the repository in which the file will be reset
 * @param {*} content the contents of the file that will overwrite the existing contents
 * @param {*} file the name of the file that will be reset
 */
function resetRepoContents(owner, repo, content, file)
{
    getFileSha(owner, repo, file).then(function(data)
    {
        var options =
        {
            url: `${urlRoot}/repos/${owner}/${repo}/contents/${file}`,
            method: 'PUT',
            headers:
            {
                'User-Agent': 'CiBot',
                'Content-Type': 'application/json',
                'Authorization': 'token ' + tokenManager.getToken(owner)
            },
            json:
            {
                'message': `[CiBot] Reset ${file}`,
                'content': `${utils.encodeBase64(content)}`,
                'sha': `${data}`
            }
        };

        return new Promise(function(resolve, reject)
        {
            request(options, function(error, response, body)
            {
                resolve(body);
            });
        });
    });
}

/**
 * Add a badge to the top of a README.md file.
 * If no README.md file exists, one will be created.
 * If the badge already exists in the file, it will not be duplicated.
 * 
 * PRECONDITION: The badge link passed is properly formatted and valid.
 *  
 * @param {*} owner the name of the owner
 * @param {*} repo the name of the repository
 * @param {*} branch the name of the branch
 * @param {*} markdownBadge a string representing the badge link in Markdown format
 */
function insertReadmeBadge(owner, repo, branch, markdownBadge) {

	return getRepoContents(owner, repo).then(function(rootContents)
	{
		var rootFileNames = _.pluck(rootContents, 'name');

		if (_.contains(rootFileNames, 'README.md')) {

			return getFileContents(owner, repo, 'README.md').then(function(fileContents)
			{
				var encodedContents = fileContents.content.replace(/\n/g, '');
				var decodedContents = utils.decodeBase64(encodedContents);

				if (!decodedContents.includes(markdownBadge)) {

					decodedContents = markdownBadge + "\n" + decodedContents;
					resetRepoContents(owner, repo, decodedContents, 'README.md');

					return new Promise(function(resolve, reject)
					{
						var message = constants.getMessageStructure();
						message['status'] = constants.SUCCESS;
						message['message'] = `The badge was successfully added to the ${owner}/${repo} README.md file.`;
						resolve(message);
					});

				} else {

					return new Promise(function(resolve, reject)
					{
						var message = constants.getMessageStructure();
						message['status'] = constants.FAILURE;
						message['message'] = `The badge already exists in the ${owner}/${repo} README.md file.`;
						reject(message);
					});
				}
			});

		} else {

			var encodedBadge = utils.encodeBase64(markdownBadge);
			createRepoContents(owner, repo, encodedBadge, 'README.md');

			return new Promise(function(resolve, reject)
			{
				var message = constants.getMessageStructure();
				message['status'] = constants.SUCCESS;
				message['message'] = `A README.md file was created for ${owner}/${repo} with the given badge.`;
				resolve(message);
			});
		}
	});
}

/**
 * Parse optional fields in a json
 * @param {*} options variable containing the optional arguments
 * @param {*} name name of the optional variable
 * @param {*} defaultValue default for the variable
 * @param {*} returns the set parameter or the default value
 */
function opt(options, name, defaultValue) {
	if (defaultValue == undefined){
		defaultValue = null;
	}
	return options && options[name] !== undefined ? options[name] : defaultValue;
}

/**
 * Check to see if a user is a collaborator for a specific repository
 * @param {*} repo repository to check
 * @param {*} owner owner of the repository
 * @param {*} user user to test for membership in collaborators
 */
function checkUserInCollaborators(repo, owner, user) {	
	var options = {
		url: `${urlRoot}/repos/${owner}/${repo}/collaborators/${user}`,
		method: 'GET',
		headers: {
			"user-agent": "CiBot",
			"content-type": "application/json",
			"Authorization": 'token ' + tokenManager.getToken(owner)
		}
	};

	return new Promise(function (resolve, reject) {
		request(options, function (error, response, body) {
			var valid = false;
			if (response !== undefined && response.statusCode == 204) {
				valid = true;
			}
			resolve({'valid': valid, 'user':user})
		});
	});
}

/**
 * Create an issue json object. The optional parameters should be set as a field in the `optional` field. If you 
 * do not want to include teh parameters, leave them out of the json.
 * 
 * The text contained within the body will be appended with the text in global variable `bodySignature`.
 * 
 * @param {string} repo The repo that we are creating an issue for
 * @param {string} owner The owner of the repo that we are creating an issue for
 * @param {string} title The title of the issue that we are creating
 * @param {?json} optional json object containing the optional fields (body, assignees)
 * @param {?string} optional.body The body of the issue to be created
 * @param {?string[]} optional.assignees A list of individuals to assign the issue to
 * @param {?string[]} optional.breaker The id of the breaker causing the issue. Will be assigned if the assignees fail
 * @returns {json} object specifying the issue to be created
 */
function createIssueJSON(repo, owner, title, optional) {
	if (optional == undefined){
		optional = {};
	}
	var body = opt(optional, 'body', '') + issueBodySignature;
	var assignees = opt(optional, 'assignees', []);
	var breaker = opt(optional, 'breaker', null);

	// Determine if all of the users are valid collaborators for the project
	var validUserFunction = function(user){
		return checkUserInCollaborators(repo, owner, user);
	}
	var users = Promise.all(assignees.map(validUserFunction));

	// Once we have the result for all of the users, create the issue with all valid ones as an assignee(s)
	return users.then(function(users){
		var issue = {
			"repo": repo,	// needed for us not GitHub
			"owner": owner,	// needed for us not GitHub
			"fallbackAssignee": false,	// needed for us not GitHub
			"title": title,
			"body": body,
			"assignees": [],
			"labels": [
				"bug", "CiBot"
			]
		}
		users.forEach(function(user){
			if (user.valid){
				issue.assignees.push(user.user);
			}
		})
		return issue;
	}).then(function(issue){
		if (issue.assignees.length === 0){
			if (breaker !== null) {
				if (typeof(breaker) === "string"){
					// Sanity check to make sure that the breaker is valid
					return validUserFunction(breaker).then(function(result){
						console.log(result)
						if (result.valid) {
							issue.fallbackAssignee = true;
							issue.assignees.push(breaker);
							console.log(issue.fallbackAssignee)
						}
						return issue;
					});
				} else {
					// We have been passed a list of assignees, likely from modifying the issue
					var breakers = Promise.all(breaker.map(validUserFunction));
					return breakers.then(function(result){
						result.forEach(function(user){
							if (user.valid){
								issue.assignees.push(user.user);
							}
						})
						return issue;
					});
				}
			}
		}
		return issue;
	});
};

/**
 * Modify the json for an issue that has already been created. If any optional parameter is absent, it will not
 * be modified. Otherwise, it will be replaced.
 * 
 * @param {Promise<json>} issue object specifying the original issue to be created
 * @param {?json} optional object containing the optional fields (repo, title, body, assignees)
 * @param {?string} optional.repo The new repo to add the issue to
 * @param {?string} optional.owner The owner of the new repo that we are creating an issue for
 * @param {?string} optional.title new issue title
 * @param {?string} optional.body new body content
 * @param {?string[]} optional.assignees new assignees
 * @param {?string[]} optional.breaker The id of the breaker causing the issue. Will be assigned if the assignees fail
 * @returns {Promise<json>} object specifying the issue to be created
 */
function modifyIssueJSON(issue, optional) {
	if (optional == undefined){
		optional = {};
	}

	// Make sure the issue has been finished
	return issue.then(function(resolvedIssue){
		// Determine what needs to be changed on the issue and change it!
		var regenerate = false;
		if (optional.title != undefined){
			resolvedIssue.title = optional.title;
		}
		if (optional.body != undefined){
			resolvedIssue.body = optional.body + issueBodySignature;
		}
		if (optional.assignees != undefined){
			// We have to check all of the assignees, so just regenerate the issue
			resolvedIssue.assignees = optional.assignees;
			regenerate = true;
		}
		if (optional.repo != undefined || optional.owner != undefined){
			// we have to recheck all of the assignees since we are changing the repo, so just regenerate the issue
			regenerate = true;
		}

		// regenerate the issue if necessary
		if (regenerate){
			var re = new RegExp(issueBodySignature, "g");
			resolvedIssue.body = resolvedIssue.body.replace(re, '');
			resolvedIssue.repo = optional.repo == undefined ? resolvedIssue.repo : optional.repo;
			resolvedIssue.owner = optional.owner == undefined ? resolvedIssue.owner : optional.owner;
			resolvedIssue.breaker = optional.breaker == undefined ? resolvedIssue.assignees : optional.breaker;
			return createIssueJSON(resolvedIssue.repo, 
				resolvedIssue.owner, 
				resolvedIssue.title, 
				{'body': resolvedIssue.body, 'assignees':resolvedIssue.assignees, 'breaker':resolvedIssue.breaker});
		}
		return resolvedIssue;
	});
};

/**
 * Send a request to GitHub to create an issue on a specific repository
 * 
 * @param {string} repo repository to create the issue in
 * @param {string} owner owner/organization containing the repository
 * @param {Promise<json>} issue json of the issue to create
 */
function createGitHubIssue(repo, owner, issuePromise) {
	// Delete the repo and owner from the issue json before sending to GitHub
	// but keep track of it to make sure that we have a json file that can be submitted here
	return issuePromise.then(function(issue){
		var iRepo = issue.repo;
		var iOwner = issue.owner;
		var iAssignees = issue.fallbackAssignee;
		delete issue.repo;
		delete issue.owner;
		delete issue.fallbackAssignee;

		var options = {
			url: `${urlRoot}/repos/${owner}/${repo}/issues`,
			method: 'POST',
			headers: {
				"user-agent": "CiBot",
				"content-type": "application/json",
				"Authorization": 'token ' + tokenManager.getToken(owner)
			},
			json: issue
		};

		return new Promise(function (resolve, reject) 
		{
			// If we are trying to submit to a repo that the issue was not created for, error out.
			if (iRepo !== repo || iOwner !== owner){
				var message = constants.getMessageStructure();
				message['status'] = constants.FAILURE;
				message['message'] = 'The issue was created for a different repository than it was submitted to.';
				reject(message);
			}
			// Send a http request to url and specify a callback that will be called upon its return.
			request(options, function (error, response, body) 
			{
				console.log(options);
				if(response.statusCode == '201')
				{
					var assignees = ''
					if (iAssignees) {
						assignees = 'We could not assign the issue to the people you requested, so we fell \
back to the person who delivered the offending commit. '
					}
					if (issue.assignees.length !== 0){
						assignees += 'The issue has been assigned to: '
						issue.assignees.forEach(function(user){
							assignees += `${user}, `;
						})
						assignees = assignees.substring(0, assignees.length - 2) + '.'
					}
					else
					{
						assignees += 'We could not assign the issue to anyone.'
					}
					var message = constants.getMessageStructure();
					message['status'] = constants.SUCCESS;
					message['message'] = `Issue created with number ${body.number}. ${assignees}`;
					resolve(message);
				}
				else
				{
					var message = constants.getMessageStructure();
					message['status'] = constants.FAILURE;
					message['message'] = 'An error was encountered when trying to create the issue';
					reject(message);
				}
			});
		});
	})
};
/**
 * Get the commit author information using commit hash value
 * @param {String} owner the owner of the repository
 * @param {String} repo the repository name for which commit hash is related
 * @param {String} hash the hash of the commit
 */
function getCommitterLoginWithHash(owner, repo, hash)
{
	// var myMockData = mockData.getRepoContents.success
	// var mockMe = nock(urlRoot)
	// .get(`${urlRoot}/repos/${owner}/${repo}/contents/${file}`)
	// .reply(myMockData.statusCode, JSON.stringify(myMockData.message));
	
    var options =
    {
        url: `${urlRoot}/repos/${owner}/${repo}/commits/${hash}`,
        method: 'GET',
        headers:
        {
            'User-Agent': 'CiBot',
            'Content-Type': 'application/json'
        }
    };

    return new Promise(function(resolve, reject)
    {
        request(options, function(error, response, body)
        {
			var contents = JSON.parse(body).committer;
			console.log(contents);
			resolve(contents);
        });
    });
}

// createGitHubIssue('coveralls-test','timothy-dement',createIssueJSON('coveralls-test','timothy-dement','BUG'))
// .then(function(response)
// {
// 	console.log(response);
// })
// .catch(function(response)
// {
// 	console.log(response);
// })

/** TESTING CODE FOR ISSUES! */
// var issue
// createIssueJSON('test', 'arewm', 'test', {'body': 'test!!', 'assignees': ['arewm', 'bubba']}).then(function(i){
// 	console.log(i);
// 	issue = i;
// })
// console.log(issue);
// var i2 = createIssueJSON('test', 'arewm', 'test', {'body': 'test!!', 'assignees': ['arewm', 'bubba']});
// console.log(i2)
// i2.then(console.log);
// i2 = modifyIssueJSON(i2, {'title': 'test2'})
// console.log(i2);
// i2.then(console.log);
// createGitHubIssue('test', 'arewm', i2).then(console.log);
// var i3 = createIssueJSON('test', 'arewm', 'test-3', {'body': 'test!!', 'assignees': ['george', 'bubba'], 'breaker': ['arewm']});
// createGitHubIssue('test', 'arewm', i3).then(console.log,console.log);

// Export methods for external use.
exports.getRepoContents = getRepoContents;
exports.createRepoContents = createRepoContents;
exports.resetRepoContents = resetRepoContents;
exports.createIssueJSON = createIssueJSON;
exports.modifyIssueJSON = modifyIssueJSON;
exports.createGitHubIssue = createGitHubIssue;
exports.insertReadmeBadge = insertReadmeBadge;
exports.getCommitterLoginWithHash = getCommitterLoginWithHash;