import * as Stream from 'stream';

import * as Ammo from '..';
import * as Code from '@hapi/code';
import * as Lab from '@hapi/lab';
import * as Wreck from '@hapi/wreck';


const { expect } = Lab.types;


const TestStream = class extends Stream.Readable {

    _count: number;

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

        this.push(null);
    }
};

const range = Ammo.header('bytes=2-9', 10) as Ammo.Range[];
const stream = new Ammo.Clip(range[0]);

const source = new TestStream();

const buffer = await Wreck.read(source.pipe(stream));
Code.expect(buffer.toString()).to.equal('23456789');


// header()

Ammo.header('bytes=2-9', 10);

expect.type<Ammo.Range[] | null>(Ammo.header('bytes=2-9', 10));

expect.error(Ammo.header());
expect.error(Ammo.header({}, 45));
expect.error(Ammo.header('x'));
