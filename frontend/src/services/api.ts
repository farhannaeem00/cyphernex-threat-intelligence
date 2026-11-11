import axios from 'axios'
import type { BackendHealth, GraphResponse, SearchResponse, InvestigationHistoryResponse, InvestigationDetailResponse, InvestigationRunRequest, InvestigationRunResponse, RiskResponse } from '../types/api'
export type * from '../types/api'

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})





















export const apiService = {
  health: async () => {
    const { data } = await api.get<BackendHealth>('/health')
    return data
  },

  risks: async (): Promise<RiskResponse> => {
  const response = await api.get<RiskResponse>("/api/risks/");
  return response.data;
},


  runInvestigation: async (payload: InvestigationRunRequest) => {
    const { data } = await api.post<InvestigationRunResponse>(
      '/api/investigations/run',
      payload,
    )
    return data
  },

  graph: async () => {
    const { data } = await api.get<GraphResponse>('/api/graph/')
    return data
  },

  search: async (query: string, limit = 10) => {
    const { data } = await api.get<SearchResponse>('/api/search/', {
      params: { q: query, limit },
    })
    return data
  },

  investigations: async () => {
    const { data } = await api.get<InvestigationHistoryResponse>(
      '/api/investigations/',
    )
    return data
  },

  investigationDetail: async (id: number) => {
    const { data } = await api.get<InvestigationDetailResponse>(
      `/api/investigations/${id}`,
    )
    return data
  },
}




export default api
