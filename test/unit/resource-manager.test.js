import test from 'node:test';
import assert from 'node:assert/strict';
import ResourceManager from '../../src/core/resource/resource-manager.js';
import Resource from '../../src/core/resource/resource.js';
import {setLevel} from '../../src/core/logger.js';

setLevel('silent');

const managerWithSpy = () => {
    const sent = [];
    const manager = new ResourceManager({
        broadcast: (type, data) => {
            sent.push({type, data});
            return 2;
        }
    });
    return {manager, sent};
};

test('registers a resource', () => {
    const {manager} = managerWithSpy();

    assert.equal(manager.addResource(new Resource('users', [1])), true);
    assert.equal(manager.size, 1);
    assert.equal(manager.getResource('users').rows, 1);
});

test('rejects anything that is not a Resource', () => {
    const {manager} = managerWithSpy();

    assert.equal(manager.addResource({name: 'users', values: []}), false);
    assert.equal(manager.size, 0);
});

test('rejects a duplicate name without overwriting', () => {
    const {manager} = managerWithSpy();
    manager.addResource(new Resource('users', [1]));

    assert.equal(manager.addResource(new Resource('users', [1, 2])), false);
    assert.equal(manager.getResource('users').rows, 1);
});

test('check broadcasts one digest per resource', () => {
    const {manager, sent} = managerWithSpy();
    manager.addResource(new Resource('users', ['a']));
    manager.addResource(new Resource('roles', ['x', 'y']));

    const reached = manager.check();

    assert.equal(reached, 2);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'resource-digest');
    assert.deepEqual(sent[0].data.map(d => d.name), ['users', 'roles']);
    assert.deepEqual(sent[0].data.map(d => d.rows), [1, 2]);
});

test('check broadcasts nothing when there is no resource', () => {
    const {manager, sent} = managerWithSpy();

    assert.equal(manager.check(), 0);
    assert.deepEqual(sent, []);
});

test('survives being built without a broadcast function', () => {
    const manager = new ResourceManager();
    manager.addResource(new Resource('users', ['a']));

    assert.equal(manager.check(), 0);
});
