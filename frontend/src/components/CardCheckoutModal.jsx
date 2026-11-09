import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export default function CardCheckoutModal({
  isOpen,
  onClose,
  items = [],
  itemType = 'product', // 'product' (Gift Shop) or 'food' (Concessions)
  onSuccess,
  userEmail = ''
}) {
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expDate, setExpDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [email, setEmail] = useState(() => userEmail || localStorage.getItem('user_email') || '');

  useEffect(() => {
    if (isOpen) {
      const activeEmail = userEmail || localStorage.getItem('user_email') || '';
      if (activeEmail) {
        setEmail(activeEmail);
      }
    }
  }, [isOpen, userEmail]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  if (!isOpen) return null;

  // Subtotal & Tax (8.25% Texas sales tax)
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const tax = subtotal * 0.0825;
  const total = subtotal + tax;

  // Real-time card formatting (16 digits spaced: 4111 2222 3333 4444)
  function handleCardNumberChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  }

  // Real-time Expiry formatting (MM/YY)
  function handleExpDateChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setExpDate(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpDate(raw);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 15) {
      setError('Please enter a valid 16-digit card number.');
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expDate)) {
      setError('Please enter a valid expiration date (MM/YY).');
      return;
    }

    if (cvv.length < 3) {
      setError('Please enter a valid CVV (3-4 digits).');
      return;
    }

    if (zipCode.length < 5) {
      setError('Please enter a valid 5-digit billing ZIP code.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          payment_method: 'credit',
          visitor_ID: null,
          email: email.trim() || null,
          total: total.toFixed(2),
          items: items.map(item => ({
            item_ID: item.item_ID,
            quantity: item.quantity,
            price: Number(item.price)
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed. Please try again.');
      }

      const receiptData = {
        ...data,
        items: [...items],
        cardLast4: cleanCard.slice(-4),
        cardName,
        email: email || 'Guest'
      };

      setSuccess(true);
      setSuccessData(data);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinish() {
    setSuccess(false);
    setSuccessData(null);
    setCardNumber('');
    setCardName('');
    setExpDate('');
    setCvv('');
    setZipCode('');
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        {/* If purchase succeeds, show clean confirmation */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <h2 style={{ color: '#204228', marginTop: 0, marginBottom: '12px' }}>
              Order Placed Successfully!
            </h2>
            <p style={{ color: '#444', fontSize: '1rem', marginBottom: '8px' }}>
              Order <strong>#{successData?.transaction_ID}</strong>
            </p>
            <p style={{ color: '#555', fontSize: '0.95rem', marginBottom: '24px' }}>
              Your purchase has been confirmed and saved to your Account.
            </p>
            <button
              type="button"
              onClick={handleFinish}
              style={{
                backgroundColor: '#204228',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        ) : (
          /* Payment Input Form */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, color: '#204228' }}>
                {itemType === 'product' ? 'Gift Shop Checkout' : 'Food Order Checkout'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '12px', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            {/* Order Mini-Summary */}
            <div style={{ background: '#f5f7f5', padding: '12px', borderRadius: '6px', marginBottom: '16px' }}>
              <strong style={{ fontSize: '0.9rem' }}>Order Summary ({items.reduce((s, i) => s + i.quantity, 0)} items):</strong>
              <div style={{ maxHeight: '120px', overflowY: 'auto', margin: '6px 0', fontSize: '0.85rem' }}>
                {items.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{it.quantity}x {it.name} {it.color ? `(${it.color})` : ''} {it.size ? `Size: ${it.size}` : ''}</span>
                    <span>${(Number(it.price) * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Total (incl. tax):</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Card Payment Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Email for Receipt (Optional)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="visitor@example.com"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Cardholder Name *
                </label>
                <input
                  type="text"
                  required
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  placeholder="Jane Doe"
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                  Card Number (Credit / Debit) *
                </label>
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="4111 2222 3333 4444"
                  maxLength={19}
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Exp Date *
                  </label>
                  <input
                    type="text"
                    required
                    value={expDate}
                    onChange={handleExpDateChange}
                    placeholder="MM/YY"
                    maxLength={5}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    CVV *
                  </label>
                  <input
                    type="password"
                    required
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
                    Billing ZIP *
                  </label>
                  <input
                    type="text"
                    required
                    value={zipCode}
                    onChange={e => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="77002"
                    maxLength={5}
                    style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '10px',
                    backgroundColor: submitting ? '#777' : '#204228',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Processing Payment...' : `Pay $${total.toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
