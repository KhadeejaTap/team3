import { Link } from 'react-router-dom';
import './App.css';

function Home() {
	return (
		<div className="home-container">
			<section className="hero-banner">
				<h1>Welcome to Cougar Zoo</h1>
				<p>
					Houston's premier zoological park and wildlife sanctuary. Dedicated to animal
					welfare, habitat conservation, and inspiring discovery across all generations.
				</p>
			</section>

			<section className="info-bar">
				<div>
					<strong>📍 Location:</strong> Houston, TX
				</div>
				<div>
					<strong>🕒 Hours:</strong> Open Daily 9:00 AM – 5:00 PM
				</div>
				<div>
					<strong>🅿️ Parking:</strong> Lots A, B & C Available
				</div>
			</section>

			<br />

			<section className="quick-links-section">
				<h2>Plan Your Visit</h2>
				<div className="home-cards-grid">
					<article>
						<h3>🎟️ Tickets & Admissions</h3>
						<p>Book your zoo admission tickets online. Adult and child passes available daily.</p>
						<br />
						<Link to="/tickets">
							<button type="button">Purchase Tickets</button>
						</Link>
					</article>

					<article>
						<h3>🎁 Gift Shop</h3>
						<p>Browse official Cougar Zoo plushies, apparel, souvenirs, and guidebooks.</p>
						<br />
						<Link to="/gift-shop">
							<button type="button">Visit Gift Shop</button>
						</Link>
					</article>

					<article>
						<h3>🍔 Food & Dining</h3>
						<p>Explore family-friendly snack bars, fresh lunches, and drinks across the park.</p>
						<br />
						<Link to="/food">
							<button type="button">View Dining</button>
						</Link>
					</article>

					<article>
						<h3>❤️ Support the Zoo</h3>
						<p>Help fund animal nutrition, veterinary care, and wildlife rescue programs.</p>
						<br />
						<Link to="/donations">
							<button type="button">Make a Donation</button>
						</Link>
					</article>
				</div>
			</section>
		</div>
	);
}

export default Home;
