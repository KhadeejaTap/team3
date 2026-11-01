import { useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function POSRegister({
  items = [],
  itemType = 'product', // 'product' or 'food'
  staffRole = 'employee',
  onSaleComplete
}) {
  const [ticket, setTicket] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Tender / Payment State
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'card'
  const [cashTendered, setCashTendered] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  // Categories list
  const categories = ['all', ...new Set(items.map(i => i.category).filter(Boolean))];

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.color && item.color.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  // Ticket Math
  const subtotal = ticket.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  const tenderedAmount = Number(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedAmount - total);
  const isCashSufficient = paymentMethod === 'card' || (tenderedAmount >= total && total > 0);

  function addToTicket(item) {
    const id = item.product_ID || item.item_ID;
    setTicket(prev => {
      const existing = prev.find(i => i.id === id);
      if (existing) {
        if (item.quantity_in_stock !== undefined && existing.quantity >= item.quantity_in_stock) {
          alert('Stock limit reached.');
          return prev;
        }
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          id,
          name: item.name,
          color: item.color || null,
          price: Number(item.price),
          quantity: 1,
          maxStock: item.quantity_in_stock
        }
      ];
    });
  }

  function updateTicketQuantity(id, delta) {
    setTicket(prev =>
      prev
        .map(i => {
          if (i.id !== id) return i;
          const newQty = i.quantity + delta;
          if (i.maxStock !== undefined && newQty > i.maxStock) {
            alert('Stock limit reached.');
            return i;
          }
          return { ...i, quantity: newQty };
        })
        .filter(i => i.quantity > 0)
    );
  }

  function removeFromTicket(id) {
    setTicket(prev => prev.filter(i => i.id !== id));
  }

  function clearTicket() {
    setTicket([]);
    setCashTendered('');
    setCardName('');
    setCardNumber('');
    setError('');
  }

  async function handleCompleteSale(e) {
    e.preventDefault();
    if (ticket.length === 0) return;
    setError('');

    if (paymentMethod === 'cash' && tenderedAmount < total) {
      setError('Cash tendered is less than the total due.');
      return;
    }

    if (paymentMethod === 'card') {
      const clean = cardNumber.replace(/\s/g, '');
      if (clean.length < 15) {
        setError('Please enter a valid 16-digit card number.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          payment_method: paymentMethod,
          cash_tendered: paymentMethod === 'cash' ? tenderedAmount.toFixed(2) : null,
          change_due: paymentMethod === 'cash' ? changeDue.toFixed(2) : null,
          total: total.toFixed(2),
          items: ticket.map(t => ({
            item_ID: t.id,
            quantity: t.quantity,
            price: t.price
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sale failed.');
      }

      setReceipt({
        ...data,
        items: [...ticket],
        cashierRole: staffRole,
        paymentMethod,
        cashTendered: tenderedAmount,
        changeDue,
        cardLast4: cardNumber ? cardNumber.replace(/\s/g, '').slice(-4) : null
      });

      clearTicket();

      if (onSaleComplete) {
        onSaleComplete();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Printable Receipt Modal */}
      {receipt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{ background: '#fff', padding: '24px', maxWidth: '480px', width: '100%', borderRadius: '4px' }}>
            <h3 style={{ margin: '0 0 12px', color: '#204228' }}>Sale Complete</h3>
            <div style={{ border: '1px dashed #666', padding: '16px', fontFamily: 'monospace', fontSize: '0.9rem', background: '#fafafa' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px solid #ccc', paddingBottom: '6px', marginBottom: '8px' }}>
                <strong>COUGAR ZOO</strong>
                <div>{itemType === 'product' ? 'Gift Shop POS Register' : 'Food Stall POS Register'}</div>
              </div>
              <div>Transaction #: TX-{receipt.transaction_ID}</div>
              <div>Date: {new Date(receipt.date).toLocaleString()}</div>
              <div>Register Staff: {receipt.cashierRole}</div>
              <div style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd', padding: '6px 0', margin: '8px 0' }}>
                {receipt.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{it.quantity}x {it.name} {it.color ? `(${it.color})` : ''}</span>
                    <span>${(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Subtotal: ${Number(receipt.subtotal).toFixed(2)}</div>
                <div>Tax (8.25%): ${Number(receipt.tax).toFixed(2)}</div>
                <div><strong>Total: ${Number(receipt.total).toFixed(2)}</strong></div>
                <div style={{ marginTop: '6px', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
                  {receipt.paymentMethod === 'cash' ? (
                    <>
                      <div>Payment: Cash</div>
                      <div>Tendered: ${Number(receipt.cashTendered).toFixed(2)}</div>
                      <div><strong>Change Due: ${Number(receipt.changeDue).toFixed(2)}</strong></div>
                    </>
                  ) : (
                    <div>Payment: Card (ending in {receipt.cardLast4})</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => window.print()} style={{ flex: 1, padding: '8px' }}>
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                style={{ flex: 1, padding: '8px', backgroundColor: '#204228', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                Next Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS Dual-Pane Screen */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* Left Side: Quick-Tap Catalog (60%) */}
        <div style={{ flex: 3, border: '1px solid #ccc', padding: '16px', borderRadius: '4px', background: '#fff' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search by name, SKU, or color..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '8px' }}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} style={{ padding: '8px' }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 10px',
                  fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                  backgroundColor: selectedCategory === cat ? '#204228' : '#eee',
                  color: selectedCategory === cat ? '#fff' : '#000',
                  border: '1px solid #ccc',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
            {filteredItems.map(item => {
              const id = item.product_ID || item.item_ID;
              const isOut = item.quantity_in_stock !== undefined && item.quantity_in_stock <= 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => addToTicket(item)}
                  disabled={isOut}
                  style={{
                    padding: '10px',
                    textAlign: 'left',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: isOut ? '#f5f5f5' : '#fafafa',
                    cursor: isOut ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.category}</div>
                  <div style={{ fontWeight: 'bold', margin: '4px 0', fontSize: '0.9rem' }}>
                    {item.name} {item.color ? `(${item.color})` : ''}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <strong>${Number(item.price).toFixed(2)}</strong>
                    {item.quantity_in_stock !== undefined && (
                      <span style={{ color: isOut ? '#c00' : '#204228' }}>
                        {isOut ? 'Out' : `Stock: ${item.quantity_in_stock}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Current Register Ticket (40%) */}
        <div style={{ flex: 2, border: '1px solid #ccc', padding: '16px', borderRadius: '4px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Register Ticket</h3>
            <button
              type="button"
              onClick={clearTicket}
              disabled={ticket.length === 0}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            >
              Clear Ticket
            </button>
          </div>

          {error && (
            <div style={{ padding: '8px', background: '#ffebee', color: '#c62828', fontSize: '0.85rem', marginBottom: '8px' }}>
              {error}
            </div>
          )}

          {/* Ticket Items */}
          <div style={{ minHeight: '160px', maxHeight: '220px', overflowY: 'auto', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
            {ticket.length === 0 ? (
              <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                Ticket is empty. Tap items on the left to ring up.
              </p>
            ) : (
              ticket.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px dotted #eee', fontSize: '0.85rem' }}>
                  <div style={{ flex: 2 }}>
                    <div><strong>{item.name}</strong> {item.color ? `(${item.color})` : ''}</div>
                    <div style={{ color: '#666' }}>${item.price.toFixed(2)} each</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'center' }}>
                    <button type="button" onClick={() => updateTicketQuantity(item.id, -1)} style={{ padding: '2px 6px' }}>-</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateTicketQuantity(item.id, 1)} style={{ padding: '2px 6px' }}>+</button>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <strong>${(item.price * item.quantity).toFixed(2)}</strong>
                    <div>
                      <button type="button" onClick={() => removeFromTicket(item.id)} style={{ fontSize: '0.75rem', color: '#999', border: 'none', background: 'none', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total Math */}
          <div style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax (8.25%):</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold', marginTop: '4px', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
              <span>Total Due:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Tender Form */}
          <div style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', background: '#fafafa', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '0.9rem' }}>
              <label>
                <input
                  type="radio"
                  name="posPayMethod"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                {' '}Cash
              </label>
              <label>
                <input
                  type="radio"
                  name="posPayMethod"
                  value="card"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                />
                {' '}Card (Counter Terminal)
              </label>
            </div>

            {paymentMethod === 'cash' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>
                  Cash Tendered ($):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
                />
                <div style={{ marginTop: '8px', fontSize: '0.95rem' }}>
                  Change Due:{' '}
                  <strong style={{ color: tenderedAmount >= total ? '#1b6b32' : '#888' }}>
                    ${changeDue.toFixed(2)}
                  </strong>
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Cardholder Name"
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  style={{ width: '100%', padding: '6px', marginBottom: '6px', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  placeholder="Card Number (16 digits)"
                  maxLength={19}
                  value={cardNumber}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                    setCardNumber(raw.replace(/(\d{4})(?=\d)/g, '$1 '));
                  }}
                  style={{ width: '100%', padding: '6px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleCompleteSale}
            disabled={submitting || ticket.length === 0 || !isCashSufficient}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: submitting || ticket.length === 0 || !isCashSufficient ? '#aaa' : '#204228',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: submitting || ticket.length === 0 || !isCashSufficient ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Processing...' : 'Complete Sale & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
