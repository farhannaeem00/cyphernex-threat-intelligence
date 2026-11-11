
import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Database,
  FileText,
  Globe,
  Hash,
  LoaderCircle,
  Search,
  Shield,
  X,
} from 'lucide-react'
import { apiService, type SearchResponse } from '../../../services/api'

type SearchTab = 'all' | 'documents' | 'indicators'

type SearchRecord = Record<string, unknown>

function getString(
  record: SearchRecord,
  keys: string[],
  fallback = 'Not available',
): string {
  for (const key of keys) {
    const value = record[key]

    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      const text = String(value).trim()
      if (text) return text
    }
  }

  return fallback
}

// function getNumber(
//   record: SearchRecord,
//   keys: string[],
// ): number | null {
//   for (const key of keys) {
//     const value = record[key]

//     if (typeof value === 'number' && Number.isFinite(value)) {
//       return value
//     }
//   }

//   return null
// }

function getSourceUrl(record: SearchRecord): string | null {
  const value = record.source_url ?? record.url

  if (
    typeof value === 'string' &&
    /^https?:\/\//i.test(value)
  ) {
    return value
  }

  return null
}

function getExcerpt(record: SearchRecord): string {
  const content = getString(
    record,
    ['content', 'description', 'quoted_text'],
    '',
  )

  if (!content) return 'No content preview is available.'

  return content.length > 350
    ? `${content.slice(0, 350).trim()}…`
    : content
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function DocumentCard({ document }: { document: SearchRecord }) {
  const title = getString(document, ['title', 'name'], 'Untitled document')
  const source = getString(
    document,
    ['source_name', 'source', 'publisher'],
  )
  const documentId = getString(document, ['id', 'document_id'])
  const externalId = getString(document, ['external_id'], '')
  const sourceUrl = getSourceUrl(document)
  const createdAt = getString(
    document,
    ['published_at', 'created_at', 'retrieved_at'],
    '',
  )

  return (
    <article className="rounded-xl border border-slate-800 bg-[#101a2b] p-5 transition hover:border-teal-400/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-teal-400/10 p-3">
            <FileText size={20} className="text-teal-300" />
          </div>

          <div className="min-w-0">
            <h3 className="break-words font-semibold text-white">
              {title}
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              {source}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-teal-400/20 bg-teal-400/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-teal-300">
          Document
        </span>
      </div>

      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
        {getExcerpt(document)}
      </p>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <span>Document ID: {documentId}</span>

        {externalId && (
          <span>External ID: {externalId}</span>
        )}

        {createdAt && (
          <span>{formatDate(createdAt)}</span>
        )}
      </div>

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-teal-300 transition hover:text-teal-200"
        >
          View original source
          <ArrowUpRight size={14} />
        </a>
      )}
    </article>
  )
}

function IndicatorCard({ indicator }: { indicator: SearchRecord }) {
  const value = getString(
    indicator,
    ['value', 'normalized_value', 'indicator_value'],
    'Unknown indicator',
  )

  const type = getString(
    indicator,
    ['indicator_type', 'type'],
    'Unknown type',
  )

  const indicatorId = getString(
    indicator,
    ['id', 'indicator_id'],
  )

  const normalizedValue = getString(
    indicator,
    ['normalized_value'],
    '',
  )

  const createdAt = getString(
    indicator,
    ['created_at'],
    '',
  )

  return (
    <article className="rounded-xl border border-slate-800 bg-[#101a2b] p-5 transition hover:border-indigo-400/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-lg bg-indigo-400/10 p-3">
            <Hash size={20} className="text-indigo-300" />
          </div>

          <div className="min-w-0">
            <p className="break-all font-mono text-sm font-medium text-white">
              {value}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Indicator ID: {indicatorId}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-indigo-400/20 bg-indigo-400/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
          {type}
        </span>
      </div>

      {normalizedValue && normalizedValue !== value && (
        <div className="mt-4 rounded-lg bg-[#0b1220] p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Normalized value
          </p>

          <p className="mt-1 break-all font-mono text-xs text-slate-300">
            {normalizedValue}
          </p>
        </div>
      )}

      {createdAt && (
        <p className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-500">
          Created: {formatDate(createdAt)}
        </p>
      )}
    </article>
  )
}

