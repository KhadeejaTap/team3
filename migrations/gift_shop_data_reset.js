const pool = require('../backend/db');

async function resetGiftShopData() {
	let connection;
	try {
		connection = await pool.getConnection();
		await connection.beginTransaction();

		console.log('Starting gift shop data cleanup...\n');

		// Step 1: Delete product transaction items
		const [delItems] = await connection.query(
			"DELETE FROM TRANSACTION_ITEM WHERE item_type = 'product'"
		);
		console.log(`✓ Deleted ${delItems.affectedRows} TRANSACTION_ITEM rows (item_type='product')`);

		// Step 2: Delete now-empty gift-shop-only transactions
		const [delTx] = await connection.query(
			`DELETE FROM CUST_TRANSACTION
       WHERE transaction_ID NOT IN (SELECT DISTINCT transaction_ID FROM TRANSACTION_ITEM)`
		);
		console.log(`✓ Deleted ${delTx.affectedRows} CUST_TRANSACTION rows (gift-shop-only)`);

		// Step 3: Delete all coupons
		const [delCoupon] = await connection.query('DELETE FROM COUPON');
		console.log(`✓ Deleted ${delCoupon.affectedRows} COUPON rows`);

		// Step 4: Delete sponsor donations (triggers will auto-delete any generated coupons in a clean state)
		const [delDon] = await connection.query(
			"DELETE FROM DONATION WHERE purpose = 'Sponsor an Animal'"
		);
		console.log(`✓ Deleted ${delDon.affectedRows} DONATION rows (purpose='Sponsor an Animal')\n`);

		await connection.commit();
		console.log('Gift shop data reset complete. Ready for reseed.');
	} catch (err) {
		if (connection) {
			await connection.rollback();
		}
		console.error('Error during reset:', err.message);
		throw err;
	} finally {
		if (connection) {
			connection.release();
		}
		await pool.end();
	}
}

resetGiftShopData().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
