const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const pool = require('./db');
const handleFood = require('./food');
const handleAccess = require('./access');
const handleCheckout = require('./checkout');
const handleFinance = require('./routes/finance');
const handleEmployees = require('./routes/employees');
const handleEnclosures = require('./routes/enclosures');
const handleDonations = require('./routes/donations');
const handleAnimals = require('./routes/animals');
const handleProducts = require('./routes/products');
const handleTickets = require('./routes/tickets');
const { generateDailyPaychecks } = require('./jobs/paycheckJob');
const { autoDispatchAlerts } = require('./mailer');

const PORT = process.env.PORT || 5000;

function send(res, status, data) {
	res.statusCode = status;
	res.end(JSON.stringify(data));
}

async function readBody(req, maxBytes = 16384) {
	let body = '';

	for await (const chunk of req) {
		body += chunk;

		if (Buffer.byteLength(body) > maxBytes) {
			const error = new Error('Request is too large.');
			error.status = 413;
			throw error;
		}
	}

	try {
		return JSON.parse(body);
	} catch {
		const error = new Error('Invalid JSON.');
		error.status = 400;
		throw error;
	}
}

const routeHandlers = [
	handleAccess,
	handleCheckout,
	handleFood,
	handleFinance,
	handleEmployees,
	handleAnimals,
	handleEnclosures,
	handleDonations,
	handleProducts,
	handleTickets
];

const server = http.createServer(async (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = 200;
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader(
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, DELETE, OPTIONS'
	);
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, Accept'
	);

	if (req.method === 'OPTIONS') {
		res.writeHead(204);
		res.end();
		return;
	}

	try {
		for (const handler of routeHandlers) {
			const handled = await handler(req, res, pool, send, readBody);
			if (handled || res.writableEnded) {
				return;
			}
		}

		if (!res.writableEnded) {
			res.statusCode = 404;
			res.end(JSON.stringify({ message: 'Not Found' }));
		}
	} catch (err) {
		console.error('Unhandled server error:', err);
		send(res, err.status || 500, {
			error: err.status ? err.message : 'Server error'
		});
	}
});

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	autoDispatchAlerts(pool).catch((error) => {
		console.error('Initial autoDispatchAlerts failed:', error);
	});
	generateDailyPaychecks().catch((error) => {
		console.error('Daily paycheck job failed:', error);
	});
});

setInterval(() => {
	autoDispatchAlerts(pool).catch((error) => {
		console.error('Interval autoDispatchAlerts failed:', error);
	});
}, 60 * 1000).unref();

setInterval(() => {
	generateDailyPaychecks().catch((error) => {
		console.error('Daily paycheck job failed:', error);
	});
}, 24 * 60 * 60 * 1000).unref();
