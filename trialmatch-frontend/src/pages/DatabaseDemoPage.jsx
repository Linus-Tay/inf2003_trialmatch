import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  GitBranch,
  Layers3,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Table2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchCriteriaQualityReport,
  fetchDatabaseDemoOverview,
  fetchDatabaseRelationships,
  fetchDatabaseViews,
  fetchIndexPerformance,
  fetchMongoSamples,
  fetchNestedQueries,
  refreshPerformanceCache,
  runMatchStatusTriggerTest,
  runPatientAgeTriggerTest,
  runTransactionDemo,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

const tabs = [
  { key: "Overview", icon: Database },
  { key: "Relationships", icon: GitBranch },
  { key: "Views", icon: Table2 },
  { key: "Nested Queries", icon: Search },
  { key: "Triggers", icon: ShieldCheck },
  { key: "Transactions", icon: Layers3 },
  { key: "Index Performance", icon: Zap },
  { key: "MongoDB", icon: FileSearch },
  { key: "Data Quality", icon: AlertTriangle },
];

export default function DatabaseDemoPage() {
  const [activeTab, setActiveTab] = useState("Overview");

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
  const [quality, setQuality] = useState({});

  const [loading, setLoading] = useState(false);
  const [tabError, setTabError] = useState("");
  const [message, setMessage] = useState("");

  async function safeLoad(label, loader) {
    setLoading(true);
    setTabError("");
    setMessage("");

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

  async function loadOverview() {
    await safeLoad("Overview", async () => {
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
    loadOverview();
  }, []);

  async function loadTab(tab) {
    setActiveTab(tab);

    if (tab === "Overview") {
      await loadOverview();
      return;
    }

    if (tab === "Relationships") {
      await safeLoad("Relationships", async () => {
        setRelationships(
          normaliseObject(await fetchDatabaseRelationships(), {})
        );
      });
      return;
    }

    if (tab === "Views") {
      await safeLoad("Views", async () => {
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
      return;
    }

    if (tab === "Data Quality") {
      await safeLoad("Criteria data quality", async () => {
        setQuality(normaliseObject(await fetchCriteriaQualityReport(), {}));
      });
    }
  }

  async function handleRefreshCache() {
    await safeLoad("Performance cache refresh", async () => {
      const result = await refreshPerformanceCache();
      setMessage(result?.message || "Performance cache refreshed.");

      const updatedOverview = await fetchDatabaseDemoOverview();
      setOverview(
        normaliseObject(updatedOverview, {
          mariadb_tables: [],
          mongodb_collections: [],
          summary: {},
        })
      );
    });
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

  const activeTabIcon = useMemo(() => {
    return tabs.find((tab) => tab.key === activeTab)?.icon || Database;
  }, [activeTab]);

  const ActiveIcon = activeTabIcon;

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        icon={FileSearch}
        eyebrow="Database Demonstration"
        title="Database features and evidence dashboard"
        description="Use this page for screenshots showing MariaDB tables, MongoDB collections, views, joins, nested queries, triggers, transactions, indexing, and data-quality checks."
      />

      {message && (
        <div className="max-w-full rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {tabError && (
        <div className="flex min-w-0 max-w-full items-start gap-3 overflow-hidden rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div className="min-w-0">
            <p className="font-bold">Demo endpoint issue</p>
            <p className="mt-1 break-words leading-6">{tabError}</p>
          </div>
        </div>
      )}

      <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-3">
        <div className="flex min-w-0 max-w-full flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => loadTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  activeTab === tab.key
                    ? "bg-slate-950 text-white"
                    : "bg-white/70 text-slate-600 hover:bg-white"
                }`}
              >
                <Icon size={16} />
                {tab.key}
              </button>
            );
          })}

          <button
            onClick={handleRefreshCache}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh cache
          </button>
        </div>
      </section>

      <section className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-3xl bg-slate-950 px-5 py-4 text-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <ActiveIcon size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
            Active demo
          </p>
          <h2 className="break-words text-lg font-bold">{activeTab}</h2>
        </div>

        {loading && (
          <span className="ml-auto shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
            Loading...
          </span>
        )}
      </section>

      {activeTab === "Overview" && (
        <section className="min-w-0 max-w-full space-y-6 overflow-hidden">
          <DemoChecklist />

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
            note="Shows how the normalized MariaDB tables connect."
            data={
              relationships.core_relationships || [
                {
                  parent_table: "trials",
                  child_table: "eligibility_criteria",
                  relationship: "One trial has many criteria rows",
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
                  relationship: "One patient can be matched against many trials",
                },
              ]
            }
          />

          <DataPanel
            title="Foreign-key / join evidence"
            note="Backend can return actual FK metadata or sample joined rows here."
            data={relationships.foreign_keys || relationships.join_samples || []}
          />
        </section>
      )}

      {activeTab === "Views" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          {Object.keys(views || {}).length === 0 ? (
            <EmptyPanel message="No view results loaded yet." />
          ) : (
            Object.entries(views).map(([key, view]) => (
              <DataPanel
                key={key}
                title={formatTitle(key)}
                data={view?.rows ?? view}
                note={
                  view?.exists === false
                    ? view?.error || "View missing."
                    : "View loaded successfully."
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
            title="Transaction demo: create trial + condition + criteria"
            description="Runs a multi-step database operation. If any step fails, the backend should roll everything back."
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
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 overflow-hidden">
            <button
              onClick={handlePerformanceRun}
              disabled={loading}
              className="primary-button w-fit disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Play size={16} />
              Run performance tests
            </button>

            <p className="min-w-0 break-words text-sm text-slate-500">
              Use this for screenshots showing indexed query plans, cached
              summaries, and EXPLAIN output.
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
                helper="Cache table"
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
                  title={`${formatTitle(key)} · ${value?.elapsed_ms ?? "—"}ms`}
                  data={value?.explain || value?.rows || value}
                  note="EXPLAIN output shows how MariaDB executes the indexed or cache-backed query."
                />
              )
            )}
        </section>
      )}

      {activeTab === "MongoDB" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <DataPanel
            title="MongoDB raw trials"
            note="Flexible raw imported trial documents."
            data={mongo.raw_trials || mongo.raw_trial_sample || []}
          />

          <DataPanel
            title="MongoDB parsed criteria documents"
            note="Document format for eligibility criteria preview and annotations."
            data={
              mongo.parsed_criteria_documents ||
              mongo.parsed_criteria_sample ||
              []
            }
          />

          <DataPanel
            title="MongoDB annotations / explanations"
            note="Flexible document-based storage for manual annotations or match explanations."
            data={mongo.criteria_annotations || mongo.match_explanations || []}
          />

          <JsonPanel title="Full MongoDB response" data={mongo} />
        </section>
      )}

      {activeTab === "Data Quality" && (
        <section className="grid min-w-0 max-w-full gap-6 overflow-hidden">
          <div className="grid min-w-0 max-w-full gap-4 overflow-hidden md:grid-cols-4">
            <MetricCard
              label="Heading rows"
              value={quality.heading_rows_count ?? "—"}
              helper="Should be 0"
              danger={Number(quality.heading_rows_count || 0) > 0}
            />
            <MetricCard
              label="Tiny fragments"
              value={quality.short_fragment_count ?? "—"}
              helper="Review needed"
              danger={Number(quality.short_fragment_count || 0) > 0}
            />
            <MetricCard
              label="Type mismatch"
              value={quality.type_mismatch_count ?? "—"}
              helper="Inclusion/exclusion issue"
              danger={Number(quality.type_mismatch_count || 0) > 0}
            />
            <MetricCard
              label="Checked trials"
              value={quality.checked_trials ?? "—"}
              helper="Validation coverage"
            />
          </div>

          <DataPanel
            title="Suspicious heading rows"
            note="Examples like 'Inclusion Criteria:' or 'Exclusion Criteria:' should not appear as criteria rows."
            data={quality.heading_rows || []}
          />

          <DataPanel
            title="Suspicious short fragments"
            note="Examples like 'and none of the' indicate bad chunk splitting."
            data={quality.short_fragments || []}
          />

          <DataPanel
            title="Suspicious type mismatch rows"
            note="Examples where an exclusion row contains inclusion heading text, or vice versa."
            data={quality.type_mismatches || []}
          />
        </section>
      )}
    </div>
  );
}

function DemoChecklist() {
  const items = [
    "MariaDB normalized tables",
    "MongoDB document collections",
    "SQL views",
    "Nested queries",
    "Triggers / constraints",
    "Transactions and rollback",
    "Indexes and EXPLAIN",
    "Data-quality validation",
  ];

  return (
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-6">
      <h2 className="mb-4 flex min-w-0 items-center gap-2 break-words text-xl font-bold text-slate-950">
        <CheckCircle2 size={20} className="shrink-0" />
        Demonstration checklist
      </h2>

      <div className="grid min-w-0 max-w-full gap-3 overflow-hidden md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item}
            className="min-w-0 break-words rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function CountPanel({ title, rows }) {
  return (
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-6">
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
              className="flex min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden rounded-2xl bg-white/75 px-4 py-3"
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
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-3xl p-5">
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
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-6">
      <h2 className="break-words text-xl font-bold text-slate-950">
        {title}
      </h2>

      <p className="mt-2 break-words text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        onClick={onRun}
        disabled={loading}
        className="primary-button mt-5 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-6">
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
            <tr key={rowIndex} className="align-top">
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
      } min-w-0 max-w-full overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white`}
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
    <section className="glass-card min-w-0 max-w-full overflow-hidden rounded-[2rem] p-6">
      <EmptyText>{message}</EmptyText>
    </section>
  );
}

function EmptyText({ children }) {
  return (
    <div className="min-w-0 max-w-full break-words rounded-3xl bg-white/70 p-5 text-sm font-medium text-slate-500">
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