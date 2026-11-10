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
const EXPENSE_CATEGORIES = ['Habitat Operations', 'Animal Healthcare', 'Food Costs'];

function formatCurrency(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

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

	const fetchSummary = () => {
		fetch(`${API_URL}/api/reports/financial-summary`)
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || `Server returned status ${res.status}`);
				}
				return res.json();
			})
			.then(setSummary)
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
			})
			.catch((err) => {
				console.error('Error fetching revenue report:', err);
				setError(`Failed to load report: ${err.message}`);
			})
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		if (isFinAdmin) {
			fetchReport();
			fetchSummary();
		}
	}, []);

	if (!isFinAdmin) {
		return (
			<div>
				<h2>Access Denied</h2>
				<p>Revenue Details report is restricted to Financial & HR personnel.</p>
			</div>
		);
	}

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
			'Total Amount ($)',
			'Average Amount ($)',
			'Min Amount ($)',
			'Max Amount ($)'
		];

		const escapeCSV = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
		const rows = reportData.map((row) => [
			escapeCSV(row.stream_category),
			escapeCSV(row.stream_name),
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
		link.setAttribute('download', 'zoo_revenue_and_expense_report.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => window.print();

	const revenueRows = reportData.filter(
		(row) => !EXPENSE_CATEGORIES.includes(row.stream_category)
	);
	const expenseRows = reportData.filter(
		(row) => EXPENSE_CATEGORIES.includes(row.stream_category)
	);
	const habitatExpenseRows = expenseRows.filter(
		(row) => row.stream_category === 'Habitat Operations'
	);
	const medicalExpenseRows = expenseRows.filter(
		(row) => row.stream_category === 'Animal Healthcare'
	);
	const foodExpenseRows = expenseRows.filter(
		(row) => row.stream_category === 'Food Costs'
	);

	const totalTransactions = revenueRows.reduce(
		(sum, row) => sum + Number(row.transaction_count || 0), 0
	);
	const grandTotalRevenue = revenueRows.reduce(
		(sum, row) => sum + Number(row.total_revenue || 0), 0
	);
	const grandTotalExpenses = expenseRows.reduce(
		(sum, row) => sum + Number(row.total_revenue || 0), 0
	);
	const netOperatingBalance = grandTotalRevenue - grandTotalExpenses;
	const overallAverage = totalTransactions > 0
		? (grandTotalRevenue / totalTransactions).toFixed(2)
		: '0.00';

	return (
		<div>
			<h2>Zoo Revenue & Financial Statement</h2>
			<p>Financial breakdown of ticket admissions, fundraising donations, gift shop retail sales, habitat operations, animal healthcare, and animal food expenses.</p>

			{summary && (
				<fieldset style={{ margin: '16px 0', padding: '12px' }}>
					<legend><strong>Executive Operating Statement</strong></legend>
					<table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '8px' }}>
						<thead>
							<tr>
								<th>Gross Revenue (Inflows)</th>
								<th>Habitat Operations (Outflows)</th>
								<th>Animal Healthcare (Outflows)</th>
								<th>Food Costs (Outflows)</th>
								<th>Total Expenses</th>
								<th>Net Operating Balance</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>
									<strong>+${formatCurrency(summary.gross_revenue)}</strong>
									<br />
									<small>Admissions: ${formatCurrency(summary.admissions_total)} | Donations: ${formatCurrency(summary.donations_total)} | Retail: ${formatCurrency(summary.retail_total)}</small>
								</td>
								<td>
									<strong>-${formatCurrency(summary.enclosure_costs_total)}</strong>
									<br />
									<small>{(summary.enclosure_categories || []).map((category) => `${category.category}: $${formatCurrency(category.amount)}`).join(' | ') || 'No habitat expenses recorded'}</small>
								</td>
								<td>
									<strong>-${formatCurrency(summary.medical_costs_total)}</strong>
									<br />
									<small>{(summary.medical_categories || []).map((category) => `${category.category}: $${formatCurrency(category.amount)}`).join(' | ') || 'No medical expenses recorded'}</small>
								</td>
								<td>
									<strong>-${formatCurrency(summary.food_costs_total)}</strong>
									<br />
									<small>{(summary.food_categories || []).map((category) => `${category.category}: $${formatCurrency(category.amount)}`).join(' | ') || 'No food expenses recorded'}</small>
								</td>
								<td><strong>-${formatCurrency(summary.total_expenses)}</strong></td>
								<td style={{ color: Number(summary.net_balance) < 0 ? '#b00' : '#070' }}>
									<strong>{Number(summary.net_balance) < 0 ? '-' : '+'}${formatCurrency(Math.abs(Number(summary.net_balance)))}</strong>
									<br />
									<small>{Number(summary.net_balance) < 0 ? 'Operating Deficit' : 'Operating Surplus'}</small>
								</td>
							</tr>
						</tbody>
					</table>
				</fieldset>
			)}

			<form onSubmit={handleFilterSubmit}>
				<label htmlFor="stream-select">Financial Stream: </label>
				<select id="stream-select" value={streamType} onChange={(e) => setStreamType(e.target.value)}>
					<option value="all">All Revenue & Expense Streams</option>
					<option value="tickets">Admissions (Ticket Sales Only)</option>
					<option value="donations">Fundraising (Donations Only)</option>
					<option value="retail">Gift Shop (Retail Merchandise Only)</option>
					<option value="expenses">Habitat Care (Expenses Only)</option>
					<option value="medical_expenses">Animal Healthcare (Expenses Only)</option>
					<option value="food_expenses">Food Costs (Expenses Only)</option>
				</select>
				&nbsp;&nbsp;

				<label htmlFor="sort-select">Sort By: </label>
				<select id="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
					<option value="revenue">Total Amount (High to Low)</option>
					<option value="count">Transaction Count (Most frequent first)</option>
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
			<div>
				<button type="button" onClick={handleExportCSV}>Export to CSV (Excel)</button>
				&nbsp;&nbsp;
				<button type="button" onClick={handlePrintPDF}>Print / Save as PDF</button>
			</div>
			<br />

			{error && <p role="alert">{error}</p>}

			<table border="1" cellPadding="6" cellSpacing="0">
				<thead>
					<tr>
						<th>Category</th>
						<th>Stream / Source</th>
						<th>Transaction Count</th>
						<th>Total Amount ($)</th>
						<th>Average Amount ($)</th>
						<th>Min Amount ($)</th>
						<th>Max Amount ($)</th>
					</tr>
				</thead>
				<tbody>
					{reportData.length === 0 && !loading && !error && (
						<tr><td colSpan="7">No financial records found.</td></tr>
					)}
					{reportData.map((row, index) => (
						<tr key={`${row.stream_category}-${row.stream_name}-${index}`}>
							<td>{row.stream_category}</td>
							<td>{row.stream_name}</td>
							<td>{Number(row.transaction_count || 0).toLocaleString()}</td>
							<td>${formatCurrency(row.total_revenue)}</td>
							<td>${formatCurrency(row.avg_amount)}</td>
							<td>${formatCurrency(row.min_amount)}</td>
							<td>${formatCurrency(row.max_amount)}</td>
						</tr>
					))}
				</tbody>
				{reportData.length > 0 && (
					<tfoot>
						<tr>
							<th colSpan="2">Total Revenue</th>
							<th>{totalTransactions.toLocaleString()}</th>
							<th>${formatCurrency(grandTotalRevenue)}</th>
							<th>${formatCurrency(overallAverage)}</th>
							<th>-</th>
							<th>-</th>
						</tr>
						<tr>
							<th colSpan="3">Total Habitat Operations Expenses</th>
							<th>-${formatCurrency(habitatExpenseRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0))}</th>
							<th colSpan="3"></th>
						</tr>
						<tr>
							<th colSpan="3">Total Animal Healthcare Expenses</th>
							<th>-${formatCurrency(medicalExpenseRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0))}</th>
							<th colSpan="3"></th>
						</tr>
						<tr>
							<th colSpan="3">Total Food Costs</th>
							<th>-${formatCurrency(foodExpenseRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0))}</th>
							<th colSpan="3"></th>
						</tr>
						<tr>
							<th colSpan="3">Total Expenses</th>
							<th>-${formatCurrency(grandTotalExpenses)}</th>
							<th colSpan="3">Net for Selected Streams: ${formatCurrency(netOperatingBalance)}</th>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

export default RevenueDetails;
