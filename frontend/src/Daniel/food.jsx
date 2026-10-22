import { useEffect, useState } from 'react';

const API = 'http://localhost:5000/api';

export default function Food() {
  const [stalls, setStalls] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const responses = await Promise.all([
          fetch(`${API}/food-stalls`),
          fetch(`${API}/menu-items`)
        ]);

        if (responses.some(response => !response.ok)) {
          throw new Error('Could not load food stalls and menu items.');
        }

        const [stallData, itemData] = await Promise.all(
          responses.map(response => response.json())
        );

        setStalls(stallData);
        setItems(itemData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function addMenuItem(event) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    const item = {
      name: fields.get('name').trim(),
      category: fields.get('category').trim(),
      price: fields.get('price'),
      stall_ID: Number(fields.get('stall_ID'))
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API}/menu-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not add menu item.');
      }

      const stall = stalls.find(
        entry => entry.stall_ID === item.stall_ID
      );

      setItems(previous => [
        ...previous,
        {
          ...item,
          item_ID: result.item_ID,
          stall_name: stall?.name || ''
        }
      ]);

      form.reset();
      setMessage('Menu item added successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Zoo Food Stalls</h1>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {stalls.map(stall => (
        <article key={stall.stall_ID}>
          <h2>{stall.name}</h2>
          <p>Location: {stall.location}</p>
          <p>
            Hours: {stall.opening_time?.slice(0, 5)} –{' '}
            {stall.closing_time?.slice(0, 5)}
          </p>
        </article>
      ))}

      {!loading && stalls.length > 0 && (
        <form
          onSubmit={addMenuItem}
          style={{ maxWidth: 420, margin: '30px auto' }}
        >
          <h2>Add Menu Item</h2>

          <fieldset disabled={saving}>
            <legend>Menu item details</legend>

            <p>
              <label>
                Food stall<br />
                <select name="stall_ID" required defaultValue="">
                  <option value="" disabled>Select a food stall</option>
                  {stalls.map(stall => (
                    <option key={stall.stall_ID} value={stall.stall_ID}>
                      {stall.name}
                    </option>
                  ))}
                </select>
              </label>
            </p>

            <p>
              <label>
                Item name<br />
                <input name="name" maxLength={100} required />
              </label>
            </p>

            <p>
              <label>
                Category<br />
                <input name="category" maxLength={50} required />
              </label>
            </p>

            <p>
              <label>
                Price ($)<br />
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  required
                />
              </label>
            </p>

            <button type="submit">
              {saving ? 'Saving...' : 'Add Menu Item'}
            </button>
          </fieldset>
        </form>
      )}

      {!loading && stalls.length === 0 && (
        <p>No food stalls available yet.</p>
      )}

      <h2>Menu</h2>

      {!loading && items.length === 0 && (
        <p>No menu items available yet.</p>
      )}

      {items.map(item => (
        <article key={item.item_ID}>
          <h3>{item.name}</h3>
          <p>Food stall: {item.stall_name}</p>
          <p>Category: {item.category}</p>
          <p>Price: ${Number(item.price).toFixed(2)}</p>
        </article>
      ))}
    </section>
  );
}