const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');

const TEST_PORT = 5050;
const SERVER_START_TIMEOUT_MS = 5000;

function stopServer(serverProcess) {
	if (
		!serverProcess
		|| serverProcess.killed
		|| serverProcess.exitCode !== null
		|| serverProcess.signalCode !== null
		|| !serverProcess.pid
	) {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		serverProcess.once('exit', () => resolve());
		const killSent = serverProcess.kill();
		if (!killSent) {
			resolve();
		}
	});
}

function waitForServerToStart(serverProcess) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error('Server did not start in time'));
		}, SERVER_START_TIMEOUT_MS);

		const handleOutput = (chunk) => {
			if (chunk.toString().includes('Server running')) {
				clearTimeout(timeout);
				serverProcess.stdout.off('data', handleOutput);
				serverProcess.stderr.off('data', handleOutput);
				resolve();
			}
		};

		serverProcess.stdout.on('data', handleOutput);
		serverProcess.stderr.on('data', handleOutput);
		serverProcess.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		serverProcess.once('exit', (code) => {
			clearTimeout(timeout);
			reject(new Error(`Server exited before listening (code ${code})`));
		});
	});
}

function request(pathOrOptions, requestBody) {
	const options = typeof pathOrOptions === 'string'
		? { path: pathOrOptions, method: 'GET' }
		: { ...pathOrOptions };

	options.hostname = options.hostname || '127.0.0.1';
	options.port = options.port || TEST_PORT;
	options.headers = options.headers || {};

	return new Promise((resolve, reject) => {
		const req = http.request(options, (res) => {
			let rawBody = '';
			res.on('data', (chunk) => {
				rawBody += chunk;
			});
			res.on('end', () => {
				let parsed = rawBody;
				try {
					parsed = JSON.parse(rawBody);
				} catch {}
				resolve({
					statusCode: res.statusCode,
					body: parsed,
				});
			});
		});

		req.on('error', reject);
		if (requestBody) {
			const data = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
			if (!options.headers['Content-Type']) {
				req.setHeader('Content-Type', 'application/json');
			}
			req.write(data);
		}
		req.end();
	});
}

test('unknown routes return 404 JSON', async () => {
	const serverProcess = spawn(process.execPath, ['server.js'], {
		cwd: `${__dirname}/..`,
		env: {
			...process.env,
			PORT: String(TEST_PORT),
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	try {
		await waitForServerToStart(serverProcess);
		const response = await request('/api/not-a-real-route');

		assert.equal(response.statusCode, 404);
		assert.deepEqual(response.body, { message: 'Not Found' });

		const financeResponse = await request('/api/salary-budget/latest');
		assert.equal(financeResponse.statusCode, 401);

		const employeeResponse = await request('/api/employees');
		assert.equal(employeeResponse.statusCode, 200);
		assert.ok(Array.isArray(employeeResponse.body));

		const animalResponse = await request('/api/public/animals');
		assert.equal(animalResponse.statusCode, 200);
		assert.ok(Array.isArray(animalResponse.body));

		const productResponse = await request('/api/products');
		assert.equal(productResponse.statusCode, 200);
		assert.ok(Array.isArray(productResponse.body));

		const attractionResponse = await request('/api/attractions');
		assert.equal(attractionResponse.statusCode, 200);
		assert.ok(Array.isArray(attractionResponse.body));

		const enclosureResponse = await request('/api/enclosures');
		assert.equal(enclosureResponse.statusCode, 401);

		// Test public feeding schedule
		const feedingResponse = await request('/api/public/feeding-schedule');
		assert.equal(feedingResponse.statusCode, 200);
		assert.ok(Array.isArray(feedingResponse.body));

		// Test medical costs report
		const medicalCostReportResponse = await request('/api/reports/medical-costs');
		assert.equal(medicalCostReportResponse.statusCode, 200);
		assert.ok(Array.isArray(medicalCostReportResponse.body));

		// Test medical costs validation
		const medicalCostsInvalid = await request('/api/medical-costs');
		assert.equal(medicalCostsInvalid.statusCode, 400);

		// Test department set-head validation
		const setHeadInvalid = await request({ path: '/api/department/set-head', method: 'POST' }, {});
		assert.equal(setHeadInvalid.statusCode, 400);

		// Test animal remove validation
		const animalRemoveInvalid = await request({ path: '/api/animals/1/remove', method: 'POST' }, {});
		assert.equal(animalRemoveInvalid.statusCode, 400);

		// Test attraction update validation
		const attractionPutInvalid = await request({ path: '/api/attractions/1', method: 'PUT' }, {});
		assert.equal(attractionPutInvalid.statusCode, 400);

		// Test dead product-checkout route is removed (returns 404)
		const deadCheckoutResponse = await request({ path: '/api/product-checkout', method: 'POST' }, {});
		assert.equal(deadCheckoutResponse.statusCode, 404);
	} finally {
		await stopServer(serverProcess);
	}
});
