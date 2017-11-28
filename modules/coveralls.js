var Promise = require("bluebird");
var request = require("request");
var nock = require("nock");
var constant = require("../modules/constants");

var data = require("../modules/mocks/coverallsMock.json");

function getCoverageInfo(commitSHA, coverageThreshold)
{

	return new Promise(function(resolve, reject){

		var urlRoot = "https://coveralls.io/builds/" + commitSHA + ".json";
		var options = {
			url: urlRoot
		};
		request(options, function(error, response, body){
			try{
				var coverageInfoResponse = JSON.parse(body);

				if(coverageInfoResponse.covered_percent < coverageThreshold)
				{
					var resp = constant.getMessageStructure();
					
					resp.status = constant.FAILURE;
					resp.message = "Current coverage (" + coverageInfoResponse.covered_percent + "%) is below threshold (" + coverageThreshold + "%)";
					resp.data = {
							"body": coverageInfoResponse,
							"blame": coverageInfoResponse.committer_name
						};
					
					resolve(resp);			
				}
				else
				{
					var resp = constant.getMessageStructure();
					resp.status = constant.SUCCESS;
					resp.message = "Current coverage is ("+ coverageInfoResponse.covered_percent + "%)";
					resp.data = {
						"body": coverageInfoResponse,
						"blame": coverageInfoResponse.committer_name
					};
					resolve(resp);
				}
			}
			catch(ex){
				var resp = constant.getMessageStructure();
				resp.status = constant.ERROR;
				resp.message = "There was an error connecting to Coveralls";
				
				resolve(resp);
			}
		});
	});
}

function badge(owner, repo){
    return `[![Coverage Status](https://img.shields.io/coveralls/github/${owner}/${repo}.svg)](https://coveralls.io/github/${owner}/${repo})`
}

exports.getCoverageInfo = getCoverageInfo;

/*

Mocking Code:
var mockCoverallsService = nock("https://coveralls.io")
			.get("/builds/" + commitSHA + ".json")
			.reply(200, JSON.stringify(data));

Actual SERVICE code:

exports.getCoverageInfo = function(commitSHA)
{
	return new Promise(function(resolve, reject){
		var urlRoot = "https://coveralls.io/builds/" + commitSHA + ".json";
		var options = {
			url: urlRoot
		};
		request(options, function(error, response, body){
			var coverageInfo = JSON.parse(body);
			resolve(coverageInfo);
		});
	});
}

*/

/*

Calling format:

getCoverageInfo("27ea21edef73652eb1e72bd9942eea15c1fe4955").then(function(results){
	console.log("Covered Percent: " + results.covered_percent);
	console.log("Coverage Change: " + results.coverage_change);
});

*/