export default function Intelligence() {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(10)
  const [activeTab, setActiveTab] = useState<SearchTab>('all')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setError('Enter at least 2 characters to search.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setResults(null)
      setSearchedQuery(trimmedQuery)
      setActiveTab('all')

      const response = await apiService.search(trimmedQuery, limit)

      setResults(response)
    } catch (err: unknown) {
      console.error('Intelligence search failed:', err)

      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
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
            : 'The search service could not complete your request.',
        )
      } else {
        setError(
          'Unable to connect to the search service. Check that the backend is running.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  function clearSearch() {
    setQuery('')
    setResults(null)
    setError('')
    setSearchedQuery('')
    setActiveTab('all')
  }

  const documents = results?.documents ?? []
  const indicators = results?.indicators ?? []

  const documentCount = results?.document_count ?? documents.length
  const indicatorCount = results?.indicator_count ?? indicators.length
  const totalCount = documentCount + indicatorCount

  const showDocuments = activeTab === 'all' || activeTab === 'documents'
  const showIndicators = activeTab === 'all' || activeTab === 'indicators'

  return (
    <div className="space-y-7">
      {/* Page heading */}

      <section>
        <p className="text-sm text-teal-400">
          Threat intelligence discovery
        </p>

        <h1 className="mt-2 text-3xl font-bold text-white">
          Intelligence Search
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Search ingested threat intelligence for documents, URLs,
          IP addresses, hostnames, and other indicators.
        </p>
      </section>

      {/* Search form */}

      <section className="rounded-xl border border-slate-800 bg-[#101a2b] p-5 sm:p-6">
        <form onSubmit={handleSearch}>
          <label
            htmlFor="intelligence-query"
            className="mb-3 block text-sm font-medium text-slate-300"
          >
            Search threat intelligence
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                id="intelligence-query"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search an IP, URL, hostname, or keyword..."
                maxLength={200}
                disabled={loading}
                className="w-full rounded-lg border border-slate-700 bg-[#0b1220] py-3.5 pl-11 pr-11 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-teal-400 disabled:opacity-50"
              />

              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-400 px-6 py-3.5 text-sm font-semibold text-[#07131b] transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <LoaderCircle size={17} className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={17} />
                  Search
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Search across your ingested intelligence database.
            </p>

            <div className="flex items-center gap-2">
              <label
                htmlFor="search-limit"
                className="text-xs text-slate-500"
              >
                Result limit
              </label>

              <select
                id="search-limit"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                disabled={loading}
                className="rounded-lg border border-slate-700 bg-[#0b1220] px-3 py-2 text-xs text-slate-300 outline-none focus:border-teal-400"
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {error && (
          <div className="mt-5 flex gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-300"
            />

            <p className="text-sm leading-6 text-red-300">
              {error}
            </p>
          </div>
        )}
      </section>

      {/* Initial state */}

      {!results && !loading && !error && (
        <section className="rounded-xl border border-dashed border-slate-700 bg-[#101a2b]/50 px-6 py-14 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-teal-400/10">
            <Database size={25} className="text-teal-300" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-white">
            Search your threat intelligence
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Enter an IP address, URL, hostname, or keyword to discover
            matching documents and indicators stored in CypherNex.
          </p>
        </section>
      )}

      {/* Loading state */}

      {loading && (
        <section className="rounded-xl border border-slate-800 bg-[#101a2b] px-6 py-14 text-center">
          <LoaderCircle
            size={30}
            className="mx-auto animate-spin text-teal-300"
          />

          <p className="mt-4 text-sm font-medium text-white">
            Searching intelligence database
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Looking for matching documents and indicators...
          </p>
        </section>
      )}

      {/* Search results */}

      {results && !loading && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-teal-400">
                Search results
              </p>

              <h2 className="mt-1 break-all text-lg font-semibold text-white">
                Results for "{searchedQuery}"
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {totalCount} matching records reported by the search API
              </p>
            </div>

            <button
              type="button"
              onClick={clearSearch}
              className="text-xs text-slate-400 transition hover:text-teal-300"
            >
              Clear results
            </button>
          </div>

          {/* Result statistics */}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Total matches
                </p>
                <Database size={18} className="text-teal-300" />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {totalCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Documents
                </p>
                <FileText size={18} className="text-teal-300" />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {documentCount}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Indicators
                </p>
                <Shield size={18} className="text-indigo-300" />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-white">
                {indicatorCount}
              </p>
            </div>
          </div>

          {/* Result filters */}

          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {(
              [
                { id: 'all', label: `All (${totalCount})` },
                { id: 'documents', label: `Documents (${documentCount})` },
                { id: 'indicators', label: `Indicators (${indicatorCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
                  activeTab === tab.id
                    ? 'bg-teal-400/10 text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Documents */}

          {showDocuments && (
            <div className="space-y-3">
              {activeTab === 'all' && documents.length > 0 && (
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-teal-300" />
                  <h3 className="text-sm font-semibold text-white">
                    Documents
                  </h3>
                </div>
              )}

              {documents.length > 0 ? (
                documents.map((document, index) => (
                  <DocumentCard
                    key={getString(document, ['id', 'document_id'], `document-${index}`)}
                    document={document}
                  />
                ))
              ) : activeTab === 'documents' ? (
                <p className="rounded-xl border border-slate-800 bg-[#101a2b] p-6 text-sm text-slate-500">
                  No matching documents were returned.
                </p>
              ) : null}
            </div>
          )}

          {/* Indicators */}

          {showIndicators && (
            <div className="space-y-3">
              {activeTab === 'all' && indicators.length > 0 && (
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-indigo-300" />
                  <h3 className="text-sm font-semibold text-white">
                    Indicators
                  </h3>
                </div>
              )}

              {indicators.length > 0 ? (
                indicators.map((indicator, index) => (
                  <IndicatorCard
                    key={getString(indicator, ['id', 'indicator_id'], `indicator-${index}`)}
                    indicator={indicator}
                  />
                ))
              ) : activeTab === 'indicators' ? (
                <p className="rounded-xl border border-slate-800 bg-[#101a2b] p-6 text-sm text-slate-500">
                  No matching indicators were returned.
                </p>
              ) : null}
            </div>
          )}

          {/* No matches */}

          {documents.length === 0 && indicators.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-[#101a2b] px-6 py-12 text-center">
              <Search size={27} className="mx-auto text-slate-600" />

              <h3 className="mt-4 font-semibold text-white">
                No matching intelligence found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                No documents or indicators matched this query in the current
                database. Try a different keyword or indicator.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
