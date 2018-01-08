'use strict';
var moment = require('moment');

function Every(amount, type, callback) {
    if (!(this instanceof Every)) {
        return new Every(amount, type, callback);
    }
    this.start(amount, type, callback);
}

Every.prototype.start = function(amount, type, callback) {
    this.stop();
    if(amount) {
        if ((typeof amount) === 'function') {
            this.callback = amount;
        } else {
            this.callback = callback;
            this.set(amount, type);
        }
    } else if(!this.duration) {
        this.set(1, 'second');
    }
    this.timer = setInterval(this.callback.bind(this), this.duration);
    return this;
};

Every.prototype.set = function(amount, type) {
    this.duration = moment.duration(amount, type).asMilliseconds();
    return this;
};

Every.prototype.stop = function() {
    clearInterval(this.timer);
    return this;
};

module.exports = Every;