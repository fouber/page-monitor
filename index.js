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

function mergeSettings(settings){
    var defaultSettings = {
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
        cli: {},
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
                'background', 'border', 'box-shadow',
                'clear', 'color', 'display', 'float',
                'font', 'line-height', 'margin', 'opacity',
                'padding', 'text-align', 'text-decoration',
                'text-indent', 'text-shadow', 'vertical-align',
                'visibility', 'position'
            ],
            attributeFilters: [ 'id' ]
        },
        diff: {
            include: [],
            exclude: [],
            changeStyle: {
                add: {
                    title: '新增',
                    backgroundColor: 'rgba(127, 255, 127, 0.3)',
                    borderColor: '#090',
                    color: '#060',
                    textShadow: '0 1px 1px rgba(0, 0, 0, 0.3)'
                },
                remove: {
                    title: '移除',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderColor: '#999',
                    overflow: 'auto'
                },
                style: {
                    title: '样式',
                    backgroundColor: 'rgba(255, 0, 0, 0.3)',
                    borderColor: '#f00'
                },
                text: {},
                textAdd: {}
            },
            ignoreText: false
        },
        path: {
            root: DEFAULT_DATA_DIRNAME,
            format: '{hostname}/{port}/{pathname}/{query}{hash}'
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

var Monitor = function(url, options){
    events.EventEmitter.call(this);
    this.url = url;
    this.running = false;
    url = Url.parse(url);
    options = mergeSettings(options);
    options.url = url;
    var pth = [ options.path.root || DEFAULT_DATA_DIRNAME ];
    String(options.path.format).split('/').forEach(function(item){
        pth.push(item.replace(/\{(\w+)\}/g, function(m, $1){
            return escapePath((url[$1] || ''));
        }));
    });
    options.path.dir = path.join.apply(path, pth);
    this.options = options;
};

util.inherits(Monitor, events.EventEmitter);

Monitor.prototype.getData = function(path){
    if(is(path, 'Date')){
        path = path.getTime();
    } else {
        path = String(path);
    }

};

Monitor.prototype.diff = function(data, callback){
    if(this.running) return;
    this.running = true;
    var self = this;
    var args = [];
    data = _.is(data, 'Object') ? data : this.getData(data);
    _.map(this.options.cli, function(key, value){
        args.push(key + '=' + value);
    });
    args.push(PHANTOMJS_SCRIPT_FILE);
    args.push(this.url);
    args.push(JSON.stringify(this.options));
    args.push(JSON.stringify(data));
    this.proc = spawn('phantomjs', args);
    this.proc.stdout.on('data', function(data){
        console.log('phantomjs stdout: ' + data);
    });
    this.proc.stderr.on('data', function(data){
        console.log('phantomjs stderr: ' + data);
    });
    this.proc.on('exit', function(){
        self.running = false;
        callback();
    });
    // TODO
};

Monitor.prototype.save = function(callback){

};

module.exports = Monitor;