import api from "./client";

/* =========================
   Dashboard / lookups
========================= */

export async function fetchDashboardOverview() {
  const response = await api.get("/dashboard/overview");
  return response.data;
}

export async function fetchLookups() {
  const response = await api.get("/lookups");
  return response.data;
}

export async function searchConditions(query = "") {
  const response = await api.get("/lookups/conditions", {
    params: { q: query || undefined, limit: 25 },
  });
  return response.data.conditions;
}

/* =========================
   Trials
========================= */

export async function searchTrials(params = {}) {
  const response = await api.get("/trials", { params });
  return response.data;
}

export async function getTrialDetail(trialId) {
  const response = await api.get(`/trials/${trialId}`);
  return response.data;
}

export async function saveTrial(trialId) {
  const response = await api.post(`/trials/${trialId}/save`);
  return response.data;
}

export async function unsaveTrial(trialId) {
  const response = await api.delete(`/trials/${trialId}/save`);
  return response.data;
}

export async function getSavedTrials() {
  const response = await api.get("/trials/saved");
  return response.data.saved_trials;
}

export async function updateSavedTrial(savedTrialId, payload) {
  const response = await api.patch(`/saved-trials/${savedTrialId}`, payload);
  return response.data;
}

export async function deleteSavedTrial(savedTrialId) {
  const response = await api.delete(`/saved-trials/${savedTrialId}`);
  return response.data;
}

/* =========================
   Patients / matching
========================= */

export async function listPatientProfiles() {
  const response = await api.get("/patients");
  return response.data.profiles;
}

export async function createPatientProfile(payload) {
  const response = await api.post("/patients", payload);
  return response.data;
}

export async function generateMatches(profileId) {
  const response = await api.post(`/patients/${profileId}/match`);
  return response.data;
}

/* =========================
   Trial management
========================= */

export async function listManagedTrials(params = {}) {
  const response = await api.get("/management/trials", { params });
  return response.data.trials;
}

export async function createManagedTrial(payload) {
  const response = await api.post("/management/trials", payload);
  return response.data;
}

export async function updateManagedTrial(trialId, payload) {
  const response = await api.patch(`/management/trials/${trialId}`, payload);
  return response.data;
}

export async function archiveManagedTrial(trialId) {
  const response = await api.delete(`/management/trials/${trialId}/archive`);
  return response.data;
}

export async function addTrialCondition(trialId, payload) {
  const response = await api.post(`/trials/${trialId}/conditions`, payload);
  return response.data;
}

export async function addTrialIntervention(trialId, payload) {
  const response = await api.post(`/trials/${trialId}/interventions`, payload);
  return response.data;
}

export async function addTrialCriteria(trialId, payload) {
  const response = await api.post(`/trials/${trialId}/criteria`, payload);
  return response.data;
}

export async function updateTrialCriteria(criteriaId, payload) {
  const response = await api.patch(`/criteria/${criteriaId}`, payload);
  return response.data;
}

export async function deleteTrialCriteria(criteriaId) {
  const response = await api.delete(`/criteria/${criteriaId}`);
  return response.data;
}

/* =========================
   Analytics / quality
========================= */

export async function fetchClinicalAnalytics() {
  const response = await api.get("/analytics/clinical");
  return response.data;
}

export async function fetchCriteriaAnalytics() {
  const response = await api.get("/analytics/criteria");
  return response.data;
}

export async function fetchQualityOverview() {
  const response = await api.get("/quality/overview");
  return response.data;
}

export async function fetchQualityFlags() {
  const response = await api.get("/quality/flags");
  return response.data.flags;
}

export async function resolveQualityFlag(flagId, isResolved = true) {
  const response = await api.patch(`/quality/flags/${flagId}/resolve`, {
    is_resolved: isResolved,
  });
  return response.data;
}

export async function fetchQualityOptionalViews() {
  const response = await api.get("/quality/optional-views");
  return response.data;
}

