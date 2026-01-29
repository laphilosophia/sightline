/**
 * Sightline Benchmark - 189MB GeoJSON Stress Test
 *
 * Tests projection-based virtualization with massive dataset.
 */

import { addNode, createNode, createSightline, SightlineEngine } from './index'

const JSON_URL =
  'https://raw.githubusercontent.com/zemirco/sf-city-lots-json/refs/heads/master/citylots.json'

interface CityLot {
  type: string
  properties: {
    MAPBLKLOT: string
    BLKLOT: string
    BLOCK_NUM: string
    LOT_NUM: string
    FROM_ST?: string
    TO_ST?: string
    STREET?: string
    ST_TYPE?: string
    ODD_EVEN?: string
  }
  geometry: unknown
}

interface GeoJSON {
  type: string
  features: CityLot[]
}

async function fetchData(): Promise<CityLot[]> {
  console.log('⏳ Fetching 189MB GeoJSON (this may take a while)...')
  const start = performance.now()

  const response = await fetch(JSON_URL)
  console.log(`📡 Response received, parsing JSON...`)

  const data = (await response.json()) as GeoJSON

  console.log(`✅ Fetched & parsed in ${((performance.now() - start) / 1000).toFixed(1)}s`)
  console.log(`📦 Features: ${data.features.length.toLocaleString()}`)

  return data.features
}

function buildTree(engine: SightlineEngine, lots: CityLot[]): void {
  console.log('\n⏳ Building tree...')
  const start = performance.now()

  const registry = engine.getRegistry()

  // Group by BLOCK_NUM for hierarchical structure
  const blocks = new Map<string, CityLot[]>()
  for (const lot of lots) {
    const block = lot.properties.BLOCK_NUM || 'UNKNOWN'
    if (!blocks.has(block)) blocks.set(block, [])
    const blockLots = blocks.get(block)
    if (blockLots) blockLots.push(lot)
  }

  console.log(`  📊 Unique blocks: ${blocks.size.toLocaleString()}`)

  // Create root
  const blockIds = Array.from(blocks.keys()).map((b) => `block-${b}`)
  const root = createNode('root', {
    childNodeIds: blockIds,
    label: `San Francisco City Lots (${lots.length.toLocaleString()} lots)`,
    isExpanded: true,
  })

  // Calculate initial size: root + all blocks (collapsed)
  root.visibleSubtreeSize = 1 + blocks.size
  addNode(registry, root)

  // Add block nodes (collapsed by default)
  for (const [blockNum, blockLots] of blocks) {
    const lotIds = blockLots.map((_, i) => `lot-${blockNum}-${i}`)
    const block = createNode(`block-${blockNum}`, {
      parentNodeId: 'root',
      depth: 1,
      childNodeIds: lotIds,
      label: `Block ${blockNum} (${blockLots.length} lots)`,
      isExpanded: false, // Collapsed - lazy!
    })
    block.visibleSubtreeSize = 1 // Self only when collapsed
    addNode(registry, block)

    // Add lot nodes (hidden until block expanded)
    blockLots.forEach((lot, i) => {
      const street = lot.properties.STREET || 'Unknown'
      const fromSt = lot.properties.FROM_ST || ''
      const toSt = lot.properties.TO_ST || ''
      const address = fromSt && toSt ? `${fromSt}-${toSt}` : lot.properties.LOT_NUM

      addNode(
        registry,
        createNode(`lot-${blockNum}-${i}`, {
          parentNodeId: `block-${blockNum}`,
          depth: 2,
          label: `${address} ${street}`,
          childNodeIds: [], // Leaf
        })
      )
    })
  }

  console.log(`✅ Tree built in ${((performance.now() - start) / 1000).toFixed(2)}s`)
  console.log(`🌳 Total nodes: ${registry.size().toLocaleString()}`)
  console.log(
    `👀 Initially visible: ${engine.getTotalVisibleCount().toLocaleString()} (root + blocks)`
  )
}

function benchmarkGetRange(engine: SightlineEngine): void {
  console.log('\n📊 Benchmarking getRange (collapsed tree)...\n')

  const totalVisible = engine.getTotalVisibleCount()
  const windowSize = 50

  const offsets = [0, 100, 500, 1000, Math.floor(totalVisible / 2), totalVisible - 100]

  for (const offset of offsets) {
    if (offset < 0 || offset >= totalVisible) continue

    const iterations = 1000
    const start = performance.now()

    for (let i = 0; i < iterations; i++) {
      engine.getRange(offset, windowSize)
    }

    const elapsed = performance.now() - start
    const avgMs = elapsed / iterations

    console.log(`  offset=${offset.toString().padStart(5)}: ${avgMs.toFixed(4)}ms avg`)
  }
}

function testExpandBlock(engine: SightlineEngine): void {
  console.log('\n� Testing block expansion...\n')

  const registry = engine.getRegistry()

  // Find a block with many lots
  let targetBlock: string | null = null
  let maxLots = 0

  for (const node of registry.values()) {
    if (node.nodeId.toString().startsWith('block-')) {
      const lotCount = node.childNodeIds?.length ?? 0
      if (lotCount > maxLots) {
        maxLots = lotCount
        targetBlock = node.nodeId.toString()
      }
    }
  }

  if (!targetBlock) return

  console.log(`  Expanding ${targetBlock} with ${maxLots} lots...`)

  const beforeCount = engine.getTotalVisibleCount()
  const start = performance.now()

  engine.expand(targetBlock)

  const expandTime = performance.now() - start
  const afterCount = engine.getTotalVisibleCount()

  console.log(`  ⏱️  Expand time: ${expandTime.toFixed(2)}ms`)
  console.log(
    `  📈 Visible count: ${beforeCount.toLocaleString()} → ${afterCount.toLocaleString()}`
  )

  // Test getRange with expanded block
  const blockNode = registry.get(targetBlock)
  if (blockNode) {
    const items = engine.getRange(1, 10) // Skip root, get first 10 blocks/lots
    console.log(`\n  First 10 visible items:`)
    items.forEach((item, i) => {
      console.log(`    ${i + 1}. [depth=${item.depth}] ${item.label}`)
    })
  }
}

function memoryStats(): void {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage()
    console.log('\n💾 Memory Usage:')
    console.log(`  Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`)
  }
}

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Sightline Stress Test - 189MB San Francisco City Lots')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    // Increase memory limit hint
    console.log('⚠️  This test requires ~1GB RAM for JSON parsing\n')

    const lots = await fetchData()
    memoryStats()

    const engine = createSightline()
    buildTree(engine, lots)
    memoryStats()

    benchmarkGetRange(engine)
    testExpandBlock(engine)
    memoryStats()

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('  ✅ Stress Test Complete')
    console.log('═══════════════════════════════════════════════════════════\n')
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  }
}

main()
