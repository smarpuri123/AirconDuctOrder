import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey'
import {
  buildFlowSankeyGraph,
  STAGE_FLOW_COLORS,
  type FlowSankeyLink,
  type FlowSankeyNode,
} from '@/lib/operationsFlow/sankeyGraph'
import type { FlowSnapshot, FlowWorkCard } from '@/lib/operationsFlow/types'

type SankeyNodeLayout = FlowSankeyNode & {
  x0?: number
  x1?: number
  y0?: number
  y1?: number
  value?: number
}

type SankeyLinkLayout = FlowSankeyLink & {
  source: SankeyNodeLayout
  target: SankeyNodeLayout
  y0?: number
  y1?: number
  width?: number
  index?: number
}

const MARGIN = { top: 48, right: 200, bottom: 24, left: 160 }
const COLUMN_LABELS = ['Clients', 'Enquiries', 'Processor / status']

type Props = {
  snapshot: FlowSnapshot
  onSelectCard: (card: FlowWorkCard) => void
}

export function OperationsFlowSankey({ snapshot, onSelectCard }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 960, height: 520 })
  const [hoverLink, setHoverLink] = useState<number | null>(null)

  const graphData = useMemo(() => buildFlowSankeyGraph(snapshot), [snapshot])

  const cardById = useMemo(() => {
    const m = new Map<string, FlowWorkCard>()
    for (const c of snapshot.cards) m.set(c.id, c)
    return m
  }, [snapshot.cards])

  const layout = useMemo(() => {
    if (graphData.nodes.length === 0) return null

    const height = Math.max(
      420,
      MARGIN.top + MARGIN.bottom + graphData.nodes.length * 14,
    )
    const width = size.width

    const nodes: SankeyNodeLayout[] = graphData.nodes.map((n) => ({ ...n }))
    const links = graphData.links.map((l) => ({ ...l }))

    const sankeyGen = sankey<SankeyNodeLayout, FlowSankeyLink & { source: string; target: string }>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(20)
      .nodePadding(14)
      .extent([[MARGIN.left, MARGIN.top], [width - MARGIN.right, height - MARGIN.bottom]])

    const result = sankeyGen({ nodes, links })

    return { nodes: result.nodes, links: result.links as SankeyLinkLayout[], height, width }
  }, [graphData, size.width])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 960
      setSize((s) => ({ ...s, width: Math.max(720, w) }))
    })
    ro.observe(el)
    setSize({ width: Math.max(720, el.clientWidth), height: 520 })
    return () => ro.disconnect()
  }, [])

  const linkPath = sankeyLinkHorizontal<SankeyNodeLayout, SankeyLinkLayout>()

  const resolveCard = (node: FlowSankeyNode): FlowWorkCard | undefined => {
    if (node.cardId && cardById.has(node.cardId)) return cardById.get(node.cardId)
    if (node.enquiryId) {
      return snapshot.cards.find((c) => c.enquiryId === node.enquiryId)
    }
    if (node.kind === 'client') {
      const clientKey = node.id.replace(/^client:/, '')
      return snapshot.cards.find((c) => c.clientId === clientKey)
    }
    return undefined
  }

  const columnXs = useMemo(() => {
    if (!layout?.nodes.length) return []
    const xs = [...new Set(layout.nodes.map((n) => n.x0 ?? 0))].sort((a, b) => a - b)
    return xs.slice(0, 3)
  }, [layout])

  if (!layout) {
    return (
      <div className="py-16 text-center text-text-secondary text-sm">No flow data to chart.</div>
    )
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
      <svg
        width={layout.width}
        height={layout.height}
        className="select-none"
        role="img"
        aria-label="Operations work flow Sankey diagram"
      >
        {columnXs.map((x, i) => (
          <text
            key={x}
            x={x + (i === 2 ? 20 : 0)}
            y={28}
            className="fill-text-primary text-xs font-semibold"
          >
            {COLUMN_LABELS[i] ?? ''}
          </text>
        ))}

        <g className="sankey-links">
          {layout.links.map((link, i) => {
            const stage = link.displayStage ?? link.target.displayStage ?? 'enquiry'
            const color = STAGE_FLOW_COLORS[stage]
            const d = linkPath(link)
            if (!d) return null
            const active = hoverLink === null || hoverLink === i
            return (
              <path
                key={`link-${i}`}
                d={d}
                fill="none"
                stroke={color}
                strokeOpacity={active ? 0.42 : 0.12}
                strokeWidth={Math.max(1, link.width ?? 1)}
                className="cursor-pointer transition-[stroke-opacity]"
                onMouseEnter={() => setHoverLink(i)}
                onMouseLeave={() => setHoverLink(null)}
                onClick={() => {
                  const card = resolveCard(link.target)
                  if (card) onSelectCard(card)
                }}
              >
                <title>
                  {link.source.name} → {link.target.name} (weight {link.value})
                </title>
              </path>
            )
          })}
        </g>

        <g className="sankey-nodes">
          {layout.nodes.map((node) => {
            const h = (node.y1 ?? 0) - (node.y0 ?? 0)
            const stage = node.displayStage ?? 'enquiry'
            const fill = STAGE_FLOW_COLORS[stage]
            const labelX =
              node.x0! < layout.width / 3
                ? (node.x0 ?? 0) - 8
                : (node.x1 ?? 0) + 8
            const anchor = node.x0! < layout.width / 3 ? 'end' : 'start'
            const showLabel = h >= 6

            return (
              <g key={node.id}>
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={(node.x1 ?? 0) - (node.x0 ?? 0)}
                  height={Math.max(1, h)}
                  fill={fill}
                  rx={2}
                  className="cursor-pointer hover:opacity-90"
                  onClick={() => {
                    const card = resolveCard(node)
                    if (card) onSelectCard(card)
                  }}
                >
                  <title>{node.name}</title>
                </rect>
                {showLabel && (
                  <text
                    x={labelX}
                    y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                    className="fill-text-primary text-[10px] pointer-events-none"
                  >
                    {node.name.length > 42 ? `${node.name.slice(0, 40)}…` : node.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="flex flex-wrap gap-4 px-4 pb-4 text-[11px] text-text-secondary border-t border-border pt-3">
        {Object.entries(STAGE_FLOW_COLORS).map(([stage, color]) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            {stage.replace(/_/g, ' ')}
          </span>
        ))}
        <span className="text-text-secondary">Ribbon width ∝ area (or qty)</span>
      </div>
    </div>
  )
}
