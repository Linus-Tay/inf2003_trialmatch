import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchClinicalAnalytics } from "../api/modules";
import PageHeader from "../components/PageHeader";

export default function AnalyticsPage() {
  const [data, setData] = useState({ statuses: [], phases: [], study_types: [], sexes: [], age_buckets: [] });

  useEffect(() => { fetchClinicalAnalytics().then(setData); }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        eyebrow="Clinical Trial Analytics Dashboard"
        title="Visualise recruitment status, phase, study type, age and sex eligibility."
        description="This page turns SQL GROUP BY queries and views into chart-ready API results."
      />
      <ChartPanel title="Trial status" data={data.statuses} />
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartPanel title="Trial phase" data={data.phases} />
        <ChartPanel title="Study type" data={data.study_types} />
        <ChartPanel title="Sex eligibility" data={data.sexes} />
        <ChartPanel title="Age bucket" data={data.age_buckets} />
      </div>
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
