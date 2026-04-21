#!/usr/bin/env node

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return fallback;
}

const baseUrl = getArg('base-url', process.env.NEPTUNYSFORM_BASE_URL || 'https://form.neptunysengine.com');
const expectedDomain = getArg('expected-domain', process.env.NEPTUNYSFORM_EXPECTED_COOKIE_DOMAIN || 'form.neptunysengine.com');
const timeoutMs = Number(getArg('timeout-ms', '15000'));

const endpoints = ['/', '/dashboard'];
const expectedOrigin = new URL(baseUrl).origin;
const failures = [];
const results = [];

for (const endpoint of endpoints) {
  const result = await inspectEndpoint(endpoint);
  results.push(result);
}

const uniqueBundles = [...new Set(results.map((r) => r.bundle).filter(Boolean))];
if (uniqueBundles.length !== 1) {
  failures.push(`Expected one shared bundle hash across / and /dashboard, found: ${uniqueBundles.join(', ') || 'none'}`);
}

for (const result of results) {
  if (result.status !== 200) {
    failures.push(`${result.url} returned ${result.status} (expected 200)`);
  }

  if (!result.bundle) {
    failures.push(`${result.url} did not include /static/index-*.js in HTML`);
  }

  if (!result.runtimeFound) {
    failures.push(`${result.url} did not contain an inline runtime config block`);
  }

  if (result.runtimeFound) {
    if (result.runtime.homepageURL !== expectedOrigin) {
      failures.push(`${result.url} homepageURL mismatch: ${result.runtime.homepageURL} != ${expectedOrigin}`);
    }

    if (result.runtime.websiteURL !== expectedOrigin) {
      failures.push(`${result.url} websiteURL mismatch: ${result.runtime.websiteURL} != ${expectedOrigin}`);
    }

    if (result.runtime.cookieDomain !== expectedDomain) {
      failures.push(`${result.url} cookieDomain mismatch: ${result.runtime.cookieDomain} != ${expectedDomain}`);
    }

    if (result.runtime.customDomainRuntime !== true) {
      failures.push(`${result.url} customDomainRuntime is not true`);
    }
  }

  if (result.html.includes('.onrender.com')) {
    failures.push(`${result.url} still references .onrender.com`);
  }
}

printSummary(results);

if (failures.length > 0) {
  console.error('\nLive deploy guard failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nLive deploy guard passed.');

async function inspectEndpoint(endpoint) {
  const target = new URL(endpoint, expectedOrigin);
  target.searchParams.set('_deploy_check', String(Date.now()));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(target, {
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }

  const html = await response.text();
  const runtime = extractRuntimeConfig(html);

  return {
    url: target.origin + endpoint,
    status: response.status,
    bundle: extractBundlePath(html),
    runtimeFound: runtime !== null,
    runtime: runtime || {},
    html,
  };
}

function extractBundlePath(html) {
  const match = html.match(/\/static\/index-[A-Za-z0-9_-]+\.js/);
  return match ? match[0] : null;
}

function extractRuntimeConfig(html) {
  const runtimeMatch = html.match(/const\s+neptunysform\s*=\s*(\{[\s\S]*?\});/);
  if (!runtimeMatch) {
    return null;
  }

  try {
    return JSON.parse(runtimeMatch[1]);
  } catch {
    return null;
  }
}

function printSummary(results) {
  console.log('Live shell summary:');
  for (const result of results) {
    const runtime = result.runtimeFound ? result.runtime : {};
    console.log(`- ${result.url}`);
    console.log(`  status=${result.status}`);
    console.log(`  bundle=${result.bundle || 'missing'}`);
    console.log(`  homepageURL=${runtime.homepageURL || 'missing'}`);
    console.log(`  websiteURL=${runtime.websiteURL || 'missing'}`);
    console.log(`  cookieDomain=${runtime.cookieDomain || 'missing'}`);
    console.log(`  customDomainRuntime=${String(runtime.customDomainRuntime)}`);
  }
}
