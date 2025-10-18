const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const request = require('supertest');
const app = require('../../../../server/server'); // ajustar caminho conforme export

const SERVER_SCRIPT = path.resolve(__dirname, '..', '..', 'server', 'server.js');
const TEST_API_KEY = 'test_api_key_12345';
const SERVER_URL = 'http://localhost:3000';
const START_TIMEOUT = 7000;

function spawnServer() {
  const env = Object.assign({}, process.env, { API_KEY: TEST_API_KEY });
  const child = spawn(process.execPath, [SERVER_SCRIPT], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return child;
}

async function waitUntilUp(timeout = START_TIMEOUT) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      const res = await axios.get(`${SERVER_URL}/api/feedback`);
      if (res && (res.status === 200 || res.status === 204 || res.status === 201)) return true;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start in time');
}

describe('/api/feedback endpoint (integration)', () => {
  let srvProc;

  beforeAll(async () => {
    srvProc = spawnServer();
    // give the server some time to start and respond
    await waitUntilUp();
  }, START_TIMEOUT + 2000);

  afterAll(() => {
    try { srvProc.kill(); } catch (e) { /* ignore */ }
  });

  test('401 sem x-api-key', async () => {
    try {
      await axios.post(`${SERVER_URL}/api/feedback`, { pdv_id: 1, input_raw: 'GOOD' }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
    } catch (e) {
      // axios might throw on network errors; fail explicitly below if needed
    }
    const res = await axios.post(`${SERVER_URL}/api/feedback`, { pdv_id: 1, input_raw: 'GOOD' }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
    expect([401, 403]).toContain(res.status);
  });

  test('aceita POST válido com x-api-key e retorna 200/201', async () => {
    const res = await axios.post(
      `${SERVER_URL}/api/feedback`,
      { pdv_id: 2, input_raw: 'GOOD' },
      { headers: { 'x-api-key': TEST_API_KEY, 'Content-Type': 'application/json' }, validateStatus: () => true }
    );
    expect([200, 201]).toContain(res.status);
    // resposta deve conter pdv_id ou id; verificar ao menos que corpo seja JSON
    expect(res.data && typeof res.data === 'object').toBeTruthy();
  });
});

describe('API /api/feedback', () => {
  test('401 without key', async () => {
    await request(app).post('/api/feedback').send({ pdv_id:1, input_raw:'GOOD' }).expect(401);
  });
});