import * as Stream from 'node:stream';

import Wreck from '@hapi/wreck';
import { assert, describe, expect, expectTypeOf, it } from 'vitest';

import * as Ammo from '../src/index.js';

describe('typings', () => {
    describe('header()', () => {
        it('accepts a header string and a length', () => {
            expectTypeOf(Ammo.header).toBeCallableWith('bytes=2-9', 10);
        });

        it('returns a range array or null', () => {
            expectTypeOf(Ammo.header('bytes=2-9', 10)).toEqualTypeOf<Ammo.Range[] | null>();
        });

        it('requires a string header and a length', () => {
            // @ts-expect-error header and length are required
            expectTypeOf(Ammo.header).toBeCallableWith();
            // @ts-expect-error object is not assignable to string
            expectTypeOf(Ammo.header).toBeCallableWith({}, 45);
            // @ts-expect-error length is required
            expectTypeOf(Ammo.header).toBeCallableWith('x');
        });
    });

    describe('Clip', () => {
        it('clips a piped stream to a parsed range', async () => {
            const TestStream = class extends Stream.Readable {
                _count: number;

                constructor() {
                    super();
                    this._count = -1;
                }

                override _read() {
                    this._count++;

                    if (this._count < 10) {
                        this.push(this._count.toString());
                        return;
                    }

                    this.push(null);
                }
            };

            const [range] = Ammo.header('bytes=2-9', 10) ?? [];
            assert(range);
            const stream = new Ammo.Clip(range);

            const source = new TestStream();

            const buffer = await Wreck.read(source.pipe(stream));
            expect(buffer.toString()).toBe('23456789');
        });
    });
});
