#!/usr/bin/env node

/**
 * TCG Express — Node.js Stress Test (no K6 required)
 *
 * Runs concurrent HTTP requests against the API using native fetch.
 *
 * Usage:
 *   node tests/stress-test.js
 *   node tests/stress-test.js --url http://localhost:3000
 *   node tests/stress-test.js --concurrency 50 --duration 60
 *   node tests/stress-test.js --scenario login
 */

const BASE_URL = getArg('--url') || 'https://tcg-express.vercel.app';
const CONCURRENCY = parseInt(getArg('--concurrency') || '20');
const DURATION_SEC = parseInt(getArg('--duration') || '30');
const SCENARIO = getArg('--scenario') || 'all';

const TEST_CLIENT = {
  email: getArg('--client-email') || 'beta-customer1@techchainglobal.com',
  password: getArg('--client-pass') || 'Test1234!',
};
const TEST_DRIVER = {
  email: getArg('--driver-email') || 'beta-driver1@techchainglobal.com',
  password: getArg('--driver-pass') || 'Test1234!',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

class Stats {
  constructor(name) {
    this.name = name;
    this.durations = [];
    this.successes = 0;
    this.failures = 0;
    this.statusCodes = {};
  }

  record(durationMs, status, ok) {
    this.durations.push(durationMs);
    this.statusCodes[status] = (this.statusCodes[status] || 0) + 1;
    if (ok) this.successes++;
    else this.failures++;
  }

  report() {
    if (this.durations.length === 0) return null;
    const sorted = [...this.durations].sort((a, b) => a - b);
    const total = this.successes + this.failures;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const errRate = ((this.failures / total) * 100).toFixed(2);

    return {
      scenario: this.name,
      requests: total,
      successes: this.successes,
      failures: this.failures,
      errorRate: `${errRate}%`,
      avgMs: Math.round(avg),
      p50Ms: Math.round(p50),
      p95Ms: Math.round(p95),
      p99Ms: Math.round(p99),
      minMs: Math.round(sorted[0]),
      maxMs: Math.round(sorted[sorted.length - 1]),
      statusCodes: this.statusCodes,
    };
  }
}

async function timedFetch(url, options = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, options);
    const duration = performance.now() - start;
    let body = null;
    try { body = await res.json(); } catch {}
    return { status: res.status, duration, body, ok: res.ok };
  } catch (err) {
    const duration = performance.now() - start;
    return { status: 0, duration, body: null, ok: false, error: err.message };
  }
}

async function login(email, password) {
  const res = await timedFetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok ? res.body.token : null;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function runLoginStress(stats, endTime) {
  while (Date.now() < endTime) {
    const res = await timedFetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_CLIENT.email, password: TEST_CLIENT.password }),
    });
    stats.record(res.duration, res.status, res.status === 200);
    await sleep(500 + Math.random() * 1500);
  }
}

async function runJobListing(stats, endTime) {
  const token = await login(TEST_CLIENT.email, TEST_CLIENT.password);
  if (!token) { stats.record(0, 0, false); return; }

  while (Date.now() < endTime) {
    const res = await timedFetch(`${BASE_URL}/api/jobs?status=open`, {
      headers: authHeaders(token),
    });
    stats.record(res.duration, res.status, res.status === 200);
    await sleep(800 + Math.random() * 1200);
  }
}

async function runBidSubmission(stats, endTime) {
  const token = await login(TEST_DRIVER.email, TEST_DRIVER.password);
  if (!token) { stats.record(0, 0, false); return; }

  // Get an open job
  const jobsRes = await timedFetch(`${BASE_URL}/api/jobs?status=open`, {
    headers: authHeaders(token),
  });
  let jobId = null;
  try {
    const jobs = jobsRes.body?.data;
    if (jobs?.length > 0) jobId = jobs[0].id;
  } catch {}

  while (Date.now() < endTime) {
    const targetJob = jobId || '00000000-0000-0000-0000-000000000000';
    const res = await timedFetch(`${BASE_URL}/api/bids`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        job_id: targetJob,
        amount: 30 + Math.random() * 70,
        message: 'Stress test bid',
      }),
    });
    // 200 OK or 409 duplicate = acceptable
    stats.record(res.duration, res.status, res.status === 200 || res.status === 409 || res.status === 404);
    await sleep(2000 + Math.random() * 3000);
  }
}

async function runGpsBroadcast(stats, endTime) {
  const token = await login(TEST_DRIVER.email, TEST_DRIVER.password);
  if (!token) { stats.record(0, 0, false); return; }

  const fakeJobId = '00000000-0000-0000-0000-000000000099';

  while (Date.now() < endTime) {
    const res = await timedFetch(`${BASE_URL}/api/jobs/${fakeJobId}/location`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        latitude: 1.3 + Math.random() * 0.05,
        longitude: 103.8 + Math.random() * 0.05,
        heading: Math.random() * 360,
        speed: 10 + Math.random() * 50,
      }),
    });
    stats.record(res.duration, res.status, res.status < 500);
    await sleep(3000);
  }
}

async function runWalletCheck(stats, endTime) {
  const token = await login(TEST_CLIENT.email, TEST_CLIENT.password);
  if (!token) { stats.record(0, 0, false); return; }

  while (Date.now() < endTime) {
    const res = await timedFetch(`${BASE_URL}/api/wallet`, {
      headers: authHeaders(token),
    });
    stats.record(res.duration, res.status, res.status === 200);
    await sleep(1500 + Math.random() * 2000);
  }
}

