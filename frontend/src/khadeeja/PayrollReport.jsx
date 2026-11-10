import { useState, useEffect } from 'react';
import './PayrollReport.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function PayrollReport({ role, userEmail }) {
	const [viewMode, setViewMode] = useState('department'); // 'department' | 'employee'
	const [reportData, setReportData] = useState([]);
	const [departmentId, setDepartmentId] = useState('all');
	const [sortBy, setSortBy] = useState('payroll');
	const [timeFrame, setTimeFrame] = useState('ytd'); // 'ytd' | 'all' | 'custom'
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');
	const [minSalary, setMinSalary] = useState('');
	const [maxSalary, setMaxSalary] = useState('');
	const [empType, setEmpType] = useState('all'); // 'all' | 'full_time' | 'part_time'
	const [loading, setLoading] = useState(false);
	const [hasGenerated, setHasGenerated] = useState(false);
	const [error, setError] = useState('');
	const [showGlossary, setShowGlossary] = useState(false);

	// Paycheck Inspection Modal State
	const [selectedEmployee, setSelectedEmployee] = useState(null);
	const [employeePaychecks, setEmployeePaychecks] = useState([]);
	const [loadingPaychecks, setLoadingPaychecks] = useState(false);
	const [paycheckError, setPaycheckError] = useState('');

	const isFinHR = Number(localStorage.getItem('user_dept')) === 1;

	const targetHeadcounts = {
		1: 4,
		2: 10,
		3: 5,
		4: 4
	};

	const getVacancies = (deptID, activeCount) => {
		const target = targetHeadcounts[deptID] || Number(activeCount || 0);
		return Math.max(0, target - Number(activeCount || 0));
	};

	const greenGradient = [
		'#143d22',
		'#25633a',
		'#42a363',
		'#6cc987'
	];

	const fetchReport = () => {
		setLoading(true);
		setError('');

		const params = new URLSearchParams({
			view_mode: viewMode,
			department_id: departmentId,
			sort_by: sortBy,
			time_frame: timeFrame,
			employment_type: empType
		});

		if (timeFrame === 'custom') {
			if (startDate) params.append('start_date', startDate);
			if (endDate) params.append('end_date', endDate);
		}

		if (minSalary) params.append('min_salary', minSalary);
		if (maxSalary) params.append('max_salary', maxSalary);

		if (role === 'manager' && userEmail && !isFinHR) {
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
		if (hasGenerated) {
			fetchReport();
		}
	}, [viewMode]);

	const handleFilterSubmit = (e) => {
		e.preventDefault();
		setHasGenerated(true);
		fetchReport();
	};

	const handleResetFilters = () => {
		setDepartmentId('all');
		setTimeFrame('ytd');
		setStartDate('');
		setEndDate('');
		setMinSalary('');
		setMaxSalary('');
		setEmpType('all');
		setSortBy(viewMode === 'department' ? 'payroll' : 'career_gross');
		setHasGenerated(false);
		setReportData([]);
	};

	const handleOpenPaychecks = (emp) => {
		setSelectedEmployee(emp);
		setLoadingPaychecks(true);
		setPaycheckError('');
		setEmployeePaychecks([]);

		fetch(`${API_URL}/api/employees/${emp.employee_ID}/paychecks`)
			.then(async (res) => {
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || 'Failed to fetch paychecks.');
				}
				return res.json();
			})
			.then((data) => {
				setEmployeePaychecks(data);
				setLoadingPaychecks(false);
			})
			.catch((err) => {
				console.error('Error fetching paychecks:', err);
				setPaycheckError(err.message);
				setLoadingPaychecks(false);
			});
	};

	const handleClosePaychecks = () => {
		setSelectedEmployee(null);
		setEmployeePaychecks([]);
	};

	const handleExportCSV = () => {
		if (reportData.length === 0) {
			alert('No data to export.');
			return;
		}

		let headers = [];
		let rows = [];

		if (viewMode === 'department') {
			headers = [
				'Department Name',
				'Department Head',
				'Active Headcount',
				'Full-Time (>=35h)',
				'Part-Time (<35h)',
				'Open Vacancies (Target - Active)',
				'Annual Base Payroll ($)',
				'Period Disbursed Gross ($)',
				'Period Net Take-Home ($)',
				'Taxes Withheld ($)',
				'Benefits Deducted ($)',
				'Allocated Budget ($)',
				'Budget Utilization (%)',
				'Average Salary ($)',
				'Hourly Equivalent ($/hr)',
				'Average Tenure (Years)'
			];

			rows = reportData.map((row) => {
				const hasStaff = Number(row.active_headcount) > 0;
				const budget = Number(row.allocated_budget || 150000);
				const payroll = Number(row.total_payroll || 0);
				const util = budget > 0 ? ((payroll / budget) * 100).toFixed(1) : '0.0';
				const vacancies = getVacancies(row.department_ID, row.active_headcount);

				return [
					`"${row.department_name}"`,
					`"${row.department_head || 'Vacant'}"`,
					row.active_headcount,
					row.full_time_count || 0,
					row.part_time_count || 0,
					vacancies,
					payroll,
					Number(row.total_disbursed_gross || 0).toFixed(2),
					Number(row.total_disbursed_net || 0).toFixed(2),
					Number(row.total_taxes_withheld || 0).toFixed(2),
					Number(row.total_benefits_deducted || 0).toFixed(2),
					budget,
					`"${util}%"`,
					hasStaff ? row.average_salary : '"N/A"',
					hasStaff ? row.effective_avg_hourly_rate : '"N/A"',
					hasStaff ? row.avg_tenure_years : '"N/A"'
				];
			});
		} else {
			headers = [
				'Employee ID',
				'Name',
				'Department',
				'Role',
				'Status (FT/PT)',
				'Weekly Hours',
				'Annual Salary ($)',
				'Hourly Equivalent ($/hr)',
				'Hire Date',
				'Tenure (Years)',
				'Total Career Gross ($)',
				'Total Career Net ($)',
				'Period Gross ($)',
				'Period Net ($)',
				'Total Checks Issued',
				'Latest Pay Date'
			];

			rows = reportData.map((row) => [
				row.employee_ID,
				`"${row.name}"`,
				`"${row.department_name}"`,
				`"${row.role}"`,
				`"${row.employment_type}"`,
				row.hours,
				row.annual_salary,
				row.hourly_equivalent,
				`"${row.hire_date}"`,
				row.tenure_years,
				Number(row.career_gross || 0).toFixed(2),
				Number(row.career_net || 0).toFixed(2),
				Number(row.period_gross || 0).toFixed(2),
				Number(row.period_net || 0).toFixed(2),
				row.total_checks_count || 0,
				`"${row.latest_pay_date || 'N/A'}"`
			]);
		}

		const glossaryLines = [
			'',
			'# PAYROLL & TAX GLOSSARY REFERENCE',
			'# Gross Pay = Annual Salary / 24 semi-monthly pay periods',
			'# Pre-Tax Benefits = 3.50% deduction for medical and retirement',
			'# FICA Taxes = 7.65% (6.20% Social Security + 1.45% Medicare) mandatory federal withholding',
			'# Federal Income Tax = 12.00% effective withholding',
			'# State Income Tax = 0.00% (Texas has no state income tax)',
			'# Net Take-Home Pay = Gross Pay - Taxes - Benefits (approx. 76.85% of Gross)',
			'# Full-Time (FT) = Weekly contracted hours >= 35 | Part-Time (PT) = Weekly hours < 35',
			'# Hourly Equivalent = Annual Salary / (Contracted Hours * 52 weeks)',
			'# Budget Utilization = Annual Base Payroll / Allocated Budget * 100'
		];

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(',')), ...glossaryLines].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', `payroll_${viewMode}_report_${timeFrame}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => {
		window.print();
	};

	// Calculated Top-level KPI Aggregations
	const totalHeadcount = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.active_headcount || 0), 0)
		: reportData.length;

	const totalAnnualPayroll = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.total_payroll || 0), 0)
		: reportData.reduce((sum, r) => sum + Number(r.annual_salary || 0), 0);

	const totalDisbursedPeriod = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.total_disbursed_gross || 0), 0)
		: reportData.reduce((sum, r) => sum + Number(r.period_gross || 0), 0);

	const totalNetPeriod = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.total_disbursed_net || 0), 0)
		: reportData.reduce((sum, r) => sum + Number(r.period_net || 0), 0);

	const totalTaxesPeriod = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.total_taxes_withheld || 0), 0)
		: reportData.reduce((sum, r) => sum + Number(r.period_taxes || 0), 0);

	const totalBudget = viewMode === 'department'
		? reportData.reduce((sum, r) => sum + Number(r.allocated_budget || 150000), 0)
		: 1170000;

	const overallUtilization = totalBudget > 0
		? ((totalAnnualPayroll / totalBudget) * 100).toFixed(1)
		: '0.0';

	// Donut chart calculations for Department Summary
	const donutRadius = 150;
	const circumference = 2 * Math.PI * donutRadius;
	const strokeWidth = 54;
	const cx = 480;
	const cy = 260;
	const rOut = donutRadius + strokeWidth / 2;
	const rLine = rOut + 24;

	let donutSlices = [];
	if (viewMode === 'department' && reportData.length > 0) {
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
	}

	return (
		<section className="payroll-report">
			<h2>Department Payroll & Compensation Report</h2>
			<p>
				<strong>Reporting Period:</strong> {timeFrame === 'ytd' ? 'FY 2026 Year-To-Date' : timeFrame === 'all' ? 'All-Time Cumulative' : `Custom Range (${startDate || 'Start'} to ${endDate || 'End'})`} &nbsp;|&nbsp;
				Personnel budgets, live paycheck disbursements, and staff compensation.
			</p>

			{/* View Mode & Glossary Toggle Bar */}
			<div className="view-mode-bar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
				<div style={{ display: 'flex', gap: '8px' }}>
					<button
						type="button"
						className={`mode-btn ${viewMode === 'department' ? 'active' : ''}`}
						onClick={() => {
							setViewMode('department');
							setSortBy('payroll');
						}}
					>
						Department Summary
					</button>
					<button
						type="button"
						className={`mode-btn ${viewMode === 'employee' ? 'active' : ''}`}
						onClick={() => {
							setViewMode('employee');
							setSortBy('career_gross');
						}}
					>
						Employee Compensation
					</button>
				</div>

				<button
					type="button"
					className="btn-secondary"
					onClick={() => setShowGlossary(!showGlossary)}
					style={{ fontWeight: '600', color: '#166534' }}
				>
					{showGlossary ? 'Hide Tax & Calculation Rules' : 'Calculation & Tax Rules'}
				</button>
			</div>

			{/* Collapsible Calculation & Tax Rules Glossary */}
			{showGlossary && (
				<div className="glossary-panel">
					<div className="glossary-header">
						<h4>Calculation & Payroll Tax Breakdown</h4>
						<span style={{ fontSize: '0.85rem', color: '#64748b' }}>Accounting Reference (Texas W-2 Model)</span>
					</div>
					<div className="glossary-grid">
						<div className="glossary-item">
							<strong>Gross Pay</strong>
							Annual Salary / 24 semi-monthly periods. What the employee earns before deductions.
						</div>
						<div className="glossary-item">
							<strong>Deduction Sequence</strong>
							Taxes and benefits are subtracted directly from Gross Pay to calculate Net Pay.
						</div>
						<div className="glossary-item">
							<strong>FICA Tax (7.65%)</strong>
							Federal Insurance Contributions Act: 6.20% Social Security (OASDI) + 1.45% Medicare.
						</div>
						<div className="glossary-item">
							<strong>Federal Income Tax (12%)</strong>
							Mandatory IRS withholding deducted from gross wages.
						</div>
						<div className="glossary-item">
							<strong>Pre-Tax Benefits (3.5%)</strong>
							Health and retirement contribution deducted before final disbursement.
						</div>
						<div className="glossary-item">
							<strong>State Income Tax (0%)</strong>
							Texas has zero personal state income tax.
						</div>
						<div className="glossary-item">
							<strong>Net Pay (76.85%)</strong>
							Gross Pay − (Taxes + Benefits). The actual direct deposit transferred to employee.
						</div>
						<div className="glossary-item">
							<strong>Full-Time vs Part-Time</strong>
							Full-Time (FT): ≥35 hours/week. Part-Time (PT): &lt;35 hours/week.
						</div>
						<div className="glossary-item">
							<strong>Hourly Equivalent</strong>
							Annual Salary / (Contracted Weekly Hours × 52 weeks).
						</div>
						<div className="glossary-item">
							<strong>Budget Utilization</strong>
							(Annual Base Payroll / Approved Department Budget) × 100.
						</div>
					</div>
				</div>
			)}

			{/* Customizable Parameter Controls */}
			<form onSubmit={handleFilterSubmit} className="filters-panel">
				<div className="filters-row">
					<div className="filter-group">
						<label htmlFor="dept-select">Department:</label>
						{role === 'manager' && !isFinHR ? (
							<select id="dept-select" value={reportData[0]?.department_ID || 'all'} disabled>
								<option>{reportData[0]?.department_name || 'Your Department'}</option>
							</select>
						) : (
							<select
								id="dept-select"
								value={departmentId}
								onChange={(e) => setDepartmentId(e.target.value)}
							>
								<option value="all">All Departments (4)</option>
								<option value="1">Financial and HR</option>
								<option value="2">Animal Operations</option>
								<option value="3">Commercial Operations</option>
								<option value="4">Guest Operations</option>
							</select>
						)}
					</div>

					<div className="filter-group">
						<label htmlFor="timeframe-select">Time Frame:</label>
						<select
							id="timeframe-select"
							value={timeFrame}
							onChange={(e) => setTimeFrame(e.target.value)}
						>
							<option value="ytd">Year-to-Date (FY 2026)</option>
							<option value="all">All-Time Cumulative</option>
							<option value="custom">Custom Date Range</option>
						</select>
					</div>

					{timeFrame === 'custom' && (
						<>
							<div className="filter-group">
								<label htmlFor="start-date">From:</label>
								<input
									type="date"
									id="start-date"
									value={startDate}
									onChange={(e) => setStartDate(e.target.value)}
								/>
							</div>
							<div className="filter-group">
								<label htmlFor="end-date">To:</label>
								<input
									type="date"
									id="end-date"
									value={endDate}
									onChange={(e) => setEndDate(e.target.value)}
								/>
							</div>
						</>
					)}

					<div className="filter-group">
						<label htmlFor="type-select">Staffing:</label>
						<select
							id="type-select"
							value={empType}
							onChange={(e) => setEmpType(e.target.value)}
						>
							<option value="all">All Staff Types</option>
							<option value="full_time">Full-Time (≥35 hrs)</option>
							<option value="part_time">Part-Time (&lt;35 hrs)</option>
						</select>
					</div>
				</div>

				<div className="filters-row">
					<div className="filter-group">
						<label htmlFor="min-sal">Min Salary ($):</label>
						<input
							type="number"
							id="min-sal"
							placeholder="e.g. 40000"
							value={minSalary}
							onChange={(e) => setMinSalary(e.target.value)}
							style={{ width: '110px' }}
						/>
					</div>

					<div className="filter-group">
						<label htmlFor="max-sal">Max Salary ($):</label>
						<input
							type="number"
							id="max-sal"
							placeholder="e.g. 70000"
							value={maxSalary}
							onChange={(e) => setMaxSalary(e.target.value)}
							style={{ width: '110px' }}
						/>
					</div>

					<div className="filter-group">
						<label htmlFor="sort-select">Sort By:</label>
						{viewMode === 'department' ? (
							<select
								id="sort-select"
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
							>
								<option value="payroll">Annual Base Payroll</option>
								<option value="disbursed">Gross Paid in Period</option>
								<option value="headcount">Staff Headcount</option>
								<option value="avg_salary">Average Salary</option>
								<option value="budget">Payroll Budget</option>
								<option value="name">Department Name</option>
							</select>
						) : (
							<select
								id="sort-select"
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
							>
								<option value="career_gross">Total Career Gross Earned</option>
								<option value="period_gross">Gross Paid in Period</option>
								<option value="payroll">Annual Salary</option>
								<option value="checks">Checks Issued Count</option>
								<option value="tenure">Tenure (Years)</option>
								<option value="name">Employee Name</option>
								<option value="dept">Department Name</option>
							</select>
						)}
					</div>

					<button type="submit" disabled={loading}>
						{loading ? 'Generating...' : 'Generate Report'}
					</button>

					<button type="button" className="btn-secondary" onClick={handleResetFilters}>
						Reset
					</button>
				</div>
			</form>

			{error && <p role="alert" className="payroll-error">{error}</p>}

			{!hasGenerated ? (
				<div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', margin: '20px 0', color: '#64748b' }}>
					<p style={{ fontSize: '1.02rem', margin: 0 }}>
						Select your parameters above and click <strong>Generate Report</strong> to view payroll data.
					</p>
				</div>
			) : (
				<>
					{/* KPI Summary Cards */}
					<div className="payroll-kpi-grid">
						<div className="kpi-card">
							<div className="kpi-title">Annual Base Payroll</div>
							<div className="kpi-value">${totalAnnualPayroll.toLocaleString()}</div>
							<div className="kpi-subtext">{totalHeadcount} Active Personnel</div>
						</div>
						<div className="kpi-card">
							<div className="kpi-title">Gross Disbursed</div>
							<div className="kpi-value" style={{ color: '#166534' }}>
								${Number(totalDisbursedPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</div>
							<div className="kpi-subtext">Paychecks Issued (Gross)</div>
						</div>
						<div className="kpi-card">
							<div className="kpi-title">Net Disbursed</div>
							<div className="kpi-value" style={{ color: '#0369a1' }}>
								${Number(totalNetPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</div>
							<div className="kpi-subtext">Take-Home Pay (~76.85%)</div>
						</div>
						<div className="kpi-card">
							<div className="kpi-title">Withholdings</div>
							<div className="kpi-value" style={{ color: '#854d0e' }}>
								${Number(totalTaxesPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
							</div>
							<div className="kpi-subtext">Taxes (19.65%) + Benefits (3.5%)</div>
						</div>
						<div className="kpi-card">
							<div className="kpi-title">Budget Utilization</div>
							<div className="kpi-value" style={{ color: Number(overallUtilization) > 90 ? '#b91c1c' : '#0f172a' }}>
								{overallUtilization}%
							</div>
							<div className="kpi-subtext">Reserve: ${(totalBudget - totalAnnualPayroll).toLocaleString()}</div>
						</div>
					</div>

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

			{/* Department Visual Donut Chart */}
			{viewMode === 'department' && reportData.length > 0 && (
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

			{/* VIEW 1: Department Summary Table */}
			{viewMode === 'department' && (
				<table className="payroll-table">
					<thead>
						<tr>
							<th>Department</th>
							<th>Head</th>
							<th>Staff (FT / PT)</th>
							<th>Vacancies</th>
							<th>Annual Base</th>
							<th>Gross Paid</th>
							<th>Net Paid</th>
							<th>Withheld</th>
							<th>Budget</th>
							<th>Util %</th>
							<th>Avg Salary (Hourly)</th>
						</tr>
					</thead>
					<tbody>
						{reportData.length === 0 && !loading && !error && (
							<tr>
								<td colSpan="11" className="table-empty-cell">
									No department records matching your filter criteria.
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
									<td>
										{row.active_headcount} &nbsp;
										<span className="text-muted" style={{ fontSize: '0.8rem' }}>
											({row.full_time_count} FT / {row.part_time_count} PT)
										</span>
									</td>
									<td>
										{vacancies > 0 ? (
											<span className="vacancy-open">{vacancies}</span>
										) : (
											0
										)}
									</td>
									<td>${payroll.toLocaleString()}</td>
									<td style={{ color: '#166534', fontWeight: '600' }}>
										${Number(row.total_disbursed_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</td>
									<td style={{ color: '#0369a1' }}>
										${Number(row.total_disbursed_net || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</td>
									<td>
										${(Number(row.total_taxes_withheld || 0) + Number(row.total_benefits_deducted || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</td>
									<td>${budget.toLocaleString()}</td>
									<td>
										<span className={isHigh ? 'util-high' : 'util-normal'}>
											{util}%
										</span>
									</td>
									<td>
										{hasStaff ? (
											<>
												${Number(row.average_salary).toLocaleString()}
												<span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>
													${row.effective_avg_hourly_rate}/hr
												</span>
											</>
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
								<th>Zoo Totals</th>
								<th>-</th>
								<th>{totalHeadcount} staff</th>
								<th>
									{reportData.reduce((sum, r) => sum + getVacancies(r.department_ID, r.active_headcount), 0)} open
								</th>
								<th>${totalAnnualPayroll.toLocaleString()}</th>
								<th style={{ color: '#166534' }}>
									${Number(totalDisbursedPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</th>
								<th style={{ color: '#0369a1' }}>
									${Number(totalNetPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</th>
								<th>
									${(Number(totalTaxesPeriod) + reportData.reduce((sum, r) => sum + Number(r.total_benefits_deducted || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</th>
								<th>${totalBudget.toLocaleString()}</th>
								<th>{overallUtilization}%</th>
								<th>-</th>
							</tr>
						</tfoot>
					)}
				</table>
			)}

			{/* VIEW 2: Employee Compensation Table */}
			{viewMode === 'employee' && (
				<table className="payroll-table">
					<thead>
						<tr>
							<th>Employee</th>
							<th>Department</th>
							<th>Role</th>
							<th>Status</th>
							<th>Annual Salary</th>
							<th>Hourly Rate</th>
							<th>Tenure</th>
							<th>Period Gross</th>
							<th>Career Gross</th>
							<th>Checks Issued</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{reportData.length === 0 && !loading && !error && (
							<tr>
								<td colSpan="11" className="table-empty-cell">
									No employee records matching your filter criteria.
								</td>
							</tr>
						)}
						{reportData.map((emp) => (
							<tr key={emp.employee_ID}>
								<td>
									<strong>{emp.name}</strong>
									<span className="text-muted" style={{ display: 'block', fontSize: '0.8rem' }}>
										ID: {emp.employee_ID}
									</span>
								</td>
								<td>{emp.department_name}</td>
								<td>{emp.role}</td>
								<td>
									<span className={`status-badge ${emp.employment_type === 'Full-Time' ? 'paid' : 'pending'}`}>
										{emp.employment_type} ({emp.hours}h)
									</span>
								</td>
								<td>${Number(emp.annual_salary).toLocaleString()}</td>
								<td>${emp.hourly_equivalent}/hr</td>
								<td>
									{emp.tenure_years} yrs
									<span className="text-muted" style={{ display: 'block', fontSize: '0.78rem' }}>
										Hired: {emp.hire_date}
									</span>
								</td>
								<td style={{ color: '#166534', fontWeight: '600' }}>
									${Number(emp.period_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
								<td style={{ color: '#0f172a', fontWeight: '600' }}>
									${Number(emp.career_gross || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
								</td>
								<td>
									{emp.total_checks_count} checks
									<span className="text-muted" style={{ display: 'block', fontSize: '0.78rem' }}>
										Last: {emp.latest_pay_date || 'N/A'}
									</span>
								</td>
								<td>
									<button
										type="button"
										className="btn-secondary"
										style={{ fontSize: '0.82rem', padding: '4px 8px' }}
										onClick={() => handleOpenPaychecks(emp)}
									>
										View Paychecks
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	)}

			{/* Modal for Paycheck Inspection with Step-by-Step Gross-to-Net Breakdown */}
			{selectedEmployee && (
				<div className="modal-overlay" onClick={handleClosePaychecks}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<div>
								<h3>Paycheck History: {selectedEmployee.name}</h3>
								<span className="text-muted">
									{selectedEmployee.role} — {selectedEmployee.department_name} | Annual: ${Number(selectedEmployee.annual_salary).toLocaleString()} (${selectedEmployee.hourly_equivalent}/hr)
								</span>
							</div>
							<button type="button" className="modal-close-btn" onClick={handleClosePaychecks}>
								&times;
							</button>
						</div>

						<div className="modal-body">
							{loadingPaychecks && <p>Loading paychecks ledger...</p>}
							{paycheckError && <p role="alert" className="payroll-error">{paycheckError}</p>}

							{!loadingPaychecks && !paycheckError && employeePaychecks.length === 0 && (
								<p className="table-empty-cell">No paychecks recorded yet for this employee.</p>
							)}

							{!loadingPaychecks && employeePaychecks.length > 0 && (
								<>
									<div style={{ marginBottom: '12px', fontSize: '0.82rem', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
										<strong>Deduction Sequence:</strong> Gross Pay → Benefits (3.5% Pre-Tax) → Federal Tax (12%) → FICA: Social Security (6.2%) + Medicare (1.45%) → State Tax (0% TX) → Net Pay (76.85%).
									</div>
									<table className="payroll-table">
										<thead>
											<tr>
												<th>Check #</th>
												<th>Period</th>
												<th>Pay Date</th>
												<th>Gross Pay</th>
												<th>Benefits (3.5%)</th>
												<th>Federal (12%)</th>
												<th>SS (6.2%)</th>
												<th>Med (1.45%)</th>
												<th>State (0%)</th>
												<th>Net Pay</th>
												<th>Status</th>
											</tr>
										</thead>
										<tbody>
											{employeePaychecks.map((chk) => (
												<tr key={chk.paycheck_ID}>
													<td>#{chk.paycheck_ID}</td>
													<td>{chk.pay_period_start} to {chk.pay_period_end}</td>
													<td><strong>{chk.payment_date}</strong></td>
													<td style={{ fontWeight: '600' }}>
														${Number(chk.gross_pay).toFixed(2)}
													</td>
													<td className="text-muted">${Number(chk.benefits_deduction).toFixed(2)}</td>
													<td className="text-muted">${Number(chk.federal_tax).toFixed(2)}</td>
													<td className="text-muted">${Number(chk.social_security || (Number(chk.gross_pay) * 0.062)).toFixed(2)}</td>
													<td className="text-muted">${Number(chk.medicare || (Number(chk.gross_pay) * 0.0145)).toFixed(2)}</td>
													<td className="text-muted">$0.00</td>
													<td style={{ color: '#0369a1', fontWeight: 'bold' }}>
														${Number(chk.net_pay).toFixed(2)}
													</td>
													<td>
														<span className={`status-badge ${chk.status}`}>
															{chk.status}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</section>
	);
}

export default PayrollReport;
