var child_process = require('child_process');
var spawn = child_process.spawn;
var fs = require('fs');
var path = require('path');
var Url = require('url');
var util = require("util");
var events = require("events");
var DEFAULT_DATA_DIRNAME = process.cwd();
var PHANTOMJS_SCRIPT_DIR = path.join(__dirname, 'phantomjs');
var PHANTOMJS_SCRIPT_FILE = path.join(PHANTOMJS_SCRIPT_DIR, 'index.js');
var _ = require('./util.js');
var _exists = fs.existsSync || path.existsSync;

function mkdirp(path, mode){
    if (typeof mode === 'undefined') {
        //511 === 0777
        mode = 511 & (~process.umask());
    }
    if(_exists(path)) return;
    path.split('/').reduce(function(prev, next) {
        if(prev && !_exists(prev)) {
            fs.mkdirSync(prev, mode);
        }
        return prev + '/' + next;
    });
    if(!_exists(path)) {
        fs.mkdirSync(path, mode);
    }
}

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

function mergeSettings(settings){
    var defaultSettings = {
        cli: {
            '--max-disk-cache-size' : '0',
            '--disk-cache' : 'false'
        },
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
            attributeFilters: [ 'id', 'class' ],
            includeSelectors: [],
            excludeSelectors: [],
            ignoreTextSelectors: [],
            ignoreChildrenSelectors: [],
            root: 'body'
        },
        diff: {
            highlight: {
                add: {
                    title: '新增',
                    backgroundColor: 'rgba(127, 255, 127, 0.3)',
                    borderColor: '#090',
                    color: '#060',
                    textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)'
                },
                remove: {
                    title: '删除',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderColor: '#999',
                    color: '#fff'
                },
                style: {
                    title: '样式',
                    backgroundColor: 'rgba(255, 0, 0, 0.3)',
                    borderColor: '#f00',
                    color: '#f00'
                },
                text: {
                    title: '内容',
                    backgroundColor: 'rgba(255, 255, 0, 0.3)',
                    borderColor: '#f90',
                    color: '#c30'
                },
                textAdd: {}
            }
        },
        render: {
            delay: 1000
        },
        path: {
            root: DEFAULT_DATA_DIRNAME,
            // format: '{hostname}/{port}/{pathname}/{query}{hash}'
            format: function(url, opt){
                return opt.hostname + (opt.port ? '-' + opt.port : '') + '/' + base64(opt.path);
            }
        }
    };
    return _.merge(defaultSettings, settings || {});
}

function phantomjs(args){

}

function escapePath(path){
    if(path === '/'){
        return '-';
    } else {
        return path.replace(/^\//, '').replace(/^\.|[\\\/:*?"<>|]/g, '-');
    }
}

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

function phantom(opt, args, onStdout, onStderr, onExit){
    var arr = [];
    _.map(opt, function(key, value){
        arr.push(key + '=' + value);
    });
    arr = arr.concat(args);
    var proc = spawn('phantomjs', args);
    if(typeof onStdout === 'function'){
        proc.stdout.on('data', onStdout);
    }
    if(typeof onStderr === 'function'){
        proc.stderr.on('data', onStderr);
    }
    if(typeof onExit === 'function'){
        proc.on('exit', onExit);
    }
    return proc;
}

var Monitor = function(url, options){
    events.EventEmitter.call(this);
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
};

util.inherits(Monitor, events.EventEmitter);

Monitor.prototype.capture = function(callback, diff){
    if(this.running) return;
    this.running = true;
    var self = this;
    var type = _.mode.CAPTURE;
    if(diff){
        type |= _.mode.DIFF;
    }
    this.proc = phantom(
        this.options.cli,
        [
            PHANTOMJS_SCRIPT_FILE,
            type,
            this.url,
            JSON.stringify(this.options)
        ],
        function(data){
            console.log('phantomjs stdout: ' + data);
        },
        function(data){
            console.log('phantomjs stderr: ' + data);
        },
        function(code){
            // TODO with code
            self.running = false;
            callback();
        }
    );
};

module.exports = Monitor;