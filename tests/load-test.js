/**
 * TCG Express — K6 Load Test
 *
 * Scenarios:
 *   1. Login stress        — POST /api/auth/login
 *   2. Job listing          — GET  /api/jobs?status=open
 *   3. Bid submission       — POST /api/bids
 *   4. GPS broadcast        — POST /api/jobs/:id/location
 *   5. Wallet check         — GET  /api/wallet
 *   6. Message push         — POST /api/messages/push
 *
 * Targets: p95 < 2 s, error rate < 1 %, throughput > 50 rps
 *
 * Usage:
 *   k6 run tests/load-test.js
 *   k6 run tests/load-test.js --env BASE_URL=http://localhost:3000
 *   k6 run tests/load-test.js --env USERS=50  # override VU count
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://tcg-express.vercel.app';
const VUS = parseInt(__ENV.USERS) || 100;

// Test accounts — use beta seed accounts (password: Beta2026!)
const PASSWORD = __ENV.PASSWORD || 'Beta2026!';
const CLIENTS = [
  { email: 'beta-customer1@techchainglobal.com', password: PASSWORD },
  { email: 'beta-customer2@techchainglobal.com', password: PASSWORD },
  { email: 'beta-customer3@techchainglobal.com', password: PASSWORD },
];
const DRIVERS = [
  { email: 'beta-driver1@techchainglobal.com', password: PASSWORD },
  { email: 'beta-driver2@techchainglobal.com', password: PASSWORD },
  { email: 'beta-driver3@techchainglobal.com', password: PASSWORD },
];

// ---------------------------------------------------------------------------
// Thresholds & metrics
// ---------------------------------------------------------------------------

const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const jobsDuration = new Trend('jobs_duration', true);
const bidDuration = new Trend('bid_duration', true);
const gpsDuration = new Trend('gps_duration', true);
const walletDuration = new Trend('wallet_duration', true);
const pushDuration = new Trend('push_duration', true);

export const options = {
  scenarios: {
    login_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.2) },   // ramp to 20% VUs
        { duration: '2m', target: Math.ceil(VUS * 0.2) },    // sustain
        { duration: '10s', target: 0 },                       // ramp down
      ],
      exec: 'loginScenario',
      gracefulStop: '10s',
    },
    job_listing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.25) },
        { duration: '2m', target: Math.ceil(VUS * 0.25) },
        { duration: '10s', target: 0 },
      ],
      exec: 'jobListingScenario',
      gracefulStop: '10s',
    },
    bid_submission: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.15) },
        { duration: '2m', target: Math.ceil(VUS * 0.15) },
        { duration: '10s', target: 0 },
      ],
      exec: 'bidScenario',
      gracefulStop: '10s',
    },
    gps_broadcast: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.2) },
        { duration: '2m', target: Math.ceil(VUS * 0.2) },
        { duration: '10s', target: 0 },
      ],
      exec: 'gpsScenario',
      gracefulStop: '10s',
    },
    wallet_check: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.1) },
        { duration: '2m', target: Math.ceil(VUS * 0.1) },
        { duration: '10s', target: 0 },
      ],
      exec: 'walletScenario',
      gracefulStop: '10s',
    },
    message_push: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(VUS * 0.1) },
        { duration: '2m', target: Math.ceil(VUS * 0.1) },
        { duration: '10s', target: 0 },
      ],
      exec: 'pushScenario',
      gracefulStop: '10s',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000'],  // p95 < 2 s
    errors: ['rate<0.01'],              // error rate < 1 %
    http_reqs: ['rate>50'],             // throughput > 50 rps
    login_duration: ['p(95)<3000'],
    jobs_duration: ['p(95)<2000'],
    bid_duration: ['p(95)<2000'],
    gps_duration: ['p(95)<1000'],
    wallet_duration: ['p(95)<2000'],
    push_duration: ['p(95)<2000'],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const jsonHeaders = { 'Content-Type': 'application/json' };

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders, tags: { name: 'login' } }
  );
  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) {
    errorRate.add(1);
    return null;
  }
  errorRate.add(0);
  const body = res.json();
  return body.token || null;
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

export function loginScenario() {
  group('Login Stress', () => {
    // Rotate across all accounts to avoid per-email rate limit (10/min)
    const allAccounts = [...CLIENTS, ...DRIVERS];
    const account = allAccounts[__VU % allAccounts.length];
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: account.email, password: account.password }),
      { headers: jsonHeaders, tags: { name: 'login' } }
    );
    loginDuration.add(Date.now() - start);
    const ok = check(res, {
      'login status 200': (r) => r.status === 200,
      'login has token': (r) => {
        try { return !!r.json().token; } catch { return false; }
      },
    });
    errorRate.add(!ok);
  });
  sleep(3 + Math.random() * 4); // 3-7 s between attempts (stay under 10/min/email)
}

export function jobListingScenario() {
  const client = CLIENTS[__VU % CLIENTS.length];
  const token = login(client.email, client.password);
  if (!token) { sleep(5); return; }

  group('Job Listing', () => {
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/jobs?status=open`, {
        headers: authHeaders(token),
        tags: { name: 'jobs_list' },
      });
      jobsDuration.add(Date.now() - start);
      const ok = check(res, {
        'jobs 200': (r) => r.status === 200,
        'jobs has data': (r) => {
          try { return Array.isArray(r.json().data); } catch { return false; }
        },
      });
      errorRate.add(!ok);
      sleep(1 + Math.random());
    }
  });
}

export function bidScenario() {
  const driver = DRIVERS[__VU % DRIVERS.length];
  const token = login(driver.email, driver.password);
  if (!token) { sleep(5); return; }

  group('Bid Submission', () => {
    // First get an open job to bid on
    const jobsRes = http.get(`${BASE_URL}/api/jobs?status=open`, {
      headers: authHeaders(token),
      tags: { name: 'jobs_for_bid' },
    });

    let jobId = null;
    try {
      const jobs = jobsRes.json().data;
      if (jobs && jobs.length > 0) {
        jobId = jobs[Math.floor(Math.random() * jobs.length)].id;
      }
    } catch {}

    if (!jobId) {
      // No open jobs — just measure the attempt
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/bids`,
        JSON.stringify({
          job_id: '00000000-0000-0000-0000-000000000000',
          amount: 50,
          message: 'K6 load test bid',
        }),
        { headers: authHeaders(token), tags: { name: 'bid_submit' } }
      );
      bidDuration.add(Date.now() - start);
      // Expect 404 for fake job — still measures latency
      check(res, { 'bid responds': (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
      return;
    }

    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/bids`,
      JSON.stringify({
        job_id: jobId,
        amount: 30 + Math.random() * 70,
        message: 'K6 load test bid',
      }),
      { headers: authHeaders(token), tags: { name: 'bid_submit' } }
    );
    bidDuration.add(Date.now() - start);
    // 200 = success, 409 = duplicate bid — both acceptable
    const ok = check(res, {
      'bid accepted or duplicate': (r) => r.status === 200 || r.status === 409,
    });
    errorRate.add(!ok);
  });
  sleep(2 + Math.random() * 3);
}

export function gpsScenario() {
  const driver = DRIVERS[__VU % DRIVERS.length];
  const token = login(driver.email, driver.password);
  if (!token) { sleep(5); return; }

  group('GPS Broadcast', () => {
    // Simulate GPS updates every 3 s for a job
    // Use a fake job ID — the API will just upsert (may fail with FK if no job, but measures latency)
    const fakeJobId = '00000000-0000-0000-0000-000000000099';

    for (let i = 0; i < 10; i++) {
      const lat = 1.3 + Math.random() * 0.05;  // Singapore area
      const lng = 103.8 + Math.random() * 0.05;

      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/jobs/${fakeJobId}/location`,
        JSON.stringify({
          latitude: lat,
          longitude: lng,
          heading: Math.random() * 360,
          speed: 10 + Math.random() * 50,
        }),
        { headers: authHeaders(token), tags: { name: 'gps_update' } }
      );
      gpsDuration.add(Date.now() - start);
      check(res, { 'gps responds': (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
      sleep(3);
    }
  });
}

export function walletScenario() {
  const client = CLIENTS[__VU % CLIENTS.length];
  const token = login(client.email, client.password);
  if (!token) { sleep(5); return; }

  group('Wallet Check', () => {
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/wallet`, {
        headers: authHeaders(token),
        tags: { name: 'wallet_balance' },
      });
      walletDuration.add(Date.now() - start);
      const ok = check(res, {
        'wallet 200': (r) => r.status === 200,
        'wallet has data': (r) => {
          try { return !!r.json().data; } catch { return false; }
        },
      });
      errorRate.add(!ok);
      sleep(2 + Math.random() * 3);
    }
  });
}

export function pushScenario() {
  const client = CLIENTS[__VU % CLIENTS.length];
  const token = login(client.email, client.password);
  if (!token) { sleep(5); return; }

  group('Message Push', () => {
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/messages/push`,
        JSON.stringify({
          receiverId: '00000000-0000-0000-0000-000000000000',
          senderName: 'K6 Load Test',
          content: `Load test message ${Date.now()}`,
          jobId: '00000000-0000-0000-0000-000000000000',
        }),
        { headers: authHeaders(token), tags: { name: 'push_msg' } }
      );
      pushDuration.add(Date.now() - start);
      check(res, { 'push responds': (r) => r.status < 500 });
      errorRate.add(res.status >= 500);
      sleep(2 + Math.random() * 2);
    }
  });
}
