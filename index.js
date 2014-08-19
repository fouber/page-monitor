var child_process = require('child_process');
var spawn = child_process.spawn;

var defaultSettings = {
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
    attributeFilters: [ 'id' ],
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
    }
};