import { LogIn } from "lucide-react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import { getApiErrorMessage } from "../utils/errors.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
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
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Welcome back" subtitle="Login to continue to TrialMatch.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="auth-input" name="email" type="email" placeholder="Email" value={form.email} onChange={updateField} required />
        <input className="auth-input" name="password" type="password" placeholder="Password" value={form.password} onChange={updateField} required />
        {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button className="primary-button w-full" disabled={isSubmitting}>
          <LogIn size={18} />
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
        <p className="text-center text-sm text-slate-500">No account? <Link className="font-semibold text-blue-700" to="/signup">Create one</Link></p>
      </form>
    </AuthScreen>
  );
}

function AuthScreen({ title, subtitle, children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10">
      <div className="absolute left-[-10%] top-[-20%] h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/20 bg-white/95 p-7 shadow-soft backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">TrialMatch</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
