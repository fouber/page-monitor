var toString = Object.prototype.toString;
var _ = module.exports = {};

/**
 * is
 * @param {*} source
 * @param {string} type
 * @returns {boolean}
 */
_.is = function(source, type){
    return toString.call(source) === '[object ' + type + ']';
};

/**
 * walk object and merge
 * @param {Object} obj
 * @param {Function} callback
 * @param {Object} merge
 */
_.map = function(obj, callback, merge){
    var index = 0;
    for(var key in obj){
        if(obj.hasOwnProperty(key)){
            if(merge){
                callback[key] = obj[key];
            } else if(callback(key, obj[key], index++)) {
                break;
            }
        }
    }
};

/**
 * merge target into source
 * @param {*} source
 * @param {*} target
 * @returns {*}
 */
_.merge = function(source, target){
    if(_.is(source, 'Object') && _.is(target, 'Object')){
        _.map(target, function(key, value){
            source[key] = _.merge(source[key], value);
        });
    } else {
        source = target;
    }
    return source;
};

/**
 * escape regexp chars
 * @param {string} str
 * @returns {string}
 */
_.escapeReg = function(str){
    return str.replace(/[\.\\\+\*\?\[\^\]\$\(\){}=!<>\|:\/]/g, '\\$&');
};

/**
 * pad a numeric string to two digits
 * @param {string} str
 * @returns {string}
 */
_.pad = function(str){
    return ('0' + str).substr(-2);
};

/**
 * convert millisecond into string like `2014-09-12 14:23:03`
 * @param {Number} num
 * @returns {string}
 */
_.getTimeString = function(num){
    var d;
    if(_.is(num, 'Date')){
        d = num;
    } else {
        d = new Date();
        d.setTime(num);
    }
    var day = [
        d.getFullYear(),
        _.pad(d.getMonth() + 1),
        _.pad(d.getDate())
    ].join('-');
    var time = [
        _.pad(d.getHours()),
        _.pad(d.getMinutes()),
        _.pad(d.getSeconds())
    ].join(':');
    return day + ' ' + time;
};

/**
 * generate UUID
 * @returns {string}
 */
_.unique = function(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

/**
 * run mode, capture or diff or both
 * @type {{CAPTURE: number, DIFF: number}}
 */
_.mode = {
    CAPTURE: 1, // capture mode
    DIFF   : 2  // diff mode
};

/**
 * log type
 * @type {{DEBUG: string, WARNING: string, INFO: string, ERROR: string, NOTICE: string}}
 */
_.log = {
    DEBUG: '<[debug]>',
    WARNING: '<[warning]>',
    INFO: '<[info]>',
    ERROR: '<[error]>',
    NOTICE: '<[notice]>'
};