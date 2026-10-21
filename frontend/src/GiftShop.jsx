import { useEffect, useState } from 'react';

export default function GiftShop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch('http://localhost:5000/api/products');

        if (!response.ok) {
          throw new Error('Could not load products.');
        }

        const data = await response.json();
        setProducts(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return (
    <section>
      <h1>Zoo Gift Shop</h1>

      {loading && <p>Loading products...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && !error && products.length === 0 && (
        <p>No products available yet.</p>
      )}

      {products.map((product) => (
        <article key={product.product_ID}>
          <h2>{product.name}</h2>
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