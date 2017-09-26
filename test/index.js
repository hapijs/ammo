'use strict';

// Load modules

const Stream = require('stream');

const Ammo = require('..');
const Code = require('code');
const Hoek = require('hoek');
const Lab = require('lab');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('header()', () => {

    it('parses header (start)', async () => {

        expect(Ammo.header('bytes=0-4', 10)).to.equal([{ from: 0, to: 4 }]);
    });

    it('parses header (middle)', async () => {

        expect(Ammo.header('bytes=1-5', 10)).to.equal([{ from: 1, to: 5 }]);
    });

    it('parses header (-to)', async () => {

        expect(Ammo.header('bytes=-5', 10)).to.equal([{ from: 5, to: 9 }]);
    });

    it('parses header (from-)', async () => {

        expect(Ammo.header('bytes=5-', 45000)).to.equal([{ from: 5, to: 44999 }]);
    });

    it('parses header (beyond end)', async () => {

        expect(Ammo.header('bytes=10-20', 15)).to.equal([{ from: 10, to: 14 }]);
    });

    it('parses header (wrong unit)', async () => {

        expect(Ammo.header('horses=1-5', 10)).to.equal(null);
    });

    it('parses header (flipped)', async () => {

        expect(Ammo.header('bytes=5-1', 10)).to.equal(null);
    });

    it('parses header (missing =)', async () => {

        expect(Ammo.header('bytes 1-5', 10)).to.equal(null);
    });

    it('parses header (missing to and from)', async () => {

        expect(Ammo.header('bytes=-', 10)).to.equal(null);
    });

    it('parses header (multiple ranges)', async () => {

        expect(Ammo.header('bytes=1-5,7-10', 10)).to.equal([{ from: 1, to: 5 }, { from: 7, to: 9 }]);
    });

    it('parses header (overlapping ranges)', async () => {

        expect(Ammo.header('bytes=1-5,5-10', 10)).to.equal([{ from: 1, to: 9 }]);
    });
});

describe('Stream', () => {

    it('returns a subset of a stream', async () => {

        const random = new Buffer(5000);
        const source = Wreck.toReadableStream(random);
        const range = Ammo.header('bytes=1000-4000', 5000);
        const stream = new Ammo.Stream(range[0]);

        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal(random.slice(1000, 4001).toString());
    });

    it('processes multiple chunks', async () => {

        const TestStream = function () {

            Stream.Readable.call(this);
            this._count = -1;
        };

        Hoek.inherits(TestStream, Stream.Readable);

        TestStream.prototype._read = function (size) {

            this._count++;

            if (this._count > 10) {
                return;
            }

            if (this._count === 10) {
                this.push(null);
                return;
            }

            this.push(this._count.toString());
        };

        const range = Ammo.header('bytes=2-4', 10);
        const stream = new Ammo.Stream(range[0]);

        const source = new TestStream();
        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal('234');
    });
});
