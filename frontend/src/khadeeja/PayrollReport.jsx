import { useState, useEffect } from 'react';
import './PayrollReport.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function PayrollReport({ role, userEmail }) {
	const [reportData, setReportData] = useState([]);
	const [departmentId, setDepartmentId] = useState('all');
	const [sortBy, setSortBy] = useState('payroll');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const targetHeadcounts = {
		1: 4,
		2: 6,
		3: 4,
		6: 2,
		7: 2,
		8: 2,
		9: 4
	};

	const getVacancies = (deptID, activeCount) => {
		const target = targetHeadcounts[deptID] || Number(activeCount || 0);
		return Math.max(0, target - Number(activeCount || 0));
	};

	const greenGradient = [
		'#143d22',
		'#1b4d2c',
		'#25633a',
		'#30804b',
		'#42a363',
		'#6cc987',
		'#a7ecc0'
	];

	const fetchReport = () => {
		setLoading(true);
		setError('');

		const params = new URLSearchParams({
			department_id: departmentId,
			sort_by: sortBy
		});

		if (role === 'manager' && userEmail) {
			params.append('email', userEmail);
		}

		fetch(`${API_URL}/api/reports/payroll?${params.toString()}`)
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
				console.error('Error fetching payroll report:', err);
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
			'Department Name',
			'Department Head',
			'Active Headcount',
			'Open Vacancies',
			'Total Payroll ($)',
			'Payroll Budget ($)',
			'Budget Utilization (%)',
			'Average Salary ($)',
			'Min Salary ($)',
			'Max Salary ($)'
		];

		const rows = reportData.map((row) => {
			const hasStaff = Number(row.active_headcount) > 0;
			const budget = Number(row.allocated_budget || 150000);
			const payroll = Number(row.total_payroll || 0);
			const util = budget > 0 ? ((payroll / budget) * 100).toFixed(1) : '0.0';
			const vacancies = getVacancies(row.department_ID, row.active_headcount);

			return [
				`"${row.department_name}"`,
				`"${row.department_head || 'Vacant'}"`,
				row.active_headcount,
				vacancies,
				payroll,
				budget,
				`"${util}%"`,
				hasStaff ? row.average_salary : '"N/A"',
				hasStaff ? row.min_salary : '"N/A"',
				hasStaff ? row.max_salary : '"N/A"'
			];
		});

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'department_payroll_summary_FY2026.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => {
		window.print();
	};

	const totalHeadcount = reportData.reduce((sum, r) => sum + Number(r.active_headcount || 0), 0);
	const totalPayroll = reportData.reduce((sum, r) => sum + Number(r.total_payroll || 0), 0);
	const totalBudget = reportData.reduce((sum, r) => sum + Number(r.allocated_budget || 150000), 0);
	const totalVacancies = reportData.reduce(
		(sum, r) => sum + getVacancies(r.department_ID, r.active_headcount),
		0
	);
	const overallAvgSalary =
		totalHeadcount > 0 ? (totalPayroll / totalHeadcount).toFixed(2) : '0.00';
	const overallUtilization =
		totalBudget > 0 ? ((totalPayroll / totalBudget) * 100).toFixed(1) : '0.0';

	const donutRadius = 150;
	const circumference = 2 * Math.PI * donutRadius;
	const strokeWidth = 54;
	const cx = 480;
	const cy = 260;
	const rOut = donutRadius + strokeWidth / 2;
	const rLine = rOut + 24;

	let donutSlices = [];
	if (reportData.length === 1) {
		const dept = reportData[0];
		const budget = Number(dept.allocated_budget || 150000);
		const payroll = Number(dept.total_payroll || 0);
		const remaining = Math.max(0, budget - payroll);

		const spentFraction = budget > 0 ? payroll / budget : 0;
		const remainingFraction = budget > 0 ? remaining / budget : 0;
		const spentLength = spentFraction * circumference;
		const remainingLength = remainingFraction * circumference;
		const spentSpan = spentFraction * 2 * Math.PI;
		const remainingSpan = remainingFraction * 2 * Math.PI;

		const startAngle = -Math.PI / 2;
		const mid1 = startAngle + spentSpan / 2;
		const mid2 = startAngle + spentSpan + remainingSpan / 2;

		donutSlices = [
			{
				id: 'spent',
				name: 'Spent Payroll',
				amount: payroll,
				percent: (spentFraction * 100).toFixed(1),
				color: '#1a4f2c',
				sliceLength: spentLength,
				offset: 0,
				midAngle: mid1
			},
			{
				id: 'remaining',
				name: 'Available Reserve',
				amount: remaining,
				percent: (remainingFraction * 100).toFixed(1),
				color: '#bbf2cc',
				sliceLength: remainingLength,
				offset: spentLength,
				midAngle: mid2
			}
		];
	} else {
		let currentOffset = 0;
		let currentAngle = -Math.PI / 2;

		const stableChartData = [...reportData].sort(
			(a, b) => Number(b.allocated_budget || 0) - Number(a.allocated_budget || 0)
		);

		donutSlices = stableChartData.map((dept, index) => {
			const budget = Number(dept.allocated_budget || 150000);
			const pct = totalBudget > 0 ? budget / totalBudget : 0;
			const sliceLength = pct * circumference;
			const offset = currentOffset;
			currentOffset += sliceLength;

			const angleSpan = pct * 2 * Math.PI;
			const midAngle = currentAngle + angleSpan / 2;
			currentAngle += angleSpan;

			return {
				id: dept.department_ID,
				name: dept.department_name,
				amount: budget,
				percent: (pct * 100).toFixed(1),
				color: greenGradient[index] || '#2c7f48',
				sliceLength,
				offset,
				midAngle
			};
		});
	}

	return (
		<section className="payroll-report">
			<h2>Department Payroll & Headcount Report</h2>
			<p>
				<strong>Reporting Period:</strong> Annual Salaries — FY 2026 &nbsp;|&nbsp;
				Aggregated departmental payroll expenses, annual personnel budgets, and staffing distribution.
			</p>

			<form onSubmit={handleFilterSubmit} className="payroll-controls">
				<label htmlFor="dept-select">
					<strong>Department: </strong>
				</label>
				{role === 'manager' ? (
					<>
						<select id="dept-select" value={reportData[0]?.department_ID || 'all'} disabled>
							<option>{reportData[0]?.department_name || 'Your Department'}</option>
						</select>
						<span className="scoped-note">
							(Scoped to your departmental budget)
						</span>
					</>
				) : (
					<select
						id="dept-select"
						value={departmentId}
						onChange={(e) => setDepartmentId(e.target.value)}
					>
						<option value="all">All Departments (7)</option>
						<option value="1">HR</option>
						<option value="2">Animal Care</option>
						<option value="3">Veterinary</option>
						<option value="6">Retail</option>
						<option value="7">Food Services</option>
						<option value="8">Parking</option>
						<option value="9">Events & Attractions</option>
					</select>
				)}
				&nbsp;&nbsp;&nbsp;

				<label htmlFor="sort-select">
					<strong>Sort By: </strong>
				</label>
				<select
					id="sort-select"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value)}
				>
					<option value="payroll">Total Payroll (High to Low)</option>
					<option value="headcount">Staff Headcount (High to Low)</option>
					<option value="avg_salary">Average Salary (High to Low)</option>
					<option value="budget">Payroll Budget (High to Low)</option>
					<option value="name">Department Name (A to Z)</option>
				</select>
				&nbsp;&nbsp;&nbsp;

				<button type="submit" disabled={loading}>
					{loading ? 'Refreshing...' : 'Generate Report'}
				</button>
			</form>

			<div className="export-actions">
				<button type="button" onClick={handleExportCSV}>
					Export to CSV (Excel)
				</button>
				&nbsp;&nbsp;
				<button type="button" onClick={handlePrintPDF}>
					Print / Save as PDF
				</button>
			</div>

			{error && <p role="alert" className="payroll-error">{error}</p>}

			{reportData.length > 0 && (
				<div className="payroll-visuals">
					<div className="donut-card">
						<h3 className="donut-title">
							{reportData.length === 1
								? `${reportData[0].department_name} Payroll Budget Breakdown`
								: 'Zoo Payroll Budget Allocation (FY 2026)'}
						</h3>

						<svg viewBox="0 0 960 520" className="donut-chart-large">
							<circle
								cx={cx}
								cy={cy}
								r={donutRadius}
								fill="transparent"
								stroke="#f1f5f9"
								strokeWidth={strokeWidth}
							/>

							{donutSlices.map((slice) => (
								<circle
									key={slice.id}
									cx={cx}
									cy={cy}
									r={donutRadius}
									fill="transparent"
									stroke={slice.color}
									strokeWidth={strokeWidth}
									strokeDasharray={`${slice.sliceLength} ${circumference}`}
									strokeDashoffset={-slice.offset}
									transform={`rotate(-90 ${cx} ${cy})`}
								>
									<title>{`${slice.name}: $${slice.amount.toLocaleString()} (${slice.percent}%)`}</title>
								</circle>
							))}

							<text
								x={cx}
								y={cy - 12}
								textAnchor="middle"
								fontSize="11"
								fill="#64748b"
								fontWeight="bold"
								letterSpacing="0.08em"
							>
								{reportData.length === 1 ? 'DEPT BUDGET' : 'TOTAL BUDGET'}
							</text>
							<text
								x={cx}
								y={cy + 18}
								textAnchor="middle"
								fontSize="24"
								fill="#0f172a"
								fontWeight="bold"
							>
								${(reportData.length === 1 ? Number(reportData[0].allocated_budget || 150000) : totalBudget).toLocaleString()}
							</text>

							{donutSlices.map((slice) => {
								const cos = Math.cos(slice.midAngle);
								const sin = Math.sin(slice.midAngle);
								const x1 = cx + (rOut + 4) * cos;
								const y1 = cy + (rOut + 4) * sin;
								const x2 = cx + rLine * cos;
								const y2 = cy + rLine * sin;
								const isRight = x2 >= cx;
								const x3 = isRight ? x2 + 18 : x2 - 18;
								const textX = isRight ? x3 + 8 : x3 - 8;

								return (
									<g key={`label-${slice.id}`}>
										<polyline
											points={`${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x3.toFixed(1)},${y2.toFixed(1)}`}
											fill="none"
											stroke="#94a3b8"
											strokeWidth="1.2"
										/>
										<circle
											cx={isRight ? textX + 4 : textX - 4}
											cy={y2}
											r="4.5"
											fill={slice.color}
										/>
										<text
											x={isRight ? textX + 14 : textX - 14}
											y={y2 + 4}
											textAnchor={isRight ? 'start' : 'end'}
											fontSize="13"
											fill="#0f172a"
										>
											<tspan fontWeight="600">{slice.name}</tspan>
											<tspan fontWeight="bold" fill="#143d22"> {slice.percent}%</tspan>
										</text>
									</g>
								);
							})}
						</svg>
					</div>
				</div>
			)}

			<table className="payroll-table">
				<thead>
					<tr>
						<th>Department</th>
						<th>Department Head</th>
						<th>Active Headcount</th>
						<th>Open Vacancies</th>
						<th>Total Payroll ($)</th>
						<th>Payroll Budget ($)</th>
						<th>Budget Utilization</th>
						<th>Average Salary ($)</th>
						<th>Salary Range ($ Min – $ Max)</th>
					</tr>
				</thead>
				<tbody>
					{reportData.length === 0 && !loading && !error && (
						<tr>
							<td colSpan="9" className="table-empty-cell">
								No department records found.
							</td>
						</tr>
					)}
					{reportData.map((row) => {
						const hasStaff = Number(row.active_headcount) > 0;
						const budget = Number(row.allocated_budget || 150000);
						const payroll = Number(row.total_payroll || 0);
						const util = budget > 0 ? ((payroll / budget) * 100).toFixed(1) : '0.0';
						const vacancies = getVacancies(row.department_ID, row.active_headcount);
						const isHigh = Number(util) > 90;

						return (
							<tr key={row.department_ID}>
								<td><strong>{row.department_name}</strong></td>
								<td>{row.department_head || <span className="text-muted">Vacant</span>}</td>
								<td>{row.active_headcount}</td>
								<td>
									{vacancies > 0 ? (
										<span className="vacancy-open">{vacancies}</span>
									) : (
										0
									)}
								</td>
								<td>${payroll.toLocaleString()}</td>
								<td>${budget.toLocaleString()}</td>
								<td>
									<span className={isHigh ? 'util-high' : 'util-normal'}>
										{util}%
									</span>
								</td>
								<td>
									{hasStaff ? `$${Number(row.average_salary).toLocaleString()}` : <span className="text-muted">N/A</span>}
								</td>
								<td>
									{hasStaff ? (
										`$${Number(row.min_salary).toLocaleString()} – $${Number(row.max_salary).toLocaleString()}`
									) : (
										<span className="text-muted">N/A</span>
									)}
								</td>
							</tr>
						);
					})}
				</tbody>
				{reportData.length > 0 && (
					<tfoot>
						<tr>
							<th>Zoo Totals / Overall</th>
							<th>-</th>
							<th>{totalHeadcount} staff</th>
							<th>{totalVacancies} open</th>
							<th>${totalPayroll.toLocaleString()}</th>
							<th>${totalBudget.toLocaleString()}</th>
							<th>{overallUtilization}%</th>
							<th>${Number(overallAvgSalary).toLocaleString()}</th>
							<th>-</th>
						</tr>
					</tfoot>
				)}
			</table>
		</section>
	);
}

export default PayrollReport;
