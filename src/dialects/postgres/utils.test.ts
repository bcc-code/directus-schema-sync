import assert from "node:assert";
import { describe, it } from "node:test";
import { sequenceToSerialType } from "./utils.js";

describe('sequenceToSerialType', () => {
    it('should remove nextval default value and set has_auto_increment to true', () => {
      const obj1 = {
        "fields": [
          {
            "collection": "test_collection",
            "field": "id",
            "type": "integer",
            "meta": null,
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
              "is_primary_key": true,
              "is_generated": false,
              "generation_expression": null,
              "has_auto_increment": false,
              "foreign_key_table": null,
              "foreign_key_column": null
            }
          }
        ]
      };
      const obj2 = {
        "fields": [
          {
            "collection": "test_collection",
            "field": "id",
            "type": "integer",
            "meta": null,
            "schema": {
              "name": "id",
              "table": "test_collection",
              "data_type": "integer",
              "default_value": null,
              "max_length": null,
              "numeric_precision": 32,
              "numeric_scale": 0,
              "is_nullable": false,
              "is_unique": true,
              "is_primary_key": true,
              "is_generated": false,
              "generation_expression": null,
              "has_auto_increment": true,
              "foreign_key_table": null,
              "foreign_key_column": null
            }
          }
        ]
      };
      assert.deepEqual(sequenceToSerialType(obj1), obj2);
    });
  
    it('should return same snapshot if serial type is already used everywhere', () => {
      const obj1 = {
        "fields": [
          {
            "collection": "test_collection",
            "field": "id",
            "type": "string",
            "meta": null,
            "schema": {
              "name": "id",
              "table": "test_collection",
              "data_type": "integer",
              "default_value": "test",
              "max_length": null,
              "numeric_precision": 32,
              "numeric_scale": 0,
              "is_nullable": false,
              "is_unique": true,
              "is_primary_key": true,
              "is_generated": false,
              "generation_expression": null,
              "has_auto_increment": false,
              "foreign_key_table": null,
              "foreign_key_column": null
            }
          }
        ]
      };
      const obj2 = {
        "fields": [
          {
            "collection": "test_collection",
            "field": "id",
            "type": "string",
            "meta": null,
            "schema": {
              "name": "id",
              "table": "test_collection",
              "data_type": "integer",
              "default_value": "test",
              "max_length": null,
              "numeric_precision": 32,
              "numeric_scale": 0,
              "is_nullable": false,
              "is_unique": true,
              "is_primary_key": true,
              "is_generated": false,
              "generation_expression": null,
              "has_auto_increment": false,
              "foreign_key_table": null,
              "foreign_key_column": null
            }
          }
        ]
      };
      assert.deepEqual(sequenceToSerialType(obj1), obj2);
    });
  });