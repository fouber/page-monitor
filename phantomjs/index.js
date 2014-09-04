/**
 * log
 * @param {string} msg
 * @param {number} type
 */
var log = function(msg, type){
    type = type || _.log.DEBUG;
    console.log(type + msg);
};

// on error
phantom.onError = function(msg, trace) {
    var msgStack = [ msg ];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
        });
    }
    log(msgStack.join('\n'), _.log.ERROR);
    phantom.exit(1);
};

// deps
var system = require('system');
var webpage = require('webpage');
var fs = require('fs');

var _ = require('../util.js');
var diff = require('./diff.js');
var walk = require('./walk.js');
var hl = require('./highlight.js');

// generate communication token
var TOKEN =  (function unique(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
})();

/**
 * configure phantomjs webpage settings
 * @param {webpage} page
 * @param {*} options
 */
function settings(page, options){
    _.map(options, function(key, value){
        if(key === 'settings'){
            _.map(value, function(key, value){
                page.settings[key] = value;
                log('page.settings.' + key + ' = ' + JSON.stringify(value));
            });
        } else {
            page[key] = value;
            log('page.' + key + ' = ' + JSON.stringify(value));
        }
    });
}

/**
 * eval script in webpage
 * @param {webpage} page
 * @param {Function} fn
 * @param {Array} args
 * @returns {Object}
 */
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

/**
 * create webpage and bind events
 * @param {string} url
 * @param {Object} options
 * @param {Function} onload
 */
function createPage(url, options, onload){
    var page = webpage.create();

    // remove application cache db
    // @see https://github.com/fouber/page-monitor/issues/3
    if(options.cleanApplicationCache){
        var path = page.offlineStoragePath + '/ApplicationCache.db';
        if(fs.isFile(path)){
            if(fs.remove(path) === false){
                log('unable to remove application cache [' + path + ']', _.log.WARNING);
            } else {
                log('removed application cache [' + path + ']');
            }
        }
    }

    var timer, count = 0,
        delay = options.render.delay;
    var callback = function(){
        clearTimeout(timer);
        if(count === 0){
            timer = setTimeout(function(){
                if(onload(page) !== false){
                    phantom.exit();
                }
                callback = function(){};
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
            log('load page error [' + status + ']', _.log.ERROR);
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
        log('resource [' + req.url + '] timeout', _.log.WARNING);
        callback();
    };
    page.onError = function(msg, trace){
        var msgStack = [ msg ];
        if (trace && trace.length) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
            });
        }
        log(msgStack.join('\n'), _.log.ERROR);
    };
    page.onInitialized = function() {
        if(options.events){
            evaluate(page, options.events.init);
        }
    };
    page.onConsoleMessage = function(msg){
        if(msg.substring(0, TOKEN.length) === TOKEN){
            log(msg.substring(TOKEN.length));
        } else {
            log(msg, _.log.NOTICE);
        }
    };
    page.open(url);
    return page;
}

// constant values
var LATEST_LOG_FILENAME = 'latest.log';
var SCREENSHOT_FILENAME = 'screenshot.png';
var INFO_FILENAME = 'info.json';
var TREE_FILENAME = 'tree.json';
var HIGHLIGHT_HTML_FILENAME = 'highlight.html';

/**
 * read tree object by dirname
 * @param {string} dir
 * @returns {Object}
 */
function getTree(dir){
    var file = ROOT + '/' + dir + '/' + TREE_FILENAME;
    return JSON.parse(fs.read(file));
}

/**
 * pad a numeric string to two digits
 * @param {string} str
 * @returns {string}
 */
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

/**
 * diff and highlight
 * @param {string|number|Date} left
 * @param {string|number|Date} right
 * @param {Function} callback
 */
function highlight(left, right, callback){
    log('diff [' + left + '] width [' + right + ']');
    // convert into number
    if(_.is(left, 'Date')){
        left = left.getTime();
    }
    if(_.is(right, 'Date')){
        right = right.getTime();
    }
    // TODO check diffed
    var lTree = getTree(left);
    var rTree = getTree(right);
    var ret = diff(lTree, rTree, data.diff);
    if(ret.length){
        log('has ' + ret.length + ' changes');
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
            render: {
                delay: 1000
            }
        };
        url += [
            lScreenshot, rScreenshot,
            getTimeString(left), getTimeString(right)
        ].join('|');
        log('start highlight [' + url + ']');
        createPage(url, opt, function(page){
            log('highlight done');
            page.evaluate(hl, TOKEN, ret, data.diff);
            page.render(diffFilename);
            callback(ret, diffFilename);
        });
    } else {
        callback(ret);
    }
}

