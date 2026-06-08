/**
 * SupplyChain MongoDB to Amazon DynamoDB + S3 Data Migration Script
 *
 * This script runs a one-time migration of all data from MongoDB Atlas to
 * DynamoDB and S3.
 *
 * Requirements:
 * 1. Environment variables set:
 *    - MONGO_URI
 *    - DYNAMODB_TABLE (default: SupplyGraph-Prod)
 *    - S3_MODELS_BUCKET
 *    - AWS_REGION (default: us-east-1)
 *    - AWS_ACCESS_KEY_ID (if not using IAM role)
 *    - AWS_SECRET_ACCESS_KEY (if not using IAM role)
 *
 * Run command:
 *   node scripts/migrate-mongo-to-dynamo.js
 */

require("dotenv").config();
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const MONGO_URI = process.env.MONGO_URI;
const TABLE_NAME = process.env.DYNAMODB_TABLE || "SupplyGraph-Prod";
const BUCKET_NAME = process.env.S3_MODELS_BUCKET;
const REGION = process.env.AWS_REGION || "us-east-1";

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI environment variable is required.");
  process.exit(1);
}

if (!BUCKET_NAME) {
  console.error("❌ ERROR: S3_MODELS_BUCKET environment variable is required.");
  process.exit(1);
}

console.log("🚀 Starting MongoDB to AWS Migration...");
console.log(`📌 Target DynamoDB Table: ${TABLE_NAME}`);
console.log(`📌 Target S3 Bucket:     ${BUCKET_NAME}`);
console.log(`📌 AWS Region:            ${REGION}`);

// Initialize AWS SDK
const rawDynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(rawDynamoClient, {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true }
});
const s3Client = new S3Client({ region: REGION });

