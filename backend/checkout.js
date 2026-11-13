const { requireRoles } = require('./auth');
const { autoDispatchAlerts, sendReceiptEmail } = require('./mailer');

async function handleCheckout(req, res, pool, send, readBody) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/coupons' && req.method === 'GET') {
    try {
      const email = parsedUrl.searchParams.get('email');
      if (!email || !email.trim()) {
        send(res, 200, []);
        return true;
      }
      const [coupons] = await pool.query(
        `SELECT coupon_ID, code, discount_percent, created_at
         FROM COUPON
         WHERE LOWER(donor_email) = LOWER(?) AND is_used = FALSE
         ORDER BY created_at DESC`,
        [email.trim()]
      );
      send(res, 200, coupons);
      return true;
    } catch (err) {
      send(res, 500, { error: err.message });
      return true;
    }
  }

  if (pathname === '/api/checkout' && req.method === 'POST') {
    let data;
    try {
      data = await readBody(req);
    } catch {
      send(res, 400, { error: 'Invalid JSON request body.' });
      return true;
    }

    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      send(res, 400, { error: 'Your cart is empty. Please add items before checking out.' });
      return true;
    }

    const itemType = data.item_type || 'product';
    if (!['product', 'food', 'ticket'].includes(itemType)) {
      send(res, 400, { error: 'Invalid item type.' });
      return true;
    }

    for (const item of data.items) {
      if (!item.item_ID || !item.quantity || item.quantity <= 0) {
        send(res, 400, { error: 'Invalid item details in cart.' });
        return true;
      }
    }

    const subtotal = data.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    let discountAmount = 0;
    let appliedCouponCode = null;

    const allowedMethods = ['credit', 'debit', 'digital_wallet', 'paypal', 'cash'];
    let chosenMethod = data.payment_method === 'card' ? 'credit' : data.payment_method;
    const paymentMethod = allowedMethods.includes(chosenMethod) ? chosenMethod : 'credit';

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      if (data.coupon_code && typeof data.coupon_code === 'string' && data.coupon_code.trim()) {
        const rawCode = data.coupon_code.trim().toUpperCase();
        const [couponRows] = await connection.query(
          'SELECT coupon_ID, code, discount_percent FROM COUPON WHERE UPPER(code) = ? AND is_used = FALSE FOR UPDATE',
          [rawCode]
        );
        if (couponRows.length > 0) {
          const coupon = couponRows[0];
          const pct = coupon.discount_percent || 15;
          discountAmount = subtotal * (pct / 100);
          appliedCouponCode = coupon.code;
          await connection.query('UPDATE COUPON SET is_used = TRUE WHERE coupon_ID = ?', [coupon.coupon_ID]);
        } else {
          await connection.rollback();
          send(res, 400, { error: `Invalid, expired, or already-used coupon code: "${data.coupon_code}"` });
          return true;
        }
      }

      const discountedSubtotal = Math.max(0, subtotal - discountAmount);
      const tax = discountedSubtotal * 0.0825;
      const totalAmount = data.total ? Number(data.total) : discountedSubtotal + tax;

      let visitorID = data.visitor_ID || null;
      const checkoutEmail = typeof data.email === 'string' && data.email.trim() ? data.email.trim() : null;

      if (!visitorID && checkoutEmail) {
        const [existingVisitor] = await connection.query(
          'SELECT visitor_ID FROM VISITOR WHERE LOWER(email) = LOWER(?)',
          [checkoutEmail]
        );
        if (existingVisitor.length > 0) {
          visitorID = existingVisitor[0].visitor_ID;
        } else {
          const [u] = await connection.query(
            'SELECT first_name, last_name FROM users WHERE LOWER(email) = LOWER(?)',
            [checkoutEmail]
          );
          const fullName = u.length > 0 && (u[0].first_name || u[0].last_name)
            ? [u[0].first_name, u[0].last_name].filter(Boolean).join(' ')
            : checkoutEmail.split('@')[0];

          const [newVisitor] = await connection.query(
            'INSERT INTO VISITOR (name, email) VALUES (?, ?)',
            [fullName, checkoutEmail]
          );
          visitorID = newVisitor.insertId;
        }
      }

      const [transResult] = await connection.query(
        `INSERT INTO CUST_TRANSACTION (visitor_ID, total, payment_method, transaction_date)
         VALUES (?, ?, ?, NOW())`,
        [visitorID, totalAmount.toFixed(2), paymentMethod]
      );
      const transactionID = transResult.insertId;

      for (const item of data.items) {
        await connection.query(
          `INSERT INTO TRANSACTION_ITEM (transaction_ID, item_type, item_ID, quantity, price)
           VALUES (?, ?, ?, ?, ?)`,
          [transactionID, itemType, item.item_ID, item.quantity, Number(item.price).toFixed(2)]
        );
      }

      await connection.commit();

      if (itemType === 'product') {
        autoDispatchAlerts(pool).catch((mailErr) => {
          console.error('[MAILER ERROR] Could not dispatch low stock alert:', mailErr.message);
        });
      }

      const dispatchEmail = checkoutEmail || (data.email && typeof data.email === 'string' ? data.email.trim() : null);
      if (dispatchEmail && dispatchEmail.includes('@')) {
        const storeLabel = itemType === 'product'
          ? 'Gift Shop'
          : itemType === 'food'
            ? 'Food Concessions'
            : 'Cougar Zoo Admissions';

        sendReceiptEmail({
          pool,
          customerEmail: dispatchEmail,
          transactionID,
          storeName: storeLabel,
          items: data.items.map(it => ({
            name: it.name || `${storeLabel} Item #${it.item_ID}`,
            quantity: it.quantity,
            price: it.price
          })),
          subtotal,
          discount: discountAmount,
          tax,
          total: totalAmount,
          paymentMethod: data.payment_method || paymentMethod
        }).catch((mailErr) => {
          console.error('[MAILER ERROR] Could not dispatch receipt email:', mailErr.message);
        });
      }

      send(res, 201, {
        success: true,
        transaction_ID: transactionID,
        total: totalAmount.toFixed(2),
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        coupon_code: appliedCouponCode,
        tax: tax.toFixed(2),
        date: new Date().toISOString(),
        payment_method: data.payment_method || paymentMethod,
        cash_tendered: data.cash_tendered || null,
        change_due: data.change_due || null,
        item_type: itemType,
        item_count: data.items.reduce((sum, item) => sum + Number(item.quantity), 0),
        message: 'Order processed successfully!'
      });
      return true;
    } catch (err) {
      if (connection) {
        await connection.rollback();
      }
      console.error('Checkout error:', err);
      if (err.sqlState === '45000') {
        send(res, 400, { error: err.sqlMessage || err.message });
      } else {
        send(res, 500, { error: 'Checkout failed. ' + err.message });
      }
      return true;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }

  return false;
}

module.exports = handleCheckout;
