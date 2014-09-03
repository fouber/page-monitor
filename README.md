## Page Monitor

> capture webpage and diff the dom change with [phantomjs](http://phantomjs.org/)

## Effects

### Element Add

![element add](./demo/1409037825746-1409037838093.png)

### Element Removed

![element removed](./demo/1409037838093-1409037882033.png)

### Text Changed

![element removed](./demo/1409037882033-1409037916727.png)

### Style Changed

![element removed](./demo/1409038130483-1409038137417.png)

## Usage

```javascript
var Monitor = require('page-monitor');

var url = 'http://www.google.com';
var monitor = new Monitor(url);
monitor.capture(function(code){
    console.log(monitor.log); // from phantom
    console.log('done, exit [' + code + ']');
});
```

## API

### Monitor

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
        includeSelectors: [ /* include selectors */ ],
        excludeSelectors: [ /* exclude selectors */ ],
        ignoreTextSelectors: [ /* ignore text selectors */ ],
        ignoreChildrenSelectors: [ /* ignore children selectors */ ],
        root: 'body' // root selector
    },
    diff: {
        highlight: { /* highlight styles */ }
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
        delay: 1000 // delay before screenshot, (ms)
    },
    path: {
        root: process.cwd(),   // data, screenshot save path
        // save path format, it can be a string
        // like this: '{hostname}/{port}/{pathname}/{query}{hash}'
        format: function(url, opt){
            return opt.hostname + (opt.port ? '-' + opt.port : '') + '/' + base64(opt.path);
        }
    }
};
```

### monitor.capture(callback [, noDiff]);

caputure webpage and save screenshot, then diff with last save.

```javascript
var monitor = new Monitor(url, options);
monitor.capture(function(code){
    console.log(monitor.log); // from phantom
    console.log('done, exit [' + code + ']');
});
```

### monitor.diff(left, right, callback);

diff change between left(date.getTime()) and right(date.getTime()).

```javascript
var monitor = new Monitor(url, options);
monitor.diff(1408947323420, 1408947556898, function(code){
    console.log(monitor.log); // from phantom
    console.log('done, exit [' + code + ']');
});
```

### events

```javascript
var monitor = new Monitor(url);
monitor.on('debug', function(msg){
    console.log('debug:', msg);
});
monitor.capture(function(code){
    console.log('done, exit [' + code + ']');
});
```

* ``debug``: debug from phantom
* ``notice``: console from webpage
* ``info``: info from phantom
* ``warning``: error from webpage
* ``error``: error from phantom
