import { ArrowLeft, Bookmark, Database, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getTrialDetail, saveTrial } from "../api/modules";

export default function TrialDetailPage() {
  const { trialId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    getTrialDetail(trialId).then(setData);
  }, [trialId]);

  if (!data) {
    return <div className="rounded-3xl bg-white/80 p-6 text-slate-500">Loading trial...</div>;
  }

  const { trial, conditions, interventions, criteria, mongo } = data;

  return (
    <div className="space-y-6">
      <Link to="/trials" className="secondary-button"><ArrowLeft size={16} />Back to trials</Link>

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-glow">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge>{trial.status_name}</Badge>
              <Badge>{trial.phase_name}</Badge>
              <Badge>{trial.study_type_name}</Badge>
              <Badge>{trial.sex_name}</Badge>
            </div>
            <p className="text-sm font-semibold text-blue-200">{trial.nct_id}</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-4xl">{trial.brief_title}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300">{trial.brief_summary || "No summary available from imported dataset."}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveTrial(trial.trial_id)} className="primary-button"><Bookmark size={18} />Save</button>
            {trial.source_url && (
              <a href={trial.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                <ExternalLink size={18} />Source
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Criteria" value={trial.total_criteria ?? 0} />
        <Metric label="Inclusion" value={trial.inclusion_count ?? 0} />
        <Metric label="Exclusion" value={trial.exclusion_count ?? 0} />
        <Metric label="Avg complexity" value={trial.avg_complexity_score ?? "—"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Panel title="Conditions">
            <div className="flex flex-wrap gap-2">
              {conditions.map((item) => <span key={item.condition_id} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{item.condition_name}</span>)}
            </div>
          </Panel>

          <Panel title="Interventions">
            <div className="space-y-2">
              {interventions.slice(0, 12).map((item) => <div key={item.intervention_id} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{item.intervention_name}</div>)}
            </div>
          </Panel>

          <Panel title="MongoDB trace">
            <div className="rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
              <div className="mb-2 flex items-center gap-2 text-emerald-300"><Database size={16} />Document preview</div>
              <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(mongo, null, 2)}</pre>
            </div>
          </Panel>
        </div>

        <Panel title="Eligibility criteria">
          <div className="space-y-3">
            {criteria.map((item) => (
              <div key={item.criteria_id} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.criteria_type}</span>
                  <span className="text-xs text-slate-400">Score {item.complexity_score}</span>
                </div>
                <p className="text-sm leading-7 text-slate-700">{item.criteria_text}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Badge({ children }) {
  return <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">{children || "Unknown"}</span>;
}

function Metric({ label, value }) {
  return <div className="glass-card rounded-3xl p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-950">{value}</p></div>;
}

function Panel({ title, children }) {
  return <section className="glass-card rounded-[2rem] p-6"><h2 className="mb-4 text-xl font-bold text-slate-950">{title}</h2>{children}</section>;
}
