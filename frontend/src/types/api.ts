/* Shared API response and domain contracts. */

export interface BackendHealth {
  status: string
  service?: string
}

export interface GraphNode {
  id: string
  type: 'document' | 'indicator'
  label: string
  source?: string
  indicator_type?: 'url' | 'ip' | 'hostname' | string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationship_type: string
  description: string
  confidence: number | null
}

export interface GraphStats {
  document_nodes: number
  indicator_nodes: number
  document_indicator_relationships: number
  discovered_relationships: number
  relationships: number
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: GraphStats
}

export interface SearchResponse {
  document_count: number
  indicator_count: number
  documents?: Array<Record<string, unknown>>
  indicators?: Array<Record<string, unknown>>
}

export interface Investigation {
  id: number
  query: string
  status: string
  evidence_count: number
  created_at: string
}

export interface InvestigationHistoryResponse {
  total: number
  investigations: Investigation[]
}

export type InvestigationDetailResponse = Record<string, unknown>

export interface InvestigationRunRequest {
  query: string
  limit: number
  document_ids?: number[]
}

export type InvestigationRunResponse = Record<string, unknown>

export interface RiskAssessment {
  finding_id: number;
  title: string;
  description: string;
  finding_type: string;
  risk_level: string;
  confidence: number | null;
  source: string;
  source_url: string | null;
  external_id: string | null;
  citation: {
    citation_id: number;
    quoted_text: string;
  } | null;
  created_at: string;
}

export interface RiskResponse {
  total: number;
  assessments: RiskAssessment[];
}
