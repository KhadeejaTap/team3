const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'db-team3-zoo.mysql.database.azure.com',
    user: 'zooadmin',
    password: 'Admin123!',
    database: 'zoo',
    port: 3306,
    ssl: { rejectUnauthorized: true }
});

async function exploreDatabase() {
    const connection = await pool.getConnection();
    
    try {
        console.log('\n=== GIFT_SHOP TABLE ===');
        const [giftShop] = await connection.query('DESCRIBE GIFT_SHOP');
        console.table(giftShop);
        
        console.log('\n=== PRODUCT TABLE (items in gift shop) ===');
        const [product] = await connection.query('DESCRIBE PRODUCT');
        console.table(product);
        
        console.log('\n=== CUST_TRANSACTION TABLE ===');
        const [custTx] = await connection.query('DESCRIBE CUST_TRANSACTION');
        console.table(custTx);
        
        console.log('\n=== TRANSACTION_ITEM TABLE ===');
        const [txItem] = await connection.query('DESCRIBE TRANSACTION_ITEM');
        console.table(txItem);
        
        console.log('\n=== COUPON TABLE ===');
        const [coupon] = await connection.query('DESCRIBE COUPON');
        console.table(coupon);
        
        console.log('\n=== VISITOR TABLE ===');
        const [visitor] = await connection.query('DESCRIBE VISITOR');
        console.table(visitor);
        
        // Show some sample data
        console.log('\n=== SAMPLE DATA ===');
        
        console.log('\nGift Shops:');
        const [shops] = await connection.query('SELECT * FROM GIFT_SHOP LIMIT 3');
        console.table(shops);
        
        console.log('\nProducts (Gift Shop Items):');
        const [products] = await connection.query('SELECT p.*, g.name as shop_name FROM PRODUCT p LEFT JOIN GIFT_SHOP g ON p.shop_ID = g.shop_ID LIMIT 5');
        console.table(products);
        
        console.log('\nTransactions:');
        const [transactions] = await connection.query('SELECT ct.*, v.name as visitor_name FROM CUST_TRANSACTION ct LEFT JOIN VISITOR v ON ct.visitor_ID = v.visitor_ID LIMIT 5');
        console.table(transactions);
        
        console.log('\nTransaction Items:');
        const [items] = await connection.query('SELECT ti.*, ct.visitor_ID FROM TRANSACTION_ITEM ti LEFT JOIN CUST_TRANSACTION ct ON ti.transaction_ID = ct.transaction_ID WHERE ti.item_type IN ("product", "food") LIMIT 8');
        console.table(items);
        
        console.log('\nCoupons:');
        const [coupons] = await connection.query('SELECT * FROM COUPON LIMIT 5');
        console.table(coupons);
        
        // Show relationships
        console.log('\n=== TABLE RELATIONSHIPS ===');
        const [fks] = await connection.query(`
            SELECT 
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = 'zoo' 
            AND (TABLE_NAME IN ('GIFT_SHOP', 'PRODUCT', 'CUST_TRANSACTION', 'TRANSACTION_ITEM', 'COUPON', 'VISITOR')
                 OR REFERENCED_TABLE_NAME IN ('GIFT_SHOP', 'PRODUCT', 'CUST_TRANSACTION', 'TRANSACTION_ITEM', 'COUPON', 'VISITOR'))
            ORDER BY TABLE_NAME, COLUMN_NAME
        `);
        console.table(fks);
        
    } finally {
        connection.release();
        await pool.end();
    }
}

exploreDatabase().catch(console.error);
