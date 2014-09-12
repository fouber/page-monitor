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
var os = system.os;
var IS_WIN = os.name.toLocaleLowerCase() === 'windows';

var _ = require('../util.js');
var diff = require('./diff.js');
var walk = require('./walk.js');
var highlight = require('./highlight.js');

// generate communication token
var TOKEN = _.unique();

// constant values
var LATEST_LOG_FILENAME = 'latest.log';
var SCREENSHOT_FILENAME = 'screenshot.png';
var INFO_FILENAME = 'info.json';
var TREE_FILENAME = 'tree.json';
var HIGHLIGHT_HTML_FILENAME = 'highlight.html';

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
                onload(page);
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

var M = function(options){
    this.token = TOKEN;
    this.options = options;
    this.options.diff.changeType = {
        ADD:    1,  // 0001
        REMOVE: 2,  // 0010
        STYLE:  4,  // 0100
        TEXT:   8   // 1000
    };
    this.root = options.path.dir;
    this.latest = this.root + '/' + LATEST_LOG_FILENAME;
};

M.prototype.getLatestTree = function(){
    if(fs.exists(this.latest)){
        var time = fs.read(this.latest).trim();
        if(time){
            var tree = this.root + '/' + time + '/' + TREE_FILENAME;
            if(fs.exists(tree)){
                var content = fs.read(tree).trim();
                return {
                    time: time,
                    file: tree,
                    content: content
                };
            }
        }
    }
    return false;
};

M.prototype.save = function(page, url, tree, time){
    time = time || Date.now();
    var dir = this.root + '/' + time;
    if(fs.makeDirectory(dir)){
        var screenshot = dir + '/' + SCREENSHOT_FILENAME;
        page.render(screenshot);
        fs.write(dir + '/' + TREE_FILENAME, json);
        fs.write(dir + '/' + INFO_FILENAME, JSON.stringify({
            time: time,
            url: url
        }));
        fs.write(this.latest, time);
        page.close();
        return {
            time: time,
            dir: dir,
            screenshot: screenshot
        };
    } else {
        throw new Error('unable to make directory[' + dir + ']');
    }
};

M.prototype.highlight = function(left, right, diff, callback){
    log('diff [' + left + '] width [' + right + '] has ' + diff.length + ' changes');
    var lScreenshot = this.root + '/' + left + '/' + SCREENSHOT_FILENAME;
    var rScreenshot = this.root + '/' + right + '/' + SCREENSHOT_FILENAME;
    var dScreenshot = this.root + '/diff/' + left + '-' + right + '.png';
    var html = phantom.libraryPath + '/' + HIGHLIGHT_HTML_FILENAME;
    var url = 'file://' + (IS_WIN ? '/' : '') + html + '?';
    var opt = {
        page : {
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
        _.getTimeString(left), _.getTimeString(right)
    ].join('|');
    log('start highlight [' + url + ']');
    var self = this, options = self.options;
    createPage(url, opt, function(page){
        log('highlight done');
        var info = {
            left: left,
            right: right,
            screenshot: dScreenshot,
            count: page.evaluate(highlight, self.token, diff, options.diff)
        };
        setTimeout(function(){
            page.render(dScreenshot);
            callback(info);
        }, 200);
    });
};

M.prototype.capture = function(url, needDiff){
    if(needDiff) log('need diff');
    var self = this,
        options = self.options;
    log('loading: ' + url);
    createPage(url, options, function(page){
        log('loaded: ' + url);
        page.navigationLocked = true;
        var delay = evaluate(page, options.events.beforeWalk) || 0;
        log('delay before render: ' + delay + 'ms');
        setTimeout(function(){  // delay
            log('walk tree');
            var right = page.evaluate(walk, self.token, options.walk);    //walk tree
            var json = JSON.stringify(right);
            var latest = self.getLatestTree();
            if(latest.content === json){
                phantom.exit();
            } else if(latest === false || !needDiff) {
                self.save(page, url, json);
                phantom.exit();
            } else {
                var left = JSON.parse(latest.content);
                var ret = diff(left, right, options.diff);
                if(ret.length){
                    var now = Date.now();
                    var info = self.save(page, url, json, now);
                    self.highlight(latest.time, now, ret, function(diff){
                        info.diff = diff;
                        log(JSON.stringify(info), _.log.INFO);
                        phantom.exit();
                    });
                } else {
                    log('no change');
                    phantom.exit();
                }
            }
        }, delay);
    });
};

M.prototype.getTree = function(time){
    var file = this.root + '/' + time + '/' + TREE_FILENAME;
    if(fs.exists(file)){
        return JSON.parse(fs.read(file));
    }
};

M.prototype.diff = function(left, right){
    var self = this;
    var options = self.options;
    var lTree = this.getTree(left);
    var rTree = this.getTree(right);
    if(lTree && rTree){
        var ret = diff(lTree, rTree, options.diff);
        if(ret.length){
            self.highlight(left, right, ret, function(diff){
                var info = {diff: diff};
                log(JSON.stringify(info), _.log.INFO);
                phantom.exit();
            });
        } else {
            log('no change', _.log.WARNING);
            phantom.exit();
        }
    } else if(lTree){
        throw new Error('missing right record [' + right + ']');
    } else {
        throw new Error('missing left record [' + right + ']');
    }
};

// run mode, see _.mode@../utils.js
var mode = parseInt(system.args[1]);
log('mode: ' + mode.toString(2));

if(mode & _.mode.CAPTURE){ // capture
    (new M(JSON.parse(system.args[3]))).capture(system.args[2], (mode & _.mode.DIFF) > 0);
} else if(mode & _.mode.DIFF){ // diff only
    (new M(JSON.parse(system.args[4]))).diff(system.args[2], system.args[3]);
}