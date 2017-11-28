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

var githb_module = require('../modules/github_module.js');
var init_module = require('../modules/initialization_module.js');
var init_data = require('../mocks/initialization_mock.json');

////////////////////////
//                    //
//    TRAVIS TESTS    //
//                    //
////////////////////////

describe('#has_travis_yaml', function()
{

    var with_yamls = nock('https://api.github.com')
    .get('/repos/testuser/Hello-World/contents')
    .reply(200, JSON.stringify(init_data.contents_with_yamls));

    it('should return true if a repo has a .travis.yml file', function()
    {
        return init_module.has_travis_yaml('testuser', 'Hello-World').then(function(results)
        {
            expect(results).to.be.true;
        });
    });

    var without_yamls = nock('https://api.github.com')
    .get('/repos/testuser/Hello-World/contents')
    .reply(200, JSON.stringify(init_data.contents_without_yamls));

    it('should return false if a repo does not have .travis.yml file', function()
    {
        return init_module.has_travis_yaml('testuser', 'Hello-World').then(function(results)
        {
            expect(results).to.be.false;
        });
    });
});

describe('#create_travis_yaml', function()
{
    var new_travis_yaml = nock('https://api.github.com')
    .persist()
    .put('/repos/testuser/Hello-World/contents/.travis.yml')
    .reply(201, JSON.stringify(init_data.create_travis_file_response));

    it('should have name ".travis.yml"', function()
    {
        return init_module.create_travis_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.content.name).to.equal('.travis.yml');
        });
    });

    it('should have path ".travis.yml"', function()
    {
        return init_module.create_travis_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.content.path).to.equal('.travis.yml');
        });
    });

    it('should have message "[CiBot] Create .travis.yml"', function()
    {
        return init_module.create_travis_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.commit.message).to.equal('[CiBot] Create .travis.yml');
        });
    });
});

describe('#reset_travis_yaml', function()
{

});

describe('#delete_travis_yaml', function()
{

});

///////////////////////////
//                       //
//    COVERALLS TESTS    //
//                       //
///////////////////////////

describe('#has_coveralls_yaml', function()
{

    var with_yamls = nock('https://api.github.com')
    .get('/repos/testuser/Hello-World/contents')
    .reply(200, JSON.stringify(init_data.contents_with_yamls));

    it('should return true if a repo has a .coveralls.yaml file', function()
    {
        return init_module.has_coveralls_yaml('testuser', 'Hello-World').then(function(results)
        {
            expect(results).to.be.true;
        });
    });

    var without_yamls = nock('https://api.github.com')
    .get('/repos/testuser/Hello-World/contents')
    .reply(200, JSON.stringify(init_data.contents_without_yamls));

    it('should return false if a repo does not have a .coveralls.yaml file', function()
    {
        return init_module.has_coveralls_yaml('testuser', 'Hello-World').then(function(results)
        {
            expect(results).to.be.false;
        });
    });
});

describe('#create_coveralls_yaml', function()
{
    var new_coveralls_yaml = nock('https://api.github.com')
    .persist()
    .put('/repos/testuser/Hello-World/contents/.coveralls.yml')
    .reply(201, JSON.stringify(init_data.create_coveralls_file_response));

    it('should have name ".coveralls.yml"', function()
    {
        return init_module.create_coveralls_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.content.name).to.equal('.coveralls.yml');
        });
    });

    it('should have path ".coveralls.yml"', function()
    {
        return init_module.create_coveralls_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.content.path).to.equal('.coveralls.yml');
        });
    });

    it('should have message "[CiBot] Create .coveralls.yml', function()
    {
        return init_module.create_coveralls_yaml('testuser', 'Hello-World', 'Test content').then(function(results)
        {
            expect(results.commit.message).to.equal('[CiBot] Create .coveralls.yml');
        });
    });
});

describe('#reset_coveralls_yaml', function()
{

});

describe('#delete_coveralls_yaml', function()
{

});