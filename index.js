var child_process = require('child_process');
var spawn = child_process.spawn;
var fs = require('fs');
var path = require('path');
var Url = require('url');
var util = require("util");
var DEFAULT_DATA_DIRNAME = process.cwd();
var PHANTOMJS_SCRIPT_DIR = path.join(__dirname, 'phantomjs');
var PHANTOMJS_SCRIPT_FILE = path.join(PHANTOMJS_SCRIPT_DIR, 'index.js');
var _ = require('./util.js');
var _exists = fs.existsSync || path.existsSync;

/**
 * mkdir -p
 * @param {String} path
 * @param {Number} mode
 */
function mkdirp(path, mode){
    if (typeof mode === 'undefined') {
        //511 === 0777
        mode = 511 & (~process.umask());
    }
    if(_exists(path)) return;
    path.replace(/\\/g, '/').split('/').reduce(function(prev, next) {
        if(prev && !_exists(prev)) {
            fs.mkdirSync(prev, mode);
        }
        return prev + '/' + next;
    });
    if(!_exists(path)) {
        fs.mkdirSync(path, mode);
    }
}

/**
 * base64 encode
 * @param {String|Buffer} data
 * @returns {String}
 */
function base64(data){
    if(data instanceof Buffer){
        //do nothing for quickly determining.
    } else if(data instanceof Array){
        data = new Buffer(data);
    } else {
        //convert to string.
        data = new Buffer(String(data || ''));
    }
    return data.toString('base64');
}

/**
 * merge settings
 * @param {Object} settings
 * @returns {*}
 */
function mergeSettings(settings){
    var defaultSettings = {
        // remove phantomejs application cache before capture
        // @see https://github.com/fouber/page-monitor/issues/3
        cleanApplicationCache: false,
        // phantom cli options
        // @see http://phantomjs.org/api/command-line.html
        cli: {
            '--max-disk-cache-size' : '0',
            '--disk-cache' : 'false'
        },
        // webpage settings
        // @see http://phantomjs.org/api/webpage/
        page: {
            viewportSize: {
                width: 320,
                height: 568
            },
            settings: {
                resourceTimeout: 20000,
                userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 7_0 like Mac OS X; en-us) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53'
            }
        },
        walk: {
            invisibleElements : [
                'applet', 'area', 'audio', 'base', 'basefont',
                'bdi', 'bdo', 'big', 'br', 'center', 'colgroup',
                'datalist', 'form', 'frameset', 'head', 'link',
                'map', 'meta', 'noframes', 'noscript', 'optgroup',
                'option', 'param', 'rp', 'rt', 'ruby', 'script',
                'source', 'style', 'title', 'track', 'xmp'
            ],
            ignoreChildrenElements: [
                'img', 'canvas', 'input', 'textarea', 'audio',
                'video', 'hr', 'embed', 'object', 'progress',
                'select', 'table'
            ],
            styleFilters: [
                'margin-left', 'margin-top', 'margin-right', 'margin-bottom',
                'border-left-color', 'border-left-style', 'border-left-width',
                'border-top-color', 'border-top-style', 'border-top-width',
                'border-right-color', 'border-right-style', 'border-right-width',
                'border-bottom-color', 'border-bottom-style', 'border-bottom-width',
                'border-top-left-radius', 'border-top-right-radius',
                'border-bottom-left-radius', 'border-bottom-right-radius',
                'padding-left', 'padding-top', 'padding-right', 'padding-bottom',
                'background-color', 'background-image', 'background-repeat',
                'background-size', 'background-position',
                'list-style-image', 'list-style-position', 'list-style-type',
                'outline-color', 'outline-style', 'outline-width',
                'font-size', 'font-family', 'font-weight', 'font-style', 'line-height',
                'box-shadow', 'clear', 'color', 'display', 'float', 'opacity', 'text-align',
                'text-decoration', 'text-indent', 'text-shadow', 'vertical-align', 'visibility',
                'position'
            ],
            // attributes to mark an element
            attributeFilters: [ 'id', 'class' ],
            includeSelectors: [],
            excludeSelectors: [],
            removeSelectors: [],    // remove elements before walk
            ignoreTextSelectors: [],
            ignoreChildrenSelectors: [],
            root: 'body'
        },
        diff: {
            // LCS diff priority, `head` or `tail`
            priority: 'head',
            // highlight mask styles
            highlight: {
                add: {
                    title: '新增(Added)',
                    backgroundColor: 'rgba(127, 255, 127, 0.3)',
                    borderColor: '#090',
                    color: '#060',
                    textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)'
                },
                remove: {
                    title: '删除(Removed)',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderColor: '#999',
                    color: '#fff'
                },
                style: {
                    title: '样式(Style)',
                    backgroundColor: 'rgba(255, 0, 0, 0.3)',
                    borderColor: '#f00',
                    color: '#f00'
                },
                text: {
                    title: '文本(Text)',
                    backgroundColor: 'rgba(255, 255, 0, 0.3)',
                    borderColor: '#f90',
                    color: '#c30'
                }
            }
        },
        events: {
            init: function(token){
                /*
                    do something before page init,
                    @see http://phantomjs.org/api/webpage/handler/on-initialized.html
                */
            },
            beforeWalk: function(token){
                /*
                    do something before walk dom tree,
                    retrun a number to delay screenshot
                 */
            }
        },
        render: {
            format: 'jpeg',     // @see http://phantomjs.org/api/webpage/method/render.html
            quality: 80,        // @see http://phantomjs.org/api/webpage/method/render.html
            ext: 'jpg',         // the same as format, if not specified
            delay: 1000,        // delay(ms) before screenshot.
            timeout: 60 * 1000  // render timeout, max waiting time
        },
        path: {
            root: DEFAULT_DATA_DIRNAME, // data and screenshot save path root

            // save path format, it can be a string
            // like this: '{hostname}/{port}/{pathname}/{query}{hash}'
            format: function(url, opt){
                return [
                    opt.hostname, (opt.port ? '-' + opt.port : ''), '/',
                    base64(opt.path + (opt.hash || '')).replace(/\//g, '.')
                ].join('');
            }
        }
    };

    // special handling of events
    if(settings && settings.events){
        _.map(settings.events, function(key, value){
            if(typeof value === 'function'){
                value = value.toString().replace(/^(function\s+)anonymous(?=\()/, '$1');
                settings.events[key] = value;
            }
        });
    }
    return _.merge(defaultSettings, settings || {});
}

