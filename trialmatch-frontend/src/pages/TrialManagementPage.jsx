import { ClipboardList, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  addTrialCondition,
  addTrialCriteria,
  addTrialIntervention,
  archiveManagedTrial,
  createManagedTrial,
  fetchLookups,
  getTrialDetail,
  listManagedTrials,
  updateManagedTrial,
} from "../api/modules";
import PageHeader from "../components/PageHeader";

export default function TrialManagementPage() {
  const [trials, setTrials] = useState([]);
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [lookups, setLookups] = useState({ phases: [], statuses: [], study_types: [], sexes: [] });
  const [message, setMessage] = useState("");

  const [createForm, setCreateForm] = useState({
    nct_id: "",
    brief_title: "",
    phase_id: "",
    status_id: "",
    study_type_id: "",
    sex_id: "",
    minimum_age: "",
    maximum_age: "",
    enrollment_count: "",
  });

  const [editForm, setEditForm] = useState({});
  const [conditionForm, setConditionForm] = useState({ condition_name: "", condition_role: "Primary" });
  const [interventionForm, setInterventionForm] = useState({ intervention_name: "", intervention_type: "", arm_group_label: "" });
  const [criteriaForm, setCriteriaForm] = useState({ criteria_type: "Inclusion", criteria_text: "", criteria_order: 1, keyword_count: 0, requires_manual_review: false });

  async function load() {
    setTrials(await listManagedTrials({ limit: 50 }));
  }

  useEffect(() => {
    load();
    fetchLookups().then(setLookups);
  }, []);

  async function openTrial(trial) {
    setSelectedTrial(trial);
    const detail = await getTrialDetail(trial.trial_id);
    setSelectedDetail(detail);
    setEditForm({
      brief_title: detail.trial.brief_title || "",
      official_title: detail.trial.official_title || "",
      brief_summary: detail.trial.brief_summary || "",
      minimum_age: detail.trial.minimum_age ?? "",
      maximum_age: detail.trial.maximum_age ?? "",
      enrollment_count: detail.trial.enrollment_count ?? "",
      source_url: detail.trial.source_url || "",
    });
  }

  function updateCreate(event) {
    setCreateForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateEdit(event) {
    setEditForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    await createManagedTrial({
      nct_id: createForm.nct_id,
      brief_title: createForm.brief_title,
      phase_id: createForm.phase_id ? Number(createForm.phase_id) : null,
      status_id: createForm.status_id ? Number(createForm.status_id) : null,
      study_type_id: createForm.study_type_id ? Number(createForm.study_type_id) : null,
      sex_id: createForm.sex_id ? Number(createForm.sex_id) : null,
      minimum_age: createForm.minimum_age ? Number(createForm.minimum_age) : null,
      maximum_age: createForm.maximum_age ? Number(createForm.maximum_age) : null,
      enrollment_count: createForm.enrollment_count ? Number(createForm.enrollment_count) : null,
    });

    setMessage("Trial created.");
    setCreateForm({ nct_id: "", brief_title: "", phase_id: "", status_id: "", study_type_id: "", sex_id: "", minimum_age: "", maximum_age: "", enrollment_count: "" });
    load();
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedTrial) return;

    await updateManagedTrial(selectedTrial.trial_id, {
      ...editForm,
      minimum_age: editForm.minimum_age === "" ? null : Number(editForm.minimum_age),
      maximum_age: editForm.maximum_age === "" ? null : Number(editForm.maximum_age),
      enrollment_count: editForm.enrollment_count === "" ? null : Number(editForm.enrollment_count),
    });

    setMessage("Trial updated.");
    await openTrial(selectedTrial);
    load();
  }

  async function handleArchive(trialId) {
    await archiveManagedTrial(trialId);
    setMessage("Trial archived.");
    setSelectedTrial(null);
    setSelectedDetail(null);
    load();
  }

  async function handleAddCondition(event) {
    event.preventDefault();
    if (!selectedTrial) return;
    await addTrialCondition(selectedTrial.trial_id, conditionForm);
    setMessage("Condition linked to trial.");
    setConditionForm({ condition_name: "", condition_role: "Primary" });
    await openTrial(selectedTrial);
  }

  async function handleAddIntervention(event) {
    event.preventDefault();
    if (!selectedTrial) return;
    await addTrialIntervention(selectedTrial.trial_id, {
      ...interventionForm,
      intervention_type: interventionForm.intervention_type || null,
      arm_group_label: interventionForm.arm_group_label || null,
    });
    setMessage("Intervention linked to trial.");
    setInterventionForm({ intervention_name: "", intervention_type: "", arm_group_label: "" });
    await openTrial(selectedTrial);
  }

  async function handleAddCriteria(event) {
    event.preventDefault();
    if (!selectedTrial) return;
    await addTrialCriteria(selectedTrial.trial_id, {
      ...criteriaForm,
      criteria_order: Number(criteriaForm.criteria_order),
      keyword_count: Number(criteriaForm.keyword_count),
    });
    setMessage("Eligibility criteria added.");
    setCriteriaForm({ criteria_type: "Inclusion", criteria_text: "", criteria_order: 1, keyword_count: 0, requires_manual_review: false });
    await openTrial(selectedTrial);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        eyebrow="Trial Management"
        title="Create, update, archive and enrich trial records."
        description="This page demonstrates CRUD, lookup relationships, many-to-many links and eligibility criteria management."
      />

      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <section className="glass-card rounded-[2rem] p-6">
        <h2 className="text-xl font-bold text-slate-950">Create trial</h2>
        <form onSubmit={handleCreate} className="mt-5 grid gap-3 md:grid-cols-3">
          <input className="form-input" name="nct_id" placeholder="NCT ID" value={createForm.nct_id} onChange={updateCreate} required />
          <input className="form-input md:col-span-2" name="brief_title" placeholder="Brief title" value={createForm.brief_title} onChange={updateCreate} required />
          <select className="form-input" name="phase_id" value={createForm.phase_id} onChange={updateCreate}>
            <option value="">Phase</option>
            {lookups.phases.map((item) => <option key={item.phase_id} value={item.phase_id}>{item.phase_name}</option>)}
          </select>
          <select className="form-input" name="status_id" value={createForm.status_id} onChange={updateCreate}>
            <option value="">Status</option>
            {lookups.statuses.map((item) => <option key={item.status_id} value={item.status_id}>{item.status_name}</option>)}
          </select>
          <select className="form-input" name="study_type_id" value={createForm.study_type_id} onChange={updateCreate}>
            <option value="">Study type</option>
            {lookups.study_types.map((item) => <option key={item.study_type_id} value={item.study_type_id}>{item.study_type_name}</option>)}
          </select>
          <select className="form-input" name="sex_id" value={createForm.sex_id} onChange={updateCreate}>
            <option value="">Sex eligibility</option>
            {lookups.sexes.map((item) => <option key={item.sex_id} value={item.sex_id}>{item.sex_name}</option>)}
          </select>
          <input className="form-input" name="minimum_age" type="number" placeholder="Minimum age" value={createForm.minimum_age} onChange={updateCreate} />
          <input className="form-input" name="maximum_age" type="number" placeholder="Maximum age" value={createForm.maximum_age} onChange={updateCreate} />
          <button className="primary-button md:col-span-3"><Plus size={18} />Create trial</button>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="glass-card rounded-[2rem] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">Recent trials</h2>
            <button onClick={load} className="secondary-button"><RefreshCw size={16} />Refresh</button>
          </div>
          <div className="space-y-3">
            {trials.map((trial) => (
              <button key={trial.trial_id} onClick={() => openTrial(trial)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedTrial?.trial_id === trial.trial_id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <p className="text-xs font-semibold text-slate-500">{trial.nct_id}</p>
                <p className="mt-1 font-bold text-slate-950">{trial.brief_title}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {!selectedDetail && <div className="glass-card rounded-[2rem] p-6 text-slate-500">Select a trial to update details and add related data.</div>}

          {selectedDetail && (
            <>
              <section className="glass-card rounded-[2rem] p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{selectedDetail.trial.nct_id}</p>
                    <h2 className="text-2xl font-bold text-slate-950">{selectedDetail.trial.brief_title}</h2>
                  </div>
                  <button onClick={() => handleArchive(selectedDetail.trial.trial_id)} className="secondary-button text-red-700"><Trash2 size={16} />Archive</button>
                </div>

                <form onSubmit={handleUpdate} className="grid gap-3">
                  <input className="form-input" name="brief_title" value={editForm.brief_title || ""} onChange={updateEdit} />
                  <input className="form-input" name="official_title" placeholder="Official title" value={editForm.official_title || ""} onChange={updateEdit} />
                  <textarea className="form-input min-h-28" name="brief_summary" placeholder="Summary" value={editForm.brief_summary || ""} onChange={updateEdit} />
                  <button className="primary-button"><Save size={18} />Save trial update</button>
                </form>
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <MiniPanel title="Add condition" onSubmit={handleAddCondition}>
                  <input className="form-input" placeholder="Condition name" value={conditionForm.condition_name} onChange={(e) => setConditionForm((c) => ({ ...c, condition_name: e.target.value }))} required />
                </MiniPanel>
                <MiniPanel title="Add intervention" onSubmit={handleAddIntervention}>
                  <input className="form-input" placeholder="Intervention name" value={interventionForm.intervention_name} onChange={(e) => setInterventionForm((c) => ({ ...c, intervention_name: e.target.value }))} required />
                </MiniPanel>
                <MiniPanel title="Add criteria" onSubmit={handleAddCriteria}>
                  <select className="form-input" value={criteriaForm.criteria_type} onChange={(e) => setCriteriaForm((c) => ({ ...c, criteria_type: e.target.value }))}>
                    <option>Inclusion</option>
                    <option>Exclusion</option>
                    <option>General</option>
                  </select>
                  <textarea className="form-input min-h-24" placeholder="Criteria text" value={criteriaForm.criteria_text} onChange={(e) => setCriteriaForm((c) => ({ ...c, criteria_text: e.target.value }))} required />
                </MiniPanel>
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function MiniPanel({ title, children, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="glass-card rounded-[2rem] p-5">
      <h3 className="mb-4 font-bold text-slate-950">{title}</h3>
      <div className="space-y-3">{children}</div>
      <button className="primary-button mt-4 w-full"><Plus size={16} />Add</button>
    </form>
  );
}
