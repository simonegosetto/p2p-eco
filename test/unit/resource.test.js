import test from 'node:test';
import assert from 'node:assert/strict';
import Resource, {sha256} from '../../src/core/resource/resource.js';

test('defaults to an empty value list', () => {
    const resource = new Resource('empty');

    assert.deepEqual(resource.values, []);
    assert.equal(resource.rows, 0);
    assert.equal(resource.hash, sha256('[]'));
});

test('rows follows values instead of going stale', () => {
    const resource = new Resource('users', ['a', 'b']);
    assert.equal(resource.rows, 2);

    resource.values.push('c');

    assert.equal(resource.rows, 3);
});

test('hashes the same values identically', () => {
    assert.equal(new Resource('a', [1, 2]).hash, new Resource('b', [1, 2]).hash);
});

test('updateHash reflects a change in values', () => {
    const resource = new Resource('users', ['a']);
    const before = resource.hash;

    resource.values.push('b');
    const after = resource.updateHash();

    assert.notEqual(after, before);
    assert.equal(resource.hash, after);
});

test('digest carries name, rows and hash', () => {
    const resource = new Resource('users', ['a', 'b', 'c']);

    assert.deepEqual(resource.digest(), {name: 'users', rows: 3, hash: resource.hash});
});

test('sha256 is a module function, not an instance field', () => {
    // it used to be an enumerable arrow field, duplicated per instance and
    // serialized along with the resource
    assert.equal(Object.keys(new Resource('users', [])).includes('SHA256'), false);
    assert.equal(typeof sha256, 'function');
});
