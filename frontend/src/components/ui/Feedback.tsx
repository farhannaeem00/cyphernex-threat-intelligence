import type { ReactNode } from 'react'

type FeedbackProps = { children: ReactNode; tone?: 'error' | 'success' | 'info' }

const styles = {
  error: 'border-rose-400/20 bg-rose-400/5 text-rose-200',
  success: 'border-teal-400/20 bg-teal-400/5 text-teal-200',
  info: 'border-slate-700 bg-slate-900 text-slate-300',
}

export function Feedback({ children, tone = 'info' }: FeedbackProps) {
  return <div role="status" className={`rounded-lg border p-4 text-sm ${styles[tone]}`}>{children}</div>
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="py-10 text-center text-sm text-slate-400">{label}</div>
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
    <p className="text-sm font-medium text-slate-200">{title}</p>
    {description && <p className="mt-2 text-xs text-slate-500">{description}</p>}
  </div>
}
