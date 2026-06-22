import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Info,
  ScrollText,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getTrialDetail, saveTrial, unsaveTrial } from "../api/modules";

export default function TrialDetailPage() {
  const { trialId } = useParams();

  const [data, setData] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    setData(null);
    setError("");
    setActionMessage("");

    getTrialDetail(trialId)
      .then((detail) => {
        if (!active) return;

        setData(detail);
        setIsSaved(Boolean(detail.saved));
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load this trial.");
      });

    return () => {
      active = false;
    };
  }, [trialId]);

  async function handleSaveToggle() {
    if (!data?.trial?.trial_id || isSaving) return;

    setIsSaving(true);
    setActionMessage("");

    try {
      if (isSaved) {
        await unsaveTrial(data.trial.trial_id);
        setIsSaved(false);
        setActionMessage("Trial removed from saved list.");
      } else {
        await saveTrial(data.trial.trial_id);
        setIsSaved(true);
        setActionMessage("Trial saved.");
      }
    } catch {
      setActionMessage("Unable to update saved status.");
    } finally {
      setIsSaving(false);
    }
  }

  const criteriaGroups = useMemo(() => {
    return groupCriteria(data?.criteria || []);
  }, [data]);

  if (error) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
        Loading trial...
      </div>
    );
  }

  const {
    trial,
    conditions = [],
    interventions = [],
    criteria = [],
    mongo = {},
  } = data;

  const sourceUrl = trial.source_url?.trim();
  const parsedPreview = mongo?.parsed_criteria_preview;
  const rawTrace = mongo?.raw_trace;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/trials" className="secondary-button w-fit">
          <ArrowLeft size={16} />
          Back to trials
        </Link>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveToggle}
            disabled={isSaving}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              isSaved
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            {isSaving ? "Updating..." : isSaved ? "Saved" : "Save trial"}
          </button>

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink size={18} />
              Source
            </a>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-3xl border border-white/60 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-600">
          {actionMessage}
        </div>
      )}

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-glow sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge>{trial.status_name}</Badge>
            <Badge>{trial.phase_name || "Not applicable"}</Badge>
            <Badge>{trial.study_type_name || "Unknown study type"}</Badge>
            <Badge>{trial.sex_name || "All sexes"}</Badge>
            <Badge>{formatHealthyVolunteers(trial.healthy_volunteers)}</Badge>
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-200">
              {trial.nct_id || "No NCT ID"}
            </p>

            <h1 className="mt-3 max-w-5xl text-2xl font-bold leading-tight md:text-4xl">
              {trial.brief_title || "Untitled trial"}
            </h1>

            {trial.official_title && trial.official_title !== trial.brief_title && (
              <p className="mt-3 max-w-5xl text-sm font-medium leading-6 text-slate-300">
                {trial.official_title}
              </p>
            )}

            <p className="mt-5 max-w-5xl text-sm leading-7 text-slate-300">
              {trial.brief_summary ||
                "No summary available from imported dataset."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HeroMeta
              label="Age range"
              value={formatAgeRange(trial.minimum_age, trial.maximum_age)}
            />
            <HeroMeta label="Recruitment" value={trial.status_name || "Unknown"} />
            <HeroMeta label="Phase" value={trial.phase_name || "Not applicable"} />
            <HeroMeta label="Manual review" value={trial.manual_review_count ?? 0} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Criteria" value={trial.total_criteria ?? 0} />
        <Metric label="Inclusion" value={trial.inclusion_count ?? 0} />
        <Metric label="Exclusion" value={trial.exclusion_count ?? 0} />
        <Metric label="Avg complexity" value={formatScore(trial.avg_complexity_score)} />
        <Metric
          label="Healthy volunteers"
          value={formatHealthyVolunteersShort(trial.healthy_volunteers)}
        />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Conditions"
            icon={CheckCircle2}
            helper={`${conditions.length} linked condition record${conditions.length === 1 ? "" : "s"}`}
          >
            {conditions.length === 0 ? (
              <EmptyText>No conditions linked to this trial.</EmptyText>
            ) : (
              <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
                {conditions.map((item) => (
                  <span
                    key={item.condition_id}
                    className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700"
                  >
                    {item.condition_name}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Interventions"
            icon={FileText}
            helper={`${interventions.length} linked intervention record${interventions.length === 1 ? "" : "s"}`}
          >
            {interventions.length === 0 ? (
              <EmptyText>No interventions linked to this trial.</EmptyText>
            ) : (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {interventions.map((item) => (
                  <div
                    key={item.intervention_id}
                    className="rounded-2xl bg-slate-50 p-3 text-sm font-medium text-slate-700"
                  >
                    {item.intervention_name}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="MongoDB trace"
            icon={Database}
            helper="Useful for showing NoSQL evidence in your demo, but kept collapsed so it does not dominate the page."
          >
            <div className="min-w-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <TraceItem
                  label="Parsed document"
                  value={parsedPreview ? "Available" : "Not available"}
                />
                <TraceItem
                  label="Raw import trace"
                  value={rawTrace ? "Available" : "Not available"}
                />
                <TraceItem
                  label="Trial ID"
                  value={parsedPreview?.trial_id ?? rawTrace?.trial_id ?? trial.trial_id}
                />
                <TraceItem
                  label="NCT ID"
                  value={parsedPreview?.nct_id ?? trial.nct_id ?? "Not applicable"}
                />
              </div>

              <details className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-emerald-300">
                  View document preview
                </summary>

                <pre className="max-h-[320px] max-w-full overflow-auto whitespace-pre-wrap break-words border-t border-white/10 p-4 text-xs leading-6 [overflow-wrap:anywhere]">
                  {JSON.stringify(mongo, null, 2)}
                </pre>
              </details>
            </div>
          </Panel>
        </div>

        <Panel
          title="Eligibility criteria"
          icon={ScrollText}
          helper={`${criteria.length} imported criteria items shown. Grouped by database criteria type. Scroll inside this panel.`}
          fullHeight
        >
          <div className="mb-4 rounded-3xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            <span className="font-bold">Complexity score</span> is a database demo metric:
            it is based on criteria text length divided by 20, capped at 99.99.
            Higher means the rule text is longer or more complex. It is not a medical risk score.
          </div>

          {criteria.length === 0 ? (
            <EmptyText>No eligibility criteria found for this trial.</EmptyText>
          ) : (
            <div className="max-h-[760px] space-y-5 overflow-y-auto pr-2">
              {criteriaGroups.map((group) => (
                <CriteriaGroup key={group.type} group={group} />
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
      {children || "Unknown"}
    </span>
  );
}

function HeroMeta({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="glass-card rounded-3xl p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Panel({ title, helper, icon: Icon = Info, children, fullHeight = false }) {
  return (
    <section
      className={`glass-card min-w-0 rounded-[2rem] p-5 sm:p-6 ${
        fullHeight ? "xl:h-full" : ""
      }`}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-950">{title}</h2>
          {helper && <p className="mt-1 text-sm text-slate-500">{helper}</p>}
        </div>
      </div>

      {children}
    </section>
  );
}

function CriteriaGroup({ group }) {
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-950">{group.type} criteria</h3>
          <span className={getTypeBadgeClass(group.type)}>
            {group.items.length} item{group.items.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {group.items.map((item) => (
        <CriteriaCard key={item.criteria_id} item={item} />
      ))}
    </div>
  );
}

function CriteriaCard({ item }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
          Rule #{item.criteria_order ?? "—"}
        </span>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
          Text complexity {formatScore(item.complexity_score)}
        </span>
      </div>

      <p className="break-words text-sm leading-7 text-slate-700">
        {item.criteria_text || "No criteria text available."}
      </p>
    </article>
  );
}

function TraceItem({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function EmptyText({ children }) {
  return (
    <div className="rounded-3xl bg-white/70 p-5 text-sm text-slate-500">
      {children}
    </div>
  );
}

function groupCriteria(criteria) {
  const groups = {
    Inclusion: [],
    Exclusion: [],
    General: [],
  };

  criteria.forEach((item) => {
    const type = normaliseCriteriaType(item.criteria_type);
    groups[type].push(item);
  });

  return ["Inclusion", "Exclusion", "General"]
    .map((type) => ({
      type,
      items: groups[type].sort((a, b) => {
        return Number(a.criteria_order || 0) - Number(b.criteria_order || 0);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

function normaliseCriteriaType(value) {
  const type = String(value || "").trim().toLowerCase();

  if (type.includes("inclusion")) return "Inclusion";
  if (type.includes("exclusion")) return "Exclusion";

  return "General";
}

function getTypeBadgeClass(type) {
  if (type === "Inclusion") {
    return "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700";
  }

  if (type === "Exclusion") {
    return "rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700";
  }

  return "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600";
}

function formatHealthyVolunteers(value) {
  if (value === true || value === 1) return "Healthy volunteers accepted";
  if (value === false || value === 0) return "Patients only";
  return "Unknown volunteer status";
}

function formatHealthyVolunteersShort(value) {
  if (value === true || value === 1) return "Yes";
  if (value === false || value === 0) return "No";
  return "Not applicable";
}

function formatAgeRange(minimumAge, maximumAge) {
  const hasMinimum = minimumAge !== null && minimumAge !== undefined && minimumAge !== "";
  const hasMaximum = maximumAge !== null && maximumAge !== undefined && maximumAge !== "";

  if (hasMinimum && hasMaximum) return `${minimumAge}–${maximumAge}`;
  if (hasMinimum) return `${minimumAge}+`;
  if (hasMaximum) return `Up to ${maximumAge}`;

  return "Not applicable";
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return value;

  return numberValue.toFixed(2);
}