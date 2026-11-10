// Helper for email notifications and receipt logging
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let transporter = null;
try {
	const nodemailer = require('nodemailer');
	if (process.env.SMTP_HOST && process.env.SMTP_USER) {
		transporter = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: Number(process.env.SMTP_PORT || 587),
			secure: process.env.SMTP_SECURE === 'true',
			auth: {
				user: process.env.SMTP_USER,
				pass: process.env.SMTP_PASS
			}
		});
		console.log('[MAILER] Nodemailer SMTP transporter initialized with host:', process.env.SMTP_HOST);
	} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
		transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS
			}
		});
		console.log('[MAILER] Nodemailer Gmail transporter initialized for:', process.env.EMAIL_USER);
	}
} catch (err) {
	console.warn('[MAILER] Nodemailer setup note:', err.message);
}

async function getDepartmentHead(pool, departmentID) {
	if (!pool || !departmentID) return null;

	const [rows] = await pool.query(
		`SELECT e.email, e.first_name, e.last_name, d.department_name
     FROM department d
     JOIN employee e ON d.head_employee_ID = e.employee_ID
     WHERE d.department_ID = ?`,
		[Number(departmentID)]
	);

	return rows.length > 0 ? rows[0] : null;
}

async function sendEmail({ pool, to, type, referenceType = 'low_stock', subject, body, referenceID }) {
	if (!to || !to.includes('@')) {
		throw new Error('Valid recipient email is required.');
	}
	if (!['receipt', 'alert'].includes(type)) {
		throw new Error('Type must be receipt or alert.');
	}
	if (!['low_stock', 'event', 'receipt'].includes(referenceType)) {
		referenceType = type === 'receipt' ? 'receipt' : 'low_stock';
	}
	if (!subject || !body) {
		throw new Error('Subject and body are required.');
	}
	if (!referenceID) {
		throw new Error('Reference ID is required.');
	}

	const [result] = await pool.query(
		`INSERT INTO EMAIL_LOG (recipient_email, email_type, reference_type, subject, body, reference_ID)
     VALUES (?, ?, ?, ?, ?, ?)`,
		[to.trim(), type, referenceType, subject.trim(), body.trim(), Number(referenceID)]
	);

	console.log(`[Email Logged] ${type.toUpperCase()} (${referenceType}) to ${to.trim()}: ${subject.trim()}`);

	// Attempt real SMTP dispatch if transporter is configured
	if (transporter) {
		try {
			await transporter.sendMail({
				from: process.env.SMTP_FROM || process.env.EMAIL_USER || '"Cougar Zoo Operations" <no-reply@cougarzoo.com>',
				to: to.trim(),
				subject: subject.trim(),
				text: body.trim()
			});
			console.log(`[Email Dispatched via SMTP] to ${to.trim()}`);
		} catch (smtpErr) {
			console.error(`[SMTP ERROR] Could not dispatch email to ${to.trim()}:`, smtpErr.message);
		}
	} else {
		console.log(`[Email Notice] SMTP credentials not set in .env. Logged to EMAIL_LOG (ID: ${result.insertId}).`);
	}

	return {
		success: true,
		email_ID: result.insertId,
		recipient: to.trim()
	};
}

async function sendDepartmentAlert({ pool, departmentID, referenceType = 'low_stock', subject, body, referenceID }) {
	const head = await getDepartmentHead(pool, departmentID);
	if (!head || !head.email) {
		console.warn(`No department head found for department ${departmentID}`);
		return { success: false, error: 'No department head found' };
	}

	const message = `Hello ${head.first_name},\n\n${body}\n\nThanks,\nCougar Zoo Operations`;

	return sendEmail({
		pool,
		to: head.email,
		type: 'alert',
		referenceType,
		subject,
		body: message,
		referenceID
	});
}

async function sendReceiptEmail({
	pool,
	customerEmail,
	transactionID,
	storeName = 'Gift Shop',
	items = [],
	subtotal,
	discount,
	tax,
	total,
	paymentMethod = 'credit'
}) {
	if (!customerEmail || !customerEmail.includes('@')) return;

	const itemList = items
		.map(i => `${i.quantity}x ${i.name} ($${Number(i.price).toFixed(2)})`)
		.join('\n');

	const discountText = discount && Number(discount) > 0 ? `\nDiscount: -$${Number(discount).toFixed(2)}` : '';

	const body = `Cougar Zoo Receipt - Order #${transactionID}
Store: ${storeName}
Date: ${new Date().toLocaleString()}
Payment: ${paymentMethod}

Items:
${itemList}

Subtotal: $${Number(subtotal).toFixed(2)}${discountText}
Tax: $${Number(tax).toFixed(2)}
Total: $${Number(total).toFixed(2)}

Thank you for visiting Cougar Zoo!`;

	return sendEmail({
		pool,
		to: customerEmail,
		type: 'receipt',
		referenceType: 'receipt',
		subject: `Cougar Zoo Receipt - Order #${transactionID}`,
		body,
		referenceID: transactionID
	});
}

