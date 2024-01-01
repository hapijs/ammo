'use strict';

const Stream = require('stream');

const Hoek = require('hoek');


const internals = {};


// RFC 7233 (https://tools.ietf.org/html/rfc7233#appendix-D)
//
// Range = "bytes" "=" byte-range-set
// byte-range-set = *( "," OWS ) byte-range-spec *( OWS "," [ OWS byte-range-spec ] )
// byte-range-spec = ( 1*DIGIT "-" [ 1*DIGIT ] ) / ( "-" 1*DIGIT )


//                                12  3          3 4       425         6  7          7 8       865 1
internals.headerRx = /^bytes=[\s,]*((?:(?:\d+\-\d*)|(?:\-\d+))(?:\s*,\s*(?:(?:\d+\-\d*)|(?:\-\d+)))*)$/i;


exports.header = function (header, length) {

    // Parse header

    const parts = internals.headerRx.exec(header);
    if (!parts) {
        return null;
    }

    const lastPos = length - 1;

    const result = [];
    const ranges = parts[1].match(/\d*\-\d*/g);

    // Handle headers with multiple ranges

    for (let range of ranges) {
        let from;
        let to;
        range = range.split('-');
        if (range[0]) {
            from = parseInt(range[0], 10);
        }

        if (range[1]) {
            to = parseInt(range[1], 10);
            if (from !== undefined) {      // Can be 0
                // From-To
                if (to > lastPos) {
                    to = lastPos;
                }
            }
            else {
                // -To
                from = length - to;
                to = lastPos;
            }
        }
        else {
            // From-
            to = lastPos;
        }

        if (from > to) {
            return null;
        }

        result.push(new internals.Range(from, to));
    }

    if (result.length === 1) {
        return result;
    }

    // Sort and consolidate ranges

    result.sort((a, b) => a.from - b.from);

    const consolidated = [];
    for (let i = result.length - 1; i > 0; --i) {
        const current = result[i];
        const before = result[i - 1];
        if (current.from <= before.to + 1) {
            before.to = current.to;
        }
        else {
            consolidated.unshift(current);
        }
    }

    consolidated.unshift(result[0]);

    return consolidated;
};


internals.Range = class {

    constructor(from, to) {

        this.from = from;
        this.to = to;
    }
};


exports.Stream = internals.Stream = function (range) {

    Stream.Transform.call(this);

    this._range = range;
    this._next = 0;
};

Hoek.inherits(internals.Stream, Stream.Transform);


internals.Stream.prototype._transform = function (chunk, encoding, done) {

    // Read desired range from a stream

    const pos = this._next;
    this._next = this._next + chunk.length;

    if (this._next <= this._range.from ||       // Before range
        pos > this._range.to) {                 // After range

        return done();
    }

    // Calc bounds of chunk to read

    const from = Math.max(0, this._range.from - pos);
    const to = Math.min(chunk.length, this._range.to - pos + 1);

    this.push(chunk.slice(from, to));
    return done();
};
