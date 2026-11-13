const pool = require('../backend/db');

const START_YEAR = 2020;
const SALES_PER_MONTH = 10;
const MONTHS_SPANNED = 83; // Jan 2020 - Nov 2026
const TOTAL_SALES = SALES_PER_MONTH * MONTHS_SPANNED; // 830 sales

// 10 confirmed existing visitor IDs (no duplicates)
const VISITOR_IDS = [2, 4, 8, 10, 11, 12, 15, 52, 54, 57];

// Payment methods for variety
const PAYMENT_METHODS = ['credit', 'debit', 'digital_wallet', 'paypal'];

async function seedGiftShopData() {
	let connection;
	try {
		connection = await pool.getConnection();

		// Fetch the real product catalog
		const [products] = await connection.query('SELECT product_ID, price FROM PRODUCT ORDER BY product_ID');
		if (products.length === 0) {
			throw new Error('No products found in PRODUCT table');
		}

		console.log(`Found ${products.length} products in catalog`);

		// Replenish stock to handle 830 sales (max ~5 units per sale = 4150 max per product)
		// Set to 500 per product to be safe
		await connection.query('UPDATE PRODUCT SET quantity_in_stock = 500');
		console.log('Replenished product stock to 500 units each');

		console.log(`Starting seed: ${TOTAL_SALES} sales over ${MONTHS_SPANNED} months (${SALES_PER_MONTH}/month)\n`);

		await connection.beginTransaction();

		let inserted = 0;
		const startTime = Date.now();

		for (let saleNum = 0; saleNum < TOTAL_SALES; saleNum++) {
			// Deterministic visitor rotation (cycles through all 10 each month)
			const visitorIdx = (saleNum % SALES_PER_MONTH + Math.floor(saleNum / SALES_PER_MONTH) * SALES_PER_MONTH) % VISITOR_IDS.length;
			const visitorID = VISITOR_IDS[visitorIdx];

			// Deterministic product variety (different stride so it doesn't lock-step with visitor)
			const productIdx = (saleNum * 7 + Math.floor(saleNum / SALES_PER_MONTH) * 3) % products.length;
			const product = products[productIdx];

			// Quantity varies 1-5
			const quantity = ((saleNum % 5) + 1);

			// Calculate total
			const total = (product.price * quantity).toFixed(2);

			// Payment method cycles through available options
			const paymentMethod = PAYMENT_METHODS[saleNum % PAYMENT_METHODS.length];

			// Spread sales deterministically across the month
			const month = Math.floor(saleNum / SALES_PER_MONTH);
			const dayInMonth = (saleNum % SALES_PER_MONTH) * 3 % 27 + 1; // Days 1-27, spread out
			const year = START_YEAR + Math.floor(month / 12);
			const monthInYear = (month % 12) + 1;
			const transactionDate = new Date(year, monthInYear - 1, dayInMonth);
			transactionDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

			// Insert transaction
			const [txResult] = await connection.query(
				`INSERT INTO CUST_TRANSACTION (visitor_ID, total, payment_method, transaction_date)
         VALUES (?, ?, ?, ?)`,
				[visitorID, total, paymentMethod, transactionDate]
			);
			const transactionID = txResult.insertId;

			// Insert transaction item
			await connection.query(
				`INSERT INTO TRANSACTION_ITEM (transaction_ID, item_type, item_ID, quantity, price)
         VALUES (?, ?, ?, ?, ?)`,
				[transactionID, 'product', product.product_ID, quantity, Number(product.price).toFixed(2)]
			);

			inserted++;

			if (inserted % 100 === 0) {
				console.log(`  Progress: ${inserted} / ${TOTAL_SALES} sales inserted`);
			}
		}

		await connection.commit();

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
		console.log(`\n✓ Successfully seeded ${inserted} gift shop transactions in ${elapsed}s`);
		console.log(`  Date range: Jan 2020 – Nov 2026`);
		console.log(`  Visitors: ${VISITOR_IDS.length} recurring buyers`);
		console.log(`  Products: ${products.length} items from catalog`);
		console.log(`  Payment methods: All 4 types represented`);
	} catch (err) {
		if (connection) {
			try {
				await connection.rollback();
			} catch (rollbackErr) {
				console.error('Rollback error:', rollbackErr.message);
			}
		}
		console.error('Error during seed:', err.message);
		throw err;
	} finally {
		if (connection) {
			connection.release();
		}
		await pool.end();
	}
}

seedGiftShopData().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
