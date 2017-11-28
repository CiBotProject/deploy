var _ = require('underscore');
var botkit = require('botkit');
var chai = require('chai');
var fs = require('fs');
var nock = require('nock');
var parse = require('parse-link-header');
var promise = require('bluebird');
var querystring = require('querystring');
var request = require('request');

var expect = chai.expect;

var github_module = require('../modules/github_module.js');

//////////////////////////
//                      //
//    TRAVIS METHODS    //
//                      //
//////////////////////////

// MAYBE - Define a method to activate Travis CI on a repo.
function activate_travis(owner, repo)
{

}

// Define a method to check for Travis CI file.
function has_travis_yaml(owner, repo)
{
    return new Promise(function(resolve, reject)
    {
        github_module.get_repo_contents(owner, repo).then(function(contents)
        {
            var file_names = _.pluck(contents, 'name');
            
            if(_.contains(file_names, '.travis.yml'))
                resolve(true);
            else
                resolve(false);
        });
    });
}

// Define a method to create Travis CI file.
function create_travis_yaml(owner, repo, file_content)
{
    return new Promise(function(resolve, reject)
    {
        github_module.create_repo_contents(owner, repo, file_content, '.travis.yml').then(function(contents)
        {
            resolve(contents);
        });
    });
}

// Define a method to reset Travis CI file.
function reset_travis_yaml(owner, repo, file_content)
{
    
}

// Define a method to delete Travis CI file.
function delete_travis_yaml(owner, repo)
{
    
}

/////////////////////////////
//                         //
//    COVERALLS METHODS    //
//                         //
/////////////////////////////

// MAYBE - Define a method to activate Coveralls on a repo.
function activate_coveralls(owner, repo)
{

}

// Define a method to check for Coveralls file.
function has_coveralls_yaml(owner, repo)
{
    return new Promise(function(resolve, reject)
    {
        github_module.get_repo_contents(owner, repo).then(function(contents)
        {
            var file_names = _.pluck(contents, 'name');
            
            if(_.contains(file_names, '.coveralls.yml'))
                resolve(true);
            else
                resolve(false);
        });
    });
}

// Define a method to create Coveralls file.
function create_coveralls_yaml(owner, repo, file_content)
{
    return new Promise(function(resolve, reject)
    {
        github_module.create_repo_contents(owner, repo, file_content, '.coveralls.yml').then(function(contents)
        {
            resolve(contents);
        });
    })

}

// Define a method to reset Coveralls file.
function reset_coveralls_yaml(owner, repo, file_content)
{
    
}

// Define a method to delete Coveralls file.
function delete_coveralls_yaml(owner, repo)
{
    
}

// Export methods for external use.
exports.activate_travis = activate_travis;
exports.has_travis_yaml = has_travis_yaml;
exports.create_travis_yaml = create_travis_yaml;
exports.reset_travis_yaml = reset_travis_yaml;
exports.delete_travis_yaml = delete_travis_yaml;

exports.activate_coveralls = activate_coveralls;
exports.has_coveralls_yaml = has_coveralls_yaml;
exports.create_coveralls_yaml = create_coveralls_yaml;
exports.reset_coveralls_yaml = reset_coveralls_yaml;
exports.delete_coveralls_yaml = delete_coveralls_yaml;