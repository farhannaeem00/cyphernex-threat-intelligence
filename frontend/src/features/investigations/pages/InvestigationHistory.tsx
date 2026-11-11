
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FileSearch,
  History,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import {
  apiService,
  type Investigation,
} from '../../../services/api'

type DataObject = Record<string, unknown>

function asObject(value: unknown): DataObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as DataObject
    : null
}

function getReport(data: DataObject): string | null {
  const candidates = [
    data.report,
    data.report_text,
    data.analysis,
    data.content,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }

    const nested = asObject(candidate)
    if (nested) {
      for (const key of ['report', 'report_text', 'content', 'text']) {
        const value = nested[key]
        if (typeof value === 'string' && value.trim()) return value
      }
    }
  }

  return null
}

function getSources(data: DataObject): unknown[] {
  for (const candidate of [
    data.sources,
    data.evidence,
    data.investigation_sources,
  ]) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function sourceField(source: unknown, key: string): unknown {
  const object = asObject(source)
  return object?.[key]
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function statusStyle(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
    case 'failed':
      return 'border-red-500/20 bg-red-500/10 text-red-300'
    case 'processing':
    case 'running':
      return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
    default:
      return 'border-slate-700 bg-slate-800 text-slate-300'
  }
}

function MarkdownReport({ content }: { content: string }) {
  return (
    <article className="investigation-markdown space-y-5 text-sm leading-7 text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="border-b border-slate-700 pb-3 text-2xl font-bold text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="border-b border-slate-800 pb-2 pt-3 text-xl font-semibold text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="pt-2 text-base font-semibold text-teal-300">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-7 text-slate-300">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-2 pl-6 marker:text-teal-400">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-2 pl-6 marker:text-teal-400">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-300 underline underline-offset-4"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-teal-400 bg-teal-400/5 py-2 pl-4 text-slate-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800 text-slate-200">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-700 px-4 py-3">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-800 px-4 py-3 align-top">
              {children}
            </td>
          ),
          hr: () => <hr className="border-slate-800" />,
          code: ({ children }) => (
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-teal-200">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}

export default function InvestigationHistory() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<DataObject | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  async function loadHistory() {
    try {
      setLoading(true)
      setError('')
      const response = await apiService.investigations()
      setInvestigations(response.investigations)
      setTotal(response.total)
    } catch (err) {
      console.error('Failed to load investigation history:', err)
      setError('Could not load investigation history. Check the backend connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  async function openInvestigation(id: number) {
    try {
      setSelectedId(id)
      setDetail(null)
      setDetailError('')
      setDetailLoading(true)

      const response = await apiService.investigationDetail(id)
      setDetail(response)
    } catch (err) {
      console.error('Failed to load saved investigation:', err)
      setDetailError(`Could not load investigation #${id}. Please try again.`)
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredInvestigations = investigations.filter((item) => {
    const searchText = `${item.id} ${item.query} ${item.status}`.toLowerCase()
    return searchText.includes(filter.toLowerCase())
  })

  const report = detail ? getReport(detail) : null
  const sources = detail ? getSources(detail) : []

  return (
    <div className="space-y-7">
      <section>
        <Link
          to="/investigations"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-teal-300"
        >
          <ArrowLeft size={16} />
          Back to investigations
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-teal-400">
              <History size={16} />
              Investigation records
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              Investigation History
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Browse and reopen reports saved from previous investigations.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101a2b] px-4 py-2.5 text-sm text-slate-300 hover:border-teal-400/50 hover:text-teal-300 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
          <p className="text-xs text-slate-500">Total saved investigations</p>
          <p className="mt-2 text-3xl font-bold text-white">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
          <p className="text-xs text-slate-500">Completed</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">
            {investigations.filter((item) => item.status === 'completed').length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
          <p className="text-xs text-slate-500">Evidence passages saved</p>
          <p className="mt-2 text-3xl font-bold text-teal-300">
            {investigations.reduce((sum, item) => sum + (item.evidence_count || 0), 0)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#101a2b] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Saved investigations</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a record to view its saved report.
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
            {filteredInvestigations.length} records
          </span>
        </div>

        <div className="relative mt-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search by ID, query, or status..."
            className="w-full rounded-lg border border-slate-700 bg-[#0b1220] py-3 pl-10 pr-4 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-400">
            <LoaderCircle size={18} className="animate-spin text-teal-300" />
            Loading investigation history...
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {!loading && !error && filteredInvestigations.length === 0 && (
          <div className="py-12 text-center">
            <FileSearch size={30} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm text-slate-300">No investigations found.</p>
            <p className="mt-1 text-xs text-slate-500">
              Try another search or run a new investigation.
            </p>
          </div>
        )}

        {!loading && !error && filteredInvestigations.length > 0 && (
          <div className="mt-4 divide-y divide-slate-800">
            {filteredInvestigations.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      Investigation #{item.id}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${statusStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                    {item.query}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{formatDate(item.created_at)}</span>
                    <span>{item.evidence_count} evidence passages</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void openInvestigation(item.id)}
                  className="shrink-0 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-2.5 text-sm font-medium text-teal-300 transition hover:bg-teal-400/20"
                >
                  View report
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedId !== null && (
        <section className="scroll-mt-6 space-y-5 rounded-xl border border-slate-800 bg-[#101a2b] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <p className="text-xs text-teal-400">Saved investigation</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Investigation #{selectedId}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null)
                setDetail(null)
                setDetailError('')
              }}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white"
            >
              Close report
            </button>
          </div>

          {detailLoading && (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-400">
              <LoaderCircle size={18} className="animate-spin text-teal-300" />
              Retrieving saved report...
            </div>
          )}

          {detailError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {detailError}
            </p>
          )}

          {detail && (
            <>
              {report ? (
                <MarkdownReport content={report} />
              ) : (
                <p className="text-sm text-amber-300">
                  The detail endpoint returned data, but its report field was not recognized.
                  Inspect the response below so we can map its exact structure.
                </p>
              )}

              <div className="border-t border-slate-800 pt-5">
                <h3 className="flex items-center gap-2 font-semibold text-white">
                  <FileSearch size={17} className="text-teal-300" />
                  Supporting evidence ({sources.length})
                </h3>

                {sources.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {sources.map((source, index) => {
                      const title = sourceField(source, 'title')
                      const sourceId = sourceField(source, 'source_id')
                      const url = sourceField(source, 'source_url') ?? sourceField(source, 'url')
                      const quote = sourceField(source, 'quoted_text')
                      const safeUrl =
                        typeof url === 'string' && /^https?:\/\//i.test(url)
                          ? url
                          : null

                      return (
                        <div key={`${String(sourceId ?? index)}-${index}`} className="rounded-lg border border-slate-800 bg-[#0b1220] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-teal-300">
                              {String(sourceId ?? `Source ${index + 1}`)}
                            </p>
                            {safeUrl && (
                              <a
                                href={safeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200"
                              >
                                Open source <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                          {title !== undefined && (
                            <p className="mt-2 text-xs text-slate-400">{String(title)}</p>
                          )}
                          {typeof quote === 'string' && (
                            <blockquote className="mt-3 border-l-2 border-teal-400/50 pl-3 text-xs leading-6 text-slate-400">
                              {quote}
                            </blockquote>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No source list was recognized in this response.
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-slate-400">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-300" />
                This is a previously saved AI-generated investigation. Review its source evidence before relying on its conclusions.
              </div>

              <details className="rounded-lg border border-slate-800 p-4">
                <summary className="cursor-pointer text-sm text-slate-300">
                  Inspect complete detail response
                </summary>
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#0b1220] p-4 text-xs leading-6 text-slate-400">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </details>
            </>
          )}
        </section>
      )}
    </div>
  )
}
