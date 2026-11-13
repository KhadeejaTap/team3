import { Fragment, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EXPENSE_CATEGORIES = ['Habitat Operations', 'Animal Healthcare'];

function formatCurrency(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

function RevenueDetails({ userDept }) {
	const [reportData, setReportData] = useState([]);
	const [summary, setSummary] = useState(null);
	const [streamType, setStreamType] = useState('all');
	const [sortBy, setSortBy] = useState('revenue');
	const [timeFrame, setTimeFrame] = useState('ytd'); // 'ytd' | 'all' | 'custom'
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [minAmount, setMinAmount] = useState('');
	const [maxAmount, setMaxAmount] = useState('');
	const [loading, setLoading] = useState(false);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [error, setError] = useState('');
	const [lastUpdated, setLastUpdated] = useState('');
	const [selectedRowKey, setSelectedRowKey] = useState(null);
	const [transactionDetails, setTransactionDetails] = useState([]);
	const [detailsLoading, setDetailsLoading] = useState(false);
	const [detailsError, setDetailsError] = useState('');
	const detailRequestId = useRef(0);

	const isFinAdmin =
		Number(userDept) === 1 ||
		Number(localStorage.getItem('user_dept')) === 1;

	const fetchSummary = (tf, sDate, eDate) => {
		const activeTf = tf || timeFrame;
		const activeStart = sDate !== undefined ? sDate : startDate;
		const activeEnd = eDate !== undefined ? eDate : endDate;

		const params = new URLSearchParams({
			time_frame: activeTf
		});
		if (activeTf === 'custom') {
			if (activeStart) params.append('start_date', activeStart);
			if (activeEnd) params.append('end_date', activeEnd);
		}

		fetch(`${API_URL}/api/reports/financial-summary?${params.toString()}`)
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

	const fetchReport = (st, sb, tf, sDate, eDate, minAmt, maxAmt) => {
		detailRequestId.current += 1;
		setSelectedRowKey(null);
		setTransactionDetails([]);
		setDetailsError('');
		setDetailsLoading(false);
		setLoading(true);
		setError('');

		const activeStream = st !== undefined ? st : streamType;
		const activeSort = sb !== undefined ? sb : sortBy;
		const activeTf = tf !== undefined ? tf : timeFrame;
		const activeStart = sDate !== undefined ? sDate : startDate;
		const activeEnd = eDate !== undefined ? eDate : endDate;
		const activeMin = minAmt !== undefined ? minAmt : minAmount;
		const activeMax = maxAmt !== undefined ? maxAmt : maxAmount;

		if (activeTf === 'custom') {
			if (activeStart && activeEnd && activeStart > activeEnd) {
				setError("Invalid date range: 'From' date cannot be after 'To' date.");
				setLoading(false);
				return;
			}
		}

		if (activeMin && activeMax && Number(activeMin) > Number(activeMax)) {
			setError("Invalid threshold: Min Amount cannot be greater than Max Amount.");
			setLoading(false);
			return;
		}

		const params = new URLSearchParams({
			stream_type: activeStream,
			sort_by: activeSort,
			time_frame: activeTf
		});

		if (activeTf === 'custom') {
			if (activeStart) params.append('start_date', activeStart);
			if (activeEnd) params.append('end_date', activeEnd);
		}

		if (activeMin) params.append('min_amount', activeMin);
		if (activeMax) params.append('max_amount', activeMax);

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

		if (timeFrame === 'custom' && startDate && endDate && startDate > endDate) {
			setError("Invalid date range: 'From' date cannot be after 'To' date.");
			return;
		}
		if (minAmount && maxAmount && Number(minAmount) > Number(maxAmount)) {
			setError("Invalid threshold: Min Amount cannot be greater than Max Amount.");
			return;
		}
		if (minAmount && Number(minAmount) < 0) {
			setError("Min Amount cannot be negative.");
			return;
		}
		if (maxAmount && Number(maxAmount) < 0) {
			setError("Max Amount cannot be negative.");
			return;
		}

		setHasGenerated(true);
		fetchReport();
		fetchSummary();
	};

	const handleResetFilters = () => {
		detailRequestId.current += 1;
		setSelectedRowKey(null);
		setTransactionDetails([]);
		setDetailsError('');
		setStreamType('all');
		setSortBy('revenue');
		setTimeFrame('ytd');
		setStartDate('');
		setEndDate('');
		setMinAmount('');
		setMaxAmount('');
		setHasGenerated(false);
		setReportData([]);
		setSummary(null);
		setError('');
	};

	const handleExportCSV = () => {
		if (reportData.length === 0) {
			alert('No data to export.');
			return;
		}

		const headers = [
			'Flow Type',
			'Stream Category',
			'Stream / Source',
			'Transaction Count',
			'Total Amount ($)',
			'Average Amount ($)',
			'Min Amount ($)',
			'Max Amount ($)'
		];

		const escapeCSV = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
		const rows = reportData.map((row) => {
			const isExpense = EXPENSE_CATEGORIES.includes(row.stream_category);
			return [
				isExpense ? 'Outflow (Expense)' : 'Inflow (Revenue)',
				escapeCSV(row.stream_category),
				escapeCSV(row.stream_name),
				row.transaction_count,
				row.total_revenue,
				row.avg_amount,
				row.min_amount,
				row.max_amount
			];
		});

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `zoo_financial_statement_${timeFrame}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => window.print();

	const handleRowClick = async (row, rowKey) => {
		const requestId = ++detailRequestId.current;
		if (selectedRowKey === rowKey) {
			setSelectedRowKey(null);
			setTransactionDetails([]);
			setDetailsError('');
			setDetailsLoading(false);
			return;
		}

		setSelectedRowKey(rowKey);
		setTransactionDetails([]);
		setDetailsError('');
		setDetailsLoading(true);

		const params = new URLSearchParams({
			stream_category: row.stream_category,
			stream_name: row.stream_name,
			time_frame: timeFrame
		});
		if (timeFrame === 'custom') {
			if (startDate) params.append('start_date', startDate);
			if (endDate) params.append('end_date', endDate);
		}

		try {
			const response = await fetch(
				`${API_URL}/api/reports/revenue/transactions?${params.toString()}`
			);
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || `Server returned status ${response.status}`);
			}
			if (detailRequestId.current === requestId) {
				setTransactionDetails(data);
			}
		} catch (err) {
			if (detailRequestId.current === requestId) {
				console.error('Error fetching revenue transactions:', err);
				setDetailsError(`Failed to load transactions: ${err.message}`);
			}
		} finally {
			if (detailRequestId.current === requestId) {
				setDetailsLoading(false);
			}
		}
	};

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
			<p style={{ fontSize: '1.05rem', lineHeight: '1.5', color: '#334155', margin: '8px 0 16px 0' }}>
				Financial breakdown of ticket admissions, fundraising donations, gift shop retail sales, concessions, habitat operations, and animal healthcare including feeding expenses.
			</p>

			{/* Filter Form Controls */}
			<form onSubmit={handleFilterSubmit} style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px' }}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
					<div>
						<label htmlFor="stream-select" style={{ fontWeight: '600', marginRight: '6px' }}>Financial Stream:</label>
						<select id="stream-select" value={streamType} onChange={(e) => setStreamType(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
							<option value="all">All Revenue & Expense Streams</option>
							<option value="tickets">Admissions (Ticket Sales Only)</option>
							<option value="donations">Fundraising (Donations Only)</option>
							<option value="retail">Gift Shop (Retail Merchandise Only)</option>
							<option value="food_sales">Food & Dining Concessions (Sales Only)</option>
							<option value="expenses">Habitat Care (Expenses Only)</option>
							<option value="medical_expenses">Animal Healthcare (Including Feeding Expenses)</option>
						</select>
					</div>

					<div>
						<label htmlFor="timeframe-select" style={{ fontWeight: '600', marginRight: '6px' }}>Time Frame:</label>
						<select id="timeframe-select" value={timeFrame} onChange={(e) => setTimeFrame(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
							<option value="ytd">Year-to-Date (FY 2026)</option>
							<option value="all">All-Time Cumulative</option>
							<option value="custom">Custom Date Range</option>
						</select>
					</div>

					{timeFrame === 'custom' && (
						<>
							<div>
								<label htmlFor="start-date" style={{ fontWeight: '600', marginRight: '6px' }}>From:</label>
								<input
									type="date"
									id="start-date"
									value={startDate}
									onChange={(e) => setStartDate(e.target.value)}
									style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
								/>
							</div>
							<div>
								<label htmlFor="end-date" style={{ fontWeight: '600', marginRight: '6px' }}>To:</label>
								<input
									type="date"
									id="end-date"
									value={endDate}
									onChange={(e) => setEndDate(e.target.value)}
									style={{ padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
								/>
							</div>
						</>
					)}
				</div>

				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
					<div>
						<label htmlFor="min-amt" style={{ fontWeight: '600', marginRight: '6px' }}>Min Amount ($):</label>
						<input
							type="number"
							id="min-amt"
							placeholder="e.g. 100"
							value={minAmount}
							onChange={(e) => setMinAmount(e.target.value)}
							style={{ width: '110px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
						/>
					</div>

					<div>
						<label htmlFor="max-amt" style={{ fontWeight: '600', marginRight: '6px' }}>Max Amount ($):</label>
						<input
							type="number"
							id="max-amt"
							placeholder="e.g. 5000"
							value={maxAmount}
							onChange={(e) => setMaxAmount(e.target.value)}
							style={{ width: '110px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
						/>
					</div>

					<div>
						<label htmlFor="sort-select" style={{ fontWeight: '600', marginRight: '6px' }}>Sort By:</label>
						<select id="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
							<option value="revenue">Total Amount (High to Low)</option>
							<option value="count">Transaction Count (Most frequent first)</option>
							<option value="avg">Average Amount (High to Low)</option>
							<option value="name">Stream Name (A to Z)</option>
						</select>
					</div>

					<button type="submit" disabled={loading} style={{ padding: '6px 16px', fontWeight: '600', background: '#166534', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
						{loading ? 'Generating...' : 'Generate Report'}
					</button>

					<button type="button" onClick={handleResetFilters} style={{ padding: '6px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}>
						Reset
					</button>

					{lastUpdated && (
						<span style={{ fontSize: '0.9rem', color: '#64748b' }}>
							(Generated at {lastUpdated})
						</span>
					)}
				</div>
			</form>

			{error && (
				<p role="alert" style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px 14px', borderRadius: '6px', fontWeight: '500' }}>
					{error}
				</p>
			)}

			{!hasGenerated ? (
				<div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', margin: '20px 0', color: '#64748b' }}>
					<p style={{ fontSize: '1.02rem', margin: 0 }}>
						Select your parameters above and click <strong>Generate Report</strong> to load financial statement data.
					</p>
				</div>
			) : (
				<>
					{summary && streamType === 'all' && (
						<fieldset style={{ margin: '16px 0', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
							<legend style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
								<strong style={{ fontSize: '1.08rem', color: '#0f172a' }}>Executive Operating Statement</strong>
								<span style={{ fontSize: '0.88rem', color: '#64748b', fontWeight: 'normal', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
									Period: {summary.time_frame === 'ytd' ? 'FY 2026 Year-to-Date' : summary.time_frame === 'all' ? 'All-Time Cumulative' : `${summary.start_date || startDate || 'Start'} to ${summary.end_date || endDate || 'End'}`}
								</span>
							</legend>
							<table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', marginBottom: '8px', background: '#ffffff', borderCollapse: 'collapse', borderColor: '#cbd5e1' }}>
								<thead>
									<tr style={{ background: '#f1f5f9' }}>
										<th style={{ padding: '10px', fontSize: '0.95rem' }}>Gross Revenue (Inflows)</th>
										<th style={{ padding: '10px', fontSize: '0.95rem' }}>Habitat Operations (Outflows)</th>
										<th style={{ padding: '10px', fontSize: '0.95rem' }}>Animal Healthcare & Feeding (Outflows)</th>
										<th style={{ padding: '10px', fontSize: '0.95rem' }}>Total Expenses</th>
										<th style={{ padding: '10px', fontSize: '0.95rem' }}>Net Operating Balance</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td style={{ padding: '10px' }}>
											<strong style={{ fontSize: '1.12rem', color: '#166534' }}>+${formatCurrency(summary.gross_revenue)}</strong>
											<div style={{ fontSize: '0.92rem', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
												Admissions: ${formatCurrency(summary.admissions_total)} | Donations: ${formatCurrency(summary.donations_total)} | Retail: ${formatCurrency(summary.retail_total)} | Concessions: ${formatCurrency(summary.food_concessions_total)}
											</div>
										</td>
										<td style={{ padding: '10px' }}>
											<strong style={{ fontSize: '1.12rem', color: '#b91c1c' }}>-${formatCurrency(summary.enclosure_costs_total)}</strong>
											<div style={{ fontSize: '0.92rem', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
												{(summary.enclosure_categories || []).map((category) => `${category.category}: $${formatCurrency(category.amount)}`).join(' | ') || 'No habitat expenses recorded'}
											</div>
										</td>
										<td style={{ padding: '10px' }}>
											<strong style={{ fontSize: '1.12rem', color: '#b91c1c' }}>-${formatCurrency(summary.medical_costs_total)}</strong>
											<div style={{ fontSize: '0.92rem', color: '#475569', marginTop: '6px', lineHeight: '1.4' }}>
												{(summary.medical_categories || []).map((category) => `${category.category}: $${formatCurrency(category.amount)}`).join(' | ') || 'No healthcare or feeding expenses recorded'}
											</div>
										</td>
										<td style={{ padding: '10px' }}>
											<strong style={{ fontSize: '1.12rem', color: '#b91c1c' }}>-${formatCurrency(summary.total_expenses)}</strong>
										</td>
										<td style={{ padding: '10px', color: Number(summary.net_balance) < 0 ? '#b91c1c' : '#166534' }}>
											<strong style={{ fontSize: '1.12rem' }}>
												{Number(summary.net_balance) < 0 ? '-' : '+'}${formatCurrency(Math.abs(Number(summary.net_balance)))}
											</strong>
											<div style={{ fontSize: '0.92rem', fontWeight: '600', marginTop: '6px' }}>
												{Number(summary.net_balance) < 0 ? 'Operating Deficit' : 'Operating Surplus'}
											</div>
										</td>
									</tr>
								</tbody>
							</table>
						</fieldset>
					)}

					<div style={{ margin: '14px 0' }}>
						<button type="button" onClick={handleExportCSV} style={{ padding: '6px 14px', marginRight: '10px', cursor: 'pointer' }}>
							Export to CSV (Excel)
						</button>
						<button type="button" onClick={handlePrintPDF} style={{ padding: '6px 14px', cursor: 'pointer' }}>
							Print / Save as PDF
						</button>
					</div>

					<table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#cbd5e1' }}>
						<thead>
							<tr style={{ background: '#f1f5f9' }}>
								<th style={{ padding: '8px' }}>Flow Type</th>
								<th style={{ padding: '8px' }}>Category</th>
								<th style={{ padding: '8px' }}>Stream / Source</th>
								<th style={{ padding: '8px' }}>Transaction Count</th>
								<th style={{ padding: '8px' }}>Total Amount ($)</th>
								<th style={{ padding: '8px' }}>Average Amount ($)</th>
								<th style={{ padding: '8px' }}>Min Amount ($)</th>
								<th style={{ padding: '8px' }}>Max Amount ($)</th>
							</tr>
						</thead>
						<tbody>
							{reportData.length === 0 && !loading && !error && (
								<tr>
									<td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
										No financial records found matching your selected criteria (Stream: {streamType}, Timeframe: {timeFrame}{minAmount ? `, Min: $${minAmount}` : ''}{maxAmount ? `, Max: $${maxAmount}` : ''}). Try broadening your date range or adjusting thresholds.
									</td>
								</tr>
							)}
							{reportData.map((row, index) => {
								const isExpense = EXPENSE_CATEGORIES.includes(row.stream_category);
								const rowKey = `${row.stream_category}-${row.stream_name}-${index}`;
								const isSelected = selectedRowKey === rowKey;
								return (
									<Fragment key={rowKey}>
									<tr
										onClick={() => handleRowClick(row, rowKey)}
										onKeyDown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												handleRowClick(row, rowKey);
											}
										}}
										tabIndex={0}
										aria-expanded={isSelected}
										title="Click to view individual transactions"
										style={{ cursor: 'pointer' }}
									>
										<td>
											<span style={{
												display: 'inline-block',
												padding: '2px 8px',
												borderRadius: '10px',
												fontSize: '0.8rem',
												fontWeight: '600',
												background: isExpense ? '#fee2e2' : '#dcfce7',
												color: isExpense ? '#b91c1c' : '#166534'
											}}>
												{isExpense ? 'Outflow (Expense)' : 'Inflow (Revenue)'}
											</span>
										</td>
										<td>{row.stream_category}</td>
										<td><strong>{row.stream_name}</strong></td>
										<td>{Number(row.transaction_count || 0).toLocaleString()}</td>
										<td style={{ fontWeight: '600', color: isExpense ? '#b91c1c' : '#166534' }}>
											{isExpense ? '-' : '+'}${formatCurrency(row.total_revenue)}
										</td>
										<td>${formatCurrency(row.avg_amount)}</td>
										<td>${formatCurrency(row.min_amount)}</td>
										<td>${formatCurrency(row.max_amount)}</td>
									</tr>
									{isSelected && (
										<tr>
											<td colSpan="8" style={{ padding: '16px', background: '#f8fafc' }}>
												<strong style={{ display: 'block', marginBottom: '10px' }}>
													Transactions for {row.stream_name}
												</strong>
												{detailsLoading ? (
													<p role="status">Loading transactions...</p>
												) : detailsError ? (
													<p role="alert" style={{ color: '#b91c1c' }}>{detailsError}</p>
												) : transactionDetails.length === 0 ? (
													<p style={{ color: '#64748b' }}>No individual transactions found.</p>
												) : (
													<table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#cbd5e1', background: '#fff' }}>
														<thead>
															<tr style={{ background: '#e2e8f0' }}>
																<th>Date</th>
																<th>Transaction / Record ID</th>
																<th>Item / Description</th>
																<th>Quantity</th>
																<th>Unit Amount ($)</th>
																<th>Total ($)</th>
																<th>Payment Method</th>
															</tr>
														</thead>
														<tbody>
															{transactionDetails.map((transaction, detailIndex) => (
																<tr key={`${transaction.record_ID}-${transaction.transaction_ID}-${detailIndex}`}>
																	<td>{transaction.transaction_date || '—'}</td>
																	<td>
																		{transaction.transaction_ID
																			? `#${transaction.transaction_ID}`
																			: `Record #${transaction.record_ID}`}
																	</td>
																	<td>
																		{transaction.item_name || '—'}
																		{transaction.description && (
																			<div style={{ color: '#64748b', fontSize: '0.9rem' }}>
																				{transaction.description}
																			</div>
																		)}
																	</td>
																	<td>{Number(transaction.quantity || 0).toLocaleString()}</td>
																	<td>${formatCurrency(transaction.unit_price)}</td>
																	<td>${formatCurrency(transaction.amount)}</td>
																	<td>{transaction.payment_method || '—'}</td>
																</tr>
															))}
														</tbody>
													</table>
												)}
											</td>
										</tr>
									)}
									</Fragment>
								);
							})}
						</tbody>
						{reportData.length > 0 && (
							<tfoot>
								<tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
									<th colSpan="3">Total Revenue (Inflows)</th>
									<th>{totalTransactions.toLocaleString()}</th>
									<th style={{ color: '#166534' }}>+${formatCurrency(grandTotalRevenue)}</th>
									<th>${formatCurrency(overallAverage)}</th>
									<th>-</th>
									<th>-</th>
								</tr>
								<tr>
									<th colSpan="4">Total Habitat Operations Expenses</th>
									<th style={{ color: '#b91c1c' }}>-${formatCurrency(habitatExpenseRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0))}</th>
									<th colSpan="3"></th>
								</tr>
								<tr>
									<th colSpan="4">Total Animal Healthcare Expenses</th>
									<th style={{ color: '#b91c1c' }}>-${formatCurrency(medicalExpenseRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0))}</th>
									<th colSpan="3"></th>
								</tr>
								<tr style={{ background: '#fef2f2', fontWeight: 'bold' }}>
									<th colSpan="4">Total Expenses (Outflows)</th>
									<th style={{ color: '#b91c1c' }}>-${formatCurrency(grandTotalExpenses)}</th>
									<th colSpan="3" style={{ color: netOperatingBalance >= 0 ? '#166534' : '#b91c1c' }}>
										Net for Selected Streams: {netOperatingBalance >= 0 ? '+' : '-'}${formatCurrency(Math.abs(netOperatingBalance))}
									</th>
								</tr>
							</tfoot>
						)}
					</table>
				</>
			)}
		</div>
	);
}

export default RevenueDetails;