var data = {};
var ROOT = '';

/**
 * init options
 * @param {Object} d
 */
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

// run mode, see _.mode@../utils.js
var mode = parseInt(system.args[1]);
log('mode: ' + mode.toString(2));

/**
 * get result info
 * @param {string|number|Date} left
 * @param {string|number|Date} right
 * @param {string} screenshot screenshot save path
 * @param {Array} changes
 * @returns {{left: string|number, right: string|number, screenshot: string, count: {add: number, remove: number, style: number, text: number}}}
 */
function getDiffInfo(left, right, screenshot, changes){
    // convert into number
    if(_.is(left, 'Date')){
        left = left.getTime();
    }
    if(_.is(right, 'Date')){
        right = right.getTime();
    }
    var info = {
        left: left,
        right: right,
        screenshot: screenshot,
        count: {
            add: 0,
            remove: 0,
            style: 0,
            text: 0
        }
    };
    changes.forEach(function(item){
        if(item.type & data.diff.changeType.ADD){
            info.count.add++;
        }
        if(item.type & data.diff.changeType.REMOVE){
            info.count.remove++;
        }
        if(item.type & data.diff.changeType.STYLE){
            info.count.style++;
        }
        if(item.type & data.diff.changeType.TEXT){
            info.count.text++;
        }
    });
    return info;
}

if(mode & _.mode.CAPTURE){ // capture
    var url = system.args[2];
    var needDiff = (mode & _.mode.DIFF) > 0;    // diff also
    if(needDiff) log('need diff');
    init(JSON.parse(system.args[3]));
    log('load: ' + url);
    createPage(url, data, function(page){   //create page
        log('loaded: ' + url);
        page.navigationLocked = true;   // lock navigation
        var delay = evaluate(page, data.events.beforeWalk) || 0;    // do sth befor walk
        log('delay: ' + delay);
        setTimeout(function(){  // delay
            // walk
            log('walk tree');
            var res = page.evaluate(walk, TOKEN, data.walk);    //walk tree
            var json = JSON.stringify(res);

            // latest
            var latest, latestDir, latestTree,
                latestFile = ROOT + '/' + LATEST_LOG_FILENAME;
            if(fs.exists(latestFile)){
                latest = fs.read(latestFile).trim();
                latestDir = ROOT + '/' + latest;
                latestTree = fs.read(latestDir + '/' + TREE_FILENAME);
            }

            if(latestTree && latestTree === json){ // nochange
                phantom.exit();
            } else {    // has change, save data
                var now = Date.now();
                var dir = ROOT + '/' + now;
                if(fs.makeDirectory(dir)){
                    // save current
                    page.render(dir + '/' + SCREENSHOT_FILENAME);
                    fs.write(dir + '/' + TREE_FILENAME, json);
                    fs.write(dir + '/' + INFO_FILENAME, JSON.stringify({
                        time: now,
                        url: url
                    }));
                    fs.write(ROOT + '/' + LATEST_LOG_FILENAME, now);
                    page.close();
                    var info = {
                        time: now,
                        dir: dir,
                        screenshot: dir + '/' + SCREENSHOT_FILENAME
                    };
                    if(needDiff && latestTree){ // diff
                        highlight(latest, now, function(ret, pic){
                            if(ret.length === 0) {
                                log('no change', _.log.WARNING);
                            } else {
                                info.diff = getDiffInfo(latest, now, pic, ret);
                                log(JSON.stringify(info), _.log.INFO);
                            }
                            phantom.exit();
                        });
                    } else {
                        log(JSON.stringify(info), _.log.INFO);
                        phantom.exit();
                    }
                } else {
                    throw  new Error('ERROR: unable to make directory[' + dir + ']');
                }
            }
        }, delay);
        return false;
    });
} else if(mode & _.mode.DIFF){ // diff only
    var left = system.args[2];
    var right = system.args[3];
    init(JSON.parse(system.args[4]));
    highlight(left, right, function(ret, pic){
        if(ret.length === 0) {
            log('no change', _.log.WARNING);
        } else {
            var info = { diff: getDiffInfo(left, right, pic, ret) };
            log(JSON.stringify(info), _.log.INFO);
        }
        phantom.exit();
    });
}
