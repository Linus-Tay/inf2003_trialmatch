import { Filter, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchLookups, saveTrial, searchTrials } from "../api/modules";
import PageHeader from "../components/PageHeader";
import TrialCard from "../components/TrialCard";

export default function TrialsPage() {
  const [lookups, setLookups] = useState({ phases: [], statuses: [], sexes: [] });
  const [filters, setFilters] = useState({ q: "", condition: "", keyword: "", status: "", phase: "", sex: "", healthy_volunteers: "" });
  const [results, setResults] = useState({ total: 0, trials: [] });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchLookups().then(setLookups).catch(() => {});
    runSearch();
  }, []);

  function updateField(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function runSearch(event) {
    event?.preventDefault();
    setIsLoading(true);
    try {
      const data = await searchTrials({
        ...filters,
        q: filters.q || undefined,
        condition: filters.condition || undefined,
        keyword: filters.keyword || undefined,
        status: filters.status || undefined,
        phase: filters.phase || undefined,
        sex: filters.sex || undefined,
        healthy_volunteers: filters.healthy_volunteers || undefined,
      });
      setResults(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(trialId) {
    await saveTrial(trialId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Search}
        eyebrow="Trial Search and Discovery"
        title="Search and filter clinical trials."
        description="Uses joins, views, indexes and eligibility criteria search to make the relational schema visible through the UI."
      />

      <section className="glass-card rounded-[2rem] p-6">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600">
          <Filter size={16} />
          {results.total} results
        </div>

        <form onSubmit={runSearch} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input className="form-input xl:col-span-2" name="q" placeholder="Search title or NCT ID" value={filters.q} onChange={updateField} />
          <input className="form-input" name="condition" placeholder="Condition" value={filters.condition} onChange={updateField} />
          <input className="form-input" name="keyword" placeholder="Eligibility keyword" value={filters.keyword} onChange={updateField} />

          <select className="form-input" name="status" value={filters.status} onChange={updateField}>
            <option value="">Any status</option>
            {lookups.statuses.map((item) => <option key={item.status_id} value={item.status_name}>{item.status_name}</option>)}
          </select>

          <select className="form-input" name="phase" value={filters.phase} onChange={updateField}>
            <option value="">Any phase</option>
            {lookups.phases.map((item) => <option key={item.phase_id} value={item.phase_name}>{item.phase_name}</option>)}
          </select>

          <select className="form-input" name="sex" value={filters.sex} onChange={updateField}>
            <option value="">Any sex</option>
            {lookups.sexes.map((item) => <option key={item.sex_id} value={item.sex_name}>{item.sex_name}</option>)}
          </select>

          <select className="form-input" name="healthy_volunteers" value={filters.healthy_volunteers} onChange={updateField}>
            <option value="">Any volunteer type</option>
            <option value="true">Accepts healthy volunteers</option>
            <option value="false">Patients only / condition-specific</option>
          </select>

          <button className="primary-button md:col-span-3 xl:col-span-6" disabled={isLoading}>
            <Search size={18} />
            {isLoading ? "Searching..." : "Run database search"}
          </button>
        </form>
      </section>

      <section className="grid gap-4">
        {isLoading && <div className="rounded-3xl bg-white/80 p-6 text-slate-500">Searching trials...</div>}
        {!isLoading && results.trials.length === 0 && <div className="rounded-3xl bg-white/80 p-6 text-slate-500">No trials found yet. Import your dataset or loosen your filters.</div>}
        {results.trials.map((trial) => <TrialCard key={trial.trial_id} trial={trial} onSave={handleSave} />)}
      </section>
    </div>
  );
}
