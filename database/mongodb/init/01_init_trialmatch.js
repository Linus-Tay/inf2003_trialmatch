// ============================================================
// TrialMatch MongoDB initialization
// Purpose: document database for raw trial preservation, nested
// parsed criteria, flexible reviewer annotations, and detailed
// match explanations that do not fit cleanly into relational rows.
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

// Flexible explanation documents for patient-trial matches.
db.createCollection("patient_match_explanations");

// Flexible reviewer annotations/tags for eligibility criteria.
db.createCollection("criteria_annotations");

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

db.patient_match_explanations.createIndex({ match_id: 1 }, { unique: true });
db.patient_match_explanations.createIndex({ patient_profile_id: 1, trial_id: 1 });

db.criteria_annotations.createIndex({ criteria_id: 1, trial_id: 1 }, { unique: true });
db.criteria_annotations.createIndex({ trial_id: 1 });
db.criteria_annotations.createIndex({ "annotations.tags": 1 });

// ------------------------------------------------------------

// No trial, criteria, annotation, match, or sample documents are inserted here.
// Dataset-backed documents are loaded only by etl/scripts/import_mongodb.py.
