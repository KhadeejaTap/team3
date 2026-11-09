import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from './api';
import './App.css';

import animalImg from './assets/animal.png';
import ticketImg from './assets/ticket.jpg';
import attractionImg from './assets/attraction.png';
import foodImg from './assets/food.webp';
import giftsImg from './assets/gifts.png';
import donateImg from './assets/donate.png';

// Slideshow configuration with images and links to each zoo part
const SLIDES = [
	{
		id: 1,
		title: 'Meet the Animals',
		description: 'See all our zoo animals, their habitats, and endangered status.',
		image: animalImg,
		link: '/animal-directory',
		linkText: 'View Animals',
	},
	{
		id: 2,
		title: 'Tickets & Admissions',
		description: 'Adults are $25 and kids are $15. Buy your day pass online before you visit.',
		image: ticketImg,
		link: '/tickets',
		linkText: 'Buy Tickets',
	},
	{
		id: 3,
		title: 'Exhibits & Shows',
		description: 'Catch the Penguin Feeding Show, Reptile House, and Safari Train Tour.',
		image: attractionImg,
		link: '/attractions',
		linkText: 'View Exhibits',
	},
	{
		id: 4,
		title: 'Food & Drinks',
		description: 'Grab lunch, snacks, and cold drinks at stalls across the park.',
		image: foodImg,
		link: '/food',
		linkText: 'See Menu',
	},
	{
		id: 5,
		title: 'Gift Shop',
		description: 'Pick up zoo plushies, shirts, and souvenirs on your way out.',
		image: giftsImg,
		link: '/gift-shop',
		linkText: 'Shop Souvenirs',
	},
	{
		id: 6,
		title: 'Support the Animals',
		description: 'Help fund fresh food, vet care, and habitat upkeep for our animals.',
		image: donateImg,
		link: '/donations',
		linkText: 'Donate',
	},
];

function HeroCarousel() {
	const [current, setCurrent] = useState(0);

	// Automatically slide every 3.5 seconds
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrent((prev) => (prev + 1) % SLIDES.length);
		}, 3500);
		return () => clearInterval(timer);
	}, [current]);

	function prevSlide() {
		setCurrent((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
	}

	function nextSlide() {
		setCurrent((prev) => (prev + 1) % SLIDES.length);
	}

	const slide = SLIDES[current];

	return (
		<section
			className="hero-carousel"
			aria-roledescription="carousel"
		>
			<button
				type="button"
				className="carousel-arrow carousel-arrow-prev"
				onClick={prevSlide}
				aria-label="Previous slide"
			>
				‹
			</button>

			<div className="carousel-slide">
				<div className="carousel-content">
					<h2>{slide.title}</h2>
					<p>{slide.description}</p>

					{/* Empty spot for links to each part */}
					<div className="carousel-action-area">
						{slide.link ? (
							<Link to={slide.link} className="carousel-link-btn">
								{slide.linkText || 'Explore'} →
							</Link>
						) : (
							<div className="carousel-link-empty">
								<span>[ Empty Spot for Link ]</span>
							</div>
						)}
					</div>
				</div>

				{/* Empty spot for images */}
				<div className="carousel-image-area">
					{slide.image ? (
						<img
							src={slide.image}
							alt={slide.title}
							className="carousel-img"
						/>
					) : (
						<div className="carousel-image-empty">
							<span className="carousel-img-text">[ Empty Spot for Image ]</span>
						</div>
					)}
				</div>
			</div>

			<button
				type="button"
				className="carousel-arrow carousel-arrow-next"
				onClick={nextSlide}
				aria-label="Next slide"
			>
				›
			</button>

			<div className="carousel-dots">
				{SLIDES.map((s, index) => (
					<button
						key={s.id}
						type="button"
						className={`carousel-dot ${index === current ? 'active' : ''}`}
						onClick={() => setCurrent(index)}
						aria-label={`Go to slide ${index + 1}`}
					/>
				))}
			</div>
		</section>
	);
}

function formatVisitDate(dateStr) {
	if (!dateStr) return '';
	const parts = String(dateStr).slice(0, 10).split('-');
	if (parts.length === 3) {
		const [y, m, d] = parts.map(Number);
		if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
			const date = new Date(y, m - 1, d);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		}
	}
	return String(dateStr).slice(0, 10);
}

function formatOrderDate(dateStr) {
	if (!dateStr) return '';
	const [datePart] = String(dateStr).split(' ');
	const parts = datePart.split('-');
	if (parts.length === 3) {
		const [y, m, d] = parts.map(Number);
		if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
			const date = new Date(y, m - 1, d);
			return date.toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		}
	}
	return dateStr;
}

