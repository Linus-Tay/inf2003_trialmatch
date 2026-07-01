import { Bookmark, Eye, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { deleteSavedTrial, getSavedTrials, updateSavedTrial } from "../api/modules";
import PageHeader from "../components/PageHeader";

const statusOptions = ["Saved", "Interested", "Potential Match", "Needs Review", "Not Suitable"];

export default function SavedTrialsPage() {
  const [savedTrials, setSavedTrials] = useState([]);
  const [message, setMessage] = useState("");

  async function load() {
    setSavedTrials(await getSavedTrials());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusChange(savedTrialId, savedStatus, notes) {
    await updateSavedTrial(savedTrialId, { saved_status: savedStatus, notes });
    setMessage("Saved trial updated.");
    load();
  }

  async function handleDelete(savedTrialId) {
    await deleteSavedTrial(savedTrialId);
    setMessage("Saved trial removed.");
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bookmark}
        eyebrow="Saved Trials"
        title="Manage saved trials"
        description="Track shortlisted trials, review status and notes."
      />
      
      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <section className="grid gap-4">
        {savedTrials.length === 0 && (
          <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
            No saved trials yet. Go to Trial Search and save one.
          </div>
        )}

        {savedTrials.map((trial) => (
          <SavedTrialCard key={trial.saved_trial_id} trial={trial} onUpdate={handleStatusChange} onDelete={handleDelete} />
        ))}
      </section>
    </div>
  );
}

function SavedTrialCard({ trial, onUpdate, onDelete }) {
  const [status, setStatus] = useState(trial.saved_status || "Saved");
  const [notes, setNotes] = useState(trial.notes || "");

  const trialRouteId = trial.trial_id ?? trial.nct_id;

  return (
    <article className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {trial.saved_status}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {trial.status_name}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {trial.phase_name || "Unknown phase"}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-500">
            {trial.nct_id}
          </p>

          <h3 className="mt-1 line-clamp-3 text-lg font-bold text-slate-950">
            {trial.brief_title}
          </h3>

          <div className="mt-5">
            <Link
              to={`/trials/${trialRouteId}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Eye size={16} />
              View trial
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <select
            className="form-input"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {statusOptions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <textarea
            className="form-input min-h-24 resize-none"
            placeholder="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={() => onUpdate(trial.saved_trial_id, status, notes)}
              className="primary-button flex-1"
            >
              <Save size={16} />
              Update
            </button>

            <button
              onClick={() => onDelete(trial.saved_trial_id)}
              className="secondary-button text-red-700 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
