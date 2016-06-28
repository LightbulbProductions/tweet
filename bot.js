var _           = require('lodash');
var Client      = require('node-rest-client').Client;
var Twit        = require('twit');
var async       = require('async');
var wordFilter  = require('wordfilter');

var t = new Twit({
  consumer_key         : process.env.MYSWEETTWEET_TWIT_CONSUMER_KEY,
  consumer_secret      : process.env.MYSWEETTWEET_TWIT_CONSUMER_SECRET,
  access_token          : process.env.MYSWEETTWEET_TWIT_ACCESS_TOKEN,
  access_token_secret   : process.env.MYSWEETTWEET_TWIT_ACCESS_TOKEN_SECRET
});
var wordnikKey          = process.env.WORDNIK_API_KEY;

run = function() {
  async.waterfall([
    getPublicTweet,
    extractWordsFromTweet,
    getAllWordData,
    findNouns,
    formatTweet,
    postTweet
  ],
  function(err, botData) {
    if (err) {
      consola.log('Error encountered: ', err);
    } else {
      console.log('Good to go');
      console.log('Tweet: ', botData.tweetBlock);
    }
    console.log('Base tweet: ', botData.baseTweet);
  });
}
getPublicTweet = function(cb) {
  t.get('search/tweets', {q: 'wacky', count: 1, result_type: 'recent', lang: 'en'}, function(err, data, response) {
    if (!err) {
      var botData = {
        baseTweet       : data.statuses[0].text.toLowerCase(),
        tweetID         : data.statuses[0].id_str,
        tweetUsername   : data.statuses[0].user.screen_name
      };
      cb(null, botData);
    } else {
      console.log(" Abandoning life");
      cb(err, botData);
    }
  });
};

extractWordsFromTweet = function(botData, cb) {
  var excludeNonAlpha       = /[^a-zA-Z]+/;
  var excludeURLs           = /https?:\/\/[-a-zA-Z0-9@:%_\+.~#?&\/=]+/g;
  var excludeShortAlpha     = /\b[a-z][a-z]?\b/g;
  var excludeHandles        = /@[a-z0-9_-]+/g;
  var excludePatterns       = [excludeURLs, excludeShortAlpha, excludeHandles];
  botData.tweet             = botData.baseTweet;

  _.each(excludePatterns, function(pat) {
    botData.tweet = botData.tweet.replace(pat, ' ');
  });

  botData.tweetWordList = botData.tweet.split(excludeNonAlpha);

  var excludedElements = ['and','the','pick','select','picking'];
  botData.tweetWordList = _.reject(botData.tweetWordList, function(w) {
    return _.contains(excludedElements, w);
  });

  cb(null, botData);
};

getAllWordData = function(botData, cb) {
  async.map(botData.tweetWordList, getWordData, function(err, results){
    botData.wordList = results;
    cb(err, botData);
  });
}

getWordData = function(word, cb) {
  var client = new Client();
  var wordnikWordURLPart1   = 'http://api.wordnik.com:80/v4/word.json/';
  var wordnikWordURLPart2   = '/definitions?limit=1&includeRelated=false&useCanonical=true&includeTags=false&api_key=';
  var args = {headers: {'Accept':'application/json'}};
  var wordnikURL = wordnikWordURLPart1 + word.toLowerCase() + wordnikWordURLPart2 + wordnikKey;

  client.get(wordnikURL, args, function (data, response) {
    if (response.statusCode === 200) {
      var result = JSON.parse(data);
      if (result.length) {
        cb(null, result);
      } else {
        cb(null, null);
      }
    } else {
      cb(null, null);
    }
  });
};
findNouns = function(botData, cb) {
  botData.nounList = [];
  botData.wordList = _.compact(botData.wordList);

  _.each(botData.wordList, function(wordInfo) {
    var word            = wordInfo[0].word;
    var partOfSpeech    = wordInfo[0].partOfSpeech;

    if (partOfSpeech == 'noun' || partOfSpeech == 'proper-noun') {
      botData.nounList.push(word);
    }
  });

  if (botData.nounList.length >= 5) {
    cb(null, botData);
  } else {
    cb('There are fewer than 5 nouns.', botData);
  }
}
formatTweet = function(botData, cb) {
  botData.pickTwoWordList = [];
  _.each(botData.nounList.slice(0,5), function(word) {
    word = word.charAt(0).toUpperCase() + word.slice(1) + ".";
    botData.pickTwoWordList.push(word);
  });

  var tweetLine1    = botData.pickFourWordList.join(' ');
  var tweetLine2    = 'Pick Four.';
  var tweetLine3    = 'http://twitter.com/' + botData.tweetUsername + '/status/' + botData.tweetID;
  botData.tweetBlock = tweetLine1 + '\n' + tweetLine2 + '\n' + tweetLine3 + '\n' + tweetLine4 + '\n' + tweetLine5;
  cb(null, botData);
}
