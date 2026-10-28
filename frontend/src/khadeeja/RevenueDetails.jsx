import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function RevenueDetails({ role }) {
	const [reportData, setReportData] = useState([]);
	const [streamType, setStreamType] = useState('all');
	const [sortBy, setSortBy] = useState('revenue');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	if (role !== 'admin') {
		return (
			<div>
				<h2>Access Denied</h2>
				<p>Revenue Details report is restricted to Zoo Administrators.</p>
			</div>
		);
	}

	const fetchReport = () => {
		setLoading(true);
		setError('');

		const params = new URLSearchParams({
			stream_type: streamType,
			sort_by: sortBy
		});

		fetch(`${API_URL}/api/reports/revenue?${params.toString()}`)
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || `Server returned status ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				setReportData(data);
				setLoading(false);
			})
			.catch((err) => {
				console.error('Error fetching revenue report:', err);
				setError(`Failed to load report: ${err.message}`);
				setLoading(false);
			});
	};

	useEffect(() => {
		fetchReport();
	}, []);

	const handleFilterSubmit = (e) => {
		e.preventDefault();
		fetchReport();
	};

	const handleExportCSV = () => {
		if (reportData.length === 0) {
			alert('No data to export.');
			return;
		}

		const headers = [
			'Stream Category',
			'Stream / Source',
			'Transaction Count',
			'Total Revenue ($)',
			'Average Amount ($)',
			'Min Amount ($)',
			'Max Amount ($)'
		];

		const rows = reportData.map((row) => [
			`"${row.stream_category}"`,
			`"${row.stream_name}"`,
			row.transaction_count,
			row.total_revenue,
			row.avg_amount,
			row.min_amount,
			row.max_amount
		]);

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'zoo_revenue_report.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => {
		window.print();
	};

	// Grand totals for the summary footer
	const totalTransactions = reportData.reduce(
		(sum, r) => sum + Number(r.transaction_count || 0),
		0
	);
	const grandTotalRevenue = reportData.reduce(
		(sum, r) => sum + Number(r.total_revenue || 0),
		0
	);
	const overallAverage =
		totalTransactions > 0 ? (grandTotalRevenue / totalTransactions).toFixed(2) : '0.00';

	return (
		<div>
			<h2>Zoo Revenue & Fundraising Breakdown</h2>
			<p>Aggregated financial breakdown of ticket admissions and fundraising donations.</p>

			{/* Filter Parameters Form */}
			<form onSubmit={handleFilterSubmit}>
				<label htmlFor="stream-select">Revenue Stream: </label>
				<select
					id="stream-select"
					value={streamType}
					onChange={(e) => setStreamType(e.target.value)}
				>
					<option value="all">All Streams (Admissions & Donations)</option>
					<option value="tickets">Admissions (Ticket Sales Only)</option>
					<option value="donations">Fundraising (Donations Only)</option>
				</select>
				&nbsp;&nbsp;

				<label htmlFor="sort-select">Sort By: </label>
				<select
					id="sort-select"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value)}
				>
					<option value="revenue">Total Revenue (High to Low)</option>
					<option value="count">Transaction Count (Most popular first)</option>
					<option value="avg">Average Amount (High to Low)</option>
					<option value="name">Stream Name (A to Z)</option>
				</select>
				&nbsp;&nbsp;

				<button type="submit" disabled={loading}>
					{loading ? 'Loading...' : 'Generate Report'}
				</button>
			</form>

			<br />

			{/* Export Buttons */}
			<div>
				<button type="button" onClick={handleExportCSV}>
					Export to CSV (Excel)
				</button>
				&nbsp;&nbsp;
				<button type="button" onClick={handlePrintPDF}>
					Print / Save as PDF
				</button>
			</div>

			<br />

			{error && <p role="alert">{error}</p>}

			{/* Report Data Table */}
			<table border="1" cellPadding="6" cellSpacing="0">
				<thead>
					<tr>
						<th>Category</th>
						<th>Stream / Source</th>
						<th>Transaction Count</th>
						<th>Total Revenue ($)</th>
						<th>Average Amount ($)</th>
						<th>Min Amount ($)</th>
						<th>Max Amount ($)</th>
					</tr>
				</thead>
				<tbody>
					{reportData.length === 0 && !loading && !error && (
						<tr>
							<td colSpan="7">No revenue records found.</td>
						</tr>
					)}
					{reportData.map((row, idx) => (
						<tr key={`${row.stream_category}-${row.stream_name}-${idx}`}>
							<td>{row.stream_category}</td>
							<td>{row.stream_name}</td>
							<td>{Number(row.transaction_count).toLocaleString()}</td>
							<td>${Number(row.total_revenue).toLocaleString()}</td>
							<td>${Number(row.avg_amount).toLocaleString()}</td>
							<td>${Number(row.min_amount).toLocaleString()}</td>
							<td>${Number(row.max_amount).toLocaleString()}</td>
						</tr>
					))}
				</tbody>
				{reportData.length > 0 && (
					<tfoot>
						<tr>
							<th colSpan="2">Zoo Grand Total</th>
							<th>{totalTransactions.toLocaleString()}</th>
							<th>${grandTotalRevenue.toLocaleString()}</th>
							<th>${Number(overallAverage).toLocaleString()}</th>
							<th>-</th>
							<th>-</th>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

export default RevenueDetails;
