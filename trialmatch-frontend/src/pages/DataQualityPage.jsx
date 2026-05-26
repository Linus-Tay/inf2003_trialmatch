import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchQualityFlags, fetchQualityOptionalViews, fetchQualityOverview, resolveQualityFlag } from "../api/modules";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

export default function DataQualityPage() {
  const [overview, setOverview] = useState({});
  const [optionalViews, setOptionalViews] = useState({});
  const [flags, setFlags] = useState([]);

  async function load() {
    setOverview(await fetchQualityOverview());
    setOptionalViews(await fetchQualityOptionalViews());
    setFlags(await fetchQualityFlags());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleResolve(flagId) {
    await resolveQualityFlag(flagId, true);
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        eyebrow="Data Quality"
        title="Review missing values, unresolved flags and quality views."
        description="This page demonstrates data quality checks using flags and optional SQL views."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Unresolved flags" value={overview.unresolved_flags} />
        <StatCard label="Missing phase" value={overview.missing_phase} />
        <StatCard label="Missing age" value={overview.missing_age} />
        <StatCard label="No criteria" value={overview.no_criteria} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        {Object.entries(optionalViews || {}).map(([key, view]) => (
          <section key={key} className="glass-card rounded-[2rem] p-6">
            <h2 className="text-xl font-bold text-slate-950">{key}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {view.exists ? "Loaded from SQL view." : view.error || "View not found."}
            </p>
            <pre className="mt-4 max-h-80 overflow-auto rounded-3xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {JSON.stringify(view.rows || [], null, 2)}
            </pre>
          </section>
        ))}
      </section>

      <section className="glass-card rounded-[2rem] p-6">
        <h2 className="mb-5 text-xl font-bold text-slate-950">Quality flags</h2>

        <div className="space-y-3">
          {flags.length === 0 && <p className="text-sm text-slate-500">No quality flags found yet.</p>}

          {flags.map((flag) => (
            <div key={flag.flag_id} className="rounded-2xl bg-white/75 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{flag.flag_type}</span>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{flag.severity}</span>
                    {flag.is_resolved ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Resolved</span> : null}
                  </div>
                  <p className="font-semibold text-slate-950">{flag.brief_title || "No linked trial title"}</p>
                  <p className="mt-1 text-sm text-slate-500">{flag.description}</p>
                </div>

                {!flag.is_resolved && (
                  <button onClick={() => handleResolve(flag.flag_id)} className="secondary-button">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
