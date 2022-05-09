'use strict';

const Stream = require('stream');

const Ammo = require('..');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Wreck = require('@hapi/wreck');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('header()', () => {

    it('parses header (start)', () => {

        expect(Ammo.header('bytes=0-4', 10)).to.equal([{ from: 0, to: 4 }]);
    });

    it('parses header (middle)', () => {

        expect(Ammo.header('bytes=1-5', 10)).to.equal([{ from: 1, to: 5 }]);
    });

    it('parses header (-to)', () => {

        expect(Ammo.header('bytes=-5', 10)).to.equal([{ from: 5, to: 9 }]);
    });

    it('parses header (from-)', () => {

        expect(Ammo.header('bytes=5-', 45000)).to.equal([{ from: 5, to: 44999 }]);
    });

    it('parses header (beyond end)', () => {

        expect(Ammo.header('bytes=10-20', 15)).to.equal([{ from: 10, to: 14 }]);
    });

    it('parses header (wrong unit)', () => {

        expect(Ammo.header('horses=1-5', 10)).to.equal(null);
    });

    it('parses header (flipped)', () => {

        expect(Ammo.header('bytes=5-1', 10)).to.equal(null);
    });

    it('parses header (missing =)', () => {

        expect(Ammo.header('bytes 1-5', 10)).to.equal(null);
    });

    it('parses header (missing to and from)', () => {

        expect(Ammo.header('bytes=-', 10)).to.equal(null);
    });

    it('parses header (multiple ranges)', () => {

        expect(Ammo.header('bytes=1-5,7-10', 10)).to.equal([{ from: 1, to: 5 }, { from: 7, to: 9 }]);
    });

    it('parses header (overlapping ranges)', () => {

        expect(Ammo.header('bytes=1-5,5-10', 10)).to.equal([{ from: 1, to: 9 }]);
    });
});

describe('Stream', () => {

    it('throws on invalid ranges', () => {

        const create = (range) => {

            return () => {

                new Ammo.Clip(range);
            };
        };

        expect(create()).to.throw(Error);
        expect(create(true)).to.throw(Error);
        expect(create({ from: 'banana', to: [] })).to.throw(Error);
        expect(create({ from: 0.3 })).to.throw(Error);
        expect(create({ from: 0.3, to: 10 })).to.throw(Error);
        expect(create({ from: -4, to: 10 })).to.throw(Error);
        expect(create({ to: -10 })).to.throw(Error);
        expect(create({ from: 4, to: 10.4 })).to.throw(Error);
        expect(create({ from: 4, to: 0 })).to.throw(Error);
    });

    it('returns a subset of a stream', async () => {

        const random = Buffer.alloc(5000);
        const source = Wreck.toReadableStream(random);
        const range = Ammo.header('bytes=1000-4000', 5000);
        const stream = new Ammo.Clip(range[0]);

        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal(random.slice(1000, 4001).toString());
    });

    it('returns a minimal subset of a stream', async () => {

        const random = Buffer.alloc(5000);
        const source = Wreck.toReadableStream(random);
        const stream = new Ammo.Clip({ from: null, to: null }); // Defaults to range 0-0

        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal(random.slice(0, 1).toString());
    });

    it('processes multiple chunks', async () => {

        const TestStream = class extends Stream.Readable {

            constructor() {

                super();
                this._count = -1;
            }

            _read() {

                this._count++;

                if (this._count > 10) {
                    return;
                }

                if (this._count === 10) {
                    this.push(null);
                    return;
                }

                this.push(this._count.toString());
            }
        };

        const range = Ammo.header('bytes=2-4', 10);
        const stream = new Ammo.Clip(range[0]);

        const source = new TestStream();
        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal('234');
    });

    it('emits error on internal processing errors', async () => {

        const random = Buffer.alloc(5000);
        const source = Wreck.toReadableStream(random);
        const stream = new Ammo.Clip({ from: 1000, to: 4000 });

        stream._range = null;         // Force a processing error

        await expect(Wreck.read(source.pipe(stream))).to.reject(Error);
    });

    it('ends stream when the requested bytes are delivered regardless of upstream status', async () => {

        const TestStream = class extends Stream.Readable {

            constructor() {

                super();
                this._count = -1;
            }

            _read() {

                this._count++;

                if (this._count < 10) {
                    this.push(this._count.toString());
                    return;
                }

                this.emit('error', new Error('Failed'));
                this.push(null);
            }
        };

        const range = Ammo.header('bytes=2-9', 10);
        const stream = new Ammo.Clip(range[0]);

        const source = new TestStream();

        let errored = false;
        source.on('error', () => {

            errored = true;
        });

        const buffer = await Wreck.read(source.pipe(stream));
        expect(buffer.toString()).to.equal('23456789');
        expect(source._count).to.equal(10);
        expect(errored).to.be.true();
    });
});
