import { Activity, Bookmark, Database, FlaskConical, Layers3, Search, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

import { fetchDashboardOverview } from "../api/modules";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TrialCard from "../components/TrialCard";

const fallback = { summary: {}, saved: {}, phase_distribution: [], top_conditions: [], spotlight_trials: [] };

export default function DashboardPage() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    fetchDashboardOverview().then(setData).catch(() => setData(fallback));
  }, []);

  const chartData = (data.phase_distribution || []).map((item) => ({ name: item.label || "Unknown", value: Number(item.value || 0) }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        eyebrow="Clinical trial discovery, pre-screening and explainability"
        title="Find meaningful trial pathways from structured data and eligibility criteria."
        description="TrialMatch combines normalized MariaDB records with MongoDB criteria documents to support trial search, patient matching, analytics and database demonstration."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FlaskConical} label="Total trials" value={data.summary?.total_trials} helper="From trial_summary_view" />
        <StatCard icon={Activity} label="Open trials" value={data.summary?.open_trials} helper="Recruiting or upcoming" />
        <StatCard icon={Layers3} label="Criteria chunks" value={data.summary?.total_criteria} helper="Eligibility database depth" />
        <StatCard icon={Bookmark} label="Saved trials" value={data.saved?.saved_count ?? 0} helper="Your tracked trials" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="glass-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Phase distribution</p>
              <h2 className="text-2xl font-bold text-slate-950">Dataset signal</h2>
            </div>
            <Database className="text-blue-700" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="value" strokeWidth={3} fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">Top conditions</p>
              <h2 className="text-2xl font-bold text-slate-950">Strongest dataset areas</h2>
            </div>
            <ShieldCheck className="text-blue-700" />
          </div>
          <div className="space-y-3">
            {(data.top_conditions || []).slice(0, 6).map((condition, index) => (
              <div key={condition.condition_id || condition.condition_name} className="rounded-2xl bg-white/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{condition.condition_name}</p>
                    <p className="mt-1 text-sm text-slate-500">Condition rank #{index + 1}</p>
                  </div>
                  <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{condition.trial_count} trials</p>
                </div>
              </div>
            ))}
            {(data.top_conditions || []).length === 0 && <p className="text-sm text-slate-500">Import your CSV data to populate this section.</p>}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Spotlight trials</p>
            <h2 className="text-2xl font-bold text-slate-950">High-information records</h2>
          </div>
          <Link to="/trials" className="secondary-button"><Search size={16} />View all</Link>
        </div>
        {(data.spotlight_trials || []).length === 0 && <div className="rounded-3xl bg-white/80 p-6 text-slate-500">No trials loaded yet.</div>}
        {(data.spotlight_trials || []).slice(0, 3).map((trial) => <TrialCard key={trial.trial_id} trial={trial} />)}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link className="glass-card rounded-3xl p-6 transition hover:-translate-y-1" to="/trials">
          <Search className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Discover Trials</h3>
          <p className="mt-2 text-sm text-slate-500">Search by condition, age, sex, phase and eligibility keyword.</p>
        </Link>
        <Link className="glass-card rounded-3xl p-6 transition hover:-translate-y-1" to="/patients">
          <UserRoundSearch className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Run Patient Match</h3>
          <p className="mt-2 text-sm text-slate-500">Create demo patient profiles and generate match explanations.</p>
        </Link>
        <Link className="glass-card rounded-3xl p-6 transition hover:-translate-y-1" to="/database-demo">
          <Database className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Database Demo</h3>
          <p className="mt-2 text-sm text-slate-500">Show tables, views, nested queries and MongoDB documents.</p>
        </Link>
      </section>
    </div>
  );
}
