import {
  Activity,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Plus,
  Search,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  createPatientProfile,
  fetchLookups,
  generateMatches,
  getSavedTrials,
  listPatientProfiles,
  saveTrial,
  searchConditions,
  unsaveTrial,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

export default function PatientMatchPage() {
  const [lookups, setLookups] = useState({ sexes: [] });
  const [conditionOptions, setConditionOptions] = useState([]);
  const [conditionSearch, setConditionSearch] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [matches, setMatches] = useState([]);
  const [savedTrialIds, setSavedTrialIds] = useState(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [savingTrialId, setSavingTrialId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    profile_name: "",
    age: "",
    sex_id: "",
    condition_ids: [],
    notes: "",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const [lookupData, conditionData, profileData, savedTrials] =
          await Promise.all([
            fetchLookups(),
            searchConditions(""),
            listPatientProfiles(),
            getSavedTrials(),
          ]);

        if (!active) return;

        setLookups(lookupData || { sexes: [] });
        setConditionOptions(conditionData || []);
        setProfiles(profileData || []);
        setSavedTrialIds(new Set((savedTrials || []).map((trial) => trial.trial_id)));
      } catch {
        if (!active) return;
        setError("Unable to load patient matching data.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const filteredConditions = useMemo(() => {
    const keyword = conditionSearch.trim().toLowerCase();

    if (!keyword) return conditionOptions.slice(0, 80);

    return conditionOptions
      .filter((condition) =>
        String(condition.condition_name || "")
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 80);
  }, [conditionOptions, conditionSearch]);

  const selectedConditions = useMemo(() => {
    return conditionOptions.filter((condition) =>
      form.condition_ids.includes(condition.condition_id)
    );
  }, [conditionOptions, form.condition_ids]);

  const selectedProfile = useMemo(() => {
    return profiles.find((profile) => {
      return String(profile.patient_profile_id) === String(selectedProfileId);
    });
  }, [profiles, selectedProfileId]);

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function toggleCondition(conditionId) {
    setForm((current) => {
      const exists = current.condition_ids.includes(conditionId);

      return {
        ...current,
        condition_ids: exists
          ? current.condition_ids.filter((id) => id !== conditionId)
          : [...current.condition_ids, conditionId],
      };
    });
  }

  function clearSelectedConditions() {
    setForm((current) => ({
      ...current,
      condition_ids: [],
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    setIsCreating(true);
    setError("");
    setMessage("");

    try {
      const created = await createPatientProfile({
        ...form,
        age: Number(form.age),
        sex_id: Number(form.sex_id),
      });

      const updatedProfiles = await listPatientProfiles();
      setProfiles(updatedProfiles || []);

      const createdProfileId =
        created?.patient_profile_id ||
        created?.profile_id ||
        created?.profile?.patient_profile_id ||
        created?.patient_profile?.patient_profile_id;

      if (createdProfileId) {
        setSelectedProfileId(String(createdProfileId));
      }

      setMatches([]);
      setMessage("Patient profile created. You can now run matching.");

      setForm({
        profile_name: "",
        age: "",
        sex_id: "",
        condition_ids: [],
        notes: "",
      });

      setConditionSearch("");
    } catch {
      setError("Unable to create patient profile.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleMatch() {
    if (!selectedProfileId) return;

    setIsMatching(true);
    setError("");
    setMessage("");

    try {
      const data = await generateMatches(selectedProfileId);
      const generatedMatches = data.matches || [];

      setMatches(generatedMatches);
      setMessage(`Generated ${generatedMatches.length} trial match result(s).`);
    } catch {
      setError("Unable to generate matches.");
    } finally {
      setIsMatching(false);
    }
  }

  function handleProfileChange(event) {
    setSelectedProfileId(event.target.value);
    setMatches([]);
    setMessage("");
  }

  async function handleToggleSavedTrial(trialId) {
    if (!trialId) return;

    setSavingTrialId(trialId);
    setError("");
    setMessage("");

    try {
      const isSaved = savedTrialIds.has(trialId);

      if (isSaved) {
        await unsaveTrial(trialId);
        setSavedTrialIds((current) => {
          const next = new Set(current);
          next.delete(trialId);
          return next;
        });
        setMessage("Trial removed from saved list.");
      } else {
        await saveTrial(trialId);
        setSavedTrialIds((current) => new Set([...current, trialId]));
        setMessage("Trial saved. You can review its status and notes in Saved Trials.");
      }
    } catch {
      setError("Unable to update saved trial status.");
    } finally {
      setSavingTrialId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRoundSearch}
        eyebrow="Patient Matching"
        title="Match patients to relevant trials"
        description="Create patient profiles, run structured trial matching, and save useful trial results for review."
      />

      {error && (
        <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="grid items-stretch gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card flex min-w-0 flex-col rounded-[2rem] p-5 sm:p-6 xl:h-[820px]">
          <div className="shrink-0">
            <h2 className="text-2xl font-bold text-slate-950">
              New patient profile
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a demo patient and select relevant conditions.
            </p>
          </div>

          <form onSubmit={handleCreate} className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
            <input
              className="form-input"
              name="profile_name"
              placeholder="Profile name"
              value={form.profile_name}
              onChange={updateField}
              required
            />

            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="form-input"
                name="age"
                type="number"
                min="0"
                max="120"
                placeholder="Age"
                value={form.age}
                onChange={updateField}
                required
              />

              <div className="relative">
                <select
                  className="form-input appearance-none pr-11"
                  name="sex_id"
                  value={form.sex_id}
                  onChange={updateField}
                  required
                >
                  <option value="">Select sex</option>
                  {(lookups.sexes || []).map((sex) => (
                    <option key={sex.sex_id} value={sex.sex_id}>
                      {sex.sex_name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            <textarea
              className="form-input min-h-16 resize-none"
              name="notes"
              placeholder="Optional patient notes"
              value={form.notes}
              onChange={updateField}
            />

            <div className="flex min-h-0 flex-1 flex-col rounded-[1.5rem] border border-slate-200 bg-white/70 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Select conditions
                  </p>
                  <p className="text-xs text-slate-500">
                    {form.condition_ids.length} selected
                  </p>
                </div>

                {form.condition_ids.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSelectedConditions}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
              </div>

              <div className="relative mb-3 shrink-0">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Search conditions..."
                  value={conditionSearch}
                  onChange={(event) => setConditionSearch(event.target.value)}
                />

                {conditionSearch && (
                  <button
                    type="button"
                    onClick={() => setConditionSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {selectedConditions.length > 0 && (
                <div className="mb-3 flex max-h-14 shrink-0 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-blue-50/70 p-2">
                  {selectedConditions.map((condition) => (
                    <button
                      key={condition.condition_id}
                      type="button"
                      onClick={() => toggleCondition(condition.condition_id)}
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      <span className="truncate">
                        {condition.condition_name}
                      </span>
                      <X size={13} className="shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                {isLoading ? (
                  <div className="flex h-full min-h-28 items-center justify-center text-sm font-medium text-slate-400">
                    Loading conditions...
                  </div>
                ) : filteredConditions.length === 0 ? (
                  <div className="flex h-full min-h-28 items-center justify-center text-sm font-medium text-slate-400">
                    No conditions found.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredConditions.map((condition) => {
                      const selected = form.condition_ids.includes(
                        condition.condition_id
                      );

                      return (
                        <button
                          key={condition.condition_id}
                          type="button"
                          onClick={() => toggleCondition(condition.condition_id)}
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                            selected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <span className="line-clamp-1 min-w-0 break-words">
                            {condition.condition_name}
                          </span>

                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                              selected
                                ? "border-white/40 bg-white/20"
                                : "border-slate-300 bg-slate-50"
                            }`}
                          >
                            {selected && <Check size={13} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="mt-2 shrink-0 text-xs text-slate-400">
                Showing max 80 results. Search to narrow the list.
              </p>
            </div>

            <button
              className="primary-button w-full shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
            >
              <Plus size={18} />
              {isCreating ? "Creating..." : "Create profile"}
            </button>
          </form>
        </div>

        <aside className="glass-card flex min-w-0 flex-col overflow-hidden rounded-[2rem] xl:h-[820px]">
          <div className="shrink-0 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Run matching
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Select a patient profile and generate trial recommendations.
                </p>
              </div>

              {matches.length > 0 && (
                <span className="w-fit shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {matches.length} result{matches.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <select
                  className="form-input appearance-none pr-11"
                  value={selectedProfileId}
                  onChange={handleProfileChange}
                >
                  <option value="">Select profile</option>
                  {profiles.map((profile) => (
                    <option
                      key={profile.patient_profile_id}
                      value={profile.patient_profile_id}
                    >
                      {profile.profile_name} · {profile.age} · {profile.sex_name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              <button
                onClick={handleMatch}
                className="primary-button min-w-44 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!selectedProfileId || isMatching}
              >
                <Activity size={18} />
                {isMatching ? "Matching..." : "Match"}
              </button>
            </div>

            {selectedProfile && (
              <div className="mt-4 rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <span className="font-bold text-slate-800">
                  Selected profile:
                </span>{" "}
                {selectedProfile.profile_name} · {selectedProfile.age} · {selectedProfile.sex_name}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {matches.length === 0 ? (
              <div className="flex h-full min-h-56 items-center justify-center text-center">
                <div>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
                    <UserRoundSearch size={24} />
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-slate-950">
                    No matches yet
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Create or select a patient profile, then run matching.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match, index) => (
                  <MatchCard
                    key={match.match_id || `${match.trial_id}-${index}`}
                    match={match}
                    isSaved={savedTrialIds.has(match.trial_id)}
                    isSaving={savingTrialId === match.trial_id}
                    onToggleSavedTrial={handleToggleSavedTrial}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function MatchCard({ match, isSaved, isSaving, onToggleSavedTrial }) {
  const trialId = match.trial_id;
  const canViewTrial = trialId !== null && trialId !== undefined && trialId !== "";

  return (
    <article className="min-w-0 rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            <StatusBadge status={match.match_status} />

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {match.status_name || "Unknown status"}
            </span>

            {match.phase_name && (
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                {match.phase_name}
              </span>
            )}
          </div>

          <h3 className="line-clamp-3 break-words text-lg font-bold leading-6 text-slate-950">
            {match.brief_title || "Untitled trial"}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{match.nct_id || "No NCT ID"}</span>
            <span>•</span>
            <span>{match.matched_condition_count ?? 0} matched condition(s)</span>
          </div>

          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
            {buildMatchSummary(match)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {canViewTrial ? (
              <Link
                to={`/trials/${trialId}`}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <ExternalLink size={16} />
                View trial
              </Link>
            ) : (
              <span className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-400">
                View unavailable
              </span>
            )}

            <button
              type="button"
              onClick={() => onToggleSavedTrial(trialId)}
              disabled={!trialId || isSaving}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSaved
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {isSaving ? "Saving..." : isSaved ? "Saved" : "Save match"}
            </button>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-36 lg:grid-cols-1">
          <div className="rounded-3xl bg-slate-950 px-4 py-4 text-center text-white">
            <p className="text-xs text-slate-300">Score</p>
            <p className="text-3xl font-bold">{formatScore(match.match_score)}</p>
          </div>

          <div className="rounded-3xl bg-slate-50 px-4 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Match ID</p>
            <p className="mt-1 text-lg font-bold text-slate-800">{match.match_id || "—"}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("potential")) {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        {status}
      </span>
    );
  }

  if (normalized.includes("not")) {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        {status}
      </span>
    );
  }

  if (normalized.includes("review")) {
    return (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
        {status}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
      {status || "Match"}
    </span>
  );
}

function buildMatchSummary(match) {
  const score = formatScore(match.match_score);
  const conditionCount = Number(match.matched_condition_count || 0);
  const status = String(match.match_status || "").toLowerCase();

  if (status.includes("not")) {
    return `This trial is currently not suitable based on the available structured checks. Score: ${score}.`;
  }

  if (status.includes("review") || match.criteria_review_required) {
    return `This trial may be relevant, but the eligibility criteria should be reviewed before deciding. Score: ${score}.`;
  }

  if (conditionCount > 0) {
    return `This trial matched ${conditionCount} condition link(s) and passed the available structured checks. Score: ${score}.`;
  }

  return `This result was generated from the patient profile and structured trial eligibility fields. Score: ${score}.`;
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "—";

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return value;

  return `${Math.round(numberValue)}%`;
}
