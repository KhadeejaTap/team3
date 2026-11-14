import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';

const streamOptions = [
	{ value: 'tickets', label: 'Tickets', metrics: ['revenue'] },
	{ value: 'donations', label: 'Donations', metrics: ['revenue'] },
	{ value: 'giftShop', label: 'Gift Shop', metrics: ['revenue', 'profit'] },
	{ value: 'food', label: 'Food Stalls', metrics: ['revenue', 'profit'] }
];

const metricLabels = {
	revenue: 'Revenue',
	profit: 'Profit',
	expenses: 'Expenses'
};

function ProfitPage() {
	const [stream, setStream] = useState('tickets');
	const [metric, setMetric] = useState('revenue');
	const [timeFrame, setTimeFrame] = useState('yearToDate');
	const [customStartDate, setCustomStartDate] = useState('');
	const [customEndDate, setCustomEndDate] = useState('');
	const [sortBy, setSortBy] = useState('date');
	const [stalls, setStalls] = useState([]);
	const [selectedStall, setSelectedStall] = useState('all');
	const [reportRows, setReportRows] = useState([]);
	const [itemSummary, setItemSummary] = useState([]);
	const [showReport, setShowReport] = useState(false);
	const [loadingReport, setLoadingReport] = useState(false);
	const [error, setError] = useState('');
	const [ticketRows, setTicketRows] = useState([]);
	const [ticketTotals, setTicketTotals] = useState({
		ticket_count: 0,
		revenue: 0
	});
	const [ticketTypeSummary, setTicketTypeSummary] = useState([]);
	const [donationRows, setDonationRows] = useState([]);
	const [donorSummary, setDonorSummary] = useState([]);
	const [donationTotals, setDonationTotals] = useState({
		donation_count: 0,
		revenue: 0
	});
	const [donationPurposeSummary, setDonationPurposeSummary] = useState([]);
	const [donorSummaryTotals, setDonorSummaryTotals] = useState({
		donor_count: 0,
		donation_count: 0,
		revenue: 0
	});
	const [donorSummaryPurposeSummary, setDonorSummaryPurposeSummary] = useState([]);
	const availableMetrics = useMemo(
		() => streamOptions.find((option) => option.value === stream)?.metrics || [],
		[stream]
	);

	useEffect(() => {
		if (!availableMetrics.includes(metric)) {
			setMetric(availableMetrics[0]);
		}
	}, [availableMetrics, metric]);

	useEffect(() => {
		apiFetch('/api/food-stalls')
			.then(async (response) => {
				const data = await response.json().catch(() => []);
				if (!response.ok) {
					throw new Error(data.error || 'Could not load food stalls.');
				}
				setStalls(data);
			})
			.catch((err) => setError(err.message));
	}, []);

	const customDatesAreValid =
		timeFrame !== 'customDateFrame' ||
		(customStartDate && customEndDate && customStartDate <= customEndDate);

	const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;
	const formatDate = (value) => {
		if (!value) return '—';
		const [year, month, day] = String(value).slice(0, 10).split('-');
		return `${month}/${day}/${year}`;
	};

	const handleGenerateReport = async () => {
		if (!['food', 'tickets', 'donations', 'giftShop'].includes(stream) || !customDatesAreValid) return;

		const params = new URLSearchParams({
			stream: stream,
			reportType: metric,
			timeFrame,
			sortBy,
			stallId: selectedStall
		});
		if (timeFrame === 'customDateFrame') {
			params.set('startDate', customStartDate);
			params.set('endDate', customEndDate);
		}

		setLoadingReport(true);
		setError('');
		try {
			const response = await apiFetch(`/api/profit-report?${params.toString()}`);
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(data.error || 'Could not load the report.');
			}
			if (stream === 'tickets') {
				setTicketRows(data.ticketRows || []);
				setTicketTotals(data.ticketTotals || {});
				setTicketTypeSummary(data.ticketTypeSummary || []);
			} else if (stream === 'donations') {
				setDonationRows(data.donationRows || []);
				setDonorSummary(data.donorSummary || []);
				setDonationTotals(data.donationTotals || { donation_count: 0, revenue: 0 });
				setDonationPurposeSummary(data.donationPurposeSummary || []);
				setDonorSummaryTotals(
					data.donorSummaryTotals || { donor_count: 0, donation_count: 0, revenue: 0 }
				);
				setDonorSummaryPurposeSummary(data.donorSummaryPurposeSummary || []);
			} else {
				setReportRows(data.rows || []);
				setItemSummary(data.itemSummary || []);
			}
			setShowReport(true);
		} catch (err) {
			setError(err.message);
		} finally {
			setLoadingReport(false);
		}
	};

	const handleResetReport = () => {
		setShowReport(false);
		setReportRows([]);
		setItemSummary([]);
		setTicketRows([]);
		setTicketTotals({ ticket_count: 0, revenue: 0 });
		setTicketTypeSummary([]);
		setDonationRows([]);
		setDonorSummary([]);
		setDonationTotals({ donation_count: 0, revenue: 0 });
		setDonationPurposeSummary([]);
		setDonorSummaryTotals({ donor_count: 0, donation_count: 0, revenue: 0 });
		setDonorSummaryPurposeSummary([]);
		setError('');
	};

	const reportTotal = reportRows.reduce(
		(total, row) => total + Number(row.report_amount || 0),
		0
	);
	const quantityTotal = reportRows.reduce(
		(total, row) => total + Number(row.quantity || 0),
		0
	);

	const handleExportCSV = () => {
		const timeframeLabel =
			timeFrame === 'customDateFrame'
				? `${customStartDate} to ${customEndDate}`
				: timeFrame === 'yearToDate'
					? 'Year to date'
					: 'All time';
		const csvRows = [
			['Profit Report'],
			['Stream', streamOptions.find((option) => option.value === stream)?.label || stream],
			['Report type', metricLabels[metric]],
			['Timeframe', timeframeLabel],
			[]
		];
		const addSection = (title, headers, rows) => {
			csvRows.push([title], headers, ...rows, []);
		};

		if (stream === 'tickets') {
			addSection('Ticket Summary', ['Ticket Type', 'Ticket Count', 'Revenue'], [
				...ticketTypeSummary.map((summary) => [
					summary.ticket_type,
					summary.ticket_count,
					''
				]),
				['Total', ticketTotals.ticket_count, ticketTotals.revenue]
			]);
			addSection(
				'Ticket Sales Log',
				['Purchase Date', 'Visit Date', 'Customer', 'Email', 'Ticket Type', 'Price'],
				[
					[
						'Totals',
						'',
						'',
						'',
						ticketTotals.ticket_count,
						ticketTotals.revenue
					],
					...ticketRows.map((ticket) => [
						formatDate(ticket.purchase_date),
						formatDate(ticket.visit_date),
						ticket.visitor_name || 'name not recorded',
						ticket.visitor_email || 'email not recorded',
						ticket.ticket_type,
						Number(ticket.report_amount || 0)
					])
				]
			);
		} else if (stream === 'donations') {
			addSection(
				'Donor Summary',
				['Donor Name', 'Email', 'Num Donations', 'Phone', 'Purpose', 'Amount'],
				[
					[
						`Totals: Repeat Donors: ${donorSummary.length}`,
						'',
						donorSummaryTotals.donation_count,
						'',
						donorSummaryPurposeSummary
							.map((purpose) => `${purpose.purpose}: ${formatMoney(purpose.total_amount)}`)
							.join(' | '),
						donorSummaryTotals.revenue
					],
					...donorSummary.map((donor) => [
						`${donor.first_name} ${donor.last_name}`.trim(),
						donor.donor_email,
						donor.donation_count,
						donor.donor_phone,
						donor.purpose_breakdown,
						Number(donor.total_amount || 0)
					])
				]
			);
			addSection(
				'Donation Sales Log',
				['Donation Date', 'Donor Name', 'Email', 'Phone', 'Purpose', 'Amount'],
				[
					[
						'Totals',
						donationTotals.donation_count,
						'',
						'',
						donationPurposeSummary
							.map((purpose) => `${purpose.purpose}: ${formatMoney(purpose.total_amount)}`)
							.join(' | '),
						donationTotals.revenue
					],
					...donationRows.map((row) => [
						formatDate(row.donation_date),
						`${row.first_name} ${row.last_name}`.trim(),
						row.donor_email,
						row.donor_phone,
						row.purpose,
						Number(row.amount || 0)
					])
				]
			);
		} else {
			const isFood = stream === 'food';
			addSection(
				isFood ? 'Food Sales by Item' : 'Gift Shop Sales by Product',
				isFood
					? ['Food Item', 'Sales', 'Quantity Sold', metricLabels[metric]]
					: ['Product', 'Category', 'Sales Count', 'Quantity Sold', metricLabels[metric]],
				[
					isFood
						? ['Totals', reportRows.length, quantityTotal, reportTotal]
						: ['Totals', `${itemSummary.length} products`, reportRows.length, quantityTotal, reportTotal],
					...itemSummary.map((item) =>
						isFood
							? [item.item_name, item.sale_count, item.quantity_sold, Number(item.report_amount || 0)]
							: [
									item.item_name,
									item.category,
									item.sale_count,
									item.quantity_sold,
									Number(item.report_amount || 0)
								]
					)
				]
			);
			addSection(
				isFood ? 'Food Sales Log' : 'Gift Shop Sales Log',
				isFood
					? ['Date', 'Customer', 'Food Item', 'Food Stall', 'Quantity', 'Sale Price', metricLabels[metric]]
					: ['Date', 'Customer', 'Product', 'Category', 'Quantity', 'Sale Price', metricLabels[metric]],
				[
					['Totals', `${reportRows.length} sales`, '', '', quantityTotal, '', reportTotal],
					...reportRows.map((row) => [
						String(row.transaction_date).slice(0, 10),
						row.customer_name,
						row.item_name,
						isFood ? row.stall_name : row.category,
						row.quantity,
						Number(row.sale_price || 0),
						Number(row.report_amount || 0)
					])
				]
			);
		}

		const escapeCell = (value) => {
			let cell = value == null ? '' : String(value);
			if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(cell)) {
				cell = `'${cell}`;
			}
			return `"${cell.replace(/"/g, '""')}"`;
		};
		const csvContent = csvRows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
		const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `profit-${stream}-${metric}-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	return (
		<div className="profit-report-page">
			<h2>Profit Reports</h2>
			<section className="payroll-filters profit-report-filters">
				<h3>Report Filters</h3>
				<p>
					Revenue reports are available for tickets, donations, the gift
					shop, and food stalls. Profit reports are available for the gift shop and food stalls.
				</p>

				<label htmlFor="profit-stream">Stream: </label>
				<select
					id="profit-stream"
					value={stream}
					onChange={(event) => {
						const nextStream = event.target.value;
						setStream(nextStream);
						setSortBy(nextStream === 'food' ? 'salePrice' : 'date');
						handleResetReport();
					}}
				>
					{streamOptions.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>

				<label htmlFor="profit-metric">Report type: </label>
				<select
					id="profit-metric"
					value={metric}
					onChange={(event) => setMetric(event.target.value)}
				>
					{availableMetrics.map((option) => (
						<option key={option} value={option}>
							{metricLabels[option]}
						</option>
					))}
				</select>

				<label htmlFor="profit-timeframe">Timeframe: </label>
				<select
					id="profit-timeframe"
					value={timeFrame}
					onChange={(event) => setTimeFrame(event.target.value)}
				>
					<option value="yearToDate">Year to date</option>
					<option value="allTime">All time</option>
					<option value="customDateFrame">Custom dates</option>
				</select>

				{timeFrame === 'customDateFrame' && (
					<>
						<label htmlFor="profit-start-date">Start date: </label>
						<input
							id="profit-start-date"
							type="date"
							value={customStartDate}
							onChange={(event) => setCustomStartDate(event.target.value)}
						/>

						<label htmlFor="profit-end-date">End date: </label>
						<input
							id="profit-end-date"
							type="date"
							value={customEndDate}
							onChange={(event) => setCustomEndDate(event.target.value)}
						/>
					</>
				)}

				{stream === 'food' && (
					<>
						<label htmlFor="food-sort">Sort logs by: </label>
						<select
							id="food-sort"
							value={sortBy}
							onChange={(event) => setSortBy(event.target.value)}
						>
							<option value="salePrice">Highest sale price</option>
							<option value="largestSale">Largest sale</option>
						</select>
						<label htmlFor="food-stall">Food stall: </label>
						<select
							id="food-stall"
							value={selectedStall}
							onChange={(event) => setSelectedStall(event.target.value)}
						>
							<option value="all">All Stalls</option>
							{stalls.map((stall) => (
								<option key={stall.stall_ID} value={stall.stall_ID}>
									{stall.name}
								</option>
							))}
						</select>
					</>
				)}

				{['tickets', 'donations', 'giftShop'].includes(stream) && (
					<>
						<label htmlFor="report-sort">Sort logs by: </label>
						<select
							id="report-sort"
							value={['date', 'amount'].includes(sortBy) ? sortBy : 'date'}
							onChange={(event) => setSortBy(event.target.value)}
						>
							<option value="date">Date</option>
							<option value="amount">Amount</option>
						</select>
					</>
				)}

				{!customDatesAreValid && (
					<p role="alert">Choose a valid custom start and end date.</p>
				)}
				{['food', 'tickets', 'donations', 'giftShop'].includes(stream) && (
					<button
						type="button"
						onClick={showReport ? handleResetReport : handleGenerateReport}
						disabled={!customDatesAreValid || loadingReport}
					>
						{loadingReport ? 'Loading...' : showReport ? 'Reset Report' : 'Generate Report'}
					</button>
				)}
				{error && <p role="alert">{error}</p>}
			</section>

			{showReport && (
				<div className="profit-report-export-actions">
					<button type="button" onClick={handleExportCSV}>
						Export as CSV
					</button>
					<button type="button" onClick={() => window.print()}>
						Export as PDF
					</button>
				</div>
			)}

			{showReport && (
				<div className="profit-report-printable">
					<h2>
						{streamOptions.find((option) => option.value === stream)?.label} {metricLabels[metric]} Report
					</h2>
			{showReport && stream === 'food' && (
				<section>
					<h3>Food Sales by Item</h3>
					<table>
						<thead>
							<tr>
								<th>Food item</th>
								<th>Sales</th>
								<th>Quantity sold</th>
								<th>{metricLabels[metric]}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th>Totals</th>
								<td>{reportRows.length}</td>
								<td>{quantityTotal}</td>
								<th>{formatMoney(reportTotal)}</th>
							</tr>
							{itemSummary.map((item) => (
								<tr key={item.item_ID}>
									<td>{item.item_name}</td>
									<td>{item.sale_count}</td>
									<td>{item.quantity_sold}</td>
									<td>{formatMoney(item.report_amount)}</td>
								</tr>
							))}
						</tbody>
					</table>

					<h3>Food Sales Log</h3>
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Customer</th>
								<th>Food item</th>
								<th>Food stall</th>
								<th>Quantity</th>
								<th>Sale price</th>
								<th>{metricLabels[metric]}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th>Totals</th>
								<td colSpan="3">{reportRows.length} sales</td>
								<td>{quantityTotal}</td>
								<td></td>
								<th>{formatMoney(reportTotal)}</th>
							</tr>
							{reportRows.map((row) => (
								<tr key={row.transaction_ID}>
									<td>{String(row.transaction_date).slice(0, 10)}</td>
									<td>{row.customer_name}</td>
									<td>{row.item_name}</td>
									<td>{row.stall_name}</td>
									<td>{row.quantity}</td>
									<td>{formatMoney(row.sale_price)}</td>
									<td>{formatMoney(row.report_amount)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
			{showReport && stream === 'tickets' && (
				<section>
					<h3>Ticket Sales Log</h3>

					<table>
						<thead>
							<tr>
								<th>Purchase Date</th>
								<th>Visit Date</th>
								<th>Customer</th>
								<th>Email</th>
								<th>Ticket Type</th>
								<th>Price</th>
							</tr>
						</thead>

						<tbody>
							<tr>
								<th colSpan="4">Total ({ticketTotals.ticket_count} tickets)</th>
								<td>
									{ticketTypeSummary
										.map((summary) => `${summary.ticket_type}: ${summary.ticket_count}`)
										.join(' ')}
								</td>
								<th>
									Total revenue: ${Number(ticketTotals.revenue || 0).toFixed(2)}
								</th>
							</tr>

							{ticketRows.map((ticket) => (
								<tr key={ticket.ticket_ID}>
									<td>{formatDate(ticket.purchase_date)}</td>
									<td>{formatDate(ticket.visit_date)}</td>
									<td>{ticket.visitor_name || 'name not recorded'}</td>
									<td>{ticket.visitor_email || 'email not recorded'}</td>
									<td>{ticket.ticket_type}</td>
									<td>
										${Number(ticket.report_amount || 0).toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
			{showReport && stream === 'donations' && (
				<section>
					<h3>Donor Summary</h3>
					<table>
						<thead>
							<tr>
								<th>Donor Name</th>
								<th>Email</th>
								<th>Num Donations</th>
								<th>Phone</th>
								<th>Purpose</th>
								<th>Amount</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th colSpan="2">Totals: Repeat Donors: {donorSummary.length} </th>
								<th>{donorSummaryTotals.donation_count}</th>
								<td></td>
								<td>
									{donorSummaryPurposeSummary
										.map((p) => `${p.purpose}: ${formatMoney(p.total_amount)}`)
										.join(' | ')}
								</td>
								<th>Total: {formatMoney(donorSummaryTotals.revenue)}</th>
							</tr>
							{donorSummary.length === 0 ? (
								<tr>
									<td colSpan="6">No donors with more than 1 donation found.</td>
								</tr>
							) : (
								donorSummary.map((donor) => (
									<tr key={donor.donor_ID || `${donor.first_name}_${donor.last_name}`}>
										<td>{`${donor.first_name} ${donor.last_name}`.trim()}</td>
										<td>{donor.donor_email}</td>
										<td>{donor.donation_count}</td>
										<td>{donor.donor_phone}</td>
										<td>{donor.purpose_breakdown}</td>
										<td>{formatMoney(donor.total_amount)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>

					<h3>Donation Sales Log</h3>
					<table>
						<thead>
							<tr>
								<th>Donation Date</th>
								<th>Donor Name</th>
								<th>Email</th>
								<th>Phone</th>
								<th>Purpose</th>
								<th>Amount</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th colSpan="4">Totals: Donations: {donationTotals.donation_count}</th>
								<td>
									{donationPurposeSummary
										.map((p) => `${p.purpose}: ${formatMoney(p.total_amount)}`)
										.join(' | ')}
								</td>
								<th>Total: {formatMoney(donationTotals.revenue)}</th>
							</tr>
							{donationRows.map((row) => (
								<tr key={row.donation_ID}>
									<td>{formatDate(row.donation_date)}</td>
									<td>{`${row.first_name} ${row.last_name}`.trim()}</td>
									<td>{row.donor_email}</td>
									<td>{row.donor_phone}</td>
									<td>{row.purpose}</td>
									<td>{formatMoney(row.amount)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
			{showReport && stream === 'giftShop' && (
				<section>
					<h3>Gift Shop Sales by Product</h3>
					<table>
						<thead>
							<tr>
								<th>Product</th>
								<th>Category</th>
								<th>Sales Count</th>
								<th>Quantity Sold</th>
								<th>{metricLabels[metric]}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th>Totals</th>
								<td>{itemSummary.length} products</td>
								<td>{reportRows.length}</td>
								<td>{quantityTotal}</td>
								<th>{formatMoney(reportTotal)}</th>
							</tr>
							{itemSummary.map((item) => (
								<tr key={item.item_ID}>
									<td>{item.item_name}</td>
									<td>{item.category}</td>
									<td>{item.sale_count}</td>
									<td>{item.quantity_sold}</td>
									<td>{formatMoney(item.report_amount)}</td>
								</tr>
							))}
						</tbody>
					</table>

					<h3>Gift Shop Sales Log</h3>
					<table>
						<thead>
							<tr>
								<th>Date</th>
								<th>Customer</th>
								<th>Product</th>
								<th>Category</th>
								<th>Quantity</th>
								<th>Sale Price</th>
								<th>{metricLabels[metric]}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th>Totals</th>
								<td colSpan="3">{reportRows.length} sales</td>
								<td>{quantityTotal}</td>
								<td></td>
								<th>{formatMoney(reportTotal)}</th>
							</tr>
							{reportRows.map((row) => (
								<tr key={row.transaction_ID}>
									<td>{String(row.transaction_date).slice(0, 10)}</td>
									<td>{row.customer_name}</td>
									<td>{row.item_name}</td>
									<td>{row.category}</td>
									<td>{row.quantity}</td>
									<td>{formatMoney(row.sale_price)}</td>
									<td>{formatMoney(row.report_amount)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</section>
			)}
				</div>
			)}
		</div>
	);
}

export default ProfitPage;
