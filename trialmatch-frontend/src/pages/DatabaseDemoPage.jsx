import {
  AlertTriangle,
  Database,
  FileSearch,
  GitBranch,
  Layers3,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Table2,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  createParsedCriteriaItem,
  deleteParsedCriteriaItem,
  fetchDatabaseDemoOverview,
  fetchDatabaseRelationships,
  fetchDatabaseViews,
  fetchIndexPerformance,
  fetchMongoSamples,
  fetchNestedQueries,
  getMongoTrialDocumentReview,
  runMatchStatusTriggerTest,
  runPatientAgeTriggerTest,
  runTransactionDemo,
  updateParsedCriteriaDocumentReview,
  updateParsedCriteriaItem,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

const tabs = [
  { key: "Schema", icon: Database },
  { key: "Relationships", icon: GitBranch },
  { key: "SQL Views", icon: Table2 },
  { key: "Nested Queries", icon: Search },
  { key: "Triggers", icon: ShieldCheck },
  { key: "Transactions", icon: Layers3 },
  { key: "Index Performance", icon: Zap },
  { key: "MongoDB", icon: FileSearch },
];

export default function DatabaseDemoPage() {
  const [activeTab, setActiveTab] = useState("Schema");

  const [overview, setOverview] = useState({
    mariadb_tables: [],
    mongodb_collections: [],
    summary: {},
  });

  const [relationships, setRelationships] = useState({});
  const [views, setViews] = useState({});
  const [nested, setNested] = useState({});
  const [triggerResult, setTriggerResult] = useState(null);
  const [transactionResult, setTransactionResult] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [mongo, setMongo] = useState({});

  const [loading, setLoading] = useState(false);
  const [tabError, setTabError] = useState("");

  async function safeLoad(label, loader) {
    setLoading(true);
    setTabError("");

    try {
      await loader();
    } catch (error) {
      console.error(error);
      setTabError(
        `${label} failed to load. Check that the backend route exists and FastAPI is running.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSchema() {
    await safeLoad("Schema", async () => {
      const result = await fetchDatabaseDemoOverview();

      setOverview(
        normaliseObject(result, {
          mariadb_tables: [],
          mongodb_collections: [],
          summary: {},
        })
      );
    });
  }

  useEffect(() => {
    loadSchema();
  }, []);

  async function loadTab(tab) {
    setActiveTab(tab);

    if (tab === "Schema") {
      await loadSchema();
      return;
    }

    if (tab === "Relationships") {
      await safeLoad("Relationships", async () => {
        setRelationships(normaliseObject(await fetchDatabaseRelationships(), {}));
      });
      return;
    }

    if (tab === "SQL Views") {
      await safeLoad("SQL views", async () => {
        setViews(normaliseObject(await fetchDatabaseViews(), {}));
      });
      return;
    }

    if (tab === "Nested Queries") {
      await safeLoad("Nested queries", async () => {
        setNested(normaliseObject(await fetchNestedQueries(), {}));
      });
      return;
    }

    if (tab === "Index Performance") {
      await safeLoad("Index performance", async () => {
        setPerformance(normaliseObject(await fetchIndexPerformance(), {}));
      });
      return;
    }

    if (tab === "MongoDB") {
      await safeLoad("MongoDB samples", async () => {
        setMongo(normaliseObject(await fetchMongoSamples(), {}));
      });
    }
  }

  async function handlePatientAgeTrigger() {
    await safeLoad("Patient age trigger", async () => {
      setTriggerResult(await runPatientAgeTriggerTest());
    });
  }

  async function handleMatchStatusTrigger() {
    await safeLoad("Match status trigger", async () => {
      setTriggerResult(await runMatchStatusTriggerTest());
    });
  }

  async function handleTransactionDemo() {
    await safeLoad("Transaction demo", async () => {
      setTransactionResult(await runTransactionDemo());
    });
  }

  async function handlePerformanceRun() {
    await safeLoad("Index performance", async () => {
      setPerformance(normaliseObject(await fetchIndexPerformance(), {}));
    });
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        icon={FileSearch}
        eyebrow="Database Evidence"
        title="System database overview"
        description="Review schema design, queries, triggers, indexes and document storage."
      />

      {tabError && (
        <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div className="min-w-0">
            <p className="font-bold">Database evidence endpoint issue</p>
            <p className="mt-1 break-words leading-6">{tabError}</p>
          </div>
        </div>
      )}

      <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex min-w-0 max-w-full flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => loadTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.key
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={16} />
                {tab.key}
              </button>
            );
          })}
        </div>
      </section>

      {loading && (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-700">
          Loading database...
        </div>
      )}

      {activeTab === "Schema" && (
        <section className="min-w-0 max-w-full space-y-6 overflow-hidden">
          <div className="grid min-w-0 max-w-full gap-4 overflow-hidden md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="MariaDB tables"
              value={(overview.mariadb_tables || []).length}
              helper="Relational schema"
            />

            <MetricCard
              label="MongoDB collections"
              value={(overview.mongodb_collections || []).length}
              helper="Document storage"
            />

            <MetricCard
              label="Trials"
              value={
                overview.summary?.trials ||
                getCount(overview.mariadb_tables, "trials")
              }
              helper="Main dataset"
            />

            <MetricCard
              label="Criteria"
              value={
                overview.summary?.criteria ||
                getCount(overview.mariadb_tables, "eligibility_criteria")
              }
              helper="Eligibility rules"
            />
          </div>

          <div className="grid min-w-0 max-w-full gap-6 overflow-hidden xl:grid-cols-2">
            <CountPanel
              title="MariaDB tables"
              rows={overview.mariadb_tables || []}
            />

            <CountPanel
              title="MongoDB collections"
              rows={overview.mongodb_collections || []}
            />
          </div>
        </section>
      )}

      {activeTab === "Relationships" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <DataPanel
            title="Core relational design"
            note="Shows the main normalized MariaDB relationships used by the system."
            data={
              relationships.core_relationships || [
                {
                  parent_table: "trials",
                  child_table: "eligibility_criteria",
                  relationship: "One trial has many eligibility criteria rows",
                },
                {
                  parent_table: "trials",
                  child_table: "trial_conditions",
                  relationship: "One trial has many conditions",
                },
                {
                  parent_table: "trials",
                  child_table: "trial_interventions",
                  relationship: "One trial has many interventions",
                },
                {
                  parent_table: "app_users",
                  child_table: "saved_trials",
                  relationship: "One user can save many trials",
                },
                {
                  parent_table: "patient_profiles",
                  child_table: "patient_trial_matches",
                  relationship: "One patient profile can produce many trial matches",
                },
              ]
            }
          />

          <DataPanel
            title="Foreign key and join evidence"
            note="Shows actual database relationship metadata or joined sample rows returned by the backend."
            data={relationships.foreign_keys || relationships.join_samples || []}
          />
        </section>
      )}

      {activeTab === "SQL Views" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          {Object.keys(views || {}).length === 0 ? (
            <EmptyPanel message="No SQL view results loaded yet." />
          ) : (
            Object.entries(views).map(([key, view]) => (
              <DataPanel
                key={key}
                title={formatTitle(key)}
                data={view?.rows ?? view}
                note={
                  view?.exists === false
                    ? view?.error || "View missing."
                    : "SQL view loaded successfully."
                }
              />
            ))
          )}
        </section>
      )}

      {activeTab === "Nested Queries" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <DataPanel
            title="Above-average conditions"
            note="Uses a nested query to find conditions linked to more trials than the average condition."
            data={nested.above_average_conditions || []}
          />

          <DataPanel
            title="Complex trials above average"
            note="Uses a subquery comparing each trial's criteria complexity against the overall average."
            data={nested.complex_trials || []}
          />

          <DataPanel
            title="High exclusion-to-inclusion ratio"
            note="Uses aggregation and nested filtering to find trials with unusually high exclusion criteria counts."
            data={nested.high_exclusion_ratio || []}
          />
        </section>
      )}

      {activeTab === "Triggers" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden xl:grid-cols-2">
          <ActionPanel
            title="Trigger test: invalid patient age"
            description="Attempts to insert an invalid patient age. A working trigger or constraint should reject the insert."
            button="Run patient age trigger"
            onRun={handlePatientAgeTrigger}
            loading={loading}
          />

          <ActionPanel
            title="Trigger test: match status history"
            description="Creates or updates a match row, then checks whether match status history or audit logic was triggered."
            button="Run match status trigger"
            onRun={handleMatchStatusTrigger}
            loading={loading}
          />

          {triggerResult && (
            <JsonPanel title="Trigger result" data={triggerResult} wide />
          )}
        </section>
      )}

      {activeTab === "Transactions" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <ActionPanel
            title="Transaction demo: create trial with related records"
            description="Runs a multi-step database operation involving trial data and related records. If any step fails, the backend should roll everything back."
            button="Run transaction demo"
            onRun={handleTransactionDemo}
            loading={loading}
          />

          {transactionResult && (
            <JsonPanel title="Transaction result" data={transactionResult} />
          )}
        </section>
      )}

      {activeTab === "Index Performance" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={handlePerformanceRun}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={16} />
              Run performance tests
            </button>

            <p className="min-w-0 break-words text-sm leading-6 text-slate-500">
              Shows indexed query plans, cached summaries, and MariaDB EXPLAIN output.
            </p>
          </div>

          {performance?.summary && (
            <div className="grid min-w-0 max-w-full gap-4 overflow-hidden md:grid-cols-3">
              <MetricCard
                label="Tests run"
                value={Object.keys(performance.performance_tests || {}).length}
                helper="Performance demos"
              />

              <MetricCard
                label="Cache status"
                value={performance.summary.cache_status || "Ready"}
                helper="Cache table evidence"
              />

              <MetricCard
                label="Generated at"
                value={performance.summary.generated_at || "Now"}
                helper="Backend timestamp"
              />
            </div>
          )}

          {performance &&
            Object.entries(performance.performance_tests || {}).map(
              ([key, value]) => (
                <DataPanel
                  key={key}
                  title={`${formatTitle(key)} · ${
                    value?.elapsed_ms ?? "—"
                  }ms`}
                  data={value?.explain || value?.rows || value}
                  note="EXPLAIN output shows how MariaDB executes the indexed or cache-backed query."
                />
              )
            )}
        </section>
      )}

      {activeTab === "MongoDB" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <MongoDocumentReviewWorkspace
            sampleTrialId={
              mongo?.parsed_criteria_document?.trial_id ||
              mongo?.raw_trial_document?.trial_id ||
              ""
            }
            sampleNctId={
              mongo?.parsed_criteria_document?.nct_id ||
              mongo?.raw_trial_document?.nct_id ||
              ""
            }
          />
        </section>
      )}
    </div>
  );
}

function MongoDocumentReviewWorkspace({ sampleTrialId, sampleNctId }) {
  const [trialId, setTrialId] = useState(sampleTrialId ? String(sampleTrialId) : "");
  const [documentData, setDocumentData] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [reviewForm, setReviewForm] = useState({
    status: "Needs Review",
    reviewer_note: "",
  });

  const [newItem, setNewItem] = useState({
    criteria_type: "General",
    original_text: "",
    keywords: "",
    requires_manual_review: false,
  });

  const [editItem, setEditItem] = useState({
    criteria_type: "General",
    original_text: "",
    keywords: "",
    requires_manual_review: false,
  });

  const parsedDocument = documentData?.parsed_document;
  const rawDocument = documentData?.raw_document;
  const criteriaItems = parsedDocument?.criteria_items || [];
  const loadedTrialId = documentData?.trial?.trial_id || parsedDocument?.trial_id || rawDocument?.trial_id;
  const loadedNctId = documentData?.trial?.nct_id || parsedDocument?.nct_id || rawDocument?.nct_id;

  useEffect(() => {
    if (!sampleTrialId) return;

    const id = String(sampleTrialId);
    setTrialId(id);
    loadDocument(id, { silent: true });
    // The sample id only changes when the MongoDB tab sample changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleTrialId]);

  async function runAction(action, successMessage, options = {}) {
    setBusy(true);
    setError("");
    if (!options.silent) setMessage("");

    try {
      const result = await action();

      if (successMessage && !options.silent) {
        setMessage(successMessage);
      }

      return result;
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function loadDocument(targetTrialId = trialId, options = {}) {
    const id = String(targetTrialId || "").trim();

    if (!id) {
      setError("Enter a trial_id first.");
      return;
    }

    const result = await runAction(
      () => getMongoTrialDocumentReview(id),
      "MongoDB documents loaded.",
      options
    );

    if (result) {
      setTrialId(String(id));
      setDocumentData(result);
      setSelectedItem(null);

      const review = result.parsed_document?.document_review || {};
      setReviewForm({
        status: review.status || "Needs Review",
        reviewer_note: review.reviewer_note || "",
      });
    }
  }

  async function handleReviewSave() {
    if (!String(trialId || "").trim()) {
      setError("Load a trial document first.");
      return;
    }

    const result = await runAction(
      () => updateParsedCriteriaDocumentReview(trialId, reviewForm),
      "Document review metadata updated."
    );

    if (result) {
      await loadDocument(trialId, { silent: true });
    }
  }

  async function handleCreateItem(event) {
    event.preventDefault();

    if (!String(trialId || "").trim()) {
      setError("Load a trial document first.");
      return;
    }

    if (newItem.original_text.trim().length < 2) {
      setError("Enter at least 2 characters for the criteria text.");
      return;
    }

    const payload = {
      criteria_type: newItem.criteria_type,
      original_text: newItem.original_text.trim(),
      keywords: splitKeywords(newItem.keywords),
      requires_manual_review: newItem.requires_manual_review,
    };

    const result = await runAction(
      () => createParsedCriteriaItem(trialId, payload),
      "New parsed criteria item added to the MongoDB document."
    );

    if (result) {
      setNewItem({
        criteria_type: "General",
        original_text: "",
        keywords: "",
        requires_manual_review: false,
      });
      await loadDocument(trialId, { silent: true });
    }
  }

  function startEdit(item) {
    setSelectedItem(item);
    setEditItem({
      criteria_type: item.criteria_type || "General",
      original_text: item.original_text || "",
      keywords: (item.keywords || []).join(", "),
      requires_manual_review: Boolean(item.rules?.requires_manual_review),
    });
  }

  async function handleUpdateItem(event) {
    event.preventDefault();

    if (!selectedItem?.criteria_external_id) {
      setError("Select a parsed criteria item first.");
      return;
    }

    if (editItem.original_text.trim().length < 2) {
      setError("Enter at least 2 characters for the criteria text.");
      return;
    }

    const payload = {
      criteria_type: editItem.criteria_type,
      original_text: editItem.original_text.trim(),
      keywords: splitKeywords(editItem.keywords),
      requires_manual_review: editItem.requires_manual_review,
    };

    const result = await runAction(
      () =>
        updateParsedCriteriaItem(
          trialId,
          selectedItem.criteria_external_id,
          payload
        ),
      "Parsed criteria item updated in MongoDB."
    );

    if (result) {
      await loadDocument(trialId, { silent: true });
    }
  }

  async function handleDeleteItem(item) {
    const externalId = item?.criteria_external_id;
    if (!externalId) return;

    const result = await runAction(
      () => deleteParsedCriteriaItem(trialId, externalId),
      "Parsed criteria item deleted from MongoDB."
    );

    if (result) {
      if (selectedItem?.criteria_external_id === externalId) {
        setSelectedItem(null);
      }
      await loadDocument(trialId, { silent: true });
    }
  }

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex min-w-0 max-w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-slate-950">
            MongoDB source and parsed criteria review
          </h2>
          <p className="mt-1 max-w-4xl break-words text-sm leading-6 text-slate-500">
            Load one trial and review the two MongoDB documents linked to it: the raw source snapshot and the nested parsed criteria document.
          </p>
        </div>

        {sampleTrialId && (
          <button
            type="button"
            onClick={() => loadDocument(sampleTrialId)}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Load sample {sampleNctId ? `(${sampleNctId})` : ""}
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={trialId}
          onChange={(event) => setTrialId(event.target.value)}
          placeholder="Enter MariaDB trial_id, e.g. 1"
          className="min-w-0 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />

        <button
          type="button"
          onClick={() => loadDocument(trialId)}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw size={16} />
          Load trial
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-3xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {!documentData && (
        <EmptyText>
          Load the sample trial or enter a trial_id to show its raw source trace and parsed criteria document.
        </EmptyText>
      )}

      {documentData && (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Loaded trial_id" value={loadedTrialId} helper="MariaDB link key" />
            <MetricCard label="NCT ID" value={loadedNctId} helper="Shared source key" />
            <MetricCard label="Parsed items" value={criteriaItems.length} helper="Items in MongoDB array" />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-bold text-slate-950">Raw source trace</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Read-only snapshot from the imported source dataset.
              </p>

              <div className="mt-4 grid gap-3 text-sm">
                <MiniField label="Dataset" value={rawDocument?.dataset_name} />
                <MiniField label="Source condition query" value={rawDocument?.raw?.source_condition_query} />
                <MiniField label="Source title" value={rawDocument?.raw?.title} />
                <MiniField label="Recruitment status" value={rawDocument?.raw?.overall_status} />
                <MiniField label="Phase" value={rawDocument?.raw?.phase} />
                <MiniField label="Healthy volunteers" value={rawDocument?.raw?.healthy_volunteers} />
                <MiniField label="Split status" value={rawDocument?.raw?.criteria_split_status} />
                <MiniField label="ClinicalTrials.gov URL" value={rawDocument?.raw?.clinicaltrials_url} />
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-lg font-bold text-slate-950">Parsed document review</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Update document-level review fields stored only in MongoDB.
              </p>

              <div className="mt-4 grid gap-3">
                <select
                  value={reviewForm.status}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option>Needs Review</option>
                  <option>Reviewed</option>
                  <option>Parser Issue</option>
                  <option>Ready for Demo</option>
                </select>

                <textarea
                  value={reviewForm.reviewer_note}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      reviewer_note: event.target.value,
                    }))
                  }
                  placeholder="Example: source and parsed criteria checked for demo."
                  rows={4}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />

                <button
                  type="button"
                  onClick={handleReviewSave}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  Save review
                </button>
              </div>
            </section>
          </div>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-950">Parsed criteria items</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              These are nested items inside the loaded MongoDB parsed criteria document.
            </p>

            {criteriaItems.length === 0 ? (
              <EmptyText>No parsed criteria items are stored for this trial yet.</EmptyText>
            ) : (
              <div className="mt-4 space-y-3">
                {criteriaItems.slice(0, 10).map((item) => (
                  <div
                    key={item.criteria_external_id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                            {item.criteria_type || "General"}
                          </span>
                          <span className="break-all rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                            {item.criteria_external_id}
                          </span>
                          {item.rules?.requires_manual_review && (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                              Manual review
                            </span>
                          )}
                        </div>

                        <p className="mt-3 break-words text-sm leading-6 text-slate-700">
                          {item.original_text}
                        </p>

                        {(item.keywords || []).length > 0 && (
                          <p className="mt-2 text-xs font-semibold text-slate-400">
                            Keywords: {(item.keywords || []).join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-bold text-slate-950">Add parsed criteria item</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Adds one nested item to the loaded MongoDB document.
            </p>

            <form onSubmit={handleCreateItem} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                <select
                  value={newItem.criteria_type}
                  onChange={(event) =>
                    setNewItem((current) => ({
                      ...current,
                      criteria_type: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                >
                  <option>General</option>
                  <option>Inclusion</option>
                  <option>Exclusion</option>
                </select>

                <input
                  value={newItem.keywords}
                  onChange={(event) =>
                    setNewItem((current) => ({
                      ...current,
                      keywords: event.target.value,
                    }))
                  }
                  placeholder="Optional keywords, comma separated"
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <textarea
                value={newItem.original_text}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    original_text: event.target.value,
                  }))
                }
                placeholder="Enter a parsed eligibility criterion."
                rows={4}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={newItem.requires_manual_review}
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

              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Plus size={16} />
                Add item
              </button>
            </form>
          </section>

          {selectedItem && (
            <section className="rounded-[2rem] border border-blue-100 bg-blue-50 p-5">
              <h3 className="text-lg font-bold text-slate-950">Edit selected parsed item</h3>
              <p className="mt-1 break-all text-xs font-bold text-blue-700">
                {selectedItem.criteria_external_id}
              </p>

              <form onSubmit={handleUpdateItem} className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
                  <select
                    value={editItem.criteria_type}
                    onChange={(event) =>
                      setEditItem((current) => ({
                        ...current,
                        criteria_type: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-blue-100 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>General</option>
                    <option>Inclusion</option>
                    <option>Exclusion</option>
                  </select>

                  <input
                    value={editItem.keywords}
                    onChange={(event) =>
                      setEditItem((current) => ({
                        ...current,
                        keywords: event.target.value,
                      }))
                    }
                    placeholder="Optional keywords, comma separated"
                    className="rounded-2xl border border-blue-100 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <textarea
                  value={editItem.original_text}
                  onChange={(event) =>
                    setEditItem((current) => ({
                      ...current,
                      original_text: event.target.value,
                    }))
                  }
                  rows={4}
                  className="rounded-2xl border border-blue-100 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />

                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={editItem.requires_manual_review}
                    onChange={(event) =>
                      setEditItem((current) => ({
                        ...current,
                        requires_manual_review: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Requires manual review
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  Update item
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function getApiErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  const message = error?.response?.data?.message;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;

        const location = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== "body").join(".")
          : "";

        return `${location ? `${location}: ` : ""}${
          item?.msg || "Validation error"
        }`;
      })
      .join(" ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  if (typeof message === "string") return message;

  return "MongoDB action failed. Check the backend console.";
}

function MiniField({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-700 [overflow-wrap:anywhere]">
        {formatCell(value)}
      </p>
    </div>
  );
}

function splitKeywords(value) {
  return String(value || "")
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function CountPanel({ title, rows }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 break-words text-xl font-bold text-slate-950">
        {title}
      </h2>

      {(rows || []).length === 0 ? (
        <EmptyText>No records returned.</EmptyText>
      ) : (
        <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
          {(rows || []).map((row, index) => (
            <div
              key={`${row.name || row.collection || index}`}
              className="flex min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <span className="min-w-0 break-words text-sm font-semibold text-slate-700 [overflow-wrap:anywhere]">
                {row.name || row.collection || row.table_name || "Unnamed"}
              </span>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                  row.exists === false
                    ? "bg-red-50 text-red-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {formatValue(row.count ?? row.rows ?? row.documents ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, helper, danger = false }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="break-words text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-2xl font-bold [overflow-wrap:anywhere] ${
          danger ? "text-red-700" : "text-slate-950"
        }`}
      >
        {formatValue(value)}
      </p>

      {helper && (
        <p className="mt-1 break-words text-xs font-semibold text-slate-400">
          {helper}
        </p>
      )}
    </section>
  );
}

function ActionPanel({ title, description, button, onRun, loading }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="break-words text-xl font-bold text-slate-950">
        {title}
      </h2>

      <p className="mt-2 break-words text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={loading}
        className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play size={16} />
        {button}
      </button>
    </section>
  );
}

function DataPanel({ title, data, note }) {
  const rows = normaliseRows(data);

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="min-w-0 max-w-full">
        <h2 className="break-words text-xl font-bold text-slate-950">
          {title}
        </h2>

        {note && (
          <p className="mt-1 break-words text-sm leading-6 text-slate-500">
            {note}
          </p>
        )}
      </div>

      <div className="mt-4 min-w-0 max-w-full overflow-hidden">
        {rows.length === 0 ? (
          <EmptyText>No rows returned.</EmptyText>
        ) : rows.length <= 50 && canRenderTable(rows) ? (
          <SmartTable rows={rows} />
        ) : (
          <JsonBlock data={data} />
        )}
      </div>
    </section>
  );
}

