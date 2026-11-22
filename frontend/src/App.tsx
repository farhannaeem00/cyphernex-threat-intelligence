import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { Investigations, InvestigationHistory } from './features/investigations'
import { Dashboard } from './features/dashboard'
import { ThreatGraph } from './features/graph'
import { Intelligence } from './features/intelligence'
import { RiskAnalysis } from './features/risks'
import { Documents } from './features/documents'
import Ingestion from './features/ingestion/Ingestion'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/investigations" element={<Investigations />} />
          <Route
            path="/investigations/history"
            element={<InvestigationHistory />}
          />
          <Route path="/graph" element={<ThreatGraph />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/risks" element={<RiskAnalysis />} />
          <Route path="/ingestion" element={<Ingestion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
