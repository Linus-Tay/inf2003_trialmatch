db = db.getSiblingDB("trialmatch_nosql");

db.createUser({
  user: "trialmatch_mongo_user",
  pwd: "trialmatch_mongo_password",
  roles: [
    { role: "readWrite", db: "trialmatch_nosql" }
  ]
});

db.createCollection("raw_trial_documents");
db.createCollection("parsed_criteria_documents");
db.createCollection("patient_match_explanations");
db.createCollection("criteria_annotations");

db.raw_trial_documents.createIndex({ trial_id: 1 }, { unique: true });
db.raw_trial_documents.createIndex({ nct_id: 1 });

db.parsed_criteria_documents.createIndex({ trial_id: 1 }, { unique: true });
db.parsed_criteria_documents.createIndex({ nct_id: 1 });
db.parsed_criteria_documents.createIndex({ "criteria_items.criteria_id": 1 });
db.parsed_criteria_documents.createIndex({ "criteria_items.keywords": 1 });

db.patient_match_explanations.createIndex({ match_id: 1 }, { unique: true });
db.patient_match_explanations.createIndex({ patient_profile_id: 1, trial_id: 1 });

db.criteria_annotations.createIndex({ criteria_id: 1 });
db.criteria_annotations.createIndex({ trial_id: 1 });
db.criteria_annotations.createIndex({ "annotations.tags": 1 });

db.raw_trial_documents.insertOne({
  trial_id: 1,
  nct_id: "NCT00000001",
  dataset_name: "trialmatch_demo_seed",
  dataset_version: "v1",
  imported_at: new Date(),
  raw: {
    brief_title: "Lifestyle Study for Type 2 Diabetes",
    conditions: ["Diabetes Mellitus Type 2"],
    interventions: ["Lifestyle Intervention", "Metformin"],
    eligibility: "Participants must be aged 18 to 65 years. Participants with severe kidney disease are excluded."
  }
});

db.parsed_criteria_documents.insertOne({
  trial_id: 1,
  nct_id: "NCT00000001",
  parsed_at: new Date(),
  criteria_items: [
    {
      criteria_id: 1,
      criteria_type: "Inclusion",
      original_text: "Participants must be aged 18 to 65 years and diagnosed with type 2 diabetes.",
      keywords: ["aged", "18", "65", "type 2 diabetes"],
      rules: {
        min_age: 18,
        max_age: 65,
        sex: "All",
        required_conditions: ["Diabetes Mellitus Type 2"],
        excluded_conditions: [],
        requires_manual_review: false
      }
    },
    {
      criteria_id: 2,
      criteria_type: "Exclusion",
      original_text: "Participants with severe kidney disease are excluded.",
      keywords: ["severe", "kidney disease", "excluded"],
      rules: {
        excluded_conditions: ["kidney disease"],
        requires_manual_review: true
      }
    }
  ]
});

db.patient_match_explanations.insertOne({
  match_id: 1,
  patient_profile_id: 1,
  trial_id: 1,
  nct_id: "NCT00000001",
  overall_summary: "The patient passed structured checks but requires manual review for one exclusion criterion.",
  structured_checks: {
    age_check: {
      patient_age: 45,
      trial_min_age: 18,
      trial_max_age: 65,
      passed: true
    },
    sex_check: {
      patient_sex: "Male",
      trial_sex: "All",
      passed: true
    },
    condition_check: {
      matched_conditions: ["Diabetes Mellitus Type 2"],
      passed: true
    }
  },
  criteria_reasons: [
    {
      criteria_id: 1,
      result: "Passed",
      reason: "Patient age and condition match the inclusion requirement."
    },
    {
      criteria_id: 2,
      result: "Needs Review",
      reason: "Exclusion criterion mentions kidney disease and requires manual confirmation."
    }
  ],
  created_at: new Date()
});