const { requireRoles } = require("../auth");

async function handleDonations(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isDonationRoute =
		pathname === "/api/donations" ||
		pathname === "/api/donations/history";

	if (!isDonationRoute) {
		return false;
	}

	if (
		req.method === 'GET'
	) {
		try {
			const allowed = await requireRoles(
				req,
				res,
				pool,
				send,
				['admin', 'manager', 'employee', 'visitor']
			);

			if (!allowed) return;

			const [rows] = await pool.query(
				`SELECT
           dn.donation_ID,
           dn.amount,
           dn.donation_date,
           dn.purpose,
           dn.animal_ID,
           a.name AS animal_name,
           ct.payment_method,
           ct.transaction_date
         FROM donor AS d
         JOIN DONATION AS dn ON d.donor_ID = dn.donor_ID
         LEFT JOIN ANIMAL AS a ON a.animal_ID = dn.animal_ID
         JOIN TRANSACTION_ITEM AS ti
           ON ti.item_ID = dn.donation_ID
           AND ti.item_type = 'donation'
         JOIN CUST_TRANSACTION AS ct
           ON ct.transaction_ID = ti.transaction_ID
         WHERE d.userID = ?
         ORDER BY dn.donation_date DESC, dn.donation_ID DESC`,
				[req.user.userID]
			);

			send(res, 200, rows);
		} catch (error) {
			console.error('Error fetching donation history:', error);
			send(res, 500, {
				error: 'Unable to load donation history.'
			});
		}
	} else if (
		pathname === '/api/donations' &&
		req.method === 'POST'
	) {
		let data;
		try {
			data = await readBody(req);
		} catch {
			send(res, 400, { error: 'Invalid JSON request body.' });
			return;
		}

			const {
				donor_first,
				donor_last,
				donor_email,
				donor_phone,
				donation_amt,
				donation_date,
				purpose,
				payment_method
			} = data;

			let linkedUserID = null;
			if (req.headers.authorization) {
				try {
					const allowed = await requireRoles(
						req,
						res,
						pool,
						send,
						['admin', 'manager', 'employee', 'visitor']
					);
					if (!allowed) return;
					linkedUserID = req.user.userID;
				} catch (error) {
					console.error('Error validating donation session:', error);
					send(res, 500, {
						error: 'Unable to verify your session. Please try again.'
					});
					return;
				}
			}

			const amount = Number(donation_amt);
			const finalPaymentMethod = 'credit';

			if (
				![
					donor_first,
					donor_last,
					donor_email,
					donor_phone,
					donation_date,
					purpose
				].every(
					value =>
						typeof value === 'string' &&
						value.trim() !== ''
				) ||
				!Number.isFinite(amount) ||
				amount <= 0 ||
				Math.round(amount * 100) !== amount * 100
			) {
				res.statusCode = 400;
				res.end(
					JSON.stringify({
						error: 'Please provide valid donation details.'
					})
				);
				return;
			}

			if (
				!/^\d{4}-\d{2}-\d{2}$/.test(donation_date) ||
				Number.isNaN(Date.parse(donation_date)) ||
				new Date(donation_date).toISOString().slice(0, 10) !==
				donation_date
			) {
				res.statusCode = 400;
				res.end(
					JSON.stringify({
						error: 'Please provide a valid donation date.'
					})
				);
				return;
			}

			const isSponsorship = purpose.trim() === 'Sponsor an Animal';
			const animalID = data.animal_ID ? Number(data.animal_ID) : null;

			if (isSponsorship) {
				if (amount < 150) {
					res.statusCode = 400;
					res.end(
						JSON.stringify({
							error: 'Sponsoring an animal requires a minimum donation of $150.00.'
						})
					);
					return;
				}
				if (!animalID) {
					res.statusCode = 400;
					res.end(
						JSON.stringify({
							error: 'Please select a specific animal to sponsor.'
						})
					);
					return;
				}
			}

			let connection;

			try {
				connection = await pool.getConnection();
				await connection.beginTransaction();

				const [donorResult] = await connection.query(
					`INSERT INTO donor
           (first_name, last_name, donor_email, donor_phone, userID)
           VALUES (?, ?, ?, ?, ?)`,
					[
						donor_first.trim(),
						donor_last.trim(),
						donor_email.trim(),
						donor_phone.trim(),
						linkedUserID
					]
				);

				const donorID = donorResult.insertId;

				const [donationResult] = await connection.query(
					`INSERT INTO DONATION
           (donor_ID, amount, donation_date, purpose, animal_ID)
           VALUES (?, ?, ?, ?, ?)`,
					[
						donorID,
						amount.toFixed(2),
						donation_date,
						purpose.trim(),
						animalID
					]
				);

				const donationID = donationResult.insertId;

				let generatedCouponCode = null;
				if (isSponsorship) {
					const [couponRows] = await connection.query(
						`SELECT code
             FROM COUPON
             WHERE donor_email = ?
               AND code = ?
               AND is_used = FALSE`,
						[
							donor_email.trim().toLowerCase(),
							`SPONSOR-DONATION-${donationID}`
						]
					);
					generatedCouponCode = couponRows.length > 0 ? couponRows[0].code : null;
				}

				const [transactionResult] = await connection.query(
					`INSERT INTO CUST_TRANSACTION
           (visitor_ID, total, payment_method)
           VALUES (NULL, ?, ?)`,
					[amount.toFixed(2), finalPaymentMethod]
				);

				const transactionID = transactionResult.insertId;

				await connection.query(
					`INSERT INTO TRANSACTION_ITEM
           (transaction_ID, item_type, item_ID, quantity, price)
           VALUES (?, 'donation', ?, 1, ?)`,
					[
						transactionID,
						donationID,
						amount.toFixed(2)
					]
				);

				await connection.commit();

				res.statusCode = 201;
				res.end(
					JSON.stringify({
						message: generatedCouponCode
							? `Thank you for your sponsorship! Your 15% off coupon code is: ${generatedCouponCode}`
							: 'Donation processed successfully!',
						donor_ID: donorID,
						donation_ID: donationID,
						transaction_ID: transactionID,
						coupon_code: generatedCouponCode
					})
				);
			} catch (err) {
				if (connection) {
					await connection.rollback();
				}

				console.error('Error saving donation:', err);

				res.statusCode = 500;
				res.end(
					JSON.stringify({
						error: 'Unable to save donation. Please try again.'
					})
				);
			} finally {
				if (connection) {
					connection.release();
				}
			}
	}
	return true;
}

module.exports = handleDonations;
