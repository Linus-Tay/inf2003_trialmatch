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
   Analytics
========================= */

export async function fetchClinicalAnalytics() {
  const response = await api.get("/analytics/clinical");
  return response.data;
}

export async function fetchCriteriaAnalytics() {
  const response = await api.get("/analytics/criteria");
  return response.data;
}

/* =========================
   MongoDB source document review
========================= */

export async function getMongoTrialDocumentReview(trialId) {
  const response = await api.get(`/mongo/trials/${trialId}/document-review`);
  return response.data;
}

export async function updateParsedCriteriaDocumentReview(trialId, payload) {
  const response = await api.patch(
    `/mongo/trials/${trialId}/parsed-document-review`,
    payload
  );
  return response.data;
}

export async function createParsedCriteriaItem(trialId, payload) {
  const response = await api.post(
    `/mongo/trials/${trialId}/parsed-criteria-items`,
    payload
  );
  return response.data;
}

export async function updateParsedCriteriaItem(trialId, criteriaExternalId, payload) {
  const response = await api.patch(
    `/mongo/trials/${trialId}/parsed-criteria-items/${encodeURIComponent(criteriaExternalId)}`,
    payload
  );
  return response.data;
}

export async function deleteParsedCriteriaItem(trialId, criteriaExternalId) {
  const response = await api.delete(
    `/mongo/trials/${trialId}/parsed-criteria-items/${encodeURIComponent(criteriaExternalId)}`
  );
  return response.data;
}

/* =========================
   Database demo
========================= */

export async function fetchDatabaseDemoOverview() {
  const response = await api.get("/database-demo/overview");
  return response.data;
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

export async function updateTrialCondition(trialId, conditionId, payload) {
  const response = await api.patch(
    `/trials/${trialId}/conditions/${conditionId}`,
    payload
  );
  return response.data;
}

export async function deleteTrialCondition(trialId, conditionId) {
  const response = await api.delete(
    `/trials/${trialId}/conditions/${conditionId}`
  );
  return response.data;
}

export async function updateTrialIntervention(trialId, interventionId, payload) {
  const response = await api.patch(
    `/trials/${trialId}/interventions/${interventionId}`,
    payload
  );
  return response.data;
}

export async function deleteTrialIntervention(trialId, interventionId) {
  const response = await api.delete(
    `/trials/${trialId}/interventions/${interventionId}`
  );
  return response.data;
}
