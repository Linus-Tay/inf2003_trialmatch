import { Bookmark, BookmarkCheck, ChevronRight, CircleDot } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function TrialCard({
  trial,
  onSave,
  isSaved = false,
  isSaving = false,
}) {
  const isOpen = [
    "Recruiting",
    "Not yet recruiting",
    "Enrolling by invitation",
  ].includes(trial.status_name);

  return (
    <motion.article
      whileHover={{ y: -4 }}
      className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-soft"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge active={isOpen}>{trial.status_name || "Unknown"}</Badge>
            <Badge>{trial.phase_name || "Not applicable"}</Badge>
            <Badge>{trial.sex_name || "All"}</Badge>
          </div>

          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950">
            {trial.brief_title || "Untitled trial"}
          </h3>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {trial.nct_id || "No NCT ID"}
          </p>

          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Criteria" value={trial.criteria_count ?? 0} />
            <Meta label="Conditions" value={trial.condition_count ?? 0} />
            <Meta
              label="Age"
              value={formatAgeRange(trial.minimum_age, trial.maximum_age)}
            />
            <Meta
              label="Healthy volunteers"
              value={formatHealthyVolunteers(trial.healthy_volunteers)}
            />
          </div>
        </div>

        <div className="flex gap-2 md:flex-col">
          {onSave && (
            <button
              type="button"
              onClick={() => onSave(trial.trial_id)}
              disabled={isSaving}
              title={isSaved ? "Remove from saved trials" : "Save trial"}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition md:w-32 ${
                isSaved
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isSaved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              {isSaving ? "Updating..." : isSaved ? "Saved" : "Save"}
            </button>
          )}

          <Link
            to={`/trials/${trial.trial_id}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 md:w-32"
          >
            View
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function Badge({ children, active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      <CircleDot size={12} />
      {children}
    </span>
  );
}

function Meta({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function formatAgeRange(minimumAge, maximumAge) {
  const hasMinimum =
    minimumAge !== null && minimumAge !== undefined && minimumAge !== "";
  const hasMaximum =
    maximumAge !== null && maximumAge !== undefined && maximumAge !== "";

  if (hasMinimum && hasMaximum) return `${minimumAge}–${maximumAge}`;
  if (hasMinimum) return `${minimumAge}+`;
  if (hasMaximum) return `Up to ${maximumAge}`;

  return "Not applicable";
}

function formatHealthyVolunteers(value) {
  if (value === true || value === 1) return "Yes";
  if (value === false || value === 0) return "No";
  return "Not applicable";
}