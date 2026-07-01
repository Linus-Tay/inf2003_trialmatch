import { LineChart } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchCriteriaAnalytics } from "../api/modules";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

export default function CriteriaAnalyticsPage() {
  const [data, setData] = useState({ overview: {}, complexity_by_phase: [], strict_trials: [], criteria_types: [] });

  useEffect(() => { fetchCriteriaAnalytics().then(setData); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LineChart}
        eyebrow="Criteria Insights"
        title="Eligibility criteria analytics"
        description="Analyse criteria complexity, strictness and review signals."
      />

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Inclusion" value={data.overview?.inclusion_count} />
        <StatCard label="Exclusion" value={data.overview?.exclusion_count} />
        <StatCard label="Avg complexity" value={data.overview?.avg_complexity} />
        <StatCard label="Manual review" value={data.overview?.manual_review_count} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="Complexity by phase" data={data.complexity_by_phase} />
        <ChartPanel title="Criteria type distribution" data={data.criteria_types} />
      </section>

      <section className="glass-card rounded-[2rem] p-6">
        <h2 className="mb-5 text-xl font-bold text-slate-950">Strict / complex trials</h2>
        <div className="space-y-3">
          {(data.strict_trials || []).map((trial) => (
            <div key={trial.trial_id} className="rounded-2xl bg-white/75 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="md:w-10/12">
                  <p className="text-sm text-slate-500">{trial.nct_id}</p>
                  <p className="font-semibold text-slate-950">{trial.brief_title}</p>
                </div>
                <p className="rounded-full md:w-2/12 text-center bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">Complexity {trial.avg_complexity_score}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, data }) {
  const chartData = (data || []).map((item) => ({ name: item.label || "Unknown", value: Number(item.value || 0) }));
  return (
    <section className="glass-card rounded-[2rem] p-6">
      <h2 className="mb-5 text-xl font-bold text-slate-950">{title}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