async function runMigration() {
  const mongoClient = new MongoClient(MONGO_URI);
  
  try {
    await mongoClient.connect();
    console.log("🔌 Connected to MongoDB Atlas");
    
    const db = mongoClient.db(); // Default db from URI connection string
    const gridFS = new GridFSBucket(db);
    
    // --- 1. Migrate Companies ---
    console.log("\n🏢 Migrating Companies...");
    const companies = await db.collection("companies").find({}).toArray();
    console.log(`Found ${companies.length} companies in MongoDB.`);
    
    for (const comp of companies) {
      const companyId = comp._id.toString();
      const name = comp.name || null;
      const now = new Date().toISOString();
      
      const item = {
        PK: `COMPANY#${companyId}`,
        SK: "METADATA",
        companyId: companyId,
        name: name,
        setupComplete: !!comp.setupComplete,
        status: comp.status || "new",
        createdAt: comp.createdAt ? new Date(comp.createdAt).toISOString() : now,
        updatedAt: now
      };
      
      if (name) {
        item.GSI1_PK = `COMPANY_NAME#${name.toLowerCase()}`;
        item.GSI1_SK = "METADATA";
      }
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      console.log(`  ✅ Migrated company: ${name || 'Setup Pending'} (${companyId})`);
    }
    
    // --- 2. Migrate Users ---
    console.log("\n👥 Migrating Users...");
    const users = await db.collection("users").find({}).toArray();
    console.log(`Found ${users.length} users in MongoDB.`);
    
    for (const usr of users) {
      const userId = usr._id.toString();
      const companyId = usr.companyId ? usr.companyId.toString() : null;
      const email = usr.email ? usr.email.toLowerCase() : "";
      
      if (!companyId) {
        console.warn(`  ⚠️ Warning: User ${usr.email} has no companyId. Skipping.`);
        continue;
      }
      
      // Write user record
      const userItem = {
        PK: `COMPANY#${companyId}`,
        SK: `USER#${userId}`,
        GSI1_PK: `GOOGLE#${usr.googleId}`,
        GSI1_SK: "METADATA",
        userId: userId,
        companyId: companyId,
        googleId: usr.googleId,
        email: usr.email,
        name: usr.name,
        role: usr.role || "user",
        createdAt: usr.createdAt ? new Date(usr.createdAt).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: userItem }));
      
      // Write email-lookup index record
      if (email) {
        const emailItem = {
          PK: `COMPANY#${companyId}`,
          SK: `EMAIL#${email}`,
          GSI1_PK: `EMAIL#${email}`,
          GSI1_SK: "METADATA",
          userId: userId,
          companyId: companyId
        };
        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: emailItem }));
      }
      
      console.log(`  ✅ Migrated user: ${usr.email} (${userId})`);
    }
    
    // --- 3. Migrate Invites ---
    console.log("\n🔗 Migrating Invites...");
    const invites = await db.collection("invites").find({}).toArray();
    console.log(`Found ${invites.length} invites in MongoDB.`);
    
    for (const inv of invites) {
      const companyId = inv.companyId ? inv.companyId.toString() : null;
      const createdBy = inv.createdBy ? inv.createdBy.toString() : null;
      
      if (!companyId) {
        console.warn(`  ⚠️ Warning: Invite for token ${inv.token} has no companyId. Skipping.`);
        continue;
      }
      
      const inviteItem = {
        PK: `COMPANY#${companyId}`,
        SK: `INVITE#${inv.token}`,
        GSI1_PK: `INVITE#${inv.token}`,
        GSI1_SK: "METADATA",
        token: inv.token,
        companyId: companyId,
        createdBy: createdBy,
        expiresAt: inv.expiresAt ? new Date(inv.expiresAt).toISOString() : new Date().toISOString(),
        used: !!inv.used
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: inviteItem }));
      console.log(`  ✅ Migrated invite: ${inv.token}`);
    }
    
    // --- 4. Migrate Inventory Snapshots ---
    console.log("\n📦 Migrating Inventory Snapshots...");
    const snapshots = await db.collection("inventorysnapshots").find({}).toArray();
    console.log(`Found ${snapshots.length} inventory snapshots in MongoDB.`);
    
    for (const snap of snapshots) {
      const companyId = snap.companyId ? snap.companyId.toString() : null;
      if (!companyId) {
        console.warn(`  ⚠️ Warning: Snapshot has no companyId. Skipping.`);
        continue;
      }
      
      const snapItem = {
        PK: `COMPANY#${companyId}`,
        SK: "INVENTORY",
        companyId: companyId,
        items: snap.items || [],
        uploadedAt: snap.uploadedAt ? new Date(snap.uploadedAt).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: snapItem }));
      console.log(`  ✅ Migrated snapshot for company: ${companyId} (${snap.items?.length || 0} items)`);
    }
    
    // --- 5. Migrate ML Base Models ---
    console.log("\n🤖 Migrating ML Base Models...");
    const baseModels = await db.collection("models").find({}).toArray();
    console.log(`Found ${baseModels.length} base model records in MongoDB.`);
    
    for (const modelDoc of baseModels) {
      // Typically '_id': 'base_gat_lstm_model'
      const modelId = modelDoc._id.toString();
      console.log(`Processing base model: ${modelId}...`);
      
      let modelBytes = null;
      
      if (modelDoc.model_storage && modelDoc.model_storage.type === 'gridfs') {
        const fileId = modelDoc.model_storage.file_id;
        console.log(`  📥 Downloading model bytes from GridFS (FileID: ${fileId})...`);
        modelBytes = await downloadGridFSFile(gridFS, fileId);
      } else if (modelDoc.model_storage && modelDoc.model_storage.model_bytes) {
        modelBytes = modelDoc.model_storage.model_bytes.buffer;
      } else if (modelDoc.model_data) {
        modelBytes = modelDoc.model_data.buffer;
      }
      
      if (!modelBytes) {
        console.warn(`  ⚠️ Warning: No binary model weights found for ${modelId}. Metadata-only migration.`);
      } else {
        const s3Key = `models/base/${modelId}.pkl`;
        console.log(`  📤 Uploading binary to S3: s3://${BUCKET_NAME}/${s3Key} (${modelBytes.length} bytes)`);
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: modelBytes
        }));
      }
      
      const s3Uri = `s3://${BUCKET_NAME}/models/base/${modelId}.pkl`;
      const baseModelItem = {
        PK: "COMPANY#base",
        SK: "MODEL",
        s3Uri: s3Uri,
        architecture: modelDoc.architecture || {},
        node_list: modelDoc.node_list || [],
        scalers: modelDoc.scalers || {},
        feature_columns: modelDoc.feature_columns || [],
        created_at: modelDoc.created_at ? new Date(modelDoc.created_at).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: baseModelItem }));
      console.log(`  ✅ Migrated base model metadata: ${modelId}`);
    }
    
    // --- 6. Migrate ML Company Models (Fine-tuned models) ---
    console.log("\n🤖 Migrating Fine-tuned Company Models...");
    const companyModels = await db.collection("company_models").find({}).toArray();
    console.log(`Found ${companyModels.length} fine-tuned models in MongoDB.`);
    
    for (const modelDoc of companyModels) {
      const companyId = modelDoc.company_id ? modelDoc.company_id.toString() : null;
      if (!companyId) {
        console.warn(`  ⚠️ Warning: Company model has no company_id. Skipping.`);
        continue;
      }
      
      let modelBytes = null;
      
      if (modelDoc.model_storage && modelDoc.model_storage.type === 'gridfs') {
        const fileId = modelDoc.model_storage.file_id;
        console.log(`  📥 Downloading model bytes from GridFS (FileID: ${fileId}) for company ${companyId}...`);
        modelBytes = await downloadGridFSFile(gridFS, fileId);
      } else if (modelDoc.model_storage && modelDoc.model_storage.model_bytes) {
        modelBytes = modelDoc.model_storage.model_bytes.buffer;
      } else if (modelDoc.model_bytes) {
        modelBytes = modelDoc.model_bytes.buffer;
      }
      
      if (!modelBytes) {
        console.warn(`  ⚠️ Warning: No binary model weights found for company ${companyId}. Metadata-only migration.`);
      } else {
        const s3Key = `models/${companyId}/model_weights.pkl`;
        console.log(`  📤 Uploading binary to S3: s3://${BUCKET_NAME}/${s3Key} (${modelBytes.length} bytes)`);
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: modelBytes
        }));
      }
      
      const s3Uri = `s3://${BUCKET_NAME}/models/${companyId}/model_weights.pkl`;
      const modelItem = {
        PK: `COMPANY#${companyId}`,
        SK: "MODEL",
        s3Uri: s3Uri,
        architecture: modelDoc.architecture || {},
        node_list: modelDoc.node_list || [],
        scalers: modelDoc.scalers || {},
        feature_columns: modelDoc.feature_columns || [],
        node_to_idx: modelDoc.node_to_idx || {},
        metrics: modelDoc.metrics || {},
        last_x: modelDoc.last_x || null,
        created_at: modelDoc.created_at ? new Date(modelDoc.created_at).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: modelItem }));
      console.log(`  ✅ Migrated fine-tuned model metadata for company: ${companyId}`);
    }
    
    // --- 7. Migrate Training Statuses ---
    console.log("\n📊 Migrating Training Statuses...");
    const statuses = await db.collection("training_status").find({}).toArray();
    console.log(`Found ${statuses.length} training status records in MongoDB.`);
    
    for (const statusDoc of statuses) {
      const companyId = statusDoc.company_id ? statusDoc.company_id.toString() : null;
      if (!companyId) {
        console.warn(`  ⚠️ Warning: Training status record has no company_id. Skipping.`);
        continue;
      }
      
      const statusItem = {
        PK: `COMPANY#${companyId}`,
        SK: "TRAINING_STATUS",
        companyId: companyId,
        status: statusDoc.status,
        progress: statusDoc.progress || 0,
        message: statusDoc.message || "",
        error: statusDoc.error || null,
        timestamp: statusDoc.timestamp ? new Date(statusDoc.timestamp).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: statusItem }));
      console.log(`  ✅ Migrated training status for company: ${companyId} (Status: ${statusDoc.status})`);
    }
    
    // --- 8. Migrate Prediction Caches ---
    console.log("\n📈 Migrating Prediction Caches...");
    const predictionCaches = await db.collection("prediction_caches").find({}).toArray();
    console.log(`Found ${predictionCaches.length} prediction caches in MongoDB.`);
    
    for (const cache of predictionCaches) {
      const companyId = cache.company_id ? cache.company_id.toString() : null;
      if (!companyId) {
        console.warn(`  ⚠️ Warning: Prediction cache has no company_id. Skipping.`);
        continue;
      }
      
      const cacheItem = {
        PK: `COMPANY#${companyId}`,
        SK: "PREDICTION_CACHE",
        companyId: companyId,
        predictions: cache.predictions || {},
        updatedAt: cache.updated_at ? new Date(cache.updated_at).toISOString() : new Date().toISOString()
      };
      
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: cacheItem }));
      console.log(`  ✅ Migrated prediction cache for company: ${companyId}`);
    }
    
    console.log("\n🎉 DATA MIGRATION COMPLETED SUCCESSFULLY!");
    
  } catch (err) {
    console.error("❌ ERROR during migration execution:", err);
  } finally {
    await mongoClient.close();
    console.log("🔌 MongoDB connection closed.");
  }
}

// Helper to download files from MongoDB GridFS
function downloadGridFSFile(gridFS, fileId) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const downloadStream = gridFS.openDownloadStream(new ObjectId(fileId));
    
    downloadStream.on("data", (chunk) => chunks.push(chunk));
    downloadStream.on("error", (err) => reject(err));
    downloadStream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

runMigration();
