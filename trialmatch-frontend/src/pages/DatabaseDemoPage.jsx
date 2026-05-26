import { Database, FileSearch, Play, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  fetchDatabaseDemoOverview,
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

const tabs = ["Overview", "Views", "Nested Queries", "Triggers", "Transactions", "Index Performance", "MongoDB"];

export default function DatabaseDemoPage() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [overview, setOverview] = useState({ mariadb_tables: [], mongodb_collections: [] });
  const [views, setViews] = useState({});
  const [nested, setNested] = useState({});
  const [triggerResult, setTriggerResult] = useState(null);
  const [transactionResult, setTransactionResult] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [mongo, setMongo] = useState({});
  const [message, setMessage] = useState("");

  async function loadOverview() {
    setOverview(await fetchDatabaseDemoOverview());
  }

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadTab(tab) {
    setActiveTab(tab);
    if (tab === "Views") setViews(await fetchDatabaseViews());
    if (tab === "Nested Queries") setNested(await fetchNestedQueries());
    if (tab === "Index Performance") setPerformance(await fetchIndexPerformance());
    if (tab === "MongoDB") setMongo(await fetchMongoSamples());
  }

  async function handleRefreshCache() {
    const result = await refreshPerformanceCache();
    setMessage(result.message);
    loadOverview();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileSearch}
        eyebrow="Database Demonstration"
        title="Demonstrate views, nested queries, triggers, transactions, indexing and MongoDB."
        description="This page is designed for database project demonstration and report screenshots."
      />

      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <div className="glass-card rounded-[2rem] p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => loadTab(tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                activeTab === tab ? "bg-slate-950 text-white" : "bg-white/70 text-slate-600 hover:bg-white"
              }`}
            >
              {tab}
            </button>
          ))}

          <button onClick={handleRefreshCache} className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            <RefreshCw size={16} />
            Refresh cache
          </button>
        </div>
      </div>

      {activeTab === "Overview" && (
        <section className="grid gap-6 xl:grid-cols-2">
          <CountPanel title="MariaDB tables" rows={overview.mariadb_tables || []} />
          <CountPanel title="MongoDB collections" rows={overview.mongodb_collections || []} />
        </section>
      )}

      {activeTab === "Views" && (
        <section className="grid gap-6">
          {Object.entries(views).map(([key, view]) => (
            <DataPanel key={key} title={key} rows={view.rows || []} note={view.exists ? "View loaded successfully." : view.error || "View missing."} />
          ))}
        </section>
      )}

      {activeTab === "Nested Queries" && (
        <section className="grid gap-6">
          <DataPanel title="Above-average conditions" rows={nested.above_average_conditions || []} />
          <DataPanel title="Complex trials above average" rows={nested.complex_trials || []} />
          <DataPanel title="High exclusion-to-inclusion ratio" rows={nested.high_exclusion_ratio || []} />
        </section>
      )}

      {activeTab === "Triggers" && (
        <section className="grid gap-6 xl:grid-cols-2">
          <ActionPanel
            title="Trigger test: invalid patient age"
            description="Attempts to insert age 150. A working trigger or constraint should reject this."
            button="Run patient age trigger"
            onRun={async () => setTriggerResult(await runPatientAgeTriggerTest())}
          />

          <ActionPanel
            title="Trigger test: match status/history"
            description="Creates or updates a match row and then checks match status history."
            button="Run match status trigger"
            onRun={async () => setTriggerResult(await runMatchStatusTriggerTest())}
          />

          {triggerResult && <JsonPanel title="Trigger result" data={triggerResult} />}
        </section>
      )}

      {activeTab === "Transactions" && (
        <section className="grid gap-6">
          <ActionPanel
            title="Transaction demo: create trial + condition + criteria"
            description="Runs a multi-step insert. If any step fails, the backend rolls back."
            button="Run transaction demo"
            onRun={async () => setTransactionResult(await runTransactionDemo())}
          />
          {transactionResult && <JsonPanel title="Transaction result" data={transactionResult} />}
        </section>
      )}

      {activeTab === "Index Performance" && (
        <section className="grid gap-6">
          <button onClick={async () => setPerformance(await fetchIndexPerformance())} className="primary-button w-fit">
            <Play size={16} />
            Run performance tests
          </button>

          {performance && Object.entries(performance.performance_tests || {}).map(([key, value]) => (
            <DataPanel
              key={key}
              title={`${key} · ${value.elapsed_ms}ms`}
              rows={value.explain || []}
              note="EXPLAIN output shows how MariaDB executes the indexed/cache-backed query."
            />
          ))}
        </section>
      )}

      {activeTab === "MongoDB" && (
        <section className="glass-card rounded-[2rem] p-6">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-950">
            <Database size={20} />
            MongoDB sample documents
          </h2>
          <pre className="max-h-[34rem] overflow-auto rounded-3xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">
            {JSON.stringify(mongo, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function CountPanel({ title, rows }) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-950">{title}</h2>
      <div className="space-y-2">
        {(rows || []).map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">{row.name}</span>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${row.exists === false ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DataPanel({ title, rows, note }) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <pre className="mt-4 max-h-96 overflow-auto rounded-3xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">
        {JSON.stringify(rows, null, 2)}
      </pre>
    </section>
  );
}

function ActionPanel({ title, description, button, onRun }) {
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <h2 className="text-xl font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <button onClick={onRun} className="primary-button mt-5">
        <Play size={16} />
        {button}
      </button>
    </section>
  );
}

function JsonPanel({ title, data }) {
  return (
    <section className="xl:col-span-2 rounded-[2rem] bg-slate-950 p-5 text-white">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      <pre className="overflow-auto text-xs leading-6">{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
