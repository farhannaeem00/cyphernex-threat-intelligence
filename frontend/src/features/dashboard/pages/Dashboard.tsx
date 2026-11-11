
import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Database,
  Network,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FileSearch,
  Clock,
} from 'lucide-react'
import {
  apiService,
  type GraphStats,
  type BackendHealth,
  type RiskAssessment,
  type Investigation,
} from '../../../services/api'

const emptyStats: GraphStats = {
  document_nodes: 0,
  indicator_nodes: 0,
  document_indicator_relationships: 0,
  discovered_relationships: 0,
  relationships: 0,
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string | number
  description: string
  icon: typeof Activity
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{title}</p>
        <Icon size={19} className="text-teal-400" />
      </div>
      <p className="mt-5 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Dashboard() {
  const [stats, setStats] = useState<GraphStats>(emptyStats)
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [risks, setRisks] = useState<RiskAssessment[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [investigationTotal, setInvestigationTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const loadDashboard = useCallback(async () => {
    setErrors([])

    const results = await Promise.allSettled([
      apiService.health(),
      apiService.graph(),
      apiService.risks(),
      apiService.investigations(),
    ])

    const newErrors: string[] = []

    if (results[0].status === 'fulfilled') {
      setHealth(results[0].value)
    } else {
      newErrors.push('Backend health could not be retrieved.')
    }

    if (results[1].status === 'fulfilled') {
      setStats(results[1].value.stats)
    } else {
      newErrors.push('Threat graph statistics could not be retrieved.')
    }

    if (results[2].status === 'fulfilled') {
      setRisks(results[2].value.assessments ?? [])
    } else {
      newErrors.push('Risk assessments could not be retrieved.')
    }

    if (results[3].status === 'fulfilled') {
      setInvestigations(results[3].value.investigations ?? [])
      setInvestigationTotal(results[3].value.total ?? 0)
    } else {
      newErrors.push('Investigation history could not be retrieved.')
    }

    setErrors(newErrors)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const riskCounts = {
    critical: risks.filter((r) => r.risk_level?.toLowerCase() === 'critical').length,
    high: risks.filter((r) => r.risk_level?.toLowerCase() === 'high').length,
    medium: risks.filter((r) => r.risk_level?.toLowerCase() === 'medium').length,
    low: risks.filter((r) => r.risk_level?.toLowerCase() === 'low').length,
  }

  const cards = [
    {
      title: 'Threat Documents',
      value: stats.document_nodes,
      description: 'Ingested intelligence records',
      icon: Database,
    },
    {
      title: 'Indicators',
      value: stats.indicator_nodes,
      description: 'Extracted threat indicators',
      icon: ShieldCheck,
    },
    {
      title: 'Document Links',
      value: stats.document_indicator_relationships,
      description: 'Document-to-indicator connections',
      icon: Network,
    },
    {
      title: 'Discovered Relationships',
      value: stats.discovered_relationships,
      description: 'Metadata-based relationships',
      icon: Activity,
    },
  ]

  const recentInvestigations = [...investigations]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5)

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-teal-400">
            Security intelligence overview
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Monitor threat intelligence, risk assessments, and investigations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                health?.status === 'healthy' ? 'bg-teal-400' : 'bg-red-400'
              }`}
            />
            <span className="text-slate-300">
              Backend: {health?.status ?? 'Unavailable'}
            </span>
          </div>

          <button
            onClick={() => {
              setRefreshing(true)
              void loadDashboard()
            }}
            disabled={loading || refreshing}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 transition hover:border-teal-500 hover:text-teal-400 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="mb-2 text-sm font-semibold text-yellow-300">
            Some dashboard data could not be loaded
          </p>
          {errors.map((error) => (
            <p key={error} className="text-xs text-slate-400">
              • {error}
            </p>
          ))}
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Intelligence Statistics</h2>
          <span className="text-xs text-slate-500">Live backend data</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Risk Overview</h2>
          <a
            href="/risks"
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            View all assessments →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Critical', value: riskCounts.critical, color: 'text-red-400' },
            { label: 'High', value: riskCounts.high, color: 'text-orange-400' },
            { label: 'Medium', value: riskCounts.medium, color: 'text-yellow-400' },
            { label: 'Low', value: riskCounts.low, color: 'text-green-400' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800 bg-[#101a2b] p-5"
            >
              <p className="text-sm text-slate-400">{item.label} Risk</p>
              <p className={`mt-3 text-3xl font-semibold ${item.color}`}>
                {loading ? '—' : item.value}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {loading ? 'Loading assessments...' : `${risks.length} risk assessments retrieved.`}
          {' '}Risk levels represent source-based triage, not confirmed compromise.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Network size={19} className="text-teal-400" />
            <h2 className="text-lg font-semibold text-white">
              Intelligence Network
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Relationship graph data currently available in the backend.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold text-white">
                {stats.relationships}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total graph edges</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {stats.discovered_relationships}
              </p>
              <p className="mt-1 text-xs text-slate-500">Discovered links</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {stats.indicator_nodes + stats.document_nodes}
              </p>
              <p className="mt-1 text-xs text-slate-500">Total graph nodes</p>
            </div>
          </div>

          <a
            href="/graph"
            className="mt-7 inline-block text-xs text-teal-400 hover:text-teal-300"
          >
            Explore threat graph →
          </a>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-6">
          <div className="flex items-center gap-2">
            <FileSearch size={19} className="text-teal-400" />
            <h2 className="text-lg font-semibold text-white">
              Investigations
            </h2>
          </div>

          <p className="mt-5 text-3xl font-semibold text-white">
            {loading ? '—' : investigationTotal}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Total saved investigations
          </p>

          <a
            href="/investigations"
            className="mt-7 inline-block text-xs text-teal-400 hover:text-teal-300"
          >
            Start an investigation →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#101a2b]">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-teal-400" />
            <h2 className="font-semibold text-white">Recent Investigations</h2>
          </div>
          <a
            href="/investigations/history"
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            View history →
          </a>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-400">
            Loading investigation history...
          </p>
        ) : recentInvestigations.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No saved investigations yet. Start an investigation to see activity here.
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentInvestigations.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {item.query}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(item.created_at)}
                    {' • '}
                    {item.evidence_count} evidence items
                  </p>
                </div>

                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs capitalize text-slate-300">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={19}
            className="mt-0.5 shrink-0 text-yellow-400"
          />
          <div>
            <h3 className="text-sm font-semibold text-yellow-300">
              Intelligence platform status
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Dashboard statistics reflect the latest API responses. Risk
              assessments and discovered relationships are investigative
              indicators; they do not independently establish compromise,
              attribution, or common ownership.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
