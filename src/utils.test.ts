import assert from "node:assert";
import { describe, it } from "node:test";
import { deepEqual, getDiff, sortObject } from "./utils.js";

describe('sortObject', () => {
  it('should sort object keys alphabetically', () => {
    const input = { c: 1, a: 2, b: 3 };
    const assertedOutput = { a: 2, b: 3, c: 1 };
    assert.deepStrictEqual(sortObject(input), assertedOutput);
  });

  it('should sort nested object keys alphabetically', () => {
    const input = { c: 1, a: { d: 4, b: 3 }, e: 5 };
    const assertedOutput = { a: { b: 3, d: 4 }, c: 1, e: 5 };
    assert.deepStrictEqual(sortObject(input), assertedOutput);
  });

  it('should sort array elements recursively', () => {
    const input = [{ c: 1, a: 2 }, { b: 3 }];
    const assertedOutput = [{ a: 2, c: 1 }, { b: 3 }];
    assert.deepStrictEqual(sortObject(input), assertedOutput);
  });

  it('should return input if it is not an object', () => {
    assert.deepStrictEqual(sortObject(null as any), null);
    assert.deepStrictEqual(sortObject(42 as any), 42);
    assert.deepStrictEqual(sortObject('hello' as any), 'hello');
  });
});

describe('getDiff', () => {
  it('should return the entire new object if the old object is null', () => {
    const newObj = { a: 1, b: 2 };
    const oldObj = null;
    const assertedOutput = { a: 1, b: 2 };
    assert.deepStrictEqual(getDiff(newObj, oldObj), assertedOutput);
  });

  it('should return null if the new and old objects are equal', () => {
    const newObj = { a: 1, b: 2 };
    const oldObj = { a: 1, b: 2 };
    assert.deepStrictEqual(getDiff(newObj, oldObj), null);
  });

  it('should return only the different properties between the new and old objects', () => {
    const newObj = { a: 1, b: 2, c: 3 };
    const oldObj = { a: 1, b: 3, d: 4 };
    const assertedOutput = { b: 2, c: 3 };
    assert.deepStrictEqual(getDiff(newObj, oldObj), assertedOutput);
  });

  it('should handle nested objects', () => {
    const newObj = { a: 1, b: { c: 2, d: 3 } };
    const oldObj = { a: 1, b: { c: 2, d: 4 } };
    const assertedOutput = { b: { d: 3 } };
    assert.deepStrictEqual(getDiff(newObj, oldObj), assertedOutput);
  });

  it('should handle arrays', () => {
    const newObj = { a: 1, b: [1, 2, 3] };
    const oldObj = { a: 1, b: [1, 2, 4] };
    const assertedOutput = { b: [1, 2, 3] };
    assert.deepStrictEqual(getDiff(newObj, oldObj), assertedOutput);
  });
});

describe('deepEqual', () => {
  it('should return true for equal objects', () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { a: 1, b: { c: 2 } };
    assert.strictEqual(deepEqual(obj1, obj2), true);
  });

  it('should return false for different objects', () => {
    const obj1 = { a: 1, b: { c: 2 } };
    const obj2 = { a: 1, b: { c: 3 } };
    assert.strictEqual(deepEqual(obj1, obj2), false);
  });

  it('should return true for equal arrays', () => {
    const arr1 = [1, 2, { a: 3 }];
    const arr2 = [1, 2, { a: 3 }];
    assert.strictEqual(deepEqual(arr1, arr2), true);
  });

  it('should return false for different arrays', () => {
    const arr1 = [1, 2, { a: 3 }];
    const arr2 = [1, 2, { a: 4 }];
    assert.strictEqual(deepEqual(arr1, arr2), false);
  });

  it('should return true for equal primitives', () => {
    assert.strictEqual(deepEqual(1, 1), true);
    assert.strictEqual(deepEqual('hello', 'hello'), true);
    assert.strictEqual(deepEqual(null, null), true);
    assert.strictEqual(deepEqual(undefined, undefined), true);
  });

  it('should return false for different primitives', () => {
    assert.strictEqual(deepEqual(1, 2), false);
    assert.strictEqual(deepEqual('hello', 'world'), false);
    assert.strictEqual(deepEqual(null, undefined), false);
  });
});