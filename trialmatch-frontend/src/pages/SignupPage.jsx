import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage } from "../utils/errors.js";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signup(form.fullName, form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Sign up failed. Please check your details."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10">
      <div className="absolute left-[-10%] top-[-20%] h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/20 bg-white/95 p-7 shadow-soft backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">TrialMatch</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Start as a patient user and explore trial eligibility.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <input className="auth-input" name="fullName" type="text" placeholder="Full name" value={form.fullName} onChange={updateField} required />
          <input className="auth-input" name="email" type="email" placeholder="Email" value={form.email} onChange={updateField} required />
          <input className="auth-input" name="password" type="password" placeholder="Password, minimum 8 characters" value={form.password} onChange={updateField} required />
          {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <button className="primary-button w-full" disabled={isSubmitting}>
            <UserPlus size={18} />
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
          <p className="text-center text-sm text-slate-500">Already have an account? <Link className="font-semibold text-blue-700" to="/login">Login</Link></p>
        </form>
      </section>
    </main>
  );
}
