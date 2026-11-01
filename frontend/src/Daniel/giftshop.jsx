import { apiFetch as fetch } from '../api';
import { useEffect, useState } from 'react';
import CardCheckoutModal from '../components/CardCheckoutModal';
import POSRegister from '../components/POSRegister';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = `${API_BASE}/api`;

export default function GiftShop({ role, userEmail }) {
	const [products, setProducts] = useState([]);
	const [selectedCategory, setSelectedCategory] = useState('all');
	const [cart, setCart] = useState([]);
	const [checkout, setCheckout] = useState(false);

	// Dept Head / Manager view state ('pos' or 'inventory')
	const [managerTab, setManagerTab] = useState('inventory');

	const isCashier = role === 'employee';
	const isManager = role === 'manager';

	async function loadProducts() {
		try {
			const res = await fetch(`${API}/products`);
			const data = await res.json();
			if (Array.isArray(data)) {
				setProducts(data);
			}
		} catch (err) {
			console.error('Failed to load products, database connection issue', err);
		}
	}

	useEffect(() => {
		loadProducts();
	}, []);

	// --- 1. CASHIER WORKSTATION (role === 'employee') ---
	// Frontline cashier sees only the POS register
	if (isCashier) {
		return (
			<div>
				<h1>Gift Shop — Cashier Register</h1>
				<p style={{ color: '#555', margin: '4px 0 16px 0' }}>
					Logged in as Cashier ({userEmail || 'Retail Staff'})
				</p>
				<POSRegister
					items={products}
					itemType="product"
					staffRole={role}
					onSaleComplete={loadProducts}
				/>
			</div>
		);
	}

	// --- 2. DEPARTMENT HEAD / MANAGER WORKSTATION (role === 'manager') ---
	// Manager can toggle between Register and Inventory Management (Frontend handled by user)
	if (isManager) {
		return (
			<div>
				<h1>Gift Shop — Retail Management</h1>
				<p style={{ color: '#555', margin: '4px 0 16px 0' }}>
					Logged in as Department Head ({userEmail || 'Retail Manager'})
				</p>

				<div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
					<button
						type="button"
						onClick={() => setManagerTab('inventory')}
						style={{
							padding: '8px 16px',
							fontWeight: managerTab === 'inventory' ? 'bold' : 'normal',
							backgroundColor: managerTab === 'inventory' ? '#204228' : '#f0f0f0',
							color: managerTab === 'inventory' ? '#fff' : '#000',
							border: '1px solid #ccc',
							cursor: 'pointer'
						}}
					>
						Inventory Management
					</button>
					<button
						type="button"
						onClick={() => setManagerTab('pos')}
						style={{
							padding: '8px 16px',
							fontWeight: managerTab === 'pos' ? 'bold' : 'normal',
							backgroundColor: managerTab === 'pos' ? '#204228' : '#f0f0f0',
							color: managerTab === 'pos' ? '#fff' : '#000',
							border: '1px solid #ccc',
							cursor: 'pointer'
						}}
					>
						POS Register
					</button>
				</div>

				{managerTab === 'pos' ? (
					<POSRegister
						items={products}
						itemType="product"
						staffRole={role}
						onSaleComplete={loadProducts}
					/>
				) : (
					<div id="dept-head-inventory-container" style={{ border: '1px solid #ccc', padding: '16px', borderRadius: '4px', background: '#fafafa' }}>
						{/* --- USER IMPLEMENTATION AREA FOR DEPT HEAD INVENTORY --- */}
						<h3>Retail Department Head Inventory Control</h3>
						<p style={{ color: '#666' }}>
							Insert your Department Head inventory management component here (Add Product, Update Price/Stock, Delete Product).
						</p>
						<p style={{ fontSize: '13px', color: '#888' }}>
							Backend endpoints available:
							<br />• <code>POST /api/products</code> (add product)
							<br />• <code>PUT /api/products/:id</code> (update price, stock, reorder level, etc.)
							<br />• <code>DELETE /api/products/:id</code> (delete product)
						</p>
					</div>
				)}
			</div>
		);
	}

	// --- 3. PUBLIC VISITOR STOREFRONT (Visitors / Customers) ---
	const [selectedVariants, setSelectedVariants] = useState({});

	// Group products by category and name so color variants collapse into a dropdown
	const groupedProducts = Object.values(
		products.reduce((acc, p) => {
			const key = `${p.category}:::${p.name}`;
			if (!acc[key]) {
				acc[key] = {
					name: p.name,
					category: p.category,
					variants: []
				};
			}
			acc[key].variants.push(p);
			return acc;
		}, {})
	);

	const filteredGroups = selectedCategory === 'all'
		? groupedProducts
		: groupedProducts.filter(g => g.category === selectedCategory);

	function getActiveVariant(group) {
		const chosenId = selectedVariants[group.name];
		if (chosenId) {
			const found = group.variants.find(v => v.product_ID === chosenId);
			if (found) return found;
		}
		return group.variants[0];
	}

	function addToCart(product) {
		setCart(prevCart => {
			const existing = prevCart.find(item => item.product_ID === product.product_ID);
			if (existing) {
				if (existing.quantity >= product.quantity_in_stock) {
					alert('Cannot add more; stock limit reached');
					return prevCart;
				}
				return prevCart.map(item => item.product_ID === product.product_ID ? { ...item, quantity: item.quantity + 1 } : item);
			}
			//if not alr in cart
			return [
				...prevCart,
				{
					product_ID: product.product_ID,
					name: product.name,
					price: Number(product.price),
					color: product.color,
					quantity: 1,
					maxStock: product.quantity_in_stock
				}
			];
		});
	}

	function updateQuantity(product_ID, delta) {
		setCart(prev =>
			prev
				.map(item => {
					if (item.product_ID !== product_ID) return item;
					const newQty = item.quantity + delta;
					if (newQty > item.maxStock) {
						alert('Cannot add more; stock limit reached.');
						return item;
					}
					return { ...item, quantity: newQty };
				})
				.filter(item => item.quantity > 0)
		);
	}

	function removeFromCart(product_ID) {
		setCart(prev => prev.filter(item => item.product_ID !== product_ID));
	}

	const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
	const tax = subtotal * 0.0825;
	const total = subtotal + tax;

	return (
		<div>
			<h1>Cougar Zoo Gift Shop</h1>

			<div>
				{['all', 'Toys', 'Apparel', 'Drinkware', 'Souvenirs', 'Books'].map(cat => (
					<button key={cat} onClick={() => setSelectedCategory(cat)}>
						{cat}
					</button>
				))}
			</div>
			<p> Cart Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}</p>

			{cart.length > 0 && (
				<div>
					<h2>Your Cart</h2>
					{cart.map(item => (
						<div key={item.product_ID}>
							<span>{item.name} {item.color ? `(${item.color})` : ''} - ${item.price.toFixed(2)} x {item.quantity}</span>
							{' '}
							<button onClick={() => updateQuantity(item.product_ID, -1)}>-</button>
							{' '}
							<button onClick={() => updateQuantity(item.product_ID, 1)}>+</button>
							{' '}
							<button onClick={() => removeFromCart(item.product_ID)}>Remove</button>
						</div>
					))}

					<p>Subtotal: ${subtotal.toFixed(2)}</p>
					<p>Tax (8.25%): ${tax.toFixed(2)}</p>
					<p><strong>Total: ${total.toFixed(2)}</strong></p>

					<button onClick={() => setCheckout(true)}>
						Proceed to Checkout
					</button>
				</div>
			)}

			<CardCheckoutModal
				isOpen={checkout}
				onClose={() => setCheckout(false)}
				itemType="product"
				items={cart.map(item => ({
					item_ID: item.product_ID,
					name: item.name,
					color: item.color,
					price: item.price,
					quantity: item.quantity
				}))}
				onSuccess={(receipt) => {
					setCart([]);
					loadProducts();
				}}
			/>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
				{filteredGroups.map(group => {
					const active = getActiveVariant(group);
					const hasColorVariants = group.variants.length > 1 && group.variants.some(v => v.color);

					return (
						<div key={group.name} style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', background: '#fff' }}>
							<h3 style={{ margin: '0 0 6px 0' }}>{group.name}</h3>
							<div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{group.category}</div>

							{hasColorVariants && (
								<div style={{ margin: '8px 0' }}>
									<label style={{ fontSize: '13px', marginRight: '6px', fontWeight: 'bold' }}>Color:</label>
									<select
										value={active.product_ID}
										onChange={e => {
											const chosenId = Number(e.target.value);
											setSelectedVariants(prev => ({
												...prev,
												[group.name]: chosenId
											}));
										}}
										style={{ padding: '4px 8px' }}
									>
										{group.variants.map(v => (
											<option key={v.product_ID} value={v.product_ID}>
												{v.color ? v.color.charAt(0).toUpperCase() + v.color.slice(1) : 'Default'}
												{v.quantity_in_stock <= 0 ? ' (Out of stock)' : ''}
											</option>
										))}
									</select>
								</div>
							)}

							<p style={{ margin: '8px 0' }}>
								Price: ${Number(active.price).toFixed(2)}
								{active.quantity_in_stock <= 0 && (
									<span style={{ color: '#c00', marginLeft: '8px', fontSize: '13px' }}>
										(Out of stock)
									</span>
								)}
							</p>
							<button
								onClick={() => addToCart(active)}
								disabled={active.quantity_in_stock === 0}
							>
								{active.quantity_in_stock === 0 ? 'Out of Stock' : 'Add to Cart'}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
