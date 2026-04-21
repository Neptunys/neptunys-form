import * as assert from 'assert'

import {
  normalizeTrafficSourceLabel,
  resolveTrafficSourceLabel
} from '../src/utils/traffic-source'

function testResolveTrafficSourceFromLandingUrlUtm() {
  assert.strictEqual(
    resolveTrafficSourceLabel({ landingUrl: 'https://example.com/quiz?utm_source=facebook&utm_medium=cpc' }),
    'Meta'
  )
}

function testResolveTrafficSourceFromLandingUrlClickId() {
  assert.strictEqual(
    resolveTrafficSourceLabel({ landingUrl: 'https://example.com/quiz?gclid=test-click-id' }),
    'Google'
  )
}

function testResolveTrafficSourceDefaultsToDirect() {
  assert.strictEqual(resolveTrafficSourceLabel({}), 'Direct')
}

function testNormalizeTrafficSourceLabel() {
  assert.strictEqual(normalizeTrafficSourceLabel('linkedin'), 'LinkedIn')
  assert.strictEqual(normalizeTrafficSourceLabel('newsletter'), 'Email')
}

async function run() {
  testResolveTrafficSourceFromLandingUrlUtm()
  testResolveTrafficSourceFromLandingUrlClickId()
  testResolveTrafficSourceDefaultsToDirect()
  testNormalizeTrafficSourceLabel()
}

if (require.main === module) {
  run().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exitCode = 1
  })
}