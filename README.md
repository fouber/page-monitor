## page monitor

> capture webpage and diff the change with phantomjs

## Usage

```javascript
var Monitor = require('page-monitor');

var url = 'http://www.google.com';
var options = { ... };
var monitor = new Monitor(url, options);
monitor.capture(function(code, log){
    // code: phantom exit code
    // log: console.log from phantom
    console.log('done');
});
```

## API

### Monitor(Class)

```javascript
var monitor = new Monitor(url, options);
```

options:

```javascript

var defaultSettings = {
    cli: { /* phantomjs cli options */ },
    page: { /* webpage settings */ },
    walk: {
        invisibleElements : [ /* invisible elements */ ],
        ignoreChildrenElements: [ /* ignore children elements */ ],
        styleFilters: [ /* record styles */ ],
        attributeFilters: [ /* record attribute */ ],
        includeSelectors: [ /* exclude selectors */ ],
        excludeSelectors: [ /* include selectors */ ],
        ignoreTextSelectors: [ /* ignore text selectors */ ],
        ignoreChildrenSelectors: [ /* ignore children selectors */ ],
        root: 'body' // root selector
    },
    diff: {
        highlight: { /* highlight styles */ }
    },
    events: {
        init: function(token){ /* page.onInitialized */ },
        beforeWalk: function(token){ /* before walk dom tree */ }
    },
    render: {
        delay: 1000 // delay before capture
    },
    path: {
        root: DEFAULT_DATA_DIRNAME,   //file save path
        // format: '{hostname}/{port}/{pathname}/{query}{hash}'
        format: function(url, opt){   //path format
            return opt.hostname + (opt.port ? '-' + opt.port : '') + '/' + base64(opt.path);
        }
    }
};
```

### monitor.capture(callback);

caputure webpage and save screenshot

```javascript
var monitor = new Monitor(url, options);
monitor.capture(function(code, log){
    // code: phantom exit code
    // log: console.log from phantom
    console.log('done');
});
```

### monitor.diff(left, right, callback);

diff change between left(date.getTime()) and right(date.getTime()).

```javascript
var monitor = new Monitor(url, options);
monitor.diff(1408947323420, 1408947556898,function(code, log){
    // code: phantom exit code
    // log: console.log from phantom
    console.log('done');
});
```