import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getGraph } from '../api/client'
import { RefreshCw, Info } from 'lucide-react'

export default function KnowledgeGraph({ onSelectNote, refreshTrigger }) {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const [graphData, setGraphData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await getGraph()
      setGraphData(data)
      setStats({ nodes: data.nodes.length, edges: data.edges.length })
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshTrigger])

  useEffect(() => {
    if (!graphData || loading) return
    const { nodes, edges } = graphData

    const container = svgRef.current.parentElement
    const W = container.clientWidth
    const H = container.clientHeight

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3
      .select(svgRef.current)
      .attr('width', W)
      .attr('height', H)

    // Defs: glow filter + arrow marker
    const defs = svg.append('defs')

    defs.append('filter')
      .attr('id', 'glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')

    const feMerge = defs.select('#glow').append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#2a2f45')

    // Radial background gradient
    const radial = defs.append('radialGradient')
      .attr('id', 'bg-gradient')
      .attr('cx', '50%').attr('cy', '50%')
      .attr('r', '50%')
    radial.append('stop').attr('offset', '0%').attr('stop-color', '#0e1118')
    radial.append('stop').attr('offset', '100%').attr('stop-color', '#080a12')

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', 'url(#bg-gradient)')

    // Zoom behaviour
    const g = svg.append('g').attr('class', 'everything')

    svg.call(
      d3.zoom()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => g.attr('transform', event.transform))
    )

    if (nodes.length === 0) return

    // Copy for simulation
    const simNodes = nodes.map((n) => ({ ...n }))
    const idToIndex = {}
    simNodes.forEach((n, i) => { idToIndex[n.id] = i })

    const simEdges = edges
      .filter((e) => idToIndex[e.source_id] !== undefined && idToIndex[e.target_id] !== undefined)
      .map((e) => ({
        ...e,
        source: idToIndex[e.source_id],
        target: idToIndex[e.target_id],
      }))

    // Node radius: based on word count + connections
    const maxDegree = Math.max(...simNodes.map((n) => n.degree), 1)
    const rScale = d3.scaleSqrt().domain([0, maxDegree]).range([10, 26])

    // Node color: analyzed = synapse indigo, not analyzed = muted
    const nodeColor = (n) => n.analyzed ? '#6366f1' : '#1e2130'
    const nodeStroke = (n) => n.analyzed ? '#818cf8' : '#2a2f45'

    // Simulation
    const simulation = d3
      .forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id((d) => d.index).distance((d) => 120 / (d.strength || 0.5)).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius((d) => rScale(d.degree) + 8))

    // Edges
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', '#1e2130')
      .attr('stroke-width', (d) => Math.max(1, d.strength * 3))
      .attr('stroke-opacity', (d) => 0.3 + d.strength * 0.5)
      .attr('marker-end', 'url(#arrowhead)')

    // Node groups
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    // Outer glow ring (for analyzed nodes)
    node
      .filter((d) => d.analyzed)
      .append('circle')
      .attr('r', (d) => rScale(d.degree) + 4)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.25)
      .attr('filter', 'url(#glow)')

    // Main circle
    node
      .append('circle')
      .attr('r', (d) => rScale(d.degree))
      .attr('fill', nodeColor)
      .attr('stroke', nodeStroke)
      .attr('stroke-width', 1.5)
      .attr('filter', (d) => d.analyzed ? 'url(#glow)' : null)

    // Concept dot cluster inside analyzed nodes
    node.filter((d) => d.analyzed && d.concepts?.length > 0).each(function(d) {
      const g_node = d3.select(this)
      const r = rScale(d.degree)
      const dotCount = Math.min(d.concepts.length, 5)
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * 2 * Math.PI - Math.PI / 2
        const dr = r * 0.45
        g_node.append('circle')
          .attr('cx', Math.cos(angle) * dr)
          .attr('cy', Math.sin(angle) * dr)
          .attr('r', 2.5)
          .attr('fill', '#22d3ee')
          .attr('opacity', 0.7)
      }
    })

    // Labels
    node
      .append('text')
      .attr('dy', (d) => rScale(d.degree) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-family', 'DM Sans, sans-serif')
      .attr('fill', '#94a3b8')
      .text((d) => d.title.length > 18 ? d.title.slice(0, 16) + '…' : d.title)

    // Interactions
    const tooltip = d3.select(tooltipRef.current)

    node
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).select('circle:nth-child(2)').transition().duration(150).attr('r', rScale(d.degree) * 1.15)
        tooltip.classed('visible', true).html(`
          <div style="font-family:'Syne',sans-serif;font-weight:600;color:#f1f5f9;margin-bottom:4px;font-size:0.8rem">${d.title}</div>
          ${d.summary ? `<div style="color:#94a3b8;font-size:0.72rem;line-height:1.4;margin-bottom:5px">${d.summary}</div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            ${(d.concepts || []).slice(0, 4).map(c => `<span style="background:rgba(99,102,241,0.15);color:#818cf8;border:1px solid rgba(99,102,241,0.3);border-radius:3px;padding:1px 5px;font-size:0.65rem;font-family:monospace">${c}</span>`).join('')}
          </div>
          ${d.degree > 0 ? `<div style="color:#22d3ee;font-size:0.65rem;margin-top:4px;font-family:monospace">${d.degree} connection${d.degree !== 1 ? 's' : ''}</div>` : ''}
        `)
      })
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event, svgRef.current.parentElement)
        tooltip
          .style('left', (mx + 14) + 'px')
          .style('top', (my - 10) + 'px')
      })
      .on('mouseleave', (event, d) => {
        d3.select(event.currentTarget).select('circle:nth-child(2)').transition().duration(150).attr('r', rScale(d.degree))
        tooltip.classed('visible', false)
      })
      .on('click', (_, d) => onSelectNote?.(d.id))

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => simulation.stop()
  }, [graphData, loading])

  return (
    <div className="relative w-full h-full bg-void">
      <svg ref={svgRef} className="w-full h-full" />
      <div ref={tooltipRef} className="graph-tooltip" />

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-panel/80 backdrop-blur border border-border rounded-lg">
          <div className="w-2 h-2 rounded-full bg-synapse-500" />
          <span className="text-xs font-mono text-gray-400">{stats.nodes} nodes</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-panel/80 backdrop-blur border border-border rounded-lg">
          <div className="w-2 h-2 rounded-full bg-neural" />
          <span className="text-xs font-mono text-gray-400">{stats.edges} synapses</span>
        </div>
        <button
          onClick={load}
          className="w-7 h-7 flex items-center justify-center bg-panel/80 backdrop-blur border border-border rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 px-3 py-2.5 bg-panel/80 backdrop-blur border border-border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-synapse-500 border border-synapse-400" />
          <span className="text-xs text-gray-500 font-mono">analyzed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-panel border border-border-bright" />
          <span className="text-xs text-gray-500 font-mono">unanalyzed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neural" />
          <span className="text-xs text-gray-500 font-mono">concept</span>
        </div>
      </div>

      {/* Empty state */}
      {!loading && graphData?.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-gray-700 font-display text-sm">No notes yet</p>
          <p className="text-gray-800 text-xs mt-1">Create notes and analyze them to build your graph</p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-synapse-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-gray-800 text-xs font-mono">
        <Info className="w-3 h-3" />
        drag · scroll to zoom · click to open
      </div>
    </div>
  )
}
