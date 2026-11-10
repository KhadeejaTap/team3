import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import '../App.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

function formatDateTime(value) {
	if (!value) return 'Upcoming';

	const match = String(value).match(
		/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?)?$/
	);
	if (!match) return String(value).slice(0, 10);

	const [, year, month, day, hour, minute] = match;
	const date = new Date(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour || 0),
		Number(minute || 0)
	);
	const options = hour
		? {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}
		: { month: 'short', day: 'numeric', year: 'numeric' };

	return date.toLocaleString('en-US', options);
}

function VisitorAttractions({ canManage = false }) {
	const [attractions, setAttractions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selectedType, setSelectedType] = useState('All');

	useEffect(() => {
		async function loadUpcoming() {
			setLoading(true);
			setError('');
			try {
				const response = await apiFetch(`${API_URL}/api/attractions?upcoming=true`);
				if (!response.ok) {
					throw new Error('Could not load upcoming attractions.');
				}
				const data = await response.json();
				setAttractions(Array.isArray(data) ? data : []);
			} catch (err) {
				setError(err.message || 'Unable to connect to server.');
			} finally {
				setLoading(false);
			}
		}

		loadUpcoming();
	}, []);

	const types = ['All', ...new Set(attractions.map((a) => a.type).filter(Boolean))];

	const filtered =
		selectedType === 'All'
			? attractions
			: attractions.filter((a) => a.type === selectedType);

	return (
		<div className="visitor-attractions-page">
			<header className="attractions-header">
				<h1>Upcoming Exhibits & Shows</h1>
				<p>Browse upcoming attractions and live events scheduled at Cougar Zoo.</p>
				{canManage && (
					<Link className="attractions-manage-link" to="/attractions-management">
						Add an exhibit or show
					</Link>
				)}
			</header>

			{types.length > 1 && (
				<div className="attraction-type-tabs">
					{types.map((type) => (
						<button
							key={type}
							type="button"
							className={`type-tab-btn ${selectedType === type ? 'active' : ''}`}
							onClick={() => setSelectedType(type)}
						>
							{type}
						</button>
					))}
				</div>
			)}

			{loading && <p>Loading upcoming attractions...</p>}
			{error && <p role="alert" style={{ color: '#9b2c20' }}>{error}</p>}

			{!loading && !error && filtered.length === 0 && (
				<p>No upcoming attractions scheduled at this time.</p>
			)}

			<div className="attractions-grid">
				{filtered.map((item) => (
					<div key={item.attr_ID} className="attraction-card">
						<div className="attraction-card-meta">
							<span className="attraction-date-pill">
								{formatDateTime(item.attr_datetime)}
							</span>
							{item.type && (
								<span className="attraction-type-badge">
									{item.type}
								</span>
							)}
						</div>

						<h2 className="attraction-title">{item.name}</h2>

						{item.location && (
							<p className="attraction-location">
								<strong>Location:</strong> {item.location}
							</p>
						)}

						{item.description && (
							<p className="attraction-desc">{item.description}</p>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

export default VisitorAttractions;
