// ============================================================
// TrialMatch MongoDB initialization
// Purpose: document database for raw trial preservation and
// nested parsed eligibility criteria documents.
//
// MariaDB stores the normalized operational schema. MongoDB
// stores the document-shaped source and parsed criteria layer,
// which is useful for traceability, document preview, parser
// review, and flexible criteria-item editing.
// ============================================================

db = db.getSiblingDB("trialmatch_nosql");

db.createUser({
  user: "trialmatch_mongo_user",
  pwd: "trialmatch_mongo_password",
  roles: [
    { role: "readWrite", db: "trialmatch_nosql" }
  ]
});

// Raw cleaned trial records from the source dataset.
db.createCollection("raw_trial_documents");

// One document per trial containing nested criteria_items.
db.createCollection("parsed_criteria_documents");

// ------------------------------------------------------------
// MongoDB indexes
// These support document lookup and nested-array access patterns.
// ------------------------------------------------------------
db.raw_trial_documents.createIndex({ trial_id: 1 }, { unique: true });
db.raw_trial_documents.createIndex({ nct_id: 1 });
db.raw_trial_documents.createIndex({ "raw.source_condition_query": 1 });
db.raw_trial_documents.createIndex({ "raw.healthy_volunteers": 1 });

db.parsed_criteria_documents.createIndex({ trial_id: 1 }, { unique: true });
db.parsed_criteria_documents.createIndex({ nct_id: 1 });
db.parsed_criteria_documents.createIndex({ "criteria_items.criteria_external_id": 1 });
db.parsed_criteria_documents.createIndex({ "criteria_items.keywords": 1 });
db.parsed_criteria_documents.createIndex({ "criteria_items.complexity.score": 1 });
db.parsed_criteria_documents.createIndex({ "document_review.status": 1 });

// ------------------------------------------------------------
// No sample documents are inserted here. Dataset-backed documents
// are loaded by etl/scripts/import_mongodb.py.
// ------------------------------------------------------------
