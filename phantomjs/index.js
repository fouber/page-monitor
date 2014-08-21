phantom.onError = function(msg, trace) {
    var msgStack = ['PHANTOM ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
        });
    }
    console.error(msgStack.join('\n'));
    phantom.exit(1);
};

var system = require('system');
var webpage = require('webpage');
var _ = require('../util.js');
var url = system.args[1];
var data = JSON.parse(system.args[2]);
var diff = require('./diff.js');
var TOKEN =  (function unique(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
})();

function settings(page, options){
    _.map(options, function(key, value){
        if(key === 'settings'){
            _.map(value, function(key, value){
                page.settings[key] = value;
            });
        } else {
            page[key] = value;
        }
    });
}

function createPage(url, options, onload){
    var page = webpage.create();
    var timer,
        count = 0,
        delay = options.delay || 1000;
    var callback = function(){
        clearTimeout(timer);
        if(count === 0){
            timer = setTimeout(function(){
                if(onload(page) !== false){
                    phantom.exit();
                }
            }, delay);
        }
    };
    settings(page, options.page);
    page.onLoadStarted = function(){
        if(page.url !== 'about:blank'){
            count++;
            //console.log('* [' + count + ']' + page.url);
            callback();
        }
    };
    page.onloadFinished = function(status){
        if(status === 'success'){
            callback();
        } else {
            //TODO
            phantom.exit(1);
        }
    };
    page.onResourceRequested = function(req){
        count++;
        // console.log('+ [' + count + ']' + req.url);
        callback();
    };
    page.onResourceReceived = function(res){
        if(res.stage === 'end'){
            count--;
            // console.log('- [' + count + ']' + res.url);
            callback();
        }
    };
    page.onResourceTimeout = function(req){
        count--;
        // todo
        // console.log('- [' + count + ']' + req.url);
        callback();
    };
    page.onError = function(msg, trace){
        var msgStack = ['ERROR: ' + msg];
        if (trace && trace.length) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
            });
        }
        console.error(msgStack.join('\n'));
    };
    page.onInitialized = function() {
        // TODO
        page.evaluate(function() {
            window.HTMLAudioElement = Image;
            window.Audio = Image;
        });
    };
    page.onConsoleMessage = function(msg){
        if(msg.substring(0, TOKEN.length) === TOKEN){
            // TODO parse
            console.log('console: ' + msg.substring(TOKEN.length));
        }
    };
    page.open(url);
    return page;
}

createPage(url, data, function(page){
    var res = page.evaluate(diff, TOKEN, data);

    page.render('test.png');
});