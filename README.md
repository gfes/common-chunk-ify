
> Browserify plugin for Generate an extra chunk, which contains common modules shared between entry points.

## Install
``` bash
npm install common-chunk-ify --save
```

## Useage
if you have some source files like this
```javascript
//entry a.js
var c = require("./c");
var a1 = require("./a1");
module.exports = "a";
```

```javascript
//entry a1.js
module.exports = "a1";
```

```javascript
//entry b.js
var c = require("./c");
module.exports = "b";
```

```javascript
//c.js
module.exports = "c";
```

##### Node Scripts

```javascript
"use strict";
const browserify = require("browserify");
const gulp = require("gulp");

let b = browserify(["a.js","b.js"])
    .plugin("common-chunk-ify",{
        map:{
            "a.js":"app.js"
            ,"b.js":"bpp.js"
        }
        requireName:"mycommon"
        commonName:"mycommon.js"
    })
    
b.on("bundle file",bundle=> {
    bundle.pipe(gulp.dest("./dist")); // our some other custom stream
    // dist/
    //   app.js (with a,a1)
    //   bpp.js (with b)
    //   mycommon.js (with c only)
})
```

##### Options

##### Prevent Global Pollution

## Tests
``` bash
npm install --save-dev
npm test
```

## inspire by
- [factor-bundle](https://github.com/substack/factor-bundle) ([npm](https://www.npmjs.com/package/factor-bundle))