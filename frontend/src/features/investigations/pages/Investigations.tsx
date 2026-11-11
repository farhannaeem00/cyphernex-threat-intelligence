
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  BrainCircuit,
  ExternalLink,
  FileSearch,
  History,
  LoaderCircle,
  Play,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { apiService } from '../../../services/api'

type InvestigationResult = Record<string, unknown>

function getText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function getReport(result: InvestigationResult): string | null {
  const candidates = [
    result.report,
    result.report_text,
    result.analysis,
    result.content,
  ]

  for (const candidate of candidates) {
    const text = getText(candidate)
    if (text) return text
  }

  return null
}

function getSources(result: InvestigationResult): unknown[] {
  const candidates = [
    result.sources,
    result.evidence,
    result.investigation_sources,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function sourceValue(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined

  return (source as Record<string, unknown>)[key]
}

function sourceText(
  source: unknown,
  key: string,
  fallback = 'Not available',
): string {
  const value = sourceValue(source, key)

  return value === undefined || value === null
    ? fallback
    : String(value)
}

function getSourceLabel(source: unknown, index: number): string {
  return (
    sourceText(source, 'source_id', '') ||
    sourceText(source, 'id', '') ||
    sourceText(source, 'title', '') ||
    `Source ${index + 1}`
  )
}

function getSourceUrl(source: unknown): string | null {
  const value =
    sourceValue(source, 'source_url') ??
    sourceValue(source, 'url')

  return typeof value === 'string' && /^https?:\/\//i.test(value)
    ? value
    : null
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
          li: ({ children }) => (
            <li className="pl-1 text-slate-300">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-teal-400 bg-teal-400/5 py-2 pl-4 text-slate-400">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-300 underline decoration-teal-300/30 underline-offset-4 hover:text-teal-200"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/80 text-slate-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-700 px-4 py-3 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-800 px-4 py-3 align-top text-slate-300">
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

export default function Investigations() {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<InvestigationResult | null>(null)

  async function handleInvestigation() {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 3) {
      setError(
        'Enter an investigation query containing at least 3 characters.',
      )
      return
    }

    try {
      setLoading(true)
      setError('')
      setResult(null)

      const response = await apiService.runInvestigation({
        query: trimmedQuery,
        limit,
      })

      setResult(response)
    } catch (err: unknown) {
      console.error('Investigation request failed:', err)

      if (typeof err === 'object' && err !== null && 'response' in err) {
        const response = (
          err as {
            response?: {
              data?: { detail?: unknown }
            }
          }
        ).response

        const detail = response?.data?.detail

        setError(
          typeof detail === 'string'
            ? detail
            : 'The backend could not complete this investigation. Check the backend logs.',
        )
      } else {
        setError(
          'Unable to connect to the investigation service. Check that the backend is running.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const report = result ? getReport(result) : null
  const sources = result ? getSources(result) : []

  const investigationId =
    result?.investigation_id ??
    result?.id ??
    result?.investigationId

  return (
    <div className="space-y-7">
      {/* Page heading */}

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-teal-400">
            AI-powered threat investigation
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Investigations
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Investigate threat activity using retrieved intelligence,
            source-backed evidence, and AI-assisted analysis.
          </p>
        </div>

        <Link
          to="/investigations/history"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#101a2b] px-4 py-2.5 text-sm text-slate-300 transition hover:border-teal-400/50 hover:text-teal-300"
        >
          <History size={16} />
          Investigation history
        </Link>
      </section>

      {/* Investigation form */}

      <section className="rounded-xl border border-slate-800 bg-[#101a2b] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-teal-400/10 p-3">
            <BrainCircuit size={22} className="text-teal-300" />
          </div>

          <div>
            <h2 className="font-semibold text-white">
              New investigation
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Enter a question or describe the threat activity to examine.
            </p>
          </div>
        </div>

        <label
          htmlFor="investigation-query"
          className="mt-7 block text-sm font-medium text-slate-300"
        >
          Investigation query
        </label>

        <textarea
          id="investigation-query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Analyze available threat intelligence for shared tags, indicators, reporting overlaps, and potential relationships."
          rows={5}
          maxLength={2000}
          disabled={loading}
          className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-[#0b1220] p-4 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400 disabled:opacity-50"
        />

        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
          <span>Minimum 3 characters · Maximum 2,000</span>
          <span>{query.length}/2000</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <label
              htmlFor="evidence-limit"
              className="block text-xs font-medium text-slate-400"
            >
              Maximum evidence passages
            </label>

            <select
              id="evidence-limit"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              disabled={loading}
              className="mt-2 rounded-lg border border-slate-700 bg-[#0b1220] px-4 py-2.5 text-sm text-slate-300 outline-none focus:border-teal-400"
            >
              {[3, 5, 8, 10, 15, 20].map((value) => (
                <option key={value} value={value}>
                  {value} passages
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void handleInvestigation()}
            disabled={loading || query.trim().length < 3}
            className="flex items-center gap-2 rounded-lg bg-teal-400 px-5 py-3 text-sm font-semibold text-[#07131b] transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Investigating...
              </>
            ) : (
              <>
                <Play size={16} />
                Run investigation
              </>
            )}
          </button>
        </div>

        {loading && (
          <div className="mt-6 rounded-lg border border-teal-400/20 bg-teal-400/5 p-4">
            <div className="flex items-center gap-3 text-sm text-teal-300">
              <Activity size={17} className="animate-pulse" />
              Processing investigation
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-400">
              Retrieving evidence, analyzing relevant passages, and generating
              a source-grounded report.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-5 flex gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
            <p className="text-sm leading-6 text-red-300">{error}</p>
          </div>
        )}
      </section>

      {/* Investigation results */}

      {result && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-teal-400">
                Investigation output
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                Analysis report
              </h2>
            </div>

            {investigationId !== undefined && (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
                Investigation #{String(investigationId)}
              </span>
            )}
          </div>

          {/* Formatted report */}

          <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5 sm:p-7">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <Sparkles size={18} className="text-teal-300" />

              <h3 className="font-semibold text-white">
                AI investigation findings
              </h3>
            </div>

            {report ? (
              <div className="pt-5">
                <MarkdownReport content={report} />
              </div>
            ) : (
              <p className="pt-5 text-sm text-amber-300">
                No recognized report text was returned. Inspect the complete
                API response below.
              </p>
            )}
          </div>

          {/* Supporting evidence */}

          <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
              <FileSearch size={18} className="text-teal-300" />

              <h3 className="font-semibold text-white">
                Supporting evidence
              </h3>

              <span className="ml-auto rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
                {sources.length} sources
              </span>
            </div>

            {sources.length > 0 ? (
              <div className="mt-4 space-y-3">
                {sources.map((source, index) => {
                  const url = getSourceUrl(source)

                  return (
                    <div
                      key={`${getSourceLabel(source, index)}-${index}`}
                      className="rounded-lg border border-slate-800 bg-[#0b1220] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-teal-300">
                            {getSourceLabel(source, index)}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {sourceText(source, 'title', 'Evidence passage')}
                          </p>
                        </div>

                        {url && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200"
                          >
                            Open source <ExternalLink size={13} />
                          </a>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                        <p>
                          Source: {sourceText(source, 'source_name')}
                        </p>

                        <p>
                          External ID: {sourceText(source, 'external_id')}
                        </p>

                        <p>
                          Document ID: {sourceText(source, 'document_id')}
                        </p>

                        <p>
                          Retrieval score: {sourceText(source, 'retrieval_score')}
                        </p>
                      </div>

                      {typeof sourceValue(source, 'quoted_text') === 'string' && (
                        <blockquote className="mt-4 border-l-2 border-teal-400/50 pl-3 text-xs leading-6 text-slate-400">
                          {String(sourceValue(source, 'quoted_text'))}
                        </blockquote>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                No source list was found in the response.
              </p>
            )}
          </div>

          {/* Raw API response */}

          <details className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">
              Inspect complete API response
            </summary>

            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#0b1220] p-4 text-xs leading-6 text-slate-400">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>

          {/* AI disclaimer */}

          <div className="flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />

            <p className="text-xs leading-6 text-slate-400">
              AI-generated analysis is investigative assistance, not definitive
              attribution or confirmation of compromise. Verify conclusions
              against the underlying source evidence.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
