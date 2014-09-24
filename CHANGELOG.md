## Thu Sep 25 2014

> Because of screenshot is png format, it will occupy so much space, so I change it into ``jpeg`` and set quality as ``80`` by default.

* [Mod] save screenshot as ``jpeg`` by default, and quality is ``80``
* [Add] add options to set screenshot format, quality.

If you want to save screenshot as png format, you can:


```javascript
var Monitor = require('monitor');
var m = new Monitor('http://www.example.com', {
    render: {
        format: 'png'
    }
});
```