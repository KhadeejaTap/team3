const { requireRoles } = require('./auth');

async function handleCheckout(req, res, pool, send, readBody) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname !== '/api/product-checkout' || req.method !== 'POST') {
    return false;
  }

  res.setHeader('Cache-Control', 'no-store');

  const allowed = await requireRoles(
    req,
    res,
    pool,
    send,
    ['visitor', 'employee', 'manager', 'admin']
  );

  if (!allowed) return true;

  const data = await readBody(req);
  const paymentMethods = ['credit', 'debit', 'digital_wallet', 'paypal'];

  if (
    !data ||
    !Number.isSafeInteger(data.product_ID) ||
    data.product_ID <= 0 ||
    !Number.isSafeInteger(data.quantity) ||
    data.quantity <= 0 ||
    data.quantity > 1000 ||
    !paymentMethods.includes(data.payment_method)
  ) {
    send(res, 400, {
      error: 'Select a product, quantity from 1 to 1000, and payment method.'
    });
    return true;
  }

  const connection = await pool.getConnection();
  let receipt;

  try {
    await connection.beginTransaction();

    const [products] = await connection.execute(
      `SELECT product_ID, name, price, quantity_in_stock
       FROM product
       WHERE product_ID = ?
       FOR UPDATE`,
      [data.product_ID]
    );

    if (products.length === 0) {
      await connection.rollback();
      send(res, 404, { error: 'Product was not found.' });
      return true;
    }

    const product = products[0];

    if (
      product.quantity_in_stock == null ||
      Number(product.quantity_in_stock) < data.quantity
    ) {
      await connection.rollback();
      send(res, 409, { error: 'Not enough stock for this purchase.' });
      return true;
    }

    const priceText = String(product.price);

    if (!/^\d{1,6}(\.\d{1,2})?$/.test(priceText)) {
      await connection.rollback();
      send(res, 409, { error: 'This product does not have a valid price.' });
      return true;
    }

    const [dollars, fraction = ''] = priceText.split('.');
    const unitCents = Number(dollars) * 100 +
      Number(fraction.padEnd(2, '0'));
    const totalCents = unitCents * data.quantity;

    if (totalCents > 9999999999) {
      await connection.rollback();
      send(res, 400, { error: 'Purchase total is too large.' });
      return true;
    }

    const total = (totalCents / 100).toFixed(2);

    const [transaction] = await connection.execute(
      `INSERT INTO cust_transaction (total, payment_method)
       VALUES (?, ?)`,
      [total, data.payment_method]
    );

    // The MySQL trigger reduces stock when this purchase line is inserted.
    // Do not subtract stock a second time here.
    await connection.execute(
      `INSERT INTO transaction_item
         (transaction_ID, item_type, item_ID, quantity, price)
       VALUES (?, 'product', ?, ?, ?)`,
      [
        transaction.insertId,
        product.product_ID,
        data.quantity,
        product.price
      ]
    );

    receipt = {
      transaction_ID: transaction.insertId,
      product_name: product.name,
      quantity: data.quantity,
      total,
      message: 'Purchase recorded successfully.'
    };

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    if (error.errno === 1644) {
      send(res, 409, {
        error: 'Purchase rejected. The product may have insufficient stock.'
      });
      return true;
    }

    throw error;
  } finally {
    connection.release();
  }

  send(res, 201, receipt);
  return true;
}

module.exports = handleCheckout;