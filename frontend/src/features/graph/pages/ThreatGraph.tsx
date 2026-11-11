
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import {
  Database,
  Globe,
  Network,
  Server,
  RefreshCw,
  X,
} from 'lucide-react'

import { apiService } from '../../../services/api'
import type {
  GraphNode,
  GraphEdge,
  GraphResponse,
} from '../../../services/api'

// --------------------------------------------------
// Types
// --------------------------------------------------

type GraphNodeData = {
  label: string
  category: string
  subtitle: string
}

// --------------------------------------------------
// Custom document node
// --------------------------------------------------

function DocumentNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div
      className={`w-[230px] rounded-xl border bg-[#111d30] p-4 shadow-xl ${
        selected
          ? 'border-teal-300 ring-2 ring-teal-400/20'
          : 'border-teal-500/40'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-teal-400"
      />

      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-teal-400/10 p-2">
          <Database size={19} className="text-teal-300" />
        </div>

        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-300">
            Source document
          </p>

          <p className="mt-1 break-words text-sm font-medium text-white">
            {data.label}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        {data.subtitle}
      </p>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-teal-400"
      />
    </div>
  )
}

// --------------------------------------------------
// Custom indicator node
// --------------------------------------------------

function IndicatorNode({ data, selected }: NodeProps<Node<GraphNodeData>>) {
  const category = data.category.toLowerCase()

  const Icon =
    category === 'ip'
      ? Server
      : category === 'hostname'
        ? Globe
        : Network

  const color =
    category === 'ip'
      ? 'text-orange-300'
      : category === 'hostname'
        ? 'text-purple-300'
        : 'text-sky-300'

  const border =
    category === 'ip'
      ? 'border-orange-400/40'
      : category === 'hostname'
        ? 'border-purple-400/40'
        : 'border-sky-400/40'

  return (
    <div
      className={`w-[270px] rounded-xl border bg-[#111d30] p-4 shadow-xl ${
        selected
          ? 'border-white ring-2 ring-white/20'
          : border
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-sky-400"
      />

      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-slate-800 p-2">
          <Icon size={18} className={color} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}
          >
            {data.category} indicator
          </p>

          <p className="mt-2 break-all text-xs leading-5 text-slate-200">
            {data.label}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-sky-400"
      />
    </div>
  )
}

// Keep nodeTypes outside the component to avoid unnecessary recreation.
const nodeTypes = {
  documentNode: DocumentNode,
  indicatorNode: IndicatorNode,
}

// --------------------------------------------------
// Relationship styling
// --------------------------------------------------

function getEdgeStyle(type: string) {
  switch (type) {
    case 'observed_shared_tag':
      return {
        stroke: '#f59e0b',
        label: 'Shared tags',
        dashed: true,
      }

    case 'observed_shared_reporter':
      return {
        stroke: '#38bdf8',
        label: 'Shared reporter',
        dashed: true,
      }

    case 'contains_indicator':
    default:
      return {
        stroke: '#64748b',
        label: 'Contains indicator',
        dashed: false,
      }
  }
}

// --------------------------------------------------
// Convert backend graph data into React Flow data
// --------------------------------------------------

function buildGraph(data: GraphResponse): {
  nodes: Node<GraphNodeData>[]
  edges: Edge[]
} {
  const documents = data.nodes.filter(
    (node) => node.type === 'document',
  )

  const indicators = data.nodes.filter(
    (node) => node.type === 'indicator',
  )

  const nodes: Node<GraphNodeData>[] = [
    ...documents.map((item, index) => ({
      id: item.id,
      type: 'documentNode',
      position: {
        x: 80,
        y: 80 + index * 190,
      },
      data: {
        label: item.label,
        category: 'document',
        subtitle: item.source ?? 'Threat intelligence source',
      },
    })),

    ...indicators.map((item, index) => ({
      id: item.id,
      type: 'indicatorNode',
      position: {
        x: 650,
        y: 55 + index * 115,
      },
      data: {
        label: item.label,
        category: item.indicator_type ?? 'indicator',
        subtitle: item.id,
      },
    })),
  ]

  const edges: Edge[] = data.edges.map((item: GraphEdge) => {
    const style = getEdgeStyle(item.relationship_type)

    return {
      id: item.id,
      source: item.source,
      target: item.target,
      type: 'smoothstep',

      animated: false,

      label: style.label,

      labelStyle: {
        fill: style.stroke,
        fontSize: 10,
        fontWeight: 600,
      },

      labelBgStyle: {
        fill: '#0b1220',
        fillOpacity: 0.95,
      },

      style: {
        stroke: style.stroke,
        strokeWidth: style.dashed ? 2 : 1.5,
        strokeDasharray: style.dashed ? '6 4' : undefined,
      },

      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: style.stroke,
        width: 15,
        height: 15,
      },
    }
  })

  return { nodes, edges }
}

