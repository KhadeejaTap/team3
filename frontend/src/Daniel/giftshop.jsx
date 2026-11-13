import { apiFetch as fetch } from '../api';
import { useEffect, useState } from 'react';
import CardCheckoutModal from '../components/CardCheckoutModal';
import POSRegister from '../components/POSRegister';
import RetailInventoryManagement from './RetailInventoryManagement';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API = `${API_BASE}/api`;

export default function GiftShop({ role, userEmail, userDept }) {
	const [products, setProducts] = useState([]);
	const [selectedCategory, setSelectedCategory] = useState('all');
	const [cart, setCart] = useState([]);
	const [checkout, setCheckout] = useState(false);
	const [selectedVariants, setSelectedVariants] = useState({});
	const [selectedSizes, setSelectedSizes] = useState({});

	// Workstation view toggles
	const [cashierTab, setCashierTab] = useState('pos');
	const [managerTab, setManagerTab] = useState('inventory');

	const effectiveDept = userDept != null ? Number(userDept) : Number(localStorage.getItem('user_dept'));
	const isRetailStaff = effectiveDept === 3;
	const isCashier = isRetailStaff && role === 'employee';
	const isManager = isRetailStaff && role === 'manager';

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

	// --- 1. PREPARE STOREFRONT DATA ---
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

	function addToCart(product, size) {
		setCart(prevCart => {
			const productQuantity = prevCart
				.filter(item => item.product_ID === product.product_ID)
				.reduce((sum, item) => sum + item.quantity, 0);
			if (productQuantity >= product.quantity_in_stock) {
				alert('Cannot add more; stock limit reached');
				return prevCart;
			}

			const existing = prevCart.find(item =>
				item.product_ID === product.product_ID && item.size === size
			);
			if (existing) {
				return prevCart.map(item =>
					item.product_ID === product.product_ID && item.size === size
						? { ...item, quantity: item.quantity + 1 }
						: item
				);
			}

			return [
				...prevCart,
				{
					product_ID: product.product_ID,
					name: product.name,
					price: Number(product.price),
					color: product.color,
					size,
					quantity: 1,
					maxStock: product.quantity_in_stock
				}
			];
		});
	}

	function updateQuantity(product_ID, size, delta) {
		setCart(prev =>
			prev
				.map(item => {
					if (item.product_ID !== product_ID || item.size !== size) return item;
					const newQty = item.quantity + delta;
					const otherProductQuantity = prev
						.filter(other => other.product_ID === product_ID && other.size !== size)
						.reduce((sum, other) => sum + other.quantity, 0);
					if (newQty + otherProductQuantity > item.maxStock) {
						alert('Cannot add more; stock limit reached.');
						return item;
					}
					return { ...item, quantity: newQty };
				})
				.filter(item => item.quantity > 0)
		);
	}

	function removeFromCart(product_ID, size) {
		setCart(prev => prev.filter(item => item.product_ID !== product_ID || item.size !== size));
	}

	const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
	const tax = subtotal * 0.0825;
	const total = subtotal + tax;

	return (
		<div>
			{/* Persistent Workstation Tabs for Cashier */}
			{isCashier && (
				<div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
					<button
						type="button"
						onClick={() => setCashierTab('pos')}
						style={{
							padding: '8px 16px',
							fontWeight: cashierTab === 'pos' ? 'bold' : 'normal',
							backgroundColor: cashierTab === 'pos' ? '#204228' : '#f0f0f0',
							color: cashierTab === 'pos' ? '#fff' : '#000',
							border: '1px solid #ccc',
							cursor: 'pointer'
						}}
					>
						Cashier POS Register
					</button>
					<button
						type="button"
						onClick={() => setCashierTab('store')}
						style={{
							padding: '8px 16px',
							fontWeight: cashierTab === 'store' ? 'bold' : 'normal',
							backgroundColor: cashierTab === 'store' ? '#204228' : '#f0f0f0',
							color: cashierTab === 'store' ? '#fff' : '#000',
							border: '1px solid #ccc',
							cursor: 'pointer'
						}}
					>
						Shop as Customer
					</button>
				</div>
			)}

			{/* Persistent Workstation Tabs for Manager */}
			{isManager && (
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
					<button
						type="button"
						onClick={() => setManagerTab('store')}
						style={{
							padding: '8px 16px',
							fontWeight: managerTab === 'store' ? 'bold' : 'normal',
							backgroundColor: managerTab === 'store' ? '#204228' : '#f0f0f0',
							color: managerTab === 'store' ? '#fff' : '#000',
							border: '1px solid #ccc',
							cursor: 'pointer'
						}}
					>
						Shop as Customer
					</button>
				</div>
			)}

			{/* 1. Cashier POS Register View */}
			{isCashier && cashierTab === 'pos' ? (
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
			) : isManager && managerTab === 'inventory' ? (
				/* 2. Manager Inventory Management View */
				<div>
					<h1>Gift Shop — Retail Management</h1>
					<p style={{ color: '#555', margin: '4px 0 16px 0' }}>
						Logged in as Department Head ({userEmail || 'Retail Manager'})
					</p>
					<div id="dept-head-inventory-container">
						<RetailInventoryManagement
							products={products}
							onRefresh={loadProducts}
						/>
					</div>
				</div>
			) : isManager && managerTab === 'pos' ? (
				/* 3. Manager POS Register View */
				<div>
					<h1>Gift Shop — Retail Management</h1>
					<p style={{ color: '#555', margin: '4px 0 16px 0' }}>
						Logged in as Department Head ({userEmail || 'Retail Manager'})
					</p>
					<POSRegister
						items={products}
						itemType="product"
						staffRole={role}
						onSaleComplete={loadProducts}
					/>
				</div>
			) : (
				/* 4. Public Visitor Storefront View */
				<div>
					<h1>Cougar Zoo Gift Shop</h1>

					<div style={{ display: 'flex', gap: '8px' }}>
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
								<div key={`${item.product_ID}-${item.size || ''}`}>
									<span>{item.name} {item.color ? `(${item.color})` : ''} {item.size ? `Size: ${item.size}` : ''} - ${item.price.toFixed(2)} x {item.quantity}</span>
									{' '}
									<button onClick={() => updateQuantity(item.product_ID, item.size, -1)}>-</button>
									{' '}
									<button onClick={() => updateQuantity(item.product_ID, item.size, 1)}>+</button>
									{' '}
									<button onClick={() => removeFromCart(item.product_ID, item.size)}>Remove</button>
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
						userEmail={userEmail || localStorage.getItem('user_email') || ''}
						items={cart.map(item => ({
							item_ID: item.product_ID,
							name: item.name,
							color: item.color,
							size: item.size,
							price: item.price,
							quantity: item.quantity
						}))}
						onSuccess={() => {
							setCart([]);
							loadProducts();
						}}
					/>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
						{filteredGroups.map(group => {
							const active = getActiveVariant(group);
							const hasColorVariants = group.variants.length > 1 && group.variants.some(v => v.color);
							const hasSizeOptions = ![
								'embroided zoo baseball cap',
								'embroidered zoo baseball cap',
								'stainless steel insulated tumbler',
							].includes(group.name.trim().toLowerCase());

							return (
								<div key={group.name} style={{ border: '1px solid #ccc', padding: '12px', borderRadius: '4px', background: '#fff' }}>
									<h3 style={{ margin: '0 0 6px 0' }}>{group.name}</h3>
									<div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>{group.category}</div>

									{hasColorVariants && (
										<div style={{ margin: '8px 0' }}>
											<div style={{ marginBottom: '8px' }}>
												<label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>Color:</label>
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
											{hasSizeOptions && (
												<div>
													<label htmlFor={`size-${group.name}`} style={{ display: 'block', fontSize: '13px', marginBottom: '4px', fontWeight: 'bold' }}>Size:</label>
													<select
														id={`size-${group.name}`}
														value={selectedSizes[group.name] || ''}
														onChange={e => setSelectedSizes(prev => ({
															...prev,
															[group.name]: e.target.value
														}))}
														style={{ padding: '4px 8px' }}
													>
														<option value="">Select a size</option>
														{['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
															<option key={size} value={size}>{size}</option>
														))}
													</select>
												</div>
											)}
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
										onClick={() => addToCart(active, selectedSizes[group.name])}
										disabled={active.quantity_in_stock === 0 || (hasColorVariants && hasSizeOptions && !selectedSizes[group.name])}
									>
										{active.quantity_in_stock === 0 ? 'Out of Stock' : hasColorVariants && hasSizeOptions && !selectedSizes[group.name] ? 'Select a Size' : 'Add to Cart'}
									</button>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
