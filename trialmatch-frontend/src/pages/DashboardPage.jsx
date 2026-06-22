import {
  Activity,
  Bookmark,
  Database,
  FlaskConical,
  Layers3,
  Search,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";

import { fetchDashboardOverview } from "../api/modules";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import TrialCard from "../components/TrialCard";

const fallback = {
  summary: {},
  saved: {},
  phase_distribution: [],
  top_conditions: [],
  spotlight_trials: [],
};

const phaseOrder = [
  "Early Phase 1",
  "Phase 1",
  "Phase 1/Phase 2",
  "Phase 2",
  "Phase 2/Phase 3",
  "Phase 3",
  "Phase 4",
];

const hiddenPhaseLabels = new Set([
  "",
  "Unknown",
  "N/A",
  "NA",
  "Not Applicable",
]);

export default function DashboardPage() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    fetchDashboardOverview()
      .then(setData)
      .catch(() => setData(fallback));
  }, []);

  const chartData = (data.phase_distribution || [])
    .map((item) => ({
      name: item.label || "Unknown",
      value: Number(item.value || 0),
    }))
    .filter((item) => !hiddenPhaseLabels.has(item.name))
    .sort((a, b) => {
      const aIndex = phaseOrder.indexOf(a.name);
      const bIndex = phaseOrder.indexOf(b.name);

      if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        eyebrow="Clinical trial discovery, pre-screening and explainability"
        title="Find meaningful trial pathways from structured data and eligibility criteria."
        description="TrialMatch combines normalized MariaDB records with MongoDB criteria documents to support trial search, patient matching, analytics and database demonstration."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FlaskConical}
          label="Total trials"
          value={data.summary?.total_trials}
        />
        <StatCard
          icon={Activity}
          label="Open trials"
          value={data.summary?.open_trials}
        />
        <StatCard
          icon={Layers3}
          label="Criteria Attributes"
          value={data.summary?.total_criteria}
        />
        <StatCard
          icon={Bookmark}
          label="Saved trials"
          value={data.saved?.saved_count ?? 0}
        />
      </section>

      <section className="grid items-stretch gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card flex min-h-[560px] flex-col rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Phase distribution
              </p>
              <h2 className="text-2xl font-bold text-slate-950">
                Dataset signal
              </h2>
            </div>
          </div>

          <div className="min-h-[460px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">
                Top conditions
              </p>
              <h2 className="text-2xl font-bold text-slate-950">
                Strongest dataset areas
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {(data.top_conditions || []).slice(0, 6).map((condition, index) => (
              <div
                key={condition.condition_id || condition.condition_name}
                className="rounded-2xl bg-white/70 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {condition.condition_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Condition rank #{index + 1}
                    </p>
                  </div>
                  <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                    {condition.trial_count} trials
                  </p>
                </div>
              </div>
            ))}

            {(data.top_conditions || []).length === 0 && (
              <p className="text-sm text-slate-500">
                Import your CSV data to populate this section.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Spotlight trials
            </p>
            <h2 className="text-2xl font-bold text-slate-950">
              High-information records
            </h2>
          </div>

          <Link to="/trials" className="secondary-button">
            <Search size={16} />
            View all
          </Link>
        </div>

        {(data.spotlight_trials || []).length === 0 && (
          <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
            No trials loaded yet.
          </div>
        )}

        {(data.spotlight_trials || [])
          .slice(0, 3)
          .map((trial) => <TrialCard key={trial.trial_id} trial={trial} />)}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          className="glass-card rounded-3xl p-6 transition hover:-translate-y-1"
          to="/trials"
        >
          <Search className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Discover Trials</h3>
          <p className="mt-2 text-sm text-slate-500">
            Search by condition, age, sex, phase and eligibility keyword.
          </p>
        </Link>

        <Link
          className="glass-card rounded-3xl p-6 transition hover:-translate-y-1"
          to="/patients"
        >
          <UserRoundSearch className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Run Patient Match</h3>
          <p className="mt-2 text-sm text-slate-500">
            Create demo patient profiles and generate match explanations.
          </p>
        </Link>

        <Link
          className="glass-card rounded-3xl p-6 transition hover:-translate-y-1"
          to="/database-demo"
        >
          <Database className="text-blue-700" />
          <h3 className="mt-4 font-bold text-slate-950">Database Demo</h3>
          <p className="mt-2 text-sm text-slate-500">
            Show tables, views, nested queries and MongoDB documents.
          </p>
        </Link>
      </section>
    </div>
  );
}