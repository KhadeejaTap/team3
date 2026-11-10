/**
 * REVENUE & FINANCIAL REPORT - MISSING STREAMS & COSTS TO INTEGRATE:
 *
 * 1. MISSING REVENUE STREAMS (Commercial & Earned Inflows):
 *    - Retail Merchandise: FROM transaction_item ti JOIN product p ON ti.item_ID = p.product_ID WHERE ti.item_type = 'product'
 *    - Food & Dining Concessions: FROM transaction_item ti JOIN menu_item mi ON ti.item_ID = mi.item_ID WHERE ti.item_type = 'food'
 *    - Parking Tolls: FROM parking_session ps JOIN parking_lot pl ON ps.lot_ID = pl.lot_ID (count * pl.parking_rate)
 *    - Premium Attractions / Tours: FROM attr_ticket
 *
 * 2. OPERATIONAL COSTS TO TRACK (For Zoo Net Operating Balance Summary):
 *    - Wholesale Retail COGS: SUM(p.cost_price * ti.quantity) from transaction_item (wholesale cost of merchandise sold)
 *    - Department Payroll: SUM(salary) FROM employee WHERE current = 1 ($1,045,500 total annual across 7 departments)
 *    - Habitat / Enclosure Operating Expenses: SUM(amount) FROM enclosure_cost ($3,775 across Feeding, Utilities, Maintenance, Cleaning, Landscaping)
 *
 * 3. CURRENT STATE:
 *    - Currently only queries TICKET (Admissions) and DONATION (Fundraising).
 */

import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function RevenueDetails({ role, userDept }) {
	const [reportData, setReportData] = useState([]);
	const [summary, setSummary] = useState(null);
	const [streamType, setStreamType] = useState('all');
	const [sortBy, setSortBy] = useState('revenue');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [lastUpdated, setLastUpdated] = useState('');

	const isFinAdmin =
		Number(userDept) === 1 ||
		Number(localStorage.getItem('user_dept')) === 1;

	if (!isFinAdmin) {
		return (
			<div>
				<h2>Access Denied</h2>
				<p>Revenue Details report is restricted to Financial & HR personnel.</p>
			</div>
		);
	}

	const fetchSummary = () => {
		fetch(`${API_URL}/api/reports/financial-summary`)
			.then(async (res) => {
				if (!res.ok) return null;
				return res.json();
			})
			.then((data) => {
				if (data) setSummary(data);
			})
			.catch((err) => console.error('Error fetching financial summary:', err));
	};

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
				setLastUpdated(new Date().toLocaleTimeString());
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
		fetchSummary();
	}, []);

	const handleFilterSubmit = (e) => {
		e.preventDefault();
		fetchReport();
		fetchSummary();
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

	// Separate revenue and enclosure expenses
	const revenueRows = reportData.filter(
		r => r.stream_category !== 'Habitat Operations'
	);

	const expenseRows = reportData.filter(
		r => r.stream_category === 'Habitat Operations'
	);

	const totalTransactions = revenueRows.reduce(
		(sum, r) => sum + Number(r.transaction_count || 0),
		0
	);

	const grandTotalRevenue = revenueRows.reduce(
		(sum, r) => sum + Number(r.total_revenue || 0),
		0
	);

	const grandTotalExpenses = expenseRows.reduce(
		(sum, r) => sum + Number(r.total_revenue || 0),
		0
	);

	const netOperatingBalance = grandTotalRevenue - grandTotalExpenses;

	const overallAverage =
		totalTransactions > 0
			? (grandTotalRevenue / totalTransactions).toFixed(2)
			: '0.00';

	return (
		<div>
			<h2>Zoo Revenue & Financial Statement</h2>
			<p>Aggregated financial breakdown of ticket admissions, fundraising donations, gift shop retail sales, and habitat operational expenses.</p>

			{/* Executive Operating Statement */}
			{summary && (
				<fieldset style={{ margin: '16px 0', padding: '12px' }}>
					<legend><strong>Executive Operating Statement (Habitat P&L)</strong></legend>
					<table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '8px' }}>
						<thead>
							<tr>
								<th>Gross Revenue (Inflows)</th>
								<th>Habitat Operations (Outflows)</th>
								<th>Net Operating Balance</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<strong>+${Number(summary.gross_revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
									<br />
									<small>Admissions: ${Number(summary.admissions_total).toLocaleString(undefined, { minimumFractionDigits: 2 })} | Donations: ${Number(summary.donations_total).toLocaleString(undefined, { minimumFractionDigits: 2 })} | Retail: ${Number(summary.retail_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</small>
								</td>
								<td>
									<strong>-${Number(summary.enclosure_costs_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
									<br />
									<small>
										{summary.enclosure_categories.map(c => `${c.category}: $${Number(c.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`).join(' | ')}
									</small>
								</td>
								<td style={{ color: Number(summary.net_balance) < 0 ? '#b00' : '#070' }}>
									<strong>{Number(summary.net_balance) < 0 ? '-' : '+'}${Math.abs(Number(summary.net_balance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
									<br />
									<small>{Number(summary.net_balance) < 0 ? 'Operating Deficit' : 'Operating Surplus'}</small>
								</td>
							</tr>
						</tbody>
					</table>
				</fieldset>
			)}

			{/* Filter Parameters Form */}
			<form onSubmit={handleFilterSubmit}>
				<label htmlFor="stream-select">Financial Stream: </label>
				<select
					id="stream-select"
					value={streamType}
					onChange={(e) => setStreamType(e.target.value)}
				>
					<option value="all">All Revenue Streams (Admissions, Donations, Retail)</option>
					<option value="tickets">Admissions (Ticket Sales Only)</option>
					<option value="donations">Fundraising (Donations Only)</option>
					<option value="retail">Gift Shop (Retail Merchandise Only)</option>
					<option value="expenses">Habitat Operations (Enclosure Expenses Only)</option>
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
				{lastUpdated && (
					<span style={{ marginLeft: '10px', fontSize: '0.85em', color: '#555' }}>
						(Report generated at {lastUpdated})
					</span>
				)}
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
							<th colSpan="2">Total Revenue</th>
							<th>{totalTransactions.toLocaleString()}</th>
							<th>${grandTotalRevenue.toLocaleString()}</th>
							<th>${Number(overallAverage).toLocaleString()}</th>
							<th>-</th>
							<th>-</th>
						</tr>
						<tr>
							<th colSpan="3">Total Enclosure Expenses</th>
							<th>-${grandTotalExpenses.toLocaleString()}</th>
							<th colSpan="3">
								Net Operating Balance: ${netOperatingBalance.toLocaleString()}
							</th>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

export default RevenueDetails;
