import { motion } from "framer-motion";

export default function PageHeader({ eyebrow, title, description, icon: Icon }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-glow"
    >
      <div className="absolute right-[-6rem] top-[-6rem] h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="absolute bottom-[-7rem] left-[30%] h-72 w-72 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="relative">
        {eyebrow && (
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-blue-100">
            {Icon && <Icon size={16} />}
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-4xl text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>}
      </div>
    </motion.section>
  );
}
