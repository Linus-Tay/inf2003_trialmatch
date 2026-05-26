import { motion } from "framer-motion";

export default function StatCard({ label, value, helper, icon: Icon }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} className="glass-card rounded-[1.7rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <h3 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value ?? "—"}</h3>
          {helper && <p className="mt-2 text-sm text-slate-500">{helper}</p>}
        </div>
        {Icon && <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-700"><Icon size={22} /></div>}
      </div>
    </motion.div>
  );
}
