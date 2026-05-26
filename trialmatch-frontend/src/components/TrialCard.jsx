import { Bookmark, ChevronRight, CircleDot } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function TrialCard({ trial, onSave }) {
  const isOpen = ["Recruiting", "Not yet recruiting", "Enrolling by invitation"].includes(trial.status_name);

  return (
    <motion.article whileHover={{ y: -4 }} className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge active={isOpen}>{trial.status_name || "Unknown"}</Badge>
            <Badge>{trial.phase_name || "No phase"}</Badge>
            <Badge>{trial.sex_name || "All"}</Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-950">{trial.brief_title}</h3>
          <p className="mt-2 text-sm text-slate-500">{trial.nct_id}</p>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
            <Meta label="Criteria" value={trial.criteria_count ?? 0} />
            <Meta label="Conditions" value={trial.condition_count ?? 0} />
            <Meta label="Age" value={`${trial.minimum_age ?? "?"}–${trial.maximum_age ?? "?"}`} />
            <Meta label="Healthy volunteers" value={formatHealthyVolunteers(trial.healthy_volunteers)} />
          </div>
        </div>

        <div className="flex gap-2 md:flex-col">
          {onSave && (
            <button onClick={() => onSave(trial.trial_id)} className="rounded-2xl border border-slate-200 p-3 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
              <Bookmark size={18} />
            </button>
          )}
          <Link to={`/trials/${trial.trial_id}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      <CircleDot size={12} />
      {children}
    </span>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function formatHealthyVolunteers(value) {
  if (value === true || value === 1) return "Yes";
  if (value === false || value === 0) return "No";
  return "Unknown";
}
