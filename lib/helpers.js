'use strict';

exports.lowercase = function(text) {
    return text.toLowerCase();
};

exports.slice = function(text) {
    if (text.charAt(text.length - 1) == 's') {
        text = text.slice(0, -1);
    }
    return text;
};

exports.section = function(name, options){
    if(!this._sections) this._sections = {};
    this._sections[name] = options.fn(this);
    return null;
}

exports.ifCond = function(v1, v2, options) {
    if(v1 === v2) {
        return options.fn(this);
    }
    return options.inverse(this);
}

exports.orCond = function(v1, v2, v3, options) {
    if(v1 === v2 || v1 === v3){
        return options.fn(this);
    }
    return options.inverse(this);
}

exports.getCanonicalUrl = function(pathh, pagenum_in) {
    var urll;
    if(pagenum_in == 1){
        urll = pathh;
    }
    else{
        urll = pathh + "?page=" + pagenum_in;
    }
    return urll;
};

exports.getSiteName = function(){
    return "Canopy Tent Reviews";
}

exports.getYear = function(){
    return "2023";
}

exports.getSiteUrl = function(){
    const env = require('env-var');
    return (env.get('NODE_ENV').required() == 'production' ? 'https://' : 'http://') + env.get('URL').required();
}