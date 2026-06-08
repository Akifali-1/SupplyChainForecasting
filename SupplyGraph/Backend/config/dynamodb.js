/**
 * DynamoDB DocumentClient singleton for the Node.js backend.
 *
 * All Mongoose-based models (User, Company, Invite, InventorySnapshot) have
 * been replaced with direct DynamoDB operations using this shared client.
 *
 * Table: SupplyGraph-Prod  (single-table design)
 * PK / SK access pattern:
 *   COMPANY#<id>   METADATA              — company record
 *   COMPANY#<id>   USER#<googleId>       — user record
 *   COMPANY#<id>   INVITE#<token>        — invite token
 *   COMPANY#<id>   INVENTORY             — inventory snapshot
 *   COMPANY#<id>   MODEL                 — ML model metadata
 *   COMPANY#<id>   TRAINING_STATUS       — training progress
 *   COMPANY#<id>   PREDICTION_CACHE      — cached predictions
 *
 * GSI1:  GSI1_PK = reverse-lookup key (e.g. USER#<googleId>, INVITE#<token>)
 *        GSI1_SK = "METADATA"
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1"
});

// DocumentClient adds automatic marshalling/unmarshalling of DynamoDB types
const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    // Automatically convert empty strings to null (avoids DynamoDB validation errors)
    convertEmptyValues: true,
    // Don't strip undefined values — make caller handle this explicitly
    removeUndefinedValues: true
  },
  unmarshallOptions: {
    // Return native JS numbers not BigInt
    wrapNumbers: false
  }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || "SupplyGraph-Prod";

module.exports = { docClient, TABLE_NAME };
