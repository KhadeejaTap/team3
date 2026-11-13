const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');

const TEST_PORT = 5051;
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
		if (requestBody !== undefined) {
			const data = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
			if (!options.headers['Content-Type']) {
				req.setHeader('Content-Type', 'application/json');
			}
			req.write(data);
		}
		req.end();
	});
}

test('restored features and edge case validations', async () => {
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

		// 1. Feeding Schedule API
		const feeding = await request('/api/public/feeding-schedule');
		assert.equal(feeding.statusCode, 200);
		assert.ok(Array.isArray(feeding.body));

		// 2. Medical Costs APIs
		const medReports = await request('/api/reports/medical-costs');
		assert.equal(medReports.statusCode, 200);
		assert.ok(Array.isArray(medReports.body));

		const medCostNoId = await request('/api/medical-costs');
		assert.equal(medCostNoId.statusCode, 400);

		const medCostInvalidPost = await request(
			{ path: '/api/medical-costs', method: 'POST' },
			{ record_ID: 'invalid' }
		);
		assert.equal(medCostInvalidPost.statusCode, 400);

		const medCostNotFound = await request(
			{ path: '/api/medical-costs', method: 'POST' },
			{
				record_ID: 999999,
				cost_category: 'Prescription Medication',
				amount: 75.0,
				cost_date: '2026-01-01'
			}
		);
		assert.equal(medCostNotFound.statusCode, 404);

		// 3. Department Set-Head API
		const setHeadMissing = await request(
			{ path: '/api/department/set-head', method: 'POST' },
			{ employee_ID: 1 }
		);
		assert.equal(setHeadMissing.statusCode, 400);

		const setHeadNotFound = await request(
			{ path: '/api/department/set-head', method: 'POST' },
			{ employee_ID: 999999, department_ID: 1 }
		);
		assert.equal(setHeadNotFound.statusCode, 404);

		// 4. Animal Removal API
		const removeInvalidReason = await request(
			{ path: '/api/animals/1/remove', method: 'POST' },
			{ reason: 'InvalidReason' }
		);
		assert.equal(removeInvalidReason.statusCode, 400);

		const removeMissingDeathReason = await request(
			{ path: '/api/animals/1/remove', method: 'POST' },
			{ reason: 'Death' }
		);
		assert.equal(removeMissingDeathReason.statusCode, 400);

		const removeNotFound = await request(
			{ path: '/api/animals/999999/remove', method: 'POST' },
			{ reason: 'Relocation' }
		);
		assert.equal(removeNotFound.statusCode, 404);

		// 5. Attraction Update (PUT) API
		const attrInvalid = await request(
			{ path: '/api/attractions/1', method: 'PUT' },
			{ name: '' }
		);
		assert.equal(attrInvalid.statusCode, 400);

		const attrNotFound = await request(
			{ path: '/api/attractions/999999', method: 'PUT' },
			{
				name: 'Test Nonexistent Attraction',
				type: 'Ride',
				location: 'North Zone',
				capacity: 50,
				status: 'Operating'
			}
		);
		assert.equal(attrNotFound.statusCode, 404);

		// 6. Checkout Validation & Dead Product Checkout
		const deadRoute = await request(
			{ path: '/api/product-checkout', method: 'POST' },
			{}
		);
		assert.equal(deadRoute.statusCode, 404);

		const checkoutEmpty = await request(
			{ path: '/api/checkout', method: 'POST' },
			{}
		);
		assert.equal(checkoutEmpty.statusCode, 400);
	} finally {
		await stopServer(serverProcess);
	}
});
