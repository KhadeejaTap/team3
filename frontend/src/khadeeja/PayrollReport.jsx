import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function PayrollReport() {
	const [reportData, setReportData] = useState([]);
	const [departmentId, setDepartmentId] = useState('all');
	const [sortBy, setSortBy] = useState('payroll');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const fetchReport = () => {
		setLoading(true);
		setError('');

		const params = new URLSearchParams({
			department_id: departmentId,
			sort_by: sortBy
		});

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
			'Department ID',
			'Department Name',
			'Department Head',
			'Active Headcount',
			'Total Payroll ($)',
			'Average Salary ($)',
			'Min Salary ($)',
			'Max Salary ($)'
		];

		const rows = reportData.map((row) => [
			row.department_ID,
			`"${row.department_name}"`,
			`"${row.department_head || 'None'}"`,
			row.active_headcount,
			row.total_payroll,
			row.average_salary,
			row.min_salary,
			row.max_salary
		]);

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'department_payroll_report.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => {
		window.print();
	};

	// Calculate totals for the summary footer row
	const totalHeadcount = reportData.reduce((sum, r) => sum + Number(r.active_headcount || 0), 0);
	const totalPayroll = reportData.reduce((sum, r) => sum + Number(r.total_payroll || 0), 0);
	const overallAvgSalary =
		totalHeadcount > 0 ? (totalPayroll / totalHeadcount).toFixed(2) : '0.00';

	return (
		<div>
			<h2>Department Payroll & Headcount Summary</h2>
			<p>View aggregated payroll expense and active headcount grouped by department.</p>

			{/* Filter Controls */}
			<form onSubmit={handleFilterSubmit}>
				<label htmlFor="dept-select">Department: </label>
				<select
					id="dept-select"
					value={departmentId}
					onChange={(e) => setDepartmentId(e.target.value)}
				>
					<option value="all">All Departments</option>
					<option value="1">HR (1)</option>
					<option value="2">Animal Care (2)</option>
					<option value="3">Veterinary (3)</option>
					<option value="4">Maintenance (4)</option>
					<option value="5">Security (5)</option>
				</select>
				&nbsp;&nbsp;

				<label htmlFor="sort-select">Sort By: </label>
				<select
					id="sort-select"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value)}
				>
					<option value="payroll">Total Payroll (High to Low)</option>
					<option value="headcount">Headcount (High to Low)</option>
					<option value="avg_salary">Average Salary (High to Low)</option>
					<option value="name">Department Name (A to Z)</option>
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
						<th>Dept ID</th>
						<th>Department Name</th>
						<th>Department Head</th>
						<th>Active Headcount</th>
						<th>Total Payroll ($)</th>
						<th>Average Salary ($)</th>
						<th>Min Salary ($)</th>
						<th>Max Salary ($)</th>
					</tr>
				</thead>
				<tbody>
					{reportData.length === 0 && !loading && !error && (
						<tr>
							<td colSpan="8">No records found.</td>
						</tr>
					)}
					{reportData.map((row) => (
						<tr key={row.department_ID}>
							<td>{row.department_ID}</td>
							<td>{row.department_name}</td>
							<td>{row.department_head || 'None'}</td>
							<td>{row.active_headcount}</td>
							<td>${Number(row.total_payroll).toLocaleString()}</td>
							<td>${Number(row.average_salary).toLocaleString()}</td>
							<td>${Number(row.min_salary).toLocaleString()}</td>
							<td>${Number(row.max_salary).toLocaleString()}</td>
						</tr>
					))}
				</tbody>
				{reportData.length > 0 && (
					<tfoot>
						<tr>
							<th colSpan="3">Zoo Total / Overall Average</th>
							<th>{totalHeadcount}</th>
							<th>${totalPayroll.toLocaleString()}</th>
							<th>${Number(overallAvgSalary).toLocaleString()}</th>
							<th>-</th>
							<th>-</th>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

export default PayrollReport;