function SmartTable({ rows }) {
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  ).slice(0, 8);

  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-3xl border border-slate-200 bg-white">
      <table className="w-full table-auto text-left text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="break-words px-4 py-3 font-bold [overflow-wrap:anywhere]"
              >
                {formatTitle(column)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top hover:bg-slate-50">
              {columns.map((column) => (
                <td
                  key={column}
                  className="max-w-[22rem] break-words px-4 py-3 text-slate-700 [overflow-wrap:anywhere]"
                >
                  {formatCell(row?.[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonPanel({ title, data, wide = false }) {
  return (
    <section
      className={`${
        wide ? "xl:col-span-2" : ""
      } min-w-0 max-w-full overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-sm`}
    >
      <h2 className="mb-4 break-words text-lg font-bold">{title}</h2>
      <JsonBlock data={data} dark />
    </section>
  );
}

function JsonBlock({ data, dark = false }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-3xl">
      <pre
        className={`max-h-[34rem] max-w-full overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-6 [overflow-wrap:anywhere] ${
          dark ? "bg-slate-900 text-slate-100" : "bg-slate-950 text-slate-100"
        }`}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function EmptyPanel({ message }) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <EmptyText>{message}</EmptyText>
    </section>
  );
}

function EmptyText({ children }) {
  return (
    <div className="min-w-0 max-w-full break-words rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium text-slate-500">
      {children}
    </div>
  );
}

function normaliseObject(value, fallback) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return value;
}

function normaliseRows(value) {
  if (Array.isArray(value)) return value;
  if (value?.rows && Array.isArray(value.rows)) return value.rows;
  if (value && typeof value === "object") return [value];
  return [];
}

function canRenderTable(rows) {
  return rows.every((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;

    return Object.values(row).every((value) => {
      return (
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    });
  });
}

function formatCell(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return formatValue(value);
  return String(value);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (!Number.isNaN(numberValue) && String(value).trim() !== "") {
    return new Intl.NumberFormat().format(numberValue);
  }

  return String(value);
}

function getCount(rows, name) {
  const row = (rows || []).find((item) => {
    return (
      String(item.name || item.table_name || "").toLowerCase() ===
      name.toLowerCase()
    );
  });

  return row?.count ?? row?.rows ?? 0;
}

function formatTitle(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}