function Home({ role, userEmail }) {
	const effectiveEmail = userEmail || localStorage.getItem('user_email') || '';
	const [fullName, setFullName] = useState(() => {
		const fn = localStorage.getItem('user_first_name') || '';
		const ln = localStorage.getItem('user_last_name') || '';
		return [fn, ln].filter(Boolean).join(' ');
	});
	const [upcomingVisits, setUpcomingVisits] = useState([]);
	const [loadingVisits, setLoadingVisits] = useState(false);
	const [visitsError, setVisitsError] = useState('');

	const [orders, setOrders] = useState([]);
	const [loadingOrders, setLoadingOrders] = useState(false);
	const [ordersError, setOrdersError] = useState('');

	useEffect(() => {
		if (!role || !effectiveEmail) {
			setUpcomingVisits([]);
			setOrders([]);
			setFullName('');
			return;
		}

		let isMounted = true;

		async function fetchUserProfile() {
			try {
				const res = await apiFetch(`/api/user/profile?email=${encodeURIComponent(effectiveEmail)}`);
				if (res.ok) {
					const data = await res.json();
					const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
					if (isMounted && name) {
						setFullName(name);
						localStorage.setItem('user_first_name', data.first_name || '');
						localStorage.setItem('user_last_name', data.last_name || '');
					}
				}
			} catch {
				// Silently fallback to localStorage or email
			}
		}

		async function fetchUpcomingVisits() {
			setLoadingVisits(true);
			setVisitsError('');
			try {
				const res = await apiFetch(`/api/user/upcoming-tickets?email=${encodeURIComponent(effectiveEmail)}`);
				if (!res.ok) {
					throw new Error('Failed to load upcoming visits.');
				}
				const data = await res.json();
				if (isMounted) {
					setUpcomingVisits(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				if (isMounted) {
					setVisitsError(err.message || 'Unable to load visits.');
				}
			} finally {
				if (isMounted) {
					setLoadingVisits(false);
				}
			}
		}

		async function fetchUserOrders() {
			setLoadingOrders(true);
			setOrdersError('');
			try {
				const res = await apiFetch(`/api/user/orders?email=${encodeURIComponent(effectiveEmail)}`);
				if (!res.ok) {
					throw new Error('Failed to load purchase history.');
				}
				const data = await res.json();
				if (isMounted) {
					setOrders(Array.isArray(data) ? data : []);
				}
			} catch (err) {
				if (isMounted) {
					setOrdersError(err.message || 'Unable to load orders.');
				}
			} finally {
				if (isMounted) {
					setLoadingOrders(false);
				}
			}
		}

		fetchUserProfile();
		fetchUpcomingVisits();
		fetchUserOrders();

		return () => {
			isMounted = false;
		};
	}, [role, effectiveEmail]);

	return (
		<div className="home-container">
			<HeroCarousel />

			<section className="info-bar">
				<div><strong>Location:</strong> 1738 Parkway Drive, Houston, TX, 77063</div>
				<div><strong>Hours:</strong> Open Mon-Fri, 9:00 AM – 5:00 PM</div>
			</section>

			<br />

			<section className="account-section">
				<h2>Account</h2>
				<div className="account-card">
					{role ? (
						<div>
							<p>Logged in as: <strong>{fullName ? `${fullName} (${effectiveEmail})` : effectiveEmail || role}</strong></p>

							<div className="upcoming-visits-section">
								<h3>Upcoming Visits</h3>
								{loadingVisits ? (
									<p>Loading upcoming visits...</p>
								) : visitsError ? (
									<p className="account-error-text">{visitsError}</p>
								) : upcomingVisits.length === 0 ? (
									<p>You have no upcoming visits planned.</p>
								) : (
									<div className="upcoming-visits-list">
										{upcomingVisits.map((ticket) => (
											<div key={ticket.ticket_ID} className="upcoming-visit-item">
												<div className="upcoming-visit-header">
													<span className="upcoming-visit-date">{formatVisitDate(ticket.visit_date)}</span>
													<span className="upcoming-visit-id">Ticket #{ticket.ticket_ID}</span>
												</div>
												<div className="upcoming-visit-details">
													<span className="upcoming-visit-type">
														{ticket.ticket_type} Pass (${Number(ticket.price || 0).toFixed(0)})
													</span>
													{ticket.visitor_name && (
														<span className="upcoming-visit-guest">
															Guest: {ticket.visitor_name}
														</span>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>

							<div className="recent-orders-section">
								<h3>Recent Purchases</h3>
								{loadingOrders ? (
									<p>Loading purchases...</p>
								) : ordersError ? (
									<p className="account-error-text">{ordersError}</p>
								) : orders.length === 0 ? (
									<p>No purchase history yet.</p>
								) : (
									<div className="recent-orders-list">
										{orders.map((order) => (
											<div key={order.transaction_ID} className="recent-order-item">
												<div className="recent-order-header">
													<span className="recent-order-id">Order #{order.transaction_ID}</span>
													<span className="recent-order-date">{formatOrderDate(order.transaction_date)}</span>
												</div>
												<div className="recent-order-items">
													{order.items.map((it, idx) => (
														<span key={idx} className="recent-order-item-badge">
															{it.quantity}x {it.item_name} (${Number(it.price).toFixed(2)})
														</span>
													))}
												</div>
												<div className="recent-order-footer">
													<span className="recent-order-method">
														Paid via {order.payment_method ? order.payment_method.replace('_', ' ') : 'Card'}
													</span>
													<span className="recent-order-total">
														Total: <strong>${Number(order.total).toFixed(2)}</strong>
													</span>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					) : (
						<div>
							<p>Please log in to view your account information.</p>
							<Link to="/login"><button type="button">Login or Sign Up</button></Link>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}

export default Home;
