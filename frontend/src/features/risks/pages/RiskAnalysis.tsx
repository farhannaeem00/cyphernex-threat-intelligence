
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Search,
  ExternalLink,
  RefreshCw,
  FileText,
  Activity,
} from "lucide-react";
import { apiService, type RiskAssessment } from "../../../services/api";

type RiskFilter = "all" | "critical" | "high" | "medium" | "low" | "unrated";

const riskStyles: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  low: "border-green-500/30 bg-green-500/10 text-green-400",
  unrated: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

function RiskBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
        riskStyles[normalized] ?? riskStyles.unrated
      }`}
    >
      {level}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function RiskAnalysis() {
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RiskFilter>("all");

  const loadRisks = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiService.risks();

      setAssessments(response.assessments ?? []);
      setTotal(response.total ?? 0);
    } catch (err) {
      console.error("Failed to load risk assessments:", err);
      setError("Unable to load risk assessments. Check that the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRisks();
  }, []);

  const counts = useMemo(() => {
    const result = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unrated: 0,
    };

    assessments.forEach((item) => {
      const level = item.risk_level?.toLowerCase();

      if (level in result) {
        result[level as keyof typeof result]++;
      } else {
        result.unrated++;
      }
    });

    return result;
  }, [assessments]);

  const filteredAssessments = useMemo(() => {
    const term = search.toLowerCase().trim();

    return assessments.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (item.risk_level || "unrated").toLowerCase() === filter;

      const matchesSearch =
        !term ||
        [
          item.title,
          item.description,
          item.source,
          item.external_id,
          item.risk_level,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [assessments, filter, search]);

  const cards = [
    {
      label: "Critical",
      value: counts.critical,
      color: "text-red-400",
      icon: ShieldAlert,
      filter: "critical" as RiskFilter,
    },
    {
      label: "High",
      value: counts.high,
      color: "text-orange-400",
      icon: AlertTriangle,
      filter: "high" as RiskFilter,
    },
    {
      label: "Medium",
      value: counts.medium,
      color: "text-yellow-400",
      icon: Activity,
      filter: "medium" as RiskFilter,
    },
    {
      label: "Low",
      value: counts.low,
      color: "text-green-400",
      icon: ShieldCheck,
      filter: "low" as RiskFilter,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Analysis</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review source-based threat assessments and risk indicators.
          </p>
        </div>

        <button
          onClick={loadRisks}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 transition hover:border-teal-500 hover:text-teal-400 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          <button
            onClick={loadRisks}
            className="ml-3 underline hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.label}
              onClick={() =>
                setFilter(filter === card.filter ? "all" : card.filter)
              }
              className={`rounded-xl border bg-slate-900 p-5 text-left transition hover:border-teal-500/50 ${
                filter === card.filter
                  ? "border-teal-500"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{card.label} Risk</span>
                <Icon size={20} className={card.color} />
              </div>
              <div className={`mt-3 text-3xl font-bold ${card.color}`}>
                {loading ? "—" : card.value}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Click to filter assessments
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Risk Distribution</h2>
            <span className="text-sm text-slate-400">
              {total} assessments
            </span>
          </div>

          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-slate-800">
            {total > 0 &&
              cards.map((card) => {
                const colors: Record<string, string> = {
                  Critical: "bg-red-500",
                  High: "bg-orange-500",
                  Medium: "bg-yellow-500",
                  Low: "bg-green-500",
                };

                return (
                  <div
                    key={card.label}
                    className={colors[card.label]}
                    style={{ width: `${(card.value / total) * 100}%` }}
                    title={`${card.label}: ${card.value}`}
                  />
                );
              })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    {
                      Critical: "bg-red-500",
                      High: "bg-orange-500",
                      Medium: "bg-yellow-500",
                      Low: "bg-green-500",
                    }[card.label]
                  }`}
                />
                <span className="text-xs text-slate-400">
                  {card.label}: {card.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-2">
            <FileText size={19} className="text-teal-400" />
            <h2 className="font-semibold text-white">Assessment Summary</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs text-slate-500">Total assessments</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {loading ? "—" : total}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Evidence-based findings</p>
              <p className="mt-1 text-lg font-semibold text-teal-400">
                {loading
                  ? "—"
                  : assessments.filter((item) => item.finding_type === "evidence")
                      .length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Unrated assessments</p>
              <p className="mt-1 text-lg font-semibold text-slate-300">
                {loading ? "—" : counts.unrated}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-5">
          <div>
            <h2 className="font-semibold text-white">Risk Assessments</h2>
            <p className="mt-1 text-xs text-slate-500">
              Findings generated from ingested threat intelligence sources.
            </p>
          </div>

          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assessments..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-3">
          {(["all", "critical", "high", "medium", "low", "unrated"] as RiskFilter[]).map(
            (item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === item
                    ? "bg-teal-500/15 text-teal-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {item}
              </button>
            )
          )}
        </div>

        <div className="divide-y divide-slate-800">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Loading risk assessments...
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              No risk assessments match your search.
            </div>
          ) : (
            filteredAssessments.map((item) => (
              <article key={item.finding_id} className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-semibold text-white">
                        {item.title}
                      </h3>
                      <RiskBadge level={item.risk_level || "unrated"} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Finding #{item.finding_id}
                      {item.external_id && ` • Source record ${item.external_id}`}
                    </p>
                  </div>

                  <span className="text-xs text-slate-500">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                <p className="text-sm leading-6 text-slate-300">
                  {item.description}
                </p>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                  <span>Source: {item.source || "Unknown"}</span>
                  <span>Type: {item.finding_type}</span>
                  <span>
                    Confidence:{" "}
                    {item.confidence == null
                      ? "Not provided"
                      : `${(item.confidence * 100).toFixed(0)}%`}
                  </span>

                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-teal-400 hover:text-teal-300"
                    >
                      View source <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {item.citation?.quoted_text && (
                  <details className="rounded-lg border border-slate-800 bg-slate-950">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-400 hover:text-teal-400">
                      View supporting source evidence
                    </summary>
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-slate-800 p-4 text-xs leading-5 text-slate-400">
                      {(() => {
                        try {
                          return JSON.stringify(
                            JSON.parse(item.citation.quoted_text),
                            null,
                            2
                          );
                        } catch {
                          return item.citation.quoted_text;
                        }
                      })()}
                    </pre>
                  </details>
                )}
              </article>
            ))
          )}
        </div>

        {!loading && (
          <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            Showing {filteredAssessments.length} of {total} assessments
          </div>
        )}
      </div>

      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={19}
            className="mt-0.5 shrink-0 text-yellow-400"
          />
          <div>
            <h3 className="text-sm font-semibold text-yellow-300">
              Risk assessment disclaimer
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Risk levels represent rule-based triage of source-reported
              intelligence. They do not independently confirm compromise,
              malicious activity on a local system, or threat actor attribution.
              Confidence values are displayed only when provided by the backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
