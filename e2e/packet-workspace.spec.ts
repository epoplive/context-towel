import { test, expect } from '@playwright/test'

test.describe('PacketWorkspace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-harness.html')
    await expect(page.getByTestId('harness-ready')).toBeVisible({ timeout: 10_000 })
    // Let React Flow initialize and render
    await page.waitForTimeout(1500)
  })

  test('renders the packet workspace canvas', async ({ page }) => {
    const canvas = page.locator('.react-flow')
    await expect(canvas).toBeVisible()
  })

  test('renders vector node with current state description', async ({ page }) => {
    // VectorNode shows the current state text from the problem vector
    const vectorContent = page.locator('.react-flow__node').filter({
      hasText: 'Auth tokens expire',
    })
    await expect(vectorContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders vector target state', async ({ page }) => {
    // VectorNode also shows approach text
    const targetContent = page.locator('.react-flow__node').filter({
      hasText: 'Intercept 401',
    })
    await expect(targetContent.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders work nodes from AICCL section', async ({ page }) => {
    const workNodes = page.locator('.react-flow__node')
    await expect(workNodes.first()).toBeVisible({ timeout: 5000 })

    const count = await workNodes.count()
    // vector + work nodes + typed nodes + delta timeline = many
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('renders reference node pill', async ({ page }) => {
    // Reference node shows the file path — look for the specific path text
    const refNode = page.locator('.react-flow__node').filter({
      hasText: 'auth.md',
    })
    await expect(refNode.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders test node pill with test path', async ({ page }) => {
    const testNode = page.locator('.react-flow__node').filter({
      hasText: 'refresh.spec.ts',
    })
    await expect(testNode.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders multiple nodes for all AICCL entries', async ({ page }) => {
    const nodes = page.locator('.react-flow__node')
    const count = await nodes.count()
    // Fixture has: vector + investigate-auth + fix-refresh + ref + test + diagram + delta timeline
    expect(count).toBeGreaterThanOrEqual(5)
  })

  test('renders edges between connected nodes', async ({ page }) => {
    const edges = page.locator('.react-flow__edge')
    await expect(edges.first()).toBeVisible({ timeout: 5000 })

    const edgeCount = await edges.count()
    expect(edgeCount).toBeGreaterThanOrEqual(2)
  })

  test('renders work node with investigation content', async ({ page }) => {
    // investigate-auth work node should show its body content
    const node = page.locator('.react-flow__node').filter({
      hasText: 'Auth tokens expire after 15 minutes',
    })
    await expect(node.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders badge bar on work nodes with attachments', async ({ page }) => {
    // investigate-auth has ref, test, and diagram attached
    const badges = page.locator('.react-flow__node').filter({
      hasText: /refs|tests|diag/,
    })
    await expect(badges.first()).toBeVisible({ timeout: 5000 })
  })

  test('renders delta timeline with event types', async ({ page }) => {
    const timeline = page.locator('.react-flow__node').filter({
      hasText: /discovery|success|mutation/,
    })
    await expect(timeline.first()).toBeVisible({ timeout: 5000 })
  })

  test('canvas is interactive — can zoom', async ({ page }) => {
    const canvas = page.locator('.react-flow')
    await expect(canvas).toBeVisible()

    // Get the viewport transform before zoom
    const viewportBefore = await page.locator('.react-flow__viewport').getAttribute('style')

    // Scroll to zoom
    await canvas.hover()
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(500)

    const viewportAfter = await page.locator('.react-flow__viewport').getAttribute('style')

    // Transform should have changed (zoom level changed)
    expect(viewportAfter).not.toBe(viewportBefore)
  })
})