async function runMessagePush(stats, endTime) {
  const token = await login(TEST_CLIENT.email, TEST_CLIENT.password);
  if (!token) { stats.record(0, 0, false); return; }

  while (Date.now() < endTime) {
    const res = await timedFetch(`${BASE_URL}/api/messages/push`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        receiverId: '00000000-0000-0000-0000-000000000000',
        senderName: 'Stress Test',
        content: `Stress test message ${Date.now()}`,
        jobId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    stats.record(res.duration, res.status, res.status < 500);
    await sleep(2000 + Math.random() * 2000);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const SCENARIOS = {
  login: { fn: runLoginStress, weight: 3 },
  jobs: { fn: runJobListing, weight: 4 },
  bids: { fn: runBidSubmission, weight: 2 },
  gps: { fn: runGpsBroadcast, weight: 3 },
  wallet: { fn: runWalletCheck, weight: 2 },
  push: { fn: runMessagePush, weight: 1 },
};

async function main() {
  console.log('='.repeat(60));
  console.log('  TCG Express Stress Test');
  console.log('='.repeat(60));
  console.log(`  URL:         ${BASE_URL}`);
  console.log(`  Concurrency: ${CONCURRENCY} workers`);
  console.log(`  Duration:    ${DURATION_SEC}s`);
  console.log(`  Scenario:    ${SCENARIO}`);
  console.log('='.repeat(60));
  console.log();

  // Quick connectivity check
  console.log('Checking connectivity...');
  const ping = await timedFetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ping', password: 'ping' }),
  });
  if (ping.status === 0) {
    console.error(`Cannot reach ${BASE_URL} — aborting.`);
    process.exit(1);
  }
  console.log(`Connected (${Math.round(ping.duration)}ms). Starting test...\n`);

  const endTime = Date.now() + DURATION_SEC * 1000;
  const allStats = {};
  const workers = [];

  // Determine which scenarios to run
  let activeScenarios;
  if (SCENARIO === 'all') {
    activeScenarios = Object.entries(SCENARIOS);
  } else if (SCENARIOS[SCENARIO]) {
    activeScenarios = [[SCENARIO, SCENARIOS[SCENARIO]]];
  } else {
    console.error(`Unknown scenario: ${SCENARIO}`);
    console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}, all`);
    process.exit(1);
  }

  // Distribute workers by weight
  const totalWeight = activeScenarios.reduce((sum, [, s]) => sum + s.weight, 0);

  for (const [name, scenario] of activeScenarios) {
    const workerCount = Math.max(1, Math.round((scenario.weight / totalWeight) * CONCURRENCY));
    allStats[name] = new Stats(name);
    console.log(`  [${name}] ${workerCount} workers`);

    for (let i = 0; i < workerCount; i++) {
      workers.push(scenario.fn(allStats[name], endTime));
    }
  }

  console.log(`\nTotal workers: ${workers.length}\n`);

  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - (endTime - DURATION_SEC * 1000)) / 1000);
    const totalReqs = Object.values(allStats).reduce((s, st) => s + st.durations.length, 0);
    process.stdout.write(`\r  Progress: ${elapsed}s / ${DURATION_SEC}s | Requests: ${totalReqs}`);
  }, 2000);

  await Promise.all(workers);
  clearInterval(progressInterval);
  process.stdout.write('\r' + ' '.repeat(70) + '\r');

  // ---------------------------------------------------------------------------
  // Results
  // ---------------------------------------------------------------------------

  console.log('\n' + '='.repeat(60));
  console.log('  RESULTS');
  console.log('='.repeat(60));

  let totalRequests = 0;
  let totalFailures = 0;
  const allDurations = [];

  for (const stats of Object.values(allStats)) {
    const report = stats.report();
    if (!report) continue;

    totalRequests += report.requests;
    totalFailures += report.failures;
    allDurations.push(...stats.durations);

    console.log(`\n  ${report.scenario.toUpperCase()}`);
    console.log(`  ${'—'.repeat(40)}`);
    console.log(`  Requests:   ${report.requests} (${report.successes} ok, ${report.failures} fail)`);
    console.log(`  Error rate: ${report.errorRate}`);
    console.log(`  Latency:    avg=${report.avgMs}ms  p50=${report.p50Ms}ms  p95=${report.p95Ms}ms  p99=${report.p99Ms}ms`);
    console.log(`  Range:      min=${report.minMs}ms  max=${report.maxMs}ms`);
    console.log(`  Status:     ${JSON.stringify(report.statusCodes)}`);
  }

  // Overall summary
  const overallSorted = [...allDurations].sort((a, b) => a - b);
  const overallP95 = overallSorted.length > 0 ? Math.round(overallSorted[Math.floor(overallSorted.length * 0.95)]) : 0;
  const overallErrorRate = totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(2) : '0.00';
  const rps = totalRequests > 0 ? (totalRequests / DURATION_SEC).toFixed(1) : '0.0';

  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Total requests:  ${totalRequests}`);
  console.log(`  Throughput:      ${rps} rps`);
  console.log(`  Overall p95:     ${overallP95}ms`);
  console.log(`  Overall errors:  ${totalFailures} (${overallErrorRate}%)`);

  // Pass/fail checks
  console.log(`\n  THRESHOLDS:`);
  const p95Pass = overallP95 < 2000;
  const errPass = parseFloat(overallErrorRate) < 1;
  const rpsPass = parseFloat(rps) > 50;

  console.log(`    p95 < 2000ms:     ${overallP95}ms ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`    Error rate < 1%:  ${overallErrorRate}% ${errPass ? 'PASS' : 'FAIL'}`);
  console.log(`    Throughput > 50:  ${rps} rps ${rpsPass ? 'PASS' : 'FAIL'}`);
  console.log('='.repeat(60));

  if (!p95Pass || !errPass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
