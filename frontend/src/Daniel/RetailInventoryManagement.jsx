import { useState } from 'react';
import { apiFetch as fetch } from '../api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = `${API_BASE}/api`;

const CATEGORIES = ['Toys', 'Apparel', 'Drinkware', 'Souvenirs', 'Books'];

export default function RetailInventoryManagement({ products = [], onRefresh }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form states for Add Product
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Apparel',
    color: '',
    cost_price: '',
    price: '',
    quantity_in_stock: '0',
    reorder_level: '5'
  });

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.color && p.color.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  // Summary counts
  const totalItems = products.length;
  const totalUnits = products.reduce((sum, p) => sum + (Number(p.quantity_in_stock) || 0), 0);

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handleEditChange(e) {
    const { name, value } = e.target;
    setEditingProduct(prev => ({ ...prev, [name]: value }));
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const payload = {
        sku: formData.sku.trim() || null,
        name: formData.name.trim(),
        category: formData.category.trim(),
        color: formData.color.trim() || null,
        cost_price: Number(formData.cost_price) || 0.00,
        price: Number(formData.price),
        quantity_in_stock: parseInt(formData.quantity_in_stock, 10) || 0,
        reorder_level: parseInt(formData.reorder_level, 10) || 5
      };

      const res = await fetch(`${API}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add product.');
      }

      setMessage(`Product "${payload.name}" added successfully.`);
      setShowAddForm(false);
      setFormData({
        sku: '',
        name: '',
        category: 'Apparel',
        color: '',
        cost_price: '',
        price: '',
        quantity_in_stock: '0',
        reorder_level: '5'
      });

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProduct(e) {
    e.preventDefault();
    if (!editingProduct) return;
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const payload = {
        sku: editingProduct.sku ? editingProduct.sku.trim() : null,
        name: editingProduct.name.trim(),
        category: editingProduct.category.trim(),
        color: editingProduct.color ? editingProduct.color.trim() : null,
        cost_price: Number(editingProduct.cost_price) || 0.00,
        price: Number(editingProduct.price),
        quantity_in_stock: parseInt(editingProduct.quantity_in_stock, 10),
        reorder_level: parseInt(editingProduct.reorder_level, 10)
      };

      const res = await fetch(`${API}/products/${editingProduct.product_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update product.');
      }

      setMessage(`Product "${payload.name}" updated successfully.`);
      setEditingProduct(null);

      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProduct(product) {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${product.name}"${product.color ? ` (${product.color})` : ''}?`
    );
    if (!confirmDelete) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/products/${product.product_ID}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete product.');
      }

      setMessage(`Product "${product.name}" deleted successfully.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Overview Metrics Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ border: '1px solid #ccc', padding: '10px 16px', borderRadius: '4px', background: '#fff' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Total SKUs</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totalItems}</div>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '10px 16px', borderRadius: '4px', background: '#fff' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Total Inventory Units</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{totalUnits}</div>
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div style={{ padding: '8px 12px', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', marginBottom: '12px', borderRadius: '4px' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '8px 12px', background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', marginBottom: '12px', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {/* Action Controls & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, SKU, color..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: '6px 10px', width: '220px' }}
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '6px 10px' }}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingProduct(null);
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: showAddForm ? '#666' : '#204228',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {showAddForm ? 'Cancel Add' : '+ Add New Product'}
        </button>
      </div>

      {/* Add New Product Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddProduct}
          style={{ border: '1px solid #204228', padding: '16px', borderRadius: '4px', background: '#fcfcfc', marginBottom: '20px' }}
        >
          <h3 style={{ margin: '0 0 12px 0' }}>Add New Product</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>SKU (Unique)</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                placeholder="e.g. APP-TSH-GRN-13"
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g. Cougar Zoo T-Shirt"
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '6px' }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Color (Optional)</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                placeholder="e.g. green, red, black"
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Cost Price ($ Wholesale) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleInputChange}
                required
                placeholder="e.g. 8.50"
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Sell Price ($ Retail) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                placeholder="e.g. 24.99"
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Initial Stock Units *</label>
              <input
                type="number"
                min="0"
                name="quantity_in_stock"
                value={formData.quantity_in_stock}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Reorder Level Alert *</label>
              <input
                type="number"
                min="0"
                name="reorder_level"
                value={formData.reorder_level}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '8px 18px', backgroundColor: '#204228', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Saving...' : 'Save Product'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={{ padding: '8px 14px', border: '1px solid #ccc', background: '#eee', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Edit / Restock Modal Form */}
      {editingProduct && (
        <form
          onSubmit={handleUpdateProduct}
          style={{ border: '2px solid #204228', padding: '16px', borderRadius: '4px', background: '#f5f9f6', marginBottom: '20px' }}
        >
          <h3 style={{ margin: '0 0 12px 0' }}>
            Edit / Restock Product: {editingProduct.name} {editingProduct.color ? `(${editingProduct.color})` : ''}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>SKU</label>
              <input
                type="text"
                name="sku"
                value={editingProduct.sku || ''}
                onChange={handleEditChange}
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Product Name</label>
              <input
                type="text"
                name="name"
                value={editingProduct.name}
                onChange={handleEditChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Category</label>
              <select
                name="category"
                value={editingProduct.category}
                onChange={handleEditChange}
                style={{ width: '100%', padding: '6px' }}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Color</label>
              <input
                type="text"
                name="color"
                value={editingProduct.color || ''}
                onChange={handleEditChange}
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Cost Price ($ Wholesale)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost_price"
                value={editingProduct.cost_price}
                onChange={handleEditChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Sell Price ($ Retail)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={editingProduct.price}
                onChange={handleEditChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Quantity in Stock (Restock)</label>
              <input
                type="number"
                min="0"
                name="quantity_in_stock"
                value={editingProduct.quantity_in_stock}
                onChange={handleEditChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold' }}>Reorder Level</label>
              <input
                type="number"
                min="0"
                name="reorder_level"
                value={editingProduct.reorder_level}
                onChange={handleEditChange}
                required
                style={{ width: '100%', padding: '6px' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '8px 18px', backgroundColor: '#204228', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              style={{ padding: '8px 14px', border: '1px solid #ccc', background: '#eee', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Product Catalog Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #ccc', borderRadius: '4px', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px' }}>ID</th>
              <th style={{ padding: '10px' }}>SKU</th>
              <th style={{ padding: '10px' }}>Product Name</th>
              <th style={{ padding: '10px' }}>Category</th>
              <th style={{ padding: '10px' }}>Color</th>
              <th style={{ padding: '10px' }}>Cost ($)</th>
              <th style={{ padding: '10px' }}>Price ($)</th>
              <th style={{ padding: '10px' }}>Margin</th>
              <th style={{ padding: '10px' }}>Stock</th>
              <th style={{ padding: '10px' }}>Reorder At</th>
              <th style={{ padding: '10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ padding: '20px', textAlign: 'center', color: '#777' }}>
                  No products found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredProducts.map(p => {
                const cost = Number(p.cost_price) || 0;
                const price = Number(p.price) || 0;
                const marginPercent = price > 0 ? (((price - cost) / price) * 100).toFixed(0) : '0';

                return (
                  <tr key={p.product_ID} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{p.product_ID}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', color: '#444' }}>{p.sku || '—'}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ padding: '10px' }}>{p.category}</td>
                    <td style={{ padding: '10px' }}>{p.color || '—'}</td>
                    <td style={{ padding: '10px' }}>${cost.toFixed(2)}</td>
                    <td style={{ padding: '10px' }}>${price.toFixed(2)}</td>
                    <td style={{ padding: '10px', color: '#204228' }}>{marginPercent}%</td>
                    <td style={{ padding: '10px' }}>
                      {p.quantity_in_stock}
                    </td>
                    <td style={{ padding: '10px' }}>{p.reorder_level}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProduct({ ...p });
                            setShowAddForm(false);
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          style={{ padding: '4px 8px', fontSize: '12px', color: '#c00', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
