import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Database,
  MinusCircle,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  addTrialCondition,
  addTrialCriteria,
  addTrialIntervention,
  archiveManagedTrial,
  createManagedTrial,
  deleteTrialCondition,
  deleteTrialCriteria,
  deleteTrialIntervention,
  fetchLookups,
  getTrialDetail,
  listManagedTrials,
  updateManagedTrial,
  updateTrialCondition,
  updateTrialCriteria,
  updateTrialIntervention,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

const tabs = ["Create Trial", "Manage Trial"];

const emptyCreateForm = {
  nct_id: "",
  brief_title: "",
  phase_id: "",
  status_id: "",
  study_type_id: "",
  sex_id: "",
  minimum_age: "",
  maximum_age: "",
  healthy_volunteers: "",
};

const emptyNewCondition = {
  condition_name: "",
  condition_role: "Primary",
};

const emptyNewIntervention = {
  intervention_name: "",
};

const emptyNewCriteria = {
  criteria_type: "Inclusion",
  criteria_text: "",
  criteria_order: 1,
  requires_manual_review: false,
};

export default function TrialManagementPage() {
  const [activeTab, setActiveTab] = useState("Create Trial");

  const [trials, setTrials] = useState([]);
  const [trialSearch, setTrialSearch] = useState("");
  const [selectedTrialId, setSelectedTrialId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);

  const [lookups, setLookups] = useState({
    phases: [],
    statuses: [],
    study_types: [],
    sexes: [],
  });

  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({});

  const [conditionDrafts, setConditionDrafts] = useState([]);
  const [interventionDrafts, setInterventionDrafts] = useState([]);
  const [criteriaDrafts, setCriteriaDrafts] = useState([]);

  const [newCondition, setNewCondition] = useState(emptyNewCondition);
  const [newIntervention, setNewIntervention] = useState(emptyNewIntervention);
  const [newCriteria, setNewCriteria] = useState(emptyNewCriteria);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkedBusy, setIsLinkedBusy] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab !== "Manage Trial") return;

    const timer = setTimeout(() => {
      searchManagedTrials();
    }, 300);

    return () => clearTimeout(timer);
  }, [trialSearch, activeTab]);

  async function loadInitialData() {
    setIsLoading(true);
    setError("");

    try {
      const [trialRows, lookupRows] = await Promise.all([
        listManagedTrials({ limit: 30 }),
        fetchLookups(),
      ]);

      setTrials(trialRows || []);
      setLookups({
        phases: lookupRows?.phases || [],
        statuses: lookupRows?.statuses || [],
        study_types: lookupRows?.study_types || [],
        sexes: lookupRows?.sexes || [],
      });
    } catch (err) {
      setError(getApiError(err, "Unable to load trial management data."));
    } finally {
      setIsLoading(false);
    }
  }

  async function searchManagedTrials() {
    setIsSearching(true);

    try {
      const rows = await listManagedTrials({
        q: trialSearch || undefined,
        search: trialSearch || undefined,
        limit: 30,
      });

      setTrials(rows || []);
    } catch (err) {
      setError(getApiError(err, "Unable to search trials."));
    } finally {
      setIsSearching(false);
    }
  }

  async function refreshTrials() {
    const rows = await listManagedTrials({
      q: trialSearch || undefined,
      search: trialSearch || undefined,
      limit: 30,
    });

    setTrials(rows || []);
    return rows || [];
  }

  async function openTrialById(trialId) {
    if (!trialId) {
      setSelectedTrialId("");
      setSelectedDetail(null);
      setEditForm({});
      setConditionDrafts([]);
      setInterventionDrafts([]);
      setCriteriaDrafts([]);
      return;
    }

    setIsOpening(true);
    setError("");
    setMessage("");
    setSelectedTrialId(String(trialId));

    try {
      const detail = await getTrialDetail(trialId);
      hydrateSelectedTrial(detail);
    } catch (err) {
      setError(getApiError(err, "Unable to open selected trial."));
    } finally {
      setIsOpening(false);
    }
  }

  function hydrateSelectedTrial(detail) {
    setSelectedDetail(detail);

    setEditForm({
      brief_title: detail.trial?.brief_title || "",
      official_title: detail.trial?.official_title || "",
      brief_summary: detail.trial?.brief_summary || "",
      minimum_age: detail.trial?.minimum_age ?? "",
      maximum_age: detail.trial?.maximum_age ?? "",
      healthy_volunteers:
        detail.trial?.healthy_volunteers === null ||
        detail.trial?.healthy_volunteers === undefined
          ? ""
          : String(Boolean(detail.trial.healthy_volunteers)),
      source_url: detail.trial?.source_url || "",
    });

    setConditionDrafts(getConditions(detail).map(normaliseCondition));
    setInterventionDrafts(getInterventions(detail).map(normaliseIntervention));
    setCriteriaDrafts(getCriteria(detail).map(normaliseCriteria));
  }

  function validateCreateForm() {
    const issues = [];

    if (!createForm.nct_id.trim()) issues.push("NCT ID is required.");
    if (!createForm.brief_title.trim()) issues.push("Brief title is required.");
    if (!createForm.status_id) issues.push("Recruitment status is required.");
    if (!createForm.study_type_id) issues.push("Study type is required.");
    if (!createForm.sex_id) issues.push("Sex eligibility is required.");

    if (
      createForm.nct_id.trim() &&
      !/^NCT\d{8}$/i.test(createForm.nct_id.trim())
    ) {
      issues.push("NCT ID must follow the format NCT12345678.");
    }

    const minAge =
      createForm.minimum_age === "" ? null : Number(createForm.minimum_age);
    const maxAge =
      createForm.maximum_age === "" ? null : Number(createForm.maximum_age);

    if (minAge !== null && (Number.isNaN(minAge) || minAge < 0)) {
      issues.push("Minimum age must be 0 or higher.");
    }

    if (maxAge !== null && (Number.isNaN(maxAge) || maxAge < 0)) {
      issues.push("Maximum age must be 0 or higher.");
    }

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      issues.push("Minimum age cannot be greater than maximum age.");
    }

    return issues;
  }

  function updateCreate(event) {
    setCreateForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateEdit(event) {
    setEditForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const createIssues = validateCreateForm();

    if (createIssues.length > 0) {
      setError(createIssues[0]);
      return;
    }

    setIsCreating(true);

    try {
      const payload = {
        nct_id: createForm.nct_id.trim().toUpperCase(),
        brief_title: createForm.brief_title.trim(),
        phase_id: createForm.phase_id ? Number(createForm.phase_id) : null,
        status_id: createForm.status_id ? Number(createForm.status_id) : null,
        study_type_id: createForm.study_type_id
          ? Number(createForm.study_type_id)
          : null,
        sex_id: createForm.sex_id ? Number(createForm.sex_id) : null,
        minimum_age:
          createForm.minimum_age === "" ? null : Number(createForm.minimum_age),
        maximum_age:
          createForm.maximum_age === "" ? null : Number(createForm.maximum_age),
        healthy_volunteers:
          createForm.healthy_volunteers === ""
            ? null
            : createForm.healthy_volunteers === "true",
      };

      const created = await createManagedTrial(payload);
      const updatedTrials = await refreshTrials();

      setCreateForm(emptyCreateForm);
      setMessage("Trial created successfully.");

      const createdTrialId =
        created?.trial_id ||
        created?.trial?.trial_id ||
        created?.created_trial?.trial_id;

      const createdRow = updatedTrials.find((trial) => {
        return (
          String(trial.trial_id) === String(createdTrialId) ||
          String(trial.nct_id).toUpperCase() === payload.nct_id
        );
      });

      if (createdTrialId || createdRow?.trial_id) {
        setActiveTab("Manage Trial");
        await openTrialById(createdTrialId || createdRow.trial_id);
      }
    } catch (err) {
      setError(getApiError(err, "Unable to create trial."));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedTrialId) return;

    setIsSaving(true);
    setMessage("");
    setError("");

    const minAge =
      editForm.minimum_age === "" ? null : Number(editForm.minimum_age);
    const maxAge =
      editForm.maximum_age === "" ? null : Number(editForm.maximum_age);

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      setError("Minimum age cannot be greater than maximum age.");
      setIsSaving(false);
      return;
    }

    try {
      await updateManagedTrial(selectedTrialId, {
        brief_title: String(editForm.brief_title || "").trim(),
        official_title: String(editForm.official_title || "").trim() || null,
        brief_summary: String(editForm.brief_summary || "").trim() || null,
        source_url: String(editForm.source_url || "").trim() || null,
        minimum_age: minAge,
        maximum_age: maxAge,
        healthy_volunteers:
          editForm.healthy_volunteers === ""
            ? null
            : editForm.healthy_volunteers === "true",
      });

      setMessage("Trial updated successfully.");
      await openTrialById(selectedTrialId);
      await refreshTrials();
    } catch (err) {
      setError(getApiError(err, "Unable to update trial."));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive() {
    if (!selectedTrialId) return;
    if (!window.confirm("Archive this trial?")) return;

    setIsArchiving(true);
    setMessage("");
    setError("");

    try {
      await archiveManagedTrial(selectedTrialId);
      setMessage("Trial archived.");
      setSelectedTrialId("");
      setSelectedDetail(null);
      setEditForm({});
      setConditionDrafts([]);
      setInterventionDrafts([]);
      setCriteriaDrafts([]);
      await refreshTrials();
    } catch (err) {
      setError(getApiError(err, "Unable to archive trial."));
    } finally {
      setIsArchiving(false);
    }
  }

  async function addCondition() {
    if (!selectedTrialId || !newCondition.condition_name.trim()) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await addTrialCondition(selectedTrialId, {
        condition_name: newCondition.condition_name.trim(),
        condition_role: newCondition.condition_role || "Primary",
      });

      setNewCondition(emptyNewCondition);
      setMessage("Condition added.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to add condition."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function saveCondition(index) {
    const item = conditionDrafts[index];
    const id = item.condition_id;
    if (!id) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await updateTrialCondition(selectedTrialId, id, {
        condition_name: item.condition_name.trim(),
        condition_role: item.condition_role || "Primary",
      });

      setMessage("Condition updated.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to update condition."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function removeCondition(index) {
    const item = conditionDrafts[index];
    const id = item.condition_id;
    if (!id || !window.confirm("Remove this condition?")) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteTrialCondition(selectedTrialId, id);
      setMessage("Condition removed.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to remove condition."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function addIntervention() {
    if (!selectedTrialId || !newIntervention.intervention_name.trim()) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await addTrialIntervention(selectedTrialId, {
        intervention_name: newIntervention.intervention_name.trim(),
      });

      setNewIntervention(emptyNewIntervention);
      setMessage("Intervention added.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to add intervention."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function saveIntervention(index) {
    const item = interventionDrafts[index];
    const id = item.intervention_id;
    if (!id) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await updateTrialIntervention(selectedTrialId, id, {
        intervention_name: item.intervention_name.trim(),
      });

      setMessage("Intervention updated.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to update intervention."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function removeIntervention(index) {
    const item = interventionDrafts[index];
    const id = item.intervention_id;
    if (!id || !window.confirm("Remove this intervention?")) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteTrialIntervention(selectedTrialId, id);
      setMessage("Intervention removed.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to remove intervention."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function addCriteria() {
    if (!selectedTrialId || !newCriteria.criteria_text.trim()) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await addTrialCriteria(selectedTrialId, {
        criteria_type: newCriteria.criteria_type,
        criteria_text: newCriteria.criteria_text.trim(),
        criteria_order: Number(newCriteria.criteria_order || 1),
        requires_manual_review: Boolean(newCriteria.requires_manual_review),
      });

      setNewCriteria(emptyNewCriteria);
      setMessage("Criteria added.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to add criteria."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function saveCriteria(index) {
    const item = criteriaDrafts[index];
    const id = item.criteria_id || item.criterion_id;
    if (!id) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await updateTrialCriteria(id, {
        criteria_type: item.criteria_type,
        criteria_text: item.criteria_text.trim(),
        criteria_order: Number(item.criteria_order || 1),
        requires_manual_review: Boolean(item.requires_manual_review),
      });

      setMessage("Criteria updated.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to update criteria."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  async function removeCriteria(index) {
    const item = criteriaDrafts[index];
    const id = item.criteria_id || item.criterion_id;
    if (!id || !window.confirm("Remove this criteria row?")) return;

    setIsLinkedBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteTrialCriteria(id);
      setMessage("Criteria removed.");
      await openTrialById(selectedTrialId);
    } catch (err) {
      setError(getApiError(err, "Unable to remove criteria."));
    } finally {
      setIsLinkedBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        eyebrow="Trial Management"
        title="Manage trial records"
        description="Create, update, archive and maintain trial details with relational linked records."
      />

      {message && <Alert type="success" message={message} />}
      {error && <Alert type="error" message={error} />}

      <section className="glass-card rounded-[2rem] p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab
                  ? "bg-slate-950 text-white"
                  : "bg-white/70 text-slate-600 hover:bg-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "Create Trial" && (
        <section className="glass-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Create trial</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fill in the required fields, then create a new trial.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="NCT ID" required helper="Format: NCT12345678">
                <input
                  className="form-input"
                  name="nct_id"
                  placeholder="NCT12345678"
                  value={createForm.nct_id}
                  onChange={updateCreate}
                />
              </Field>

              <Field label="Brief title" required className="md:col-span-2">
                <input
                  className="form-input"
                  name="brief_title"
                  placeholder="Short public title"
                  value={createForm.brief_title}
                  onChange={updateCreate}
                />
              </Field>

              <Field label="Recruitment status" required>
                <select
                  className="form-input"
                  name="status_id"
                  value={createForm.status_id}
                  onChange={updateCreate}
                >
                  <option value="">Select status</option>
                  {lookups.statuses.map((item) => (
                    <option key={item.status_id} value={item.status_id}>
                      {item.status_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Study type" required>
                <select
                  className="form-input"
                  name="study_type_id"
                  value={createForm.study_type_id}
                  onChange={updateCreate}
                >
                  <option value="">Select study type</option>
                  {lookups.study_types.map((item) => (
                    <option key={item.study_type_id} value={item.study_type_id}>
                      {item.study_type_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sex eligibility" required>
                <select
                  className="form-input"
                  name="sex_id"
                  value={createForm.sex_id}
                  onChange={updateCreate}
                >
                  <option value="">Select sex</option>
                  {lookups.sexes.map((item) => (
                    <option key={item.sex_id} value={item.sex_id}>
                      {item.sex_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Phase">
                <select
                  className="form-input"
                  name="phase_id"
                  value={createForm.phase_id}
                  onChange={updateCreate}
                >
                  <option value="">Unknown / not applicable</option>
                  {lookups.phases.map((item) => (
                    <option key={item.phase_id} value={item.phase_id}>
                      {item.phase_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Minimum age">
                <input
                  className="form-input"
                  name="minimum_age"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="0"
                  value={createForm.minimum_age}
                  onChange={updateCreate}
                />
              </Field>

              <Field label="Maximum age">
                <input
                  className="form-input"
                  name="maximum_age"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="120"
                  value={createForm.maximum_age}
                  onChange={updateCreate}
                />
              </Field>

              <Field label="Healthy volunteers" className="md:col-span-3">
                <select
                  className="form-input"
                  name="healthy_volunteers"
                  value={createForm.healthy_volunteers}
                  onChange={updateCreate}
                >
                  <option value="">Unknown</option>
                  <option value="true">Accepts healthy volunteers</option>
                  <option value="false">Patients only / condition-specific</option>
                </select>
              </Field>
            </div>

            <button
              className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
            >
              <Plus size={18} />
              {isCreating ? "Creating..." : "Create trial"}
            </button>
          </form>
        </section>
      )}

      {activeTab === "Manage Trial" && (
        <section className="space-y-6">
          <section className="glass-card rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Search and select trial
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Search by NCT ID or title.
                </p>
              </div>

              <button
                type="button"
                onClick={loadInitialData}
                className="secondary-button w-fit"
                disabled={isLoading}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>

            <div className="relative mt-5">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Search NCT ID or trial title..."
                value={trialSearch}
                onChange={(event) => setTrialSearch(event.target.value)}
              />
            </div>

            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
              {isLoading || isSearching ? (
                <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-500">
                  Searching trials...
                </p>
              ) : trials.length === 0 ? (
                <p className="rounded-2xl bg-white/70 p-4 text-sm font-semibold text-slate-500">
                  No matching trials found.
                </p>
              ) : (
                trials.map((trial) => (
                  <button
                    key={trial.trial_id}
                    type="button"
                    onClick={() => openTrialById(trial.trial_id)}
                    disabled={isOpening}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      String(selectedTrialId) === String(trial.trial_id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white/80 hover:bg-white"
                    }`}
                  >
                    <p className="text-xs font-bold text-blue-700">
                      {trial.nct_id || "No NCT ID"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-950">
                      {trial.brief_title || "Untitled trial"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          {!selectedDetail && (
            <section className="glass-card rounded-[2rem] p-8 text-center">
              <Database className="mx-auto text-slate-400" size={28} />
              <p className="mt-3 font-bold text-slate-700">No trial selected</p>
              <p className="mt-1 text-sm text-slate-500">
                Search and select a trial above to manage it.
              </p>
            </section>
          )}

          {selectedDetail && (
            <section className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="glass-card rounded-[2rem] p-5 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">
                      {selectedDetail.trial?.nct_id}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">
                      Edit trial
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleArchive}
                    className="secondary-button w-fit text-red-700"
                    disabled={isArchiving}
                  >
                    <Trash2 size={16} />
                    {isArchiving ? "Archiving..." : "Archive"}
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-4">
                  <Field label="Brief title" required>
                    <input
                      className="form-input"
                      name="brief_title"
                      value={editForm.brief_title || ""}
                      onChange={updateEdit}
                      required
                    />
                  </Field>

                  <Field label="Official title">
                    <input
                      className="form-input"
                      name="official_title"
                      value={editForm.official_title || ""}
                      onChange={updateEdit}
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Minimum age">
                      <input
                        className="form-input"
                        name="minimum_age"
                        type="number"
                        min="0"
                        max="120"
                        value={editForm.minimum_age ?? ""}
                        onChange={updateEdit}
                      />
                    </Field>

                    <Field label="Maximum age">
                      <input
                        className="form-input"
                        name="maximum_age"
                        type="number"
                        min="0"
                        max="120"
                        value={editForm.maximum_age ?? ""}
                        onChange={updateEdit}
                      />
                    </Field>
                  </div>

                  <Field label="Healthy volunteer eligibility">
                    <select
                      className="form-input"
                      name="healthy_volunteers"
                      value={editForm.healthy_volunteers ?? ""}
                      onChange={updateEdit}
                    >
                      <option value="">Unknown</option>
                      <option value="true">Accepts healthy volunteers</option>
                      <option value="false">Patients only / condition-specific</option>
                    </select>
                  </Field>

                  <Field label="Source URL">
                    <input
                      className="form-input"
                      name="source_url"
                      value={editForm.source_url || ""}
                      onChange={updateEdit}
                    />
                  </Field>

                  <Field label="Brief summary">
                    <textarea
                      className="form-input min-h-24 resize-none"
                      name="brief_summary"
                      value={editForm.brief_summary || ""}
                      onChange={updateEdit}
                    />
                  </Field>

                  <button
                    className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSaving}
                  >
                    <Save size={18} />
                    {isSaving ? "Saving..." : "Save update"}
                  </button>
                </form>
              </section>

              <section className="glass-card rounded-[2rem] p-5 sm:p-6">
                <h2 className="text-xl font-bold text-slate-950">
                  Linked records
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add with plus, remove with minus, save edits inline.
                </p>

                <div className="mt-5 space-y-4">
                  <EditableConditionList
                    rows={conditionDrafts}
                    setRows={setConditionDrafts}
                    newItem={newCondition}
                    setNewItem={setNewCondition}
                    onAdd={addCondition}
                    onSave={saveCondition}
                    onDelete={removeCondition}
                    disabled={isLinkedBusy}
                  />

                  <EditableInterventionList
                    rows={interventionDrafts}
                    setRows={setInterventionDrafts}
                    newItem={newIntervention}
                    setNewItem={setNewIntervention}
                    onAdd={addIntervention}
                    onSave={saveIntervention}
                    onDelete={removeIntervention}
                    disabled={isLinkedBusy}
                  />

                  <EditableCriteriaList
                    rows={criteriaDrafts}
                    setRows={setCriteriaDrafts}
                    newItem={newCriteria}
                    setNewItem={setNewCriteria}
                    onAdd={addCriteria}
                    onSave={saveCriteria}
                    onDelete={removeCriteria}
                    disabled={isLinkedBusy}
                  />
                </div>
              </section>
            </section>
          )}
        </section>
      )}
    </div>
  );
}

function EditableConditionList({
  rows,
  setRows,
  newItem,
  setNewItem,
  onAdd,
  onSave,
  onDelete,
  disabled,
}) {
  return (
    <LinkedBox title="Conditions" count={rows.length}>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_120px_auto]">
          <input
            className="form-input h-10 rounded-xl text-xs"
            placeholder="New condition"
            value={newItem.condition_name}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                condition_name: event.target.value,
              }))
            }
          />

          <select
            className="form-input h-10 rounded-xl text-xs"
            value={newItem.condition_role}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                condition_role: event.target.value,
              }))
            }
          >
            <option>Primary</option>
            <option>Secondary</option>
          </select>

          <PlusButton
            onClick={onAdd}
            disabled={disabled || !newItem.condition_name.trim()}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyLinked />
      ) : (
        rows.map((item, index) => (
          <div
            key={item.condition_id || index}
            className="rounded-2xl bg-slate-50 p-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_120px_auto_auto]">
              <input
                className="form-input h-10 rounded-xl text-xs"
                value={item.condition_name}
                onChange={(event) =>
                  updateRow(setRows, index, "condition_name", event.target.value)
                }
              />

              <select
                className="form-input h-10 rounded-xl text-xs"
                value={item.condition_role}
                onChange={(event) =>
                  updateRow(setRows, index, "condition_role", event.target.value)
                }
              >
                <option>Primary</option>
                <option>Secondary</option>
              </select>

              <SaveSmallButton disabled={disabled} onClick={() => onSave(index)} />
              <MinusButton disabled={disabled} onClick={() => onDelete(index)} />
            </div>
          </div>
        ))
      )}
    </LinkedBox>
  );
}

function EditableInterventionList({
  rows,
  setRows,
  newItem,
  setNewItem,
  onAdd,
  onSave,
  onDelete,
  disabled,
}) {
  return (
    <LinkedBox title="Interventions" count={rows.length}>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="form-input h-10 rounded-xl text-xs"
            placeholder="New intervention"
            value={newItem.intervention_name}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                intervention_name: event.target.value,
              }))
            }
          />

          <PlusButton
            onClick={onAdd}
            disabled={disabled || !newItem.intervention_name.trim()}
          />
        </div>

      </div>

      {rows.length === 0 ? (
        <EmptyLinked />
      ) : (
        rows.map((item, index) => (
          <div
            key={item.intervention_id || index}
            className="rounded-2xl bg-slate-50 p-3"
          >
            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
              <input
                className="form-input h-10 rounded-xl text-xs"
                value={item.intervention_name}
                onChange={(event) =>
                  updateRow(setRows, index, "intervention_name", event.target.value)
                }
              />

              <SaveSmallButton disabled={disabled} onClick={() => onSave(index)} />
              <MinusButton disabled={disabled} onClick={() => onDelete(index)} />
            </div>

          </div>
        ))
      )}
    </LinkedBox>
  );
}

function EditableCriteriaList({
  rows,
  setRows,
  newItem,
  setNewItem,
  onAdd,
  onSave,
  onDelete,
  disabled,
}) {
  return (
    <LinkedBox title="Criteria" count={rows.length}>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
        <div className="grid gap-2 md:grid-cols-[120px_80px_auto]">
          <select
            className="form-input h-10 rounded-xl text-xs"
            value={newItem.criteria_type}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                criteria_type: event.target.value,
              }))
            }
          >
            <option>Inclusion</option>
            <option>Exclusion</option>
            <option>General</option>
          </select>

          <input
            className="form-input h-10 rounded-xl text-xs"
            type="number"
            min="1"
            value={newItem.criteria_order}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                criteria_order: event.target.value,
              }))
            }
          />


          <PlusButton
            onClick={onAdd}
            disabled={disabled || !newItem.criteria_text.trim()}
          />
        </div>

        <textarea
          className="form-input mt-2 min-h-20 resize-none rounded-xl text-xs"
          placeholder="New criteria text"
          value={newItem.criteria_text}
          onChange={(event) =>
            setNewItem((current) => ({
              ...current,
              criteria_text: event.target.value,
            }))
          }
        />

        <label className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={Boolean(newItem.requires_manual_review)}
            onChange={(event) =>
              setNewItem((current) => ({
                ...current,
                requires_manual_review: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          Requires manual review
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyLinked />
      ) : (
        rows.map((item, index) => (
          <div
            key={item.criteria_id || item.criterion_id || index}
            className="rounded-2xl bg-slate-50 p-3"
          >
            <div className="grid gap-2 md:grid-cols-[120px_80px_auto_auto]">
              <select
                className="form-input h-10 rounded-xl text-xs"
                value={item.criteria_type}
                onChange={(event) =>
                  updateRow(setRows, index, "criteria_type", event.target.value)
                }
              >
                <option>Inclusion</option>
                <option>Exclusion</option>
                <option>General</option>
              </select>

              <input
                className="form-input h-10 rounded-xl text-xs"
                type="number"
                min="1"
                value={item.criteria_order}
                onChange={(event) =>
                  updateRow(setRows, index, "criteria_order", event.target.value)
                }
              />


              <SaveSmallButton disabled={disabled} onClick={() => onSave(index)} />
              <MinusButton disabled={disabled} onClick={() => onDelete(index)} />
            </div>

            <textarea
              className="form-input mt-2 min-h-20 resize-none rounded-xl text-xs"
              value={item.criteria_text}
              onChange={(event) =>
                updateRow(setRows, index, "criteria_text", event.target.value)
              }
            />

            <label className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(item.requires_manual_review)}
                onChange={(event) =>
                  updateRow(setRows, index, "requires_manual_review", event.target.checked)
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Requires manual review
            </label>

          </div>
        ))
      )}
    </LinkedBox>
  );
}
function PlusButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-3 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      title="Add"
    >
      <PlusCircle size={18} />
    </button>
  );
}

function MinusButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-red-50 px-3 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
      title="Remove"
    >
      <MinusCircle size={18} />
    </button>
  );
}

function SaveSmallButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-3 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      title="Save"
    >
      <Save size={16} />
    </button>
  );
}

function LinkedBox({ title, count, children }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-950">{title}</h3>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          {count}
        </span>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function Field({ label, required = false, helper, className = "", children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-bold text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {helper && <span className="mt-1 block text-xs text-slate-400">{helper}</span>}
    </label>
  );
}

function EmptyLinked() {
  return (
    <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-400">
      No records linked.
    </p>
  );
}

function Alert({ type, message }) {
  const isError = type === "error";

  return (
    <div
      className={`flex items-start gap-3 rounded-3xl border px-5 py-4 text-sm font-semibold ${
        isError
          ? "border-red-100 bg-red-50 text-red-700"
          : "border-emerald-100 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 shrink-0" size={18} />
      ) : (
        <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
      )}
      <span className="leading-6">{message}</span>
    </div>
  );
}

function StatusPill({ type, text }) {
  const styles = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${styles[type]}`}
    >
      {type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
      {text}
    </span>
  );
}

function updateRow(setRows, index, field, value) {
  setRows((current) =>
    current.map((row, rowIndex) =>
      rowIndex === index ? { ...row, [field]: value } : row
    )
  );
}

function getConditions(detail) {
  return detail?.conditions || detail?.trial_conditions || [];
}

function getInterventions(detail) {
  return detail?.interventions || detail?.trial_interventions || [];
}

function getCriteria(detail) {
  return detail?.criteria || detail?.eligibility_criteria || [];
}

function normaliseCondition(item) {
  return {
    condition_id: item.trial_condition_id || item.condition_id,
    condition_name: item.condition_name || "",
    condition_role: item.condition_role || "Primary",
  };
}

function normaliseIntervention(item) {
  return {
    intervention_id: item.trial_intervention_id || item.intervention_id,
    intervention_name: item.intervention_name || "",
  };
}

function normaliseCriteria(item) {
  return {
    criteria_id: item.criteria_id,
    criterion_id: item.criterion_id,
    criteria_type: item.criteria_type || "Inclusion",
    criteria_text: item.criteria_text || item.text || "",
    criteria_order: item.criteria_order || item.order_index || 1,
    requires_manual_review: Boolean(item.requires_manual_review),
  };
}

function getApiError(error, fallback) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.join(".") : "";
        return `${location ? `${location}: ` : ""}${
          item.msg || "Validation error"
        }`;
      })
      .join(" ");
  }

  if (typeof message === "string") return message;

  return fallback;
}