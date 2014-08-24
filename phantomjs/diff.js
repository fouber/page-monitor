function equal(left, right){
    var type = typeof left;
    if(type === typeof right){
        switch(type){
            case 'object':
                var lKeys = Object.keys(left);
                var rKeys = Object.keys(right);
                if(lKeys.length === rKeys.length){
                    for(var i = 0; i < lKeys.length; i++){
                        var key = lKeys[i];
                        if(!right.hasOwnProperty(key) || (left[key] !== right[key])){
                            return false;
                        }
                    }
                    return true;
                } else {
                    return false;
                }
                break;
            default:
                return left === right;
        }
    } else {
        return false;
    }
}

/**
 *
 * @param left
 * @param right
 * @returns {boolean|*}
 */
function isMatch(left, right){
    return (left.name === right.name) && equal(left.attr, right.attr);
}

/**
 *
 * @type {exports}
 * @returns {Array}
 */
var diff = function(left, right, opt){
    var ret = [];
    var change = {
        type: 0,
        node: right
    };
    if(left.style !== right.style){
        change.type |= opt.changeType.STYLE;
    }
    var start = 0;
    right.child.forEach(function(cur){
        for(var i = start; i < left.child.length; i++){
            var old = left.child[i];
            if(isMatch(old, cur)){
                Object.defineProperty(old, 'matched', {
                    value: true,
                    enumerable: false,
                    writable: false
                });
                if(cur.name === '#'){
                    if(old.text !== cur.text){
                        change.type |= opt.changeType.TEXT;
                    }
                } else {
                    var r = diff(old, cur, opt);
                    ret = ret.concat(r);
                }
                start = i + 1;
                return;
            }
        }
        if(cur.name === '#'){
            change.type |= opt.changeType.TEXT;
        } else {
            ret.push({
                type: opt.changeType.ADD,
                node: cur
            });
        }
    });
    left.child.forEach(function(item){
        if(!item.matched){
            ret.push({
                type: opt.changeType.REMOVE,
                node: item
            });
        }
    });
    if(change.type){
        ret.push(change);
    }
    return ret;
};

module.exports = diff;