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
var fs = require('fs');

var _ = require('../util.js');
var diff = require('./diff.js');
var walk = require('./walk.js');
var hl = require('./highlight.js');

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
                // console.log('page.settings.' + key + ' = ' + JSON.stringify(value));
            });
        } else {
            page[key] = value;
            // console.log('page.' + key + ' = ' + JSON.stringify(value));
        }
    });
}

function evaluate(page, fn, args){
    var type = typeof fn;
    var arr = [];
    switch (type){
        case 'string':
            fn = eval('(' + fn + ')');
            break;
        case 'function':
            // do nothing
            break;
        default :
            // TODO
            return;
    }
    arr.push(fn);
    arr.push(TOKEN);
    arr = arr.concat(args || []);
    return page.evaluate.apply(page, arr);
}

function createPage(url, options, onload){
    var page = webpage.create();
    var timer, count = 0,
        delay = options.render.delay;
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
        console.log('resource [' + req.url + '] timeout');
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
        evaluate(page, options.events.init);
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

var LATEST_LOG_FILENAME = 'latest.log';
var SCREENSHOT_FILENAME = 'screenshot.png';
var INFO_FILENAME = 'info.json';
var TREE_FILENAME = 'tree.json';
var HIGHLIGHT_HTML_FILENAME = 'highlight.html';

function getTree(dir){
    var file = ROOT + '/' + dir + '/' + TREE_FILENAME;
    return JSON.parse(fs.read(file));
}

function pad(str){
    return ('0' + str).substr(-2);
}

function getTimeString(num){
    var d = new Date();
    d.setTime(num);
    var day = [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate())
    ].join('-');
    var time = [
        pad(d.getHours()),
        pad(d.getMinutes()),
        pad(d.getSeconds())
    ].join(':');
    return day + ' ' + time;
}

function highlight(left, right, callback){
    console.log('diff [' + left + '] width [' + right + ']');
    // TODO check diffed
    var lTree = getTree(left);
    var rTree = getTree(right);
    var ret = diff(lTree, rTree, data.diff);
    if(ret.length){
        console.log('has ' + ret.length + ' changes');
        var lScreenshot = ROOT + '/' + left + '/' + SCREENSHOT_FILENAME;
        var rScreenshot = ROOT + '/' + right + '/' + SCREENSHOT_FILENAME;
        var diffFilename = ROOT + '/diff/' + left + '-' + right + '.png';
        var html = phantom.libraryPath + '/' + HIGHLIGHT_HTML_FILENAME;
        var url = 'file://' + html + '?';
        var opt = {
            page: {
                settings: {
                    localToRemoteUrlAccessEnabled: true
                }
            },
            render: data.render
        };
        url += [
            lScreenshot, rScreenshot,
            getTimeString(left), getTimeString(right)
        ].join('|');
        console.log('start highlight');
        createPage(url, opt, function(page){
            console.log('highlight done');
            page.evaluate(hl, TOKEN, ret, data.diff);
            page.render(diffFilename);
            callback(ret);
        });
    } else {
        callback(ret);
    }
}

var data = {};
var ROOT = '';

function init(d){
    data = d;
    ROOT = data.path.dir;
    data.diff.changeType = {
        ADD:    1,  // 0001
        REMOVE: 2,  // 0010
        STYLE:  4,  // 0100
        TEXT:   8   // 1000
    };
}

var mode = parseInt(system.args[1]);
console.log('mode: ' + mode.toString(2));

if(mode & _.mode.CAPTURE){
    var url = system.args[2];
    var needDiff = (mode & _.mode.DIFF) > 0;
    if(needDiff) console.log('need diff');
    init(JSON.parse(system.args[3]));
    console.log('load: ' + url);
    createPage(url, data, function(page){
        console.log('loaded: ' + url);
        var delay = evaluate(page, data.events.beforeWalk) || 0;
        console.log('delay: ' + delay);
        setTimeout(function(){
            // walk
            console.log('walk tree');
            var res = page.evaluate(walk, TOKEN, data.walk);
            var json = JSON.stringify(res);

            // latest
            var latest, latestDir, latestTree,
                latestFile = ROOT + '/' + LATEST_LOG_FILENAME;
            if(fs.exists(latestFile)){
                latest = fs.read(latestFile).trim();
                latestDir = ROOT + '/' + latest;
                latestTree = fs.read(latestDir + '/' + TREE_FILENAME);
            }

            // save
            if(latestTree && latestTree === json){
                phantom.exit();
            } else {
                var now = Date.now();
                var dir = ROOT + '/' + now;
                if(fs.makeDirectory(dir)){
                    // save current
                    page.render(dir + '/' + SCREENSHOT_FILENAME);
                    fs.write(dir + '/' + TREE_FILENAME, json);
                    fs.write(dir + '/' + INFO_FILENAME, JSON.stringify({
                        time: now,
                        url: url,
                        settings: data
                    }));
                    fs.write(ROOT + '/' + LATEST_LOG_FILENAME, now);
                    page.close();
                    // diff
                    if(needDiff && latestTree){
                        highlight(latest, now, function(ret){
                            if(ret.length === 0) {
                                console.log('warning, no change');
                            }
                            phantom.exit();
                        });
                    } else {
                        phantom.exit();
                    }
                } else {
                    throw  new Error('ERROR: unable to make directory[' + dir + ']');
                }
            }
        }, delay);
        return false;
    });
} else if(mode & _.mode.DIFF){
    var left = system.args[2];
    var right = system.args[3];
    init(JSON.parse(system.args[4]));
    highlight(left, right, function(ret){
        if(ret.length === 0) {
            console.log('warning, no change');
        }
        phantom.exit();
    });
}
