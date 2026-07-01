import { ChevronLeft, ChevronRight, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchLookups, getSavedTrials, saveTrial, unsaveTrial, searchTrials } from "../api/modules";
import PageHeader from "../components/PageHeader";
import TrialCard from "../components/TrialCard";

const initialFilters = {
  q: "",
  condition: "",
  keyword: "",
  status: "",
  phase: "",
  sex: "",
  healthy_volunteers: "",
};

const pageSizeOptions = [10, 20, 50];

export default function TrialsPage() {
  const [lookups, setLookups] = useState({
    phases: [],
    statuses: [],
    sexes: [],
  });

  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState({ total: 0, limit: 10, offset: 0, trials: [] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [savedTrialIds, setSavedTrialIds] = useState(new Set());
  const [savingTrialIds, setSavingTrialIds] = useState(new Set());

  const totalPages = Math.max(1, Math.ceil((results.total || 0) / pageSize));

  const showingStart = results.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingEnd = Math.min(results.total || 0, page * pageSize);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    for (let current = start; current <= end; current += 1) {
      pages.push(current);
    }

    return pages;
  }, [page, totalPages]);

  useEffect(() => {
    fetchLookups().then(setLookups).catch(() => {});
    loadSavedTrials();
    runSearch(null, { pageValue: 1, pageSizeValue: 10, filtersValue: initialFilters });
  }, []);

  async function loadSavedTrials() {
    try {
      const savedTrials = await getSavedTrials();
      setSavedTrialIds(new Set(savedTrials.map((trial) => trial.trial_id)));
    } catch {
      setSavedTrialIds(new Set());
    }
  }

  function updateField(event) {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function buildSearchParams(currentFilters, currentPage, currentPageSize) {
    return {
      q: currentFilters.q || undefined,
      condition: currentFilters.condition || undefined,
      keyword: currentFilters.keyword || undefined,
      status: currentFilters.status || undefined,
      phase: currentFilters.phase || undefined,
      sex: currentFilters.sex || undefined,
      healthy_volunteers: currentFilters.healthy_volunteers || undefined,
      limit: currentPageSize,
      offset: (currentPage - 1) * currentPageSize,
    };
  }

  async function runSearch(event, options = {}) {
    event?.preventDefault();

    const nextPage = event ? 1 : options.pageValue ?? page;
    const nextPageSize = options.pageSizeValue ?? pageSize;
    const nextFilters = options.filtersValue ?? filters;

    setPage(nextPage);
    setIsLoading(true);

    try {
      const data = await searchTrials(buildSearchParams(nextFilters, nextPage, nextPageSize));
      setResults(data);
    } finally {
      setIsLoading(false);
    }
  }

  async function resetFilters() {
    setFilters(initialFilters);
    setPage(1);

    await runSearch(null, {
      pageValue: 1,
      pageSizeValue: pageSize,
      filtersValue: initialFilters,
    });
  }

  async function changePageSize(event) {
    const nextPageSize = Number(event.target.value);

    setPageSize(nextPageSize);
    setPage(1);

    await runSearch(null, {
      pageValue: 1,
      pageSizeValue: nextPageSize,
      filtersValue: filters,
    });
  }

  async function goToPage(nextPage) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;

    setPage(nextPage);

    await runSearch(null, {
      pageValue: nextPage,
      pageSizeValue: pageSize,
      filtersValue: filters,
    });
  }


  async function handleSave(trialId) {
    if (savingTrialIds.has(trialId)) return;
  
    setSavingTrialIds((current) => new Set(current).add(trialId));
  
    try {
      if (savedTrialIds.has(trialId)) {
        await unsaveTrial(trialId);
  
        setSavedTrialIds((current) => {
          const updated = new Set(current);
          updated.delete(trialId);
          return updated;
        });
      } else {
        await saveTrial(trialId);
  
        setSavedTrialIds((current) => {
          const updated = new Set(current);
          updated.add(trialId);
          return updated;
        });
      }
    } finally {
      setSavingTrialIds((current) => {
        const updated = new Set(current);
        updated.delete(trialId);
        return updated;
      });
    }
  }
  
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Search}
        eyebrow="Trial Search"
        title="Search clinical trials"
        description="Find trials by condition, eligibility, phase, status and study details."
      />
      
      <section className="glass-card rounded-[2rem] p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600">
            <Filter size={16} />
            {results.total} results
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            <SlidersHorizontal size={16} />
            Database filters
          </div>
        </div>

        <form onSubmit={runSearch} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              className="form-input xl:col-span-2"
              name="q"
              placeholder="Search title or NCT ID"
              value={filters.q}
              onChange={updateField}
            />

            <input
              className="form-input"
              name="condition"
              placeholder="Condition"
              value={filters.condition}
              onChange={updateField}
            />

            <input
              className="form-input"
              name="keyword"
              placeholder="Eligibility keyword"
              value={filters.keyword}
              onChange={updateField}
            />

            <select
              className="form-input"
              name="status"
              value={filters.status}
              onChange={updateField}
            >
              <option value="">Any status</option>
              {lookups.statuses.map((item) => (
                <option key={item.status_id} value={item.status_name}>
                  {item.status_name}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              name="phase"
              value={filters.phase}
              onChange={updateField}
            >
              <option value="">Any phase</option>
              {lookups.phases.map((item) => (
                <option key={item.phase_id} value={item.phase_name}>
                  {item.phase_name}
                </option>
              ))}
            </select>

            <select
              className="form-input"
              name="sex"
              value={filters.sex}
              onChange={updateField}
            >
              <option value="">Any sex</option>
              {lookups.sexes.map((item) => (
                <option key={item.sex_id} value={item.sex_name}>
                  {item.sex_name}
                </option>
              ))}
            </select>

            <select
              className="form-input md:col-span-2 xl:col-span-2"
              name="healthy_volunteers"
              value={filters.healthy_volunteers}
              onChange={updateField}
            >
              <option value="">Any volunteer type</option>
              <option value="true">Accepts healthy volunteers</option>
              <option value="false">Patients only / condition-specific</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="submit"
              className="primary-button w-full"
              disabled={isLoading}
            >
              <Search size={18} />
              {isLoading ? "Searching..." : "Run database search"}
            </button>

            <button
              type="button"
              onClick={resetFilters}
              className="secondary-button w-full sm:w-auto"
              disabled={isLoading}
            >
              <X size={18} />
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-[2rem] border border-white/60 bg-white/60 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-bold text-slate-950">{showingStart}</span>–
          <span className="font-bold text-slate-950">{showingEnd}</span> of{" "}
          <span className="font-bold text-slate-950">{results.total}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            Show
            <select
              className="form-input h-11 w-24 py-2"
              value={pageSize}
              onChange={changePageSize}
              disabled={isLoading}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              className="pagination-button"
              disabled={isLoading || page <= 1}
            >
              <ChevronLeft size={16} />
            </button>

            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => goToPage(pageNumber)}
                className={`pagination-button ${
                  pageNumber === page ? "bg-slate-950 text-white" : ""
                }`}
                disabled={isLoading}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              className="pagination-button"
              disabled={isLoading || page >= totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {isLoading && (
          <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
            Searching trials...
          </div>
        )}

        {!isLoading && results.trials.length === 0 && (
          <div className="rounded-3xl bg-white/80 p-6 text-slate-500">
            No trials found yet. Import your dataset or loosen your filters.
          </div>
        )}

        {!isLoading &&
          results.trials.map((trial) => (
            <TrialCard
              key={trial.trial_id}
              trial={trial}
              onSave={handleSave}
              isSaved={savedTrialIds.has(trial.trial_id)}
              isSaving={savingTrialIds.has(trial.trial_id)}
            />
          ))}
      </section>
    </div>
  );
}