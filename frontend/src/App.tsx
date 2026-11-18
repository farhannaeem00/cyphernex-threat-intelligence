
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import { Investigations } from './features/investigations'
import { InvestigationHistory } from './features/investigations'

import { Dashboard } from "./features/dashboard";
import { ThreatGraph } from "./features/graph";
import { Intelligence } from "./features/intelligence";
import { RiskAnalysis } from "./features/risks";
import { Documents } from "./features/documents";
// function ComingSoon({ title }: { title: string }) {
//   return (
//     <div className="rounded-xl border border-slate-800 bg-[#101a2b] p-8">
//       <h1 className="text-2xl font-bold text-white">{title}</h1>
//       <p className="mt-3 text-sm text-slate-400">
//         This workspace will be connected to the CypherNex backend in the next
//         implementation stage.
//       </p>
//     </div>
//   )
// }

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
        </Route>
        
      </Routes>
    </BrowserRouter>
  )
}
