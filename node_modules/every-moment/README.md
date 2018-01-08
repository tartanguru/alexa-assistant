#  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-url]][daviddm-image]

> Declarative setInterval using moment durations

## Getting Started
See usage for example of combining the ['wait-one-moment'](https://github.com/raygerrard/wait-one-moment) module for declarative setTimeout and setInterval.

## Install

```sh
$ npm install --save every-moment
```


## Usage

```js
var every = require('every-moment');
var wait = require('wait-one-moment');
var potatoes;

var timer = every(1, 'second', function() {
    console.log(this.duration);
});

wait(5, 'seconds', function() {
    timer.set(2, 'seconds').start();
});

wait(10, 'seconds', function() {
    console.log('Stop the clock!');
    timer.stop();
});

wait(15, 'seconds', function() {
    if(!potatoes) {
        console.log('No potatoes :(');
        potatoes = true;
        this.start();
    } else {
        console.log('YUM :)');
    }
});
```


## License

MIT © [Ray Gerrard]()


[npm-url]: https://npmjs.org/package/every-moment
[npm-image]: https://badge.fury.io/js/every-moment.svg
[travis-url]: https://travis-ci.org/raygerrard/every-moment
[travis-image]: https://travis-ci.org/raygerrard/every-moment.svg?branch=master
[daviddm-url]: https://david-dm.org/raygerrard/every-moment.svg?theme=shields.io
[daviddm-image]: https://david-dm.org/raygerrard/every-moment