import assert from "node:assert";
import { describe, it } from "node:test";
import { MockDiffModifierContext } from "../all/utils.js";
import type { SnapshotDiff } from '../../types.js';
import { ProcessNextvalDefaultValues } from "./utils.js";

describe('ProcessNextvalDefaultValues', () => {
  it('should set default value of the field to the specified value as SQL expression if it contains an appropriate nextval(sequence) function. Removes the diff so that it is not further acted upon.', async () => {
    const obj1 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "diff": [
            {
              "kind": "E",
              "path": [
                "schema",
                "default_value"
              ],
              "rhs": "nextval('test_collection_id_seq'::regclass)"
            }
          ],
          "field": "id"
        }
      ],
      "relations": []
    } as SnapshotDiff;
    const obj2 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "diff": [],
          "field": "id"
        }
      ],
      "relations": []
    } as SnapshotDiff;
    assert.deepEqual((await ProcessNextvalDefaultValues(MockDiffModifierContext(obj1))).diff, obj2);
  });

  it('should cast default_value to Knex.raw() if it contains nextval function', async () => {
    const obj1 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "field": "id",
          "diff": [
            {
              "kind": "N",
              "rhs": {
                "collection": "test_collection",
                "field": "id",
                "type": "integer",
                "meta": { /* ... */ },
                "schema": {
                  "name": "id",
                  "table": "test_collection",
                  "data_type": "integer",
                  "default_value": "nextval('test_collection_id_seq'::regclass)",
                  "max_length": null,
                  "numeric_precision": 32,
                  "numeric_scale": 0,
                  "is_nullable": false,
                  "is_unique": true,
                  "is_primary_key": false,
                  "is_generated": false,
                  "generation_expression": null,
                  "has_auto_increment": true,
                  "foreign_key_table": null,
                  "foreign_key_column": null,
                },
              },
            },
          ],
        },
      ],
      "relations": []
    } as SnapshotDiff;
    const obj2 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "field": "id",
          "diff": [
            {
              "kind": "N",
              "rhs": {
                "collection": "test_collection",
                "field": "id",
                "type": "integer",
                "meta": { /* ... */ },
                "schema": {
                  "name": "id",
                  "table": "test_collection",
                  "data_type": "integer",
                  "default_value": {
                    "_events": {},
                    "_eventsCount": 0,
                    "client": {},
                    "sql": "nextval('test_collection_id_seq'::regclass)"
                  },
                  "max_length": null,
                  "numeric_precision": 32,
                  "numeric_scale": 0,
                  "is_nullable": false,
                  "is_unique": true,
                  "is_primary_key": false,
                  "is_generated": false,
                  "generation_expression": null,
                  "has_auto_increment": true,
                  "foreign_key_table": null,
                  "foreign_key_column": null,
                },
              },
            },
          ],
        },
      ],
      "relations": []
    } as SnapshotDiff;
    assert.deepEqual((await ProcessNextvalDefaultValues(MockDiffModifierContext(obj1))).diff, obj2);
  });

  it('should return same snapshot if default value doesn\'t contain nextval function', async () => {
    const obj1 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "diff": [
            {
              "kind": "E",
              "path": [
                "schema",
                "default_value"
              ],
              "rhs": "My default value"
            }
          ],
          "field": "id"
        }
      ],
      "relations": []
    } as SnapshotDiff;
    const obj2 = {
      "collections": [],
      "fields": [
        {
          "collection": "test_collection",
          "diff": [
            {
              "kind": "E",
              "path": [
                "schema",
                "default_value"
              ],
              "rhs": "My default value"
            }
          ],
          "field": "id"
        }
      ],
      "relations": []
    } as SnapshotDiff;
    assert.deepEqual((await ProcessNextvalDefaultValues(MockDiffModifierContext(obj1))).diff, obj2);
  });
});