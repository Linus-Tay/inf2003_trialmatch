import { Activity, Plus, UserRoundSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { createPatientProfile, fetchLookups, generateMatches, listPatientProfiles, searchConditions } from "../api/modules";
import PageHeader from "../components/PageHeader";

export default function PatientMatchPage() {
  const [lookups, setLookups] = useState({ sexes: [] });
  const [conditionOptions, setConditionOptions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState({ profile_name: "", age: "", sex_id: "", condition_ids: [], notes: "" });

  useEffect(() => {
    fetchLookups().then(setLookups);
    searchConditions("").then(setConditionOptions);
    listPatientProfiles().then(setProfiles);
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function toggleCondition(conditionId) {
    setForm((current) => {
      const exists = current.condition_ids.includes(conditionId);
      return { ...current, condition_ids: exists ? current.condition_ids.filter((id) => id !== conditionId) : [...current.condition_ids, conditionId] };
    });
  }

  async function handleCreate(event) {
    event.preventDefault();
    const created = await createPatientProfile({ ...form, age: Number(form.age), sex_id: Number(form.sex_id) });
    setProfiles(await listPatientProfiles());
    setSelectedProfileId(String(created.patient_profile_id));
    setForm({ profile_name: "", age: "", sex_id: "", condition_ids: [], notes: "" });
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

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-card rounded-[2rem] p-6">
          <h2 className="text-2xl font-bold text-slate-950">New patient profile</h2>
          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <input className="form-input" name="profile_name" placeholder="Profile name" value={form.profile_name} onChange={updateField} required />
            <input className="form-input" name="age" type="number" min="0" max="120" placeholder="Age" value={form.age} onChange={updateField} required />
            <select className="form-input" name="sex_id" value={form.sex_id} onChange={updateField} required>
              <option value="">Select sex</option>
              {lookups.sexes.map((sex) => <option key={sex.sex_id} value={sex.sex_id}>{sex.sex_name}</option>)}
            </select>
            <textarea className="form-input min-h-24" name="notes" placeholder="Optional notes" value={form.notes} onChange={updateField} />
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">Select conditions</p>
              <div className="flex max-h-64 flex-wrap gap-2 overflow-auto rounded-3xl border border-slate-200 bg-white/60 p-3">
                {conditionOptions.map((condition) => {
                  const selected = form.condition_ids.includes(condition.condition_id);
                  return (
                    <button key={condition.condition_id} type="button" onClick={() => toggleCondition(condition.condition_id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50"}`}>
                      {condition.condition_name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button className="primary-button w-full"><Plus size={18} />Create profile</button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-[2rem] p-6">
            <h2 className="text-2xl font-bold text-slate-950">Run matching</h2>
            <div className="mt-5 flex flex-col gap-3 md:flex-row">
              <select className="form-input" value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
                <option value="">Select profile</option>
                {profiles.map((profile) => <option key={profile.patient_profile_id} value={profile.patient_profile_id}>{profile.profile_name} · {profile.age} · {profile.sex_name}</option>)}
              </select>
              <button onClick={handleMatch} className="primary-button min-w-44" disabled={!selectedProfileId}><Activity size={18} />Match</button>
            </div>
          </div>

          <div className="space-y-3">
            {matches.length === 0 && <div className="rounded-3xl bg-white/70 p-6 text-slate-500">Create/select a patient profile, then run matching.</div>}
            {matches.map((match) => (
              <article key={match.match_id} className="rounded-[1.7rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{match.match_status}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{match.status_name}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-950">{match.brief_title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{match.nct_id}</p>
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
