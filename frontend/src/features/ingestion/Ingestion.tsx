import { useState } from 'react'
import { Activity, Database, RefreshCw } from 'lucide-react'
import api from '../../services/api'

type IngestionStats = {
  records_received: number
  documents_created: number
  documents_skipped: number
  indicators_created: number
  indicator_links_created: number
  records_skipped_invalid: number
}

export default function Ingestion() {
  const [limit, setLimit] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<IngestionStats | null>(null)

  async function startIngestion() {
    setLoading(true)
    setError('')
    setStats(null)

    try {
      const response = await api.post(
        `/api/ingestion/urlhaus?limit=${limit}`
      )
      setStats(response.data.stats ?? response.data)
    } catch (err: any) {
      setError(
        err.response?.data?.detail ??
        err.response?.data?.message ??
        err.message ??
        'Ingestion failed. Check the backend logs.'
      )
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    ['Records received', stats?.records_received],
    ['Documents created', stats?.documents_created],
    ['Documents skipped', stats?.documents_skipped],
    ['Indicators created', stats?.indicators_created],
    ['Indicator links created', stats?.indicator_links_created],
    ['Invalid records skipped', stats?.records_skipped_invalid],
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Data Ingestion</h1>
        <p className="mt-2 text-sm text-slate-400">
          Import real threat intelligence from external sources into CypherNex.
        </p>
      </div>

      <section className="max-w-2xl rounded-xl border border-slate-800 bg-[#101a2b] p-6">
        <div className="flex items-center gap-3">
          <Database className="text-teal-400" size={24} />
          <div>
            <h2 className="font-semibold text-white">URLhaus</h2>
            <p className="text-xs text-slate-400">
              Malware URL intelligence feed
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm text-slate-300">
            Number of records
          </label>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white"
            disabled={loading}
          >
            {[5, 10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>

        <button
          onClick={startIngestion}
          disabled={loading}
          className="mt-5 flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw size={17} className="animate-spin" />
          ) : (
            <Activity size={17} />
          )}
          {loading ? 'Ingesting...' : 'Start Ingestion'}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </section>

      {stats && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="mt-3 text-2xl font-bold text-teal-300">
                {value ?? 0}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
