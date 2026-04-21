#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return fallback;
}

const blueprintPath = getArg('file', 'render.yaml');
const expectedHomepage = getArg('expected-homepage', 'https://form.neptunysengine.com');
const expectedCookieDomain = getArg('expected-cookie-domain', 'form.neptunysengine.com');

const resolvedPath = path.resolve(process.cwd(), blueprintPath);

if (!fs.existsSync(resolvedPath)) {
  console.error(`[fail] render blueprint not found: ${resolvedPath}`);
  process.exit(1);
}

const content = fs.readFileSync(resolvedPath, 'utf8');

const requiredPatterns = [
  {
    description: 'auto deploy trigger is commit',
    regex: /autoDeployTrigger:\s*commit/,
  },
  {
    description: 'buildFilter includes vendor/neptunysform-upstream',
    regex: /buildFilter:[\s\S]*?paths:[\s\S]*?vendor\/neptunysform-upstream\/\*\*/,
  },
  {
    description: 'APP_HOMEPAGE_URL key exists',
    regex: /-\s+key:\s*APP_HOMEPAGE_URL/,
  },
  {
    description: `APP_HOMEPAGE_URL pinned to ${expectedHomepage}`,
    regex: new RegExp(`-\\s+key:\\s*APP_HOMEPAGE_URL[\\s\\S]*?value:\\s*${escapeRegExp(expectedHomepage)}`),
  },
  {
    description: 'COOKIE_DOMAIN key exists',
    regex: /-\s+key:\s*COOKIE_DOMAIN/,
  },
  {
    description: `COOKIE_DOMAIN pinned to ${expectedCookieDomain}`,
    regex: new RegExp(`-\\s+key:\\s*COOKIE_DOMAIN[\\s\\S]*?value:\\s*${escapeRegExp(expectedCookieDomain)}`),
  },
];

let failed = false;
for (const check of requiredPatterns) {
  const ok = check.regex.test(content);
  if (ok) {
    console.log(`[ok] ${check.description}`);
  } else {
    console.error(`[fail] ${check.description}`);
    failed = true;
  }
}

if (failed) {
  console.error('\nBlueprint guard failed. Fix render.yaml before pushing.');
  process.exit(1);
}

console.log('\nBlueprint guard passed.');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
