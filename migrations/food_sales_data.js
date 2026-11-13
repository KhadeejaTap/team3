const pool = require('../backend/db');

const START_YEAR = 2020;
const TOTAL_SALES = 900;
const MONTHS_SPANNED = 83; // January 2020 through November 2026

const visitors = [
	['Maya Rodriguez', 'maya.rodriguez@foodexample.com'],
	['Ethan Brooks', 'ethan.brooks@foodexample.com'],
	['Sofia Patel', 'sofia.patel@foodexample.com'],
	['Liam Carter', 'liam.carter@foodexample.com'],
	['Ava Thompson', 'ava.thompson@foodexample.com'],
	['Noah Williams', 'noah.williams@foodexample.com'],
	['Isabella Nguyen', 'isabella.nguyen@foodexample.com'],
	['Lucas Martinez', 'lucas.martinez@foodexample.com'],
	['Harper Kim', 'harper.kim@foodexample.com'],
	['Oliver Davis', 'oliver.davis@foodexample.com'],
	['Amelia Johnson', 'amelia.johnson@foodexample.com'],
	['James Wilson', 'james.wilson@foodexample.com']
].map(([name, email]) => ({ name, email }));

function dateForSale(saleNumber) {
	const monthOffset = Math.floor((saleNumber * MONTHS_SPANNED) / TOTAL_SALES);
	const day = (saleNumber % 25) + 1;
	const date = new Date(Date.UTC(START_YEAR, monthOffset, day));
	return date.toISOString().slice(0, 10);
}

async function findOrCreateVisitor(connection, visitor) {
	const [existing] = await connection.query(
		'SELECT visitor_ID FROM VISITOR WHERE email = ? LIMIT 1',
		[visitor.email]
	);
	if (existing.length > 0) return existing[0].visitor_ID;

	const [result] = await connection.query(
		'INSERT INTO VISITOR (name, email) VALUES (?, ?)',
		[visitor.name, visitor.email]
	);
	return result.insertId;
}

async function createFoodSalesData() {
	const connection = await pool.getConnection();

	try {
		await connection.beginTransaction();

		await connection.query(
			`DELETE ti
			 FROM TRANSACTION_ITEM ti
			 JOIN CUST_TRANSACTION ct ON ct.transaction_ID = ti.transaction_ID
			 JOIN VISITOR v ON v.visitor_ID = ct.visitor_ID
			 WHERE v.email LIKE 'food-seed-%@example.com'
			    OR v.email IN (?)`,
			[visitors.map((visitor) => visitor.email)]
		);
		await connection.query(
			`DELETE ct
			 FROM CUST_TRANSACTION ct
			 JOIN VISITOR v ON v.visitor_ID = ct.visitor_ID
			 WHERE v.email LIKE 'food-seed-%@example.com'
			    OR v.email IN (?)`,
			[visitors.map((visitor) => visitor.email)]
		);
		await connection.query(
			`DELETE FROM VISITOR
			 WHERE email LIKE 'food-seed-%@example.com'`
		);
		await connection.query(
			`DELETE FROM MENU_ITEM
			 WHERE name LIKE 'Seed %'`
		);
		await connection.query(
			`DELETE FROM FOOD_STALL
			 WHERE name LIKE 'Seed Food Stall %'`
		);

		const [existingMenuItems] = await connection.query(
			`SELECT mi.item_ID, mi.price
			 FROM MENU_ITEM mi
			 JOIN FOOD_STALL fs ON fs.stall_ID = mi.stall_ID
			 WHERE mi.name NOT LIKE 'Seed %'
			 ORDER BY mi.item_ID`
		);
		if (existingMenuItems.length === 0) {
			throw new Error('No existing menu items connected to food stalls were found.');
		}

		const visitorIDs = [];
		for (const visitor of visitors) {
			visitorIDs.push(await findOrCreateVisitor(connection, visitor));
		}

		const [[countRow]] = await connection.query(
			`SELECT COUNT(*) AS existing_sales
			 FROM CUST_TRANSACTION ct
			 JOIN VISITOR v ON v.visitor_ID = ct.visitor_ID
			 WHERE v.email IN (?)`,
			[visitors.map((visitor) => visitor.email)]
		);
		const existingSales = Math.min(Number(countRow.existing_sales), TOTAL_SALES);

		for (let saleNumber = existingSales; saleNumber < TOTAL_SALES; saleNumber += 1) {
			const menuItem = existingMenuItems[saleNumber % existingMenuItems.length];
			const quantity = (saleNumber % 5) + 1;
			const total = Number(menuItem.price) * quantity;

			const [transaction] = await connection.query(
				`INSERT INTO CUST_TRANSACTION
				 (visitor_ID, total, payment_method, transaction_date)
				 VALUES (?, ?, 'credit', ?)`,
				[
					visitorIDs[saleNumber % visitorIDs.length],
					total.toFixed(2),
					dateForSale(saleNumber)
				]
			);

			await connection.query(
				`INSERT INTO TRANSACTION_ITEM
				 (transaction_ID, item_type, item_ID, quantity, price)
				 VALUES (?, 'food', ?, ?, ?)`,
				[
					transaction.insertId,
					menuItem.item_ID,
					quantity,
					Number(menuItem.price).toFixed(2)
				]
			);
		}

		await connection.commit();
		console.log(`Food sales data applied: ${TOTAL_SALES} total sales.`);
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
		await pool.end();
	}
}

createFoodSalesData().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
