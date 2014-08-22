module.exports = function(TOKEN, data){

    function normalizeSelectors(selectors){
        if(Object.prototype.toString.call(selectors) === '[object Array]'){
            return selectors.join(',');
        } else {
            return String(selectors || '');
        }
    }

    // walk settings
    var INVISIBLE_ELEMENT = data.invisibleElements;
    var IGNORE_CHILDREN_ELEMENT = data.ignoreChildrenElements;
    var STYLE_FILTERS = data.styleFilters;
    var ATTR_FILTERS = data.attributeFilters;
    var INCLUDE_SELECTORS = normalizeSelectors(data.includeSelectors);
    var EXCLUDE_SELECTORS = normalizeSelectors(data.excludeSelectors);
    var IGNORE_CHILDREN_SELECTORS = normalizeSelectors(data.ignoreChildrenSelectors);
    var ROOT = data.root || 'body';

    // reg
    var invisibleElementReg = new RegExp('^(' + INVISIBLE_ELEMENT.join('|') + ')$', 'i');
    var ignoreChildrenElementReg = new RegExp('^(' + IGNORE_CHILDREN_ELEMENT.join('|') + ')$', 'i');

    function isInvisible(elem){
        var tagName = elem.tagName.toLowerCase();
        invisibleElementReg.lastIndex = 0;
        return (invisibleElementReg.test(tagName) || (tagName === 'input' && elem.type === 'hidden'));
    }

    function igonreChildren(elem){
        ignoreChildrenElementReg.lastIndex = 0;
        return ignoreChildrenElementReg.test(elem.tagName) ||
              (IGNORE_CHILDREN_SELECTORS && elem.webkitMatchesSelector(IGNORE_CHILDREN_SELECTORS));
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

    function filter(dom){
        var ret = true;
        switch (dom.nodeType){
            case 1:
                if(EXCLUDE_SELECTORS){
                    ret = ret && (!dom.webkitMatchesSelector(EXCLUDE_SELECTORS));
                }
                if(INCLUDE_SELECTORS){
                    ret = ret && dom.webkitMatchesSelector(INCLUDE_SELECTORS)
                }
                break;
            case 3:
                // do nothing
                break;
            default:
                ret = false;
                break;
        }
        return ret;
    }

    // walk dom tree
    function walk(elem){
        var node = {};
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
                        if(filter(child)){
                            var vdom = arguments.callee(child);
                            if(typeof vdom !== 'undefined' && vdom.style !== false){
                                node.child.push(vdom);
                            }
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

    return walk(document.querySelector(ROOT));

};