/**
 *
 * @param {String} path
 * @returns {String}
 */
function escapePath(path){
    if(path === '/'){
        return '-';
    } else {
        return path.replace(/^\//, '').replace(/^\.|[\\\/:*?"<>|]/g, '-');
    }
}

/**
 * path format
 * @param {String|Function} pattern
 * @param {String} url
 * @param {Object} opt
 * @returns {String}
 */
function format(pattern, url, opt){
    switch (typeof pattern){
        case 'function':
            return pattern(url, opt);
        case 'string':
            var pth = [];
            String(pattern).split('/').forEach(function(item){
                pth.push(item.replace(/\{(\w+)\}/g, function(m, $1){
                    return escapePath((opt[$1] || ''));
                }));
            });
            return pth.join('/');
        default :
            throw new Error('unsupport format');
    }
}

var LOG_VALUE_MAP ={};
var logTypes = (function(){
    var types = [];
    _.map(_.log, function(key, value){
        LOG_VALUE_MAP[value] = key.toLowerCase();
        types.push(_.escapeReg(value));
    });
    return types.join('|');
})();
var LOG_SPLIT_REG = new RegExp('(?:^|[\r\n]+)(?=' + logTypes + ')');
var LOG_TYPE_REG = new RegExp('^(' + logTypes + ')');

/**
 * why not events.EventEmitter?
 * because it can NOT emit an 'error' event,
 * but i need, fuck off.
 * @constructor
 */
var EventEmitter = function(){
    this._listeners = {};
};

/**
 * add event listener
 * @param {string} type
 * @param {Function} callback
 */
EventEmitter.prototype.on = function(type, callback){
    if(!this._listeners.hasOwnProperty(type)){
        this._listeners[type] = [];
    }
    this._listeners[type].push(callback);
};

/**
 * remove event listener
 * @param {string} type
 * @param {Function} callback
 */
EventEmitter.prototype.off = function(type, callback){
    if(this._listeners.hasOwnProperty(type)){
        var listeners = [];
        for(var i = 0, len = this._listeners[type].length; i < len; i++){
            var listener = this._listeners[type][i];
            if(listener !== callback){
                listeners.push(listener);
            }
        }
        this._listeners[type] = listeners;
    }
};

/**
 * dispatch event
 * @param {string} type
 */
EventEmitter.prototype.emit = function(type){
    if(this._listeners.hasOwnProperty(type)){
        var args = [].splice.call(arguments, 1);
        var self = this;
        this._listeners[type].forEach(function(callback){
            callback.apply(self, args);
        });
    }
};

/**
 * Monitor Class Constructor
 * @param {String} url
 * @param {Object} options
 * @constructor
 */
var Monitor = function(url, options){
    EventEmitter.call(this);
    options = mergeSettings(options);
    this.url = options.url = url;
    this.running = false;
    options.path.dir = path.join(
        options.path.root || DEFAULT_DATA_DIRNAME,
        format(options.path.format, url, Url.parse(url))
    );
    if(!fs.existsSync(options.path.dir)){
        mkdirp(options.path.dir);
    }
    this.options = options;
    this._initLog();
};

// inherit from EventEmitter
util.inherits(Monitor, EventEmitter);

/**
 * init log
 * @private
 */
Monitor.prototype._initLog = function(){
    var log = this.log = {};
    _.map(_.log, function(key){
        log[key.toLowerCase()] = [];
    });
};

/**
 * capture webpage and diff
 * @param {Function} callback
 * @param {Boolean} noDiff
 * @returns {*}
 */
Monitor.prototype.capture = function(callback, noDiff){
    if(this.running) return;
    this.running = true;
    var self = this;
    var type = _.mode.CAPTURE;
    if(!noDiff){
        type |= _.mode.DIFF;
    }
    this._initLog();
    return this._phantom(
        [
            PHANTOMJS_SCRIPT_FILE,
            type,
            this.url,
            JSON.stringify(this.options)
        ],
        function(code, log){
            // TODO with code
            self.running = false;
            callback.call(self, code, log);
        }
    );
};

/**
 * diff with two times
 * @param {Number|String|Date} left
 * @param {Number|String|Date} right
 * @param {Function} callback
 * @returns {*}
 */
Monitor.prototype.diff = function(left, right, callback){
    if(this.running) return;
    this.running = true;
    var self = this;
    var type = _.mode.DIFF;
    this._initLog();
    if(_.is(left, 'Date')){
        left = left.getDate();
    }
    if(_.is(right, 'Date')){
        right = right.getDate();
    }
    return this._phantom(
        [
            PHANTOMJS_SCRIPT_FILE,
            type, left, right,
            JSON.stringify(this.options)
        ],
        function(code, log){
            // TODO with code
            self.running = false;
            callback.call(self, code, log);
        }
    );
};

/**
 * spawn phantom
 * @param {Array} args
 * @param {Function} callback
 * @returns {*}
 * @private
 */
Monitor.prototype._phantom = function(args, callback){
    var arr = [];
    _.map(this.options.cli, function(key, value){
        arr.push(key + '=' + value);
    });
    this.emit('debug', 'cli arguments: ' + JSON.stringify(arr));
    arr = arr.concat(args);
    var proc = spawn('phantomjs', arr);
    proc.stdout.on('data', this._parseLog.bind(this));
    proc.stderr.on('data', this._parseLog.bind(this));
    proc.on('exit', function(code){
        callback(code);
    });
    return proc;
};

/**
 * parse log from phantom
 * @param {String} msg
 * @private
 */
Monitor.prototype._parseLog = function(msg){
    var self = this;
    String(msg || '').split(LOG_SPLIT_REG).forEach(function(item){
        item = item.trim();
        if(item){
            var type = 'debug';
            item = item.replace(LOG_TYPE_REG, function(m, $1){
                type = LOG_VALUE_MAP[$1] || type;
                return '';
            });
            self.emit(type, item);
            if(self.log.hasOwnProperty(type)){
                self.log[type].push(item);
            }
        }
    });
};

module.exports = Monitor;