// --------------------------------------------------
// Type guard for selected graph items
// --------------------------------------------------

function isGraphNode(
  item: GraphNode | GraphEdge,
): item is GraphNode {
  return 'type' in item &&
    (item.type === 'document' || item.type === 'indicator')
}

// --------------------------------------------------
// Main Threat Graph page
// --------------------------------------------------

export default function ThreatGraph() {
  const [graph, setGraph] = useState<GraphResponse | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [selectedItem, setSelectedItem] = useState<
    GraphNode | GraphEdge | null
  >(null)

  const [filter, setFilter] = useState('all')

  // ----------------------------------------------
  // Fetch graph from backend
  // ----------------------------------------------

  const loadGraph = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const result = await apiService.graph()

      setGraph(result)
      setSelectedItem(null)
    } catch (err) {
      console.error('Threat graph loading error:', err)

      setError(
        'Unable to load threat graph. Please check that the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadGraph()
  }, [loadGraph])

  // ----------------------------------------------
  // Build graph and apply relationship filter
  // ----------------------------------------------

  const { nodes, edges } = useMemo(() => {
    if (!graph) {
      return {
        nodes: [] as Node<GraphNodeData>[],
        edges: [] as Edge[],
      }
    }

    const result = buildGraph(graph)

    const filteredEdges =
      filter === 'all'
        ? result.edges
        : result.edges.filter((edge) => {
            const relationship = graph.edges.find(
              (item) => item.id === edge.id,
            )

            return relationship?.relationship_type === filter
          })

    return {
      nodes: result.nodes,
      edges: filteredEdges,
    }
  }, [graph, filter])

  // ----------------------------------------------
  // Selected item type
  // ----------------------------------------------

  const selectedNode =
    selectedItem !== null && isGraphNode(selectedItem)

  const selectedEdge =
    selectedItem !== null && !isGraphNode(selectedItem)

  // ----------------------------------------------
  // Render page
  // ----------------------------------------------

  return (
    <div className="space-y-6">

      {/* Page heading */}

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-teal-400">
            Relationship intelligence
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">
            Threat Graph
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Explore connections between source documents and threat indicators.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadGraph()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 transition hover:border-teal-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loading ? 'animate-spin' : ''}
          />

          Refresh graph
        </button>
      </section>

      {/* Graph statistics */}

      {graph && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Documents', graph.stats.document_nodes],
            ['Indicators', graph.stats.indicator_nodes],
            ['Discovered links', graph.stats.discovered_relationships],
            ['Total edges', graph.stats.relationships],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-800 bg-[#101a2b] p-4"
            >
              <p className="text-xs text-slate-500">
                {label}
              </p>

              <p className="mt-2 text-2xl font-semibold text-white">
                {value}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Relationship explorer */}

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1220]">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div>
            <h2 className="font-semibold text-white">
              Relationship explorer
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Select a node or connection to inspect its details.
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setSelectedItem(null)
            }}
            className="rounded-lg border border-slate-700 bg-[#101a2b] px-3 py-2 text-xs text-slate-300 outline-none focus:border-teal-400"
          >
            <option value="all">
              All relationships
            </option>

            <option value="contains_indicator">
              Contains indicator
            </option>

            <option value="observed_shared_tag">
              Shared tags
            </option>

            <option value="observed_shared_reporter">
              Shared reporter
            </option>
          </select>
        </div>

        {/* Graph canvas */}

        <div className="relative h-[680px]">

          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Loading real threat intelligence graph...
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-red-300">
              <p>{error}</p>

              <button
                type="button"
                onClick={() => void loadGraph()}
                className="rounded-lg border border-red-400/30 px-4 py-2 text-xs hover:bg-red-400/10"
              >
                Try again
              </button>
            </div>
          ) : graph && graph.nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.15}
              maxZoom={2}
              onNodeClick={(_, node) => {
                const original = graph.nodes.find(
                  (item) => item.id === node.id,
                )

                if (original) {
                  setSelectedItem(original)
                }
              }}
              onEdgeClick={(_, edge) => {
                const original = graph.edges.find(
                  (item) => item.id === edge.id,
                )

                if (original) {
                  setSelectedItem(original)
                }
              }}
              onPaneClick={() => setSelectedItem(null)}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                color="#243247"
                gap={24}
                size={1}
              />

              <Controls
                className="!overflow-hidden !rounded-lg !border !border-slate-700 !bg-[#111d30] [&>button]:!border-slate-700 [&>button]:!bg-[#111d30] [&>button]:!fill-slate-300"
              />

              <MiniMap
                nodeColor={(node) =>
                  node.type === 'documentNode'
                    ? '#14b8a6'
                    : '#38bdf8'
                }
                maskColor="rgba(8, 13, 24, 0.75)"
                className="!border !border-slate-700 !bg-[#111d30]"
              />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No graph data is currently available.
            </div>
          )}

          {/* Details panel */}

          {selectedItem && (
            <aside className="absolute right-4 top-4 z-10 w-[320px] max-w-[calc(100%-2rem)] rounded-xl border border-slate-700 bg-[#111d30] p-5 shadow-2xl">

              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">
                  {selectedNode
                    ? 'Node details'
                    : 'Relationship details'}
                </p>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close details"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Node details */}

              {selectedNode && (
                <>
                  <h3 className="mt-4 break-words text-sm font-semibold text-white">
                    {selectedItem.label}
                  </h3>

                  <p className="mt-2 text-xs text-slate-400">
                    Type: {selectedItem.type}
                  </p>

                  {selectedItem.type === 'indicator' &&
                    selectedItem.indicator_type && (
                      <p className="mt-2 text-xs text-slate-400">
                        Indicator category: {selectedItem.indicator_type}
                      </p>
                    )}

                  {selectedItem.type === 'document' &&
                    selectedItem.source && (
                      <p className="mt-2 text-xs text-slate-400">
                        Source: {selectedItem.source}
                      </p>
                    )}

                  <p className="mt-3 break-all text-[11px] text-slate-500">
                    ID: {selectedItem.id}
                  </p>
                </>
              )}

              {/* Relationship details */}

              {selectedEdge && (
                <>
                  <h3 className="mt-4 text-sm font-semibold capitalize text-white">
                    {selectedItem.relationship_type.replaceAll('_', ' ')}
                  </h3>

                  <p className="mt-3 text-xs leading-6 text-slate-300">
                    {selectedItem.description || 'No description provided.'}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-700 pt-3 text-xs text-slate-400">
                    <p className="break-all">
                      Source node: {selectedItem.source}
                    </p>

                    <p className="break-all">
                      Target node: {selectedItem.target}
                    </p>

                    <p>
                      Confidence:{' '}
                      {selectedItem.confidence == null
                        ? 'Not provided'
                        : selectedItem.confidence}
                    </p>
                  </div>
                </>
              )}
            </aside>
          )}
        </div>

        {/* Graph legend */}

        <div className="flex flex-wrap gap-5 border-t border-slate-800 px-5 py-4">
          {[
            ['bg-teal-400', 'Source document'],
            ['bg-sky-400', 'Indicator'],
            ['bg-slate-500', 'Contains indicator'],
            ['bg-amber-400', 'Shared tags'],
            ['bg-sky-300', 'Shared reporter'],
          ].map(([color, label]) => (
            <div
              key={label}
              className="flex items-center gap-2 text-[11px] text-slate-400"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Evidence disclaimer */}

      <p className="text-xs leading-5 text-slate-500">
        Metadata overlaps indicate shared reporting attributes, not confirmed
        attribution, common ownership, or shared infrastructure. Confidence
        is displayed only when provided by the backend.
      </p>
    </div>
  )
}
