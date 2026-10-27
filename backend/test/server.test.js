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

function request(pathname) {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: '127.0.0.1',
				port: TEST_PORT,
				path: pathname,
				method: 'GET',
			},
			(res) => {
				let rawBody = '';
				res.on('data', (chunk) => {
					rawBody += chunk;
				});
				res.on('end', () => {
					resolve({
						statusCode: res.statusCode,
						body: JSON.parse(rawBody),
					});
				});
			}
		);

		req.on('error', reject);
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
	} finally {
		await stopServer(serverProcess);
	}
});
