import { useEffect, useState } from 'react';

const API = 'http://localhost:5000/api';

export default function GiftShop() {
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const responses = await Promise.all([
          fetch(`${API}/products`),
          fetch(`${API}/gift-shops`)
        ]);

        if (responses.some((response) => !response.ok)) {
          throw new Error('Could not load products and gift shops.');
        }

        const [productData, shopData] = await Promise.all(
          responses.map((response) => response.json())
        );

        setProducts(productData);
        setShops(shopData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function addProduct(event) {
    event.preventDefault();
    if (saving) return;

    const form = event.currentTarget;
    const fields = new FormData(form);

    const product = {
      name: fields.get('name').trim(),
      category: fields.get('category').trim(),
      price: fields.get('price'),
      quantity_in_stock: Number(fields.get('quantity_in_stock')),
      color: fields.get('color').trim(),
      design: fields.get('design').trim(),
      shop_ID: Number(fields.get('shop_ID'))
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not add product.');
      }

      const shop = shops.find(
        (item) => item.shop_ID === product.shop_ID
      );

      setProducts((previous) => [
        ...previous,
        {
          ...product,
          product_ID: result.product_ID,
          shop_name: shop?.name || ''
        }
      ]);

      form.reset();
      setMessage('Product added successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Zoo Gift Shop</h1>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      {!loading && shops.length > 0 && (
        <form
          onSubmit={addProduct}
          style={{ maxWidth: 420, margin: '0 auto 40px' }}
        >
          <h2>Add Product</h2>

          <fieldset disabled={saving}>
            <legend>Product details</legend>

            <p>
              <label>
                Gift shop<br />
                <select name="shop_ID" required defaultValue="">
                  <option value="" disabled>Select a shop</option>
                  {shops.map((shop) => (
                    <option key={shop.shop_ID} value={shop.shop_ID}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </label>
            </p>

            {[
              ['name', 'Product name', 100],
              ['category', 'Category', 50],
              ['color', 'Color', 50],
              ['design', 'Design', 100]
            ].map(([name, label, maxLength]) => (
              <p key={name}>
                <label>
                  {label}<br />
                  <input name={name} maxLength={maxLength} required />
                </label>
              </p>
            ))}

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

            <p>
              <label>
                Quantity in stock<br />
                <input
                  name="quantity_in_stock"
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  required
                />
              </label>
            </p>

            <button type="submit">
              {saving ? 'Saving...' : 'Add Product'}
            </button>
          </fieldset>
        </form>
      )}

      {!loading && shops.length === 0 && (
        <p>Add a gift shop to the database before adding products.</p>
      )}

      <h2>Products</h2>

      {!loading && products.length === 0 && (
        <p>No products available yet.</p>
      )}

      {products.map((product) => (
        <article key={product.product_ID}>
          <h3>{product.name}</h3>
          <p>Shop: {product.shop_name}</p>
          <p>Category: {product.category}</p>
          <p>Price: ${Number(product.price).toFixed(2)}</p>
          <p>
            {product.quantity_in_stock > 0
              ? `${product.quantity_in_stock} in stock`
              : 'Out of stock'}
          </p>
        </article>
      ))}
    </section>
  );
}