/*
  Used by DatabaseDemoPage.
  This avoids needing a new backend route.
  It reuses your existing /quality/overview and /quality/flags endpoints.
*/
export async function fetchCriteriaQualityReport() {
  const [overviewResponse, flagsResponse] = await Promise.all([
    api.get("/quality/overview"),
    api.get("/quality/flags"),
  ]);

  const overview = overviewResponse.data || {};
  const flags = flagsResponse.data?.flags || [];

  const headingRows = flags.filter((flag) => {
    const text = String(
      flag.criteria_text || flag.text || flag.description || ""
    ).toLowerCase();

    return (
      text.trim() === "inclusion criteria:" ||
      text.trim() === "inclusion criteria" ||
      text.trim() === "exclusion criteria:" ||
      text.trim() === "exclusion criteria" ||
      text.trim() === "eligibility criteria:" ||
      text.trim() === "eligibility criteria"
    );
  });

  const shortFragments = flags.filter((flag) => {
    const text = String(
      flag.criteria_text || flag.text || flag.description || ""
    ).trim();

    return text.length > 0 && text.length < 20;
  });

  const typeMismatches = flags.filter((flag) => {
    const type = String(flag.criteria_type || flag.type || "").toLowerCase();
    const text = String(
      flag.criteria_text || flag.text || flag.description || ""
    ).toLowerCase();

    return (
      (type.includes("exclusion") && text.includes("inclusion criteria")) ||
      (type.includes("inclusion") && text.includes("exclusion criteria"))
    );
  });

  return {
    ...overview,
    checked_trials: overview.checked_trials ?? overview.total_trials ?? "—",
    heading_rows_count:
      overview.heading_rows_count ?? overview.heading_rows ?? headingRows.length,
    short_fragment_count:
      overview.short_fragment_count ??
      overview.short_fragments ??
      shortFragments.length,
    type_mismatch_count:
      overview.type_mismatch_count ??
      overview.type_mismatches ??
      typeMismatches.length,
    heading_rows: headingRows,
    short_fragments: shortFragments,
    type_mismatches: typeMismatches,
  };
}

/* =========================
   MongoDB annotations
========================= */

export async function createCriteriaAnnotation(payload) {
  const response = await api.post("/mongo/criteria-annotations", payload);
  return response.data;
}

export async function getCriteriaAnnotations(criteriaId) {
  const response = await api.get(`/mongo/criteria-annotations/${criteriaId}`);
  return response.data.annotation_document;
}

/* =========================
   Database demo
========================= */

export async function fetchDatabaseDemoOverview() {
  const response = await api.get("/database-demo/overview");
  return response.data;
}

/*
  Used by DatabaseDemoPage.
  This is frontend-safe static relationship evidence.
  It prevents an import error and avoids needing a backend route.
*/
export async function fetchDatabaseRelationships() {
  return {
    core_relationships: [
      {
        parent_table: "trials",
        child_table: "eligibility_criteria",
        relationship: "One trial has many eligibility criteria rows",
        join_key: "trials.trial_id = eligibility_criteria.trial_id",
      },
      {
        parent_table: "trials",
        child_table: "trial_conditions",
        relationship: "One trial can have many linked conditions",
        join_key: "trials.trial_id = trial_conditions.trial_id",
      },
      {
        parent_table: "trials",
        child_table: "trial_interventions",
        relationship: "One trial can have many linked interventions",
        join_key: "trials.trial_id = trial_interventions.trial_id",
      },
      {
        parent_table: "app_users",
        child_table: "saved_trials",
        relationship: "One user can save many trials",
        join_key: "app_users.user_id = saved_trials.user_id",
      },
      {
        parent_table: "patient_profiles",
        child_table: "patient_trial_matches",
        relationship: "One patient profile can have many trial match results",
        join_key:
          "patient_profiles.profile_id = patient_trial_matches.profile_id",
      },
    ],
    join_samples: [
      {
        demonstration: "Trial detail page",
        tables_used:
          "trials, trial_conditions, trial_interventions, eligibility_criteria",
      },
      {
        demonstration: "Saved trials workflow",
        tables_used: "app_users, saved_trials, trials",
      },
      {
        demonstration: "Patient matching workflow",
        tables_used: "patient_profiles, patient_trial_matches, trials",
      },
    ],
  };
}

export async function fetchDatabaseViews() {
  const response = await api.get("/database-demo/views");
  return response.data;
}

export async function fetchNestedQueries() {
  const response = await api.get("/database-demo/nested-queries");
  return response.data;
}

export async function runPatientAgeTriggerTest() {
  const response = await api.post("/database-demo/trigger-test/patient-age");
  return response.data;
}

export async function runMatchStatusTriggerTest() {
  const response = await api.post("/database-demo/trigger-test/match-status");
  return response.data;
}

export async function runTransactionDemo() {
  const response = await api.post("/database-demo/transaction-demo/create-trial");
  return response.data;
}

export async function fetchIndexPerformance() {
  const response = await api.get("/database-demo/index-performance");
  return response.data;
}

export async function fetchMongoSamples() {
  const response = await api.get("/database-demo/mongo-samples");
  return response.data;
}

export async function refreshPerformanceCache() {
  const response = await api.post("/database-demo/refresh-cache");
  return response.data;
}