async function autoDispatchAlerts(pool) {
	if (!pool) return;

	try {
		// 0. Continuous Low-Stock Protection:
		// Ensure any product currently at or below reorder level has an active unaddressed alert.
		// This guarantees alerts are created even if the MySQL trigger missed an update (e.g. stock was already below threshold or manually edited).
		await pool.query(`
			INSERT INTO low_stock_alert (product_ID, stock_at_alert, status)
			SELECT p.product_ID, p.quantity_in_stock, 'unaddressed'
			FROM product p
			WHERE p.quantity_in_stock <= COALESCE(p.reorder_level, 5)
			  AND NOT EXISTS (
			    SELECT 1 FROM low_stock_alert lsa
			    WHERE lsa.product_ID = p.product_ID AND lsa.status = 'unaddressed'
			  )
		`);

		// 1. Low stock alerts (Commercial Operations - Dept 3)
		// Deduplication check uses reference_type = 'low_stock' to avoid colliding with events or receipts that share the same numeric ID
		const [lowStock] = await pool.query(`
			SELECT a.alert_ID, a.product_ID, p.name AS product_name, p.sku, p.quantity_in_stock, p.reorder_level
			FROM low_stock_alert a
			JOIN product p ON a.product_ID = p.product_ID
			WHERE a.status = 'unaddressed'
			  AND NOT EXISTS (
			    SELECT 1 FROM EMAIL_LOG el 
			    WHERE el.reference_type = 'low_stock' AND el.reference_ID = a.alert_ID
			  )
		`);

		for (const row of lowStock) {
			await sendDepartmentAlert({
				pool,
				departmentID: 3,
				referenceType: 'low_stock',
				subject: `LOW STOCK INVENTORY: ${row.product_name}`,
				body: `Product '${row.product_name}' (SKU: ${row.sku || 'N/A'}) has reached low stock level with only ${row.quantity_in_stock} units remaining. Reorder threshold is ${row.reorder_level || 5}.`,
				referenceID: row.alert_ID
			}).catch(err => console.error('[AUTO-ALERT ERROR]', err.message));
		}

		// 2. Unstaffed events occurring within the next 7 days (Guest Operations - Dept 4)
		// Deduplication check uses reference_type = 'event' to avoid colliding with low stock alerts
		const [unstaffedEvents] = await pool.query(`
			SELECT 
				a.attr_ID,
				a.name,
				a.type,
				a.location,
				a.attr_datetime
			FROM ATTRACTION a
			LEFT JOIN STAFFED_AT sa ON a.attr_ID = sa.attr_ID
			LEFT JOIN EMPLOYEE e ON sa.employee_ID = e.employee_ID AND e.current = 1
			WHERE a.attr_datetime BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
			  AND NOT EXISTS (
			    SELECT 1 FROM EMAIL_LOG el 
			    WHERE el.reference_type = 'event' AND el.reference_ID = a.attr_ID
			  )
			GROUP BY a.attr_ID, a.name, a.type, a.location, a.attr_datetime
			HAVING COUNT(e.employee_ID) = 0
		`);

		for (const event of unstaffedEvents) {
			const dateStr = event.attr_datetime ? new Date(event.attr_datetime).toLocaleDateString() : 'Upcoming';
			await sendDepartmentAlert({
				pool,
				departmentID: 4,
				referenceType: 'event',
				subject: `ACTION REQUIRED: Unstaffed Event '${event.name}'`,
				body: `The event '${event.name}' (${event.type || 'Attraction'}) scheduled for ${dateStr} at ${event.location || 'Cougar Zoo'} currently has 0 staff assigned. Please schedule guides immediately.`,
				referenceID: event.attr_ID
			}).catch(err => console.error('[AUTO-ALERT ERROR]', err.message));
		}
	} catch (err) {
		console.error('[AUTO-ALERT RUN ERROR]', err.message);
	}
}

module.exports = {
	getDepartmentHead,
	sendEmail,
	sendDepartmentAlert,
	sendReceiptEmail,
	autoDispatchAlerts
};
