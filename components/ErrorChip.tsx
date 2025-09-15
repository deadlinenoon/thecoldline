export default function ErrorChip({ label }: { label: string }){
  return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-rose-600/20 text-rose-300 border border-rose-500/30" aria-live="polite">
      <span className="inline-block h-2 w-2 rounded-full bg-rose-400" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

