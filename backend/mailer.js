// Helper for email notifications and receipt logging

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

async function sendEmail({ pool, to, type, subject, body, referenceID }) {
	if (!to || !to.includes('@')) {
		throw new Error('Valid recipient email is required.');
	}
	if (!['receipt', 'alert'].includes(type)) {
		throw new Error('Type must be receipt or alert.');
	}
	if (!subject || !body) {
		throw new Error('Subject and body are required.');
	}
	if (!referenceID) {
		throw new Error('Reference ID is required.');
	}

	const [result] = await pool.query(
		`INSERT INTO EMAIL_LOG (recipient_email, email_type, subject, body, reference_ID)
     VALUES (?, ?, ?, ?, ?)`,
		[to.trim(), type, subject.trim(), body.trim(), Number(referenceID)]
	);

	console.log(`[Email Sent] ${type.toUpperCase()} to ${to.trim()}: ${subject.trim()}`);

	return {
		success: true,
		email_ID: result.insertId,
		recipient: to.trim()
	};
}

async function sendDepartmentAlert({ pool, departmentID, subject, body, referenceID }) {
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
		subject: `Cougar Zoo Receipt - Order #${transactionID}`,
		body,
		referenceID: transactionID
	});
}

async function autoDispatchAlerts(pool) {
	if (!pool) return;

	try {
		// 1. Low stock alerts (Commercial Operations - Dept 3)
		const [lowStock] = await pool.query(`
			SELECT a.alert_ID, a.product_ID, p.name AS product_name, p.sku, p.quantity_in_stock, p.reorder_level
			FROM low_stock_alert a
			JOIN product p ON a.product_ID = p.product_ID
			WHERE a.status = 'unaddressed'
			  AND NOT EXISTS (
			    SELECT 1 FROM EMAIL_LOG el 
			    WHERE el.email_type = 'alert' AND el.reference_ID = a.alert_ID
			  )
		`);

		for (const row of lowStock) {
			await sendDepartmentAlert({
				pool,
				departmentID: 3,
				subject: `LOW STOCK INVENTORY: ${row.product_name}`,
				body: `Product '${row.product_name}' (SKU: ${row.sku || 'N/A'}) has reached low stock level with only ${row.quantity_in_stock} units remaining. Reorder threshold is ${row.reorder_level || 5}.`,
				referenceID: row.alert_ID
			}).catch(err => console.error('[AUTO-ALERT ERROR]', err.message));
		}

		// 2. Unstaffed events occurring within the next 7 days (Guest Operations - Dept 4)
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
			    WHERE el.email_type = 'alert' AND el.reference_ID = a.attr_ID
			  )
			GROUP BY a.attr_ID, a.name, a.type, a.location, a.attr_datetime
			HAVING COUNT(e.employee_ID) = 0
		`);

		for (const event of unstaffedEvents) {
			const dateStr = event.attr_datetime ? new Date(event.attr_datetime).toLocaleDateString() : 'Upcoming';
			await sendDepartmentAlert({
				pool,
				departmentID: 4,
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
