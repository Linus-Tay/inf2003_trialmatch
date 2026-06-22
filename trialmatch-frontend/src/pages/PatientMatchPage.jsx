import {
  Activity,
  Check,
  ChevronDown,
  Plus,
  Search,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createPatientProfile,
  fetchLookups,
  generateMatches,
  listPatientProfiles,
  searchConditions,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

export default function PatientMatchPage() {
  const [lookups, setLookups] = useState({ sexes: [] });
  const [conditionOptions, setConditionOptions] = useState([]);
  const [conditionSearch, setConditionSearch] = useState("");
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState({
    profile_name: "",
    age: "",
    sex_id: "",
    condition_ids: [],
    notes: "",
  });

  useEffect(() => {
    fetchLookups().then(setLookups);
    searchConditions("").then(setConditionOptions);
    listPatientProfiles().then(setProfiles);
  }, []);

  const filteredConditions = useMemo(() => {
    const keyword = conditionSearch.trim().toLowerCase();

    if (!keyword) return conditionOptions.slice(0, 80);

    return conditionOptions
      .filter((condition) =>
        condition.condition_name.toLowerCase().includes(keyword)
      )
      .slice(0, 80);
  }, [conditionOptions, conditionSearch]);

  const selectedConditions = useMemo(() => {
    return conditionOptions.filter((condition) =>
      form.condition_ids.includes(condition.condition_id)
    );
  }, [conditionOptions, form.condition_ids]);

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

    const created = await createPatientProfile({
      ...form,
      age: Number(form.age),
      sex_id: Number(form.sex_id),
    });

    setProfiles(await listPatientProfiles());
    setSelectedProfileId(String(created.patient_profile_id));

    setForm({
      profile_name: "",
      age: "",
      sex_id: "",
      condition_ids: [],
      notes: "",
    });

    setConditionSearch("");
  }

  async function handleMatch() {
    if (!selectedProfileId) return;

    const data = await generateMatches(selectedProfileId);
    setMatches(data.matches || []);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserRoundSearch}
        eyebrow="Patient Pre-Screening and Matching"
        title="Create demo patient profiles and generate trial matches."
        description="Structured age, sex and condition checks happen in SQL. Flexible explanations are stored in MongoDB."
      />

      <section className="grid items-start gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">
                New patient profile
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add a demo patient and select relevant conditions.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <input
              className="form-input"
              name="profile_name"
              placeholder="Profile name"
              value={form.profile_name}
              onChange={updateField}
              required
            />

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
                {lookups.sexes.map((sex) => (
                  <option key={sex.sex_id} value={sex.sex_id}>
                    {sex.sex_name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              className="form-input min-h-24 resize-none"
              name="notes"
              placeholder="Optional notes"
              value={form.notes}
              onChange={updateField}
            />

            <div className="rounded-[1.5rem] border border-slate-200 bg-white/70 p-4 shadow-sm">
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
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
              </div>

              <div className="relative mb-3">
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
                <div className="mb-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-2xl bg-blue-50/70 p-3">
                  {selectedConditions.map((condition) => (
                    <button
                      key={condition.condition_id}
                      type="button"
                      onClick={() => toggleCondition(condition.condition_id)}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      {condition.condition_name}
                      <X size={13} />
                    </button>
                  ))}
                </div>
              )}

              <div className="max-h-72 min-h-40 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                {filteredConditions.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm font-medium text-slate-400">
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
                          className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                            selected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          <span className="line-clamp-2">
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

              <p className="mt-2 text-xs text-slate-400">
                Showing max 80 results. Search to narrow the list.
              </p>
            </div>

            <button className="primary-button w-full">
              <Plus size={18} />
              Create profile
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-[2rem] p-5 sm:p-6">
            <h2 className="text-2xl font-bold text-slate-950">Run matching</h2>

            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <select
                  className="form-input appearance-none pr-11"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                >
                  <option value="">Select profile</option>
                  {profiles.map((profile) => (
                    <option
                      key={profile.patient_profile_id}
                      value={profile.patient_profile_id}
                    >
                      {profile.profile_name} · {profile.age} ·{" "}
                      {profile.sex_name}
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
                className="primary-button min-w-44"
                disabled={!selectedProfileId}
              >
                <Activity size={18} />
                Match
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {matches.length === 0 && (
              <div className="rounded-3xl bg-white/70 p-6 text-slate-500">
                Create/select a patient profile, then run matching.
              </div>
            )}

            {matches.map((match) => (
              <article
                key={match.match_id}
                className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                        {match.match_status}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {match.status_name}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-950">
                      {match.brief_title}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {match.nct_id}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-950 px-5 py-4 text-center text-white">
                    <p className="text-xs text-slate-300">Score</p>
                    <p className="text-3xl font-bold">{match.match_score}%</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}