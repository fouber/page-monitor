module.exports = function(TOKEN, data){

    // console.log
    var log = function(){
        var args = [];
        for(var i = 0, len = arguments.length; i < len; i++){
            var value = arguments[i];
            switch (Object.prototype.toString.call(value)){
                case '[object Object]':
                case '[object Array]':
                    value = JSON.stringify(value);
                    break;
            }
            args.push(value);
        }
        console.log(TOKEN + args.join(' '));
    };

    // diff kernel

    // walk settings
    var INVISIBLE_ELEMENT = data.walk.invisibleElements;
    var IGNORE_CHILDREN_ELEMENT = data.walk.ignoreChildrenElements;
    var STYLE_FILTERS = data.walk.styleFilters;
    var ATTR_FILTERS = data.walk.styleFilters;

    // diff settings
    var CHANGE_STYLE = {};
    CHANGE_STYLE.ADD = data.diff.changeStyle.add;
    CHANGE_STYLE.REMOVE = data.diff.changeStyle.remove;
    CHANGE_STYLE.text = data.diff.changeStyle.text;
    CHANGE_STYLE.textAdd = data.diff.changeStyle.textAdd;

    // if ignore text change
    var IGNORE_TEXT = data.diff.ignoreText;

    // reg
    var invisibleElementReg = new RegExp('^(' + INVISIBLE_ELEMENT.join('|') + ')$', 'i');
    var ignoreChildrenElementReg = new RegExp('^(' + IGNORE_CHILDREN_ELEMENT.join('|') + ')$', 'i');

    // get rect of element
    function getRect(elem){
        var rect = elem.getBoundingClientRect();
        var doc = elem.ownerDocument;
        var win = doc.defaultView;
        var html = doc.documentElement;
        var x = Math.floor(rect.left + win.pageXOffset - html.clientLeft);
        var y = Math.floor(rect.top + win.pageYOffset - html.clientTop);
        var w = Math.floor(rect.width);
        var h = Math.floor(rect.height);
        return [x, y, w, h];
    }

    // get attributes of element
    function getAttr(elem){
        var ret = {};
        var filters = ATTR_FILTERS.slice(0);
        if(elem.tagName.toLowerCase() === 'input'){
            filters.push('type');
        }
        filters.forEach(function(key){
            var attr = elem.getAttribute(key);
            if(attr !== null){
                ret[key] = attr;
            }
        });
        return ret;
    }

    function isInvisible(elem){
        var tagName = elem.tagName.toLowerCase();
        invisibleElementReg.lastIndex = 0;
        return (invisibleElementReg.test(tagName) || (tagName === 'input' && elem.type === 'hidden'));
    }

    function igonreChildren(elem){
        ignoreChildrenElementReg.lastIndex = 0;
        return ignoreChildrenElementReg.test(elem.tagName);
    }

    // get computed styles
    function getStyles(elem){
        var ret = {};
        var filters = STYLE_FILTERS.slice(0);
        if(igonreChildren(elem)){
            filters.width = true;
            filters.height = true;
        }
        var styles = elem.ownerDocument.defaultView.getComputedStyle( elem, null );
        var display = styles.getPropertyValue('display');
        var opacity = styles.getPropertyValue('opacity');
        var visibility = styles.getPropertyValue('visibility');
        if(display === 'none' || opacity === '0' || visibility === 'hidden'){
            return false;
        } else {
            var position = styles.getPropertyValue('position');
            if(position !== 'static'){
                filters.push('top', 'right', 'bottom', 'left');
            }
            filters.forEach(function(key){
                ret[key] = styles.getPropertyValue(key);
            });
        }
        return ret;
    }

    // walk dom tree
    function walk(elem){
        var node = {};
        Object.defineProperty(node, 'dom', {
            value: elem,
            enumerable: false,
            writable: false
        });
        if(elem.nodeType === 1){
            node.name = elem.tagName.toLowerCase();
            if(!isInvisible(elem)){
                node.rect = getRect(elem);
                node.attr = getAttr(elem);
                node.style = getStyles(elem);
                node.child = [];
                if(!igonreChildren(elem)){
                    for(var i = 0, len = elem.childNodes.length; i < len; i++){
                        var child = elem.childNodes[i];
                        var vdom = arguments.callee(child);
                        if(typeof vdom !== 'undefined' && vdom.style !== false){
                            node.child.push(vdom);
                        }
                    }
                }
                return node;
            }
        } else if(elem.nodeType === 3) {
            var text = elem.nodeValue.trim();
            if(text){
                node.name = '#';
                node.text = text;
                return node;
            }
        }
    }

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

    function isMatch(left, right){
        return (left.name === right.name) && equal(left.attr, right.attr);
    }

    // diff
    function diff(left, right, filter){
        var ret = [];
        if(!equal(left.style, right.style)){
            // style change
            ret.push({type: CHANGE_TYPE.STYLE, node: right});
        }
        loop: for(var i = 0; i < right.child.length; i++){
            var cur = right.child[i];
            for(var j = 0; j < left.child.length; j++){
                var old = left.child[j];
                if(!old.matched && isMatch(old, cur)){
                    old.matched = true;
                    Object.defineProperty(cur, 'matched', {
                        value: old,
                        enumerable: false,
                        writable: false
                    });
                    if(cur.name === '#'){
                        if(old.text !== cur.text){
                            // text change
                            ret.push({type: CHANGE_TYPE.TEXT, node: cur});
                        }
                    } else {
                        if(filter){
                            if(typeof filter === 'string'){
                                if(cur.dom.webkitMatchesSelector(filter)) continue loop;
                            } else if(typeof filter === 'function'){
                                if(filter(cur)) continue loop;
                            }
                        }
                        if(!igonreChildren(cur.dom)){
                            var r = arguments.callee(old, cur, filter);
                            if(r.length){
                            }
                            ret = ret.concat(r);
                        }
                    }
                    continue loop;
                }
            }
            // add element
            ret.push({type: CHANGE_TYPE.ADD, node: cur});
        }

        for(var k = 0; k < left.child.length; k++){
            var node = left.child[k];
            if(!node.matched){
                // remove element
                Object.defineProperty(node, 'parent', {
                    value: right,
                    enumerable: false,
                    writable: false
                });
                ret.push({type: CHANGE_TYPE.REMOVE, node: node});
            }
        }
        return ret
    }

    function px(val){
        return val + 'px';
    }

    function highlightElement(rect, options){
        var div = document.createElement('x-diff-div');
        div.style.position = 'absolute';
        div.style.display = 'block';
        div.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
        div.style.border = '1px dashed #333';
        div.style.fontSize = '12px';
        div.style.fontWeight = 'normal';
        div.style.overflow = 'hidden';
        div.style.color = '#fff';
        div.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.4)';
        div.style.textShadow = '0 1px 1px rgba(0, 0, 0, 0.7)';
        if(options.title){
            var span = document.createElement('x-diff-span');
            span.innerHTML = options.title;
            span.style.display = 'block';
            span.style.position = 'absolute';
            span.style.fontSize = '12px';
            span.style.right = '0';
            span.style.top = '0';
            span.style.padding = '0 2px';
            //span.style.borderLeft = '1px solid #fff';
            //span.style.borderRadius = '3px';
            //span.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            div.appendChild(span);
        }
        for(var key in options){
            if(options.hasOwnProperty(key)){
                div.style[key] = options[key];
            }
        }
        div.style.left = px(rect[0]);
        div.style.top = px(rect[1]);
        div.style.width = px(rect[2]);
        div.style.height = px(rect[3]);
        document.body.appendChild(div);
    }

    function highlightText(dom, options){
        var range = document.createRange();
        range.setStart(dom, 0);
        range.setEnd(dom, dom.nodeValue.length);
        var text = range.extractContents();
        var span = document.createElement('x-diff-span');
        span.style.display = 'inline';
        span.style.backgroundColor = 'yellow';
        span.style.boxShadow = '0 0 2px rgba(0, 0, 0, 0.75)';
        for(var key in options){
            if(options.hasOwnProperty(key)){
                span.style[key] = options[key];
            }
        }
        range.insertNode(span);
        span.appendChild(text);
    }

    function mark(diff){
        var removed = [];
        diff.forEach(function(item){
            var node = item.node;
            switch (item.type){
                case CHANGE_TYPE.TEXT:
                    if(!IGNORE_TEXT){
                        highlightText(node.dom, CHANGE_STYLE.TEXT);
                    }
                    break;
                case CHANGE_TYPE.ADD:
                    if(node.name === '#'){
                        if(!IGNORE_TEXT){
                            highlightText(node.dom, CHANGE_STYLE.TEXT_ADD);
                        }
                    } else {
                        highlightElement(node.rect, CHANGE_STYLE.ADD);
                    }
                    break;
                case CHANGE_TYPE.STYLE:
                    highlightElement(node.rect, CHANGE_STYLE.STYLE);
                    break;
                case CHANGE_TYPE.REMOVE:
                    if(node.rect){
                        removed.push(node);
                        // console.log(node.rect);
                        // highlightElement(node.rect, CHANGE_STYLE.REMOVE);
                    } else if(!IGNORE_TEXT) {
                        // text removed
                    }
                    break;
            }
        });
        return removed;
    }
    var tree = walk(document.querySelector(diff.root || 'body'));
    var ret = {};
    ret.tree = JSON.parse(JSON.stringify(tree));
    if(data.diff.last){
        var result = diff(data.diff.last, tree);
        ret.removed = mark(result);
    }
    return ret;
};