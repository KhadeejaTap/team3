import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function SpeciesReport({ role, userEmail }) {
	const [reportData, setReportData] = useState([]);
	const [statusFilter, setStatusFilter] = useState('all');
	const [sortBy, setSortBy] = useState('population_desc');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [accessDenied, setAccessDenied] = useState(false);

	const fetchReport = () => {
		setLoading(true);
		setError('');
		setAccessDenied(false);

		const params = new URLSearchParams({
			status: statusFilter,
			sort_by: sortBy
		});

		if (userEmail) {
			params.append('email', userEmail);
		}

		fetch(`${API_URL}/api/reports/species?${params.toString()}`)
			.then(async (res) => {
				if (res.status === 403) {
					setAccessDenied(true);
					throw new Error('Access restricted to Zoo Administrators, Animal Care, and Veterinary personnel.');
				}
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
				setError(err.message);
				setLoading(false);
			});
	};

	useEffect(() => {
		fetchReport();
	}, [userEmail]);

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
			'Species ID',
			'Common Name',
			'Scientific Name',
			'Conservation Status',
			'Total Population',
			'Average Age',
			'Active Breeding'
		];

		const rows = reportData.map((row) => [
			row.species_ID,
			`"${row.common_name}"`,
			`"${row.scientific_name || 'N/A'}"`,
			`"${row.endangered_status || 'Unknown'}"`,
			row.total_count,
			row.average_age,
			row.breeding_count
		]);

		const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.setAttribute('download', 'species_population_report.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handlePrintPDF = () => {
		window.print();
	};

	if (accessDenied) {
		return (
			<div>
				<h2>Access Denied</h2>
				<p>This report is restricted to Zoo Administrators, Animal Care staff, and Veterinary personnel.</p>
			</div>
		);
	}

	// Summary totals
	const totalAnimals = reportData.reduce((sum, r) => sum + Number(r.total_count || 0), 0);
	const totalBreeding = reportData.reduce((sum, r) => sum + Number(r.breeding_count || 0), 0);

	return (
		<div>
			<h2>Species Population & Conservation Status</h2>
			<p>Aggregated wildlife inventory, population counts, and conservation risk tracking.</p>

			{/* Filter Form */}
			<form onSubmit={handleFilterSubmit}>
				<label htmlFor="status-select">Conservation Status: </label>
				<select
					id="status-select"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
				>
					<option value="all">All Statuses</option>
					<option value="Critically Endangered">Critically Endangered</option>
					<option value="Endangered">Endangered</option>
					<option value="Vulnerable">Vulnerable</option>
					<option value="Near Threatened">Near Threatened</option>
					<option value="Least Concern">Least Concern</option>
				</select>
				&nbsp;&nbsp;

				<label htmlFor="sort-select">Sort By: </label>
				<select
					id="sort-select"
					value={sortBy}
					onChange={(e) => setSortBy(e.target.value)}
				>
					<option value="population_desc">Population (High to Low)</option>
					<option value="population_asc">Rarest First (Low to High)</option>
					<option value="avg_age">Average Age (High to Low)</option>
					<option value="name">Species Name (A to Z)</option>
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

			{error && !accessDenied && <p role="alert">{error}</p>}

			{/* Data Table */}
			<table border="1" cellPadding="6" cellSpacing="0">
				<thead>
					<tr>
						<th>Species ID</th>
						<th>Common Name</th>
						<th>Scientific Name</th>
						<th>Conservation Status</th>
						<th>Total Population</th>
						<th>Average Age</th>
						<th>Active Breeding</th>
					</tr>
				</thead>
				<tbody>
					{reportData.length === 0 && !loading && !error && (
						<tr>
							<td colSpan="7">No species records found.</td>
						</tr>
					)}
					{reportData.map((row) => (
						<tr key={row.species_ID}>
							<td>{row.species_ID}</td>
							<td><strong>{row.common_name}</strong></td>
							<td><em>{row.scientific_name || 'N/A'}</em></td>
							<td>{row.endangered_status || 'Unknown'}</td>
							<td>{row.total_count}</td>
							<td>{row.average_age} yrs</td>
							<td>{row.breeding_count}</td>
						</tr>
					))}
				</tbody>
				{reportData.length > 0 && (
					<tfoot>
						<tr>
							<th colSpan="4">Zoo Totals ({reportData.length} Species)</th>
							<th>{totalAnimals}</th>
							<th>-</th>
							<th>{totalBreeding}</th>
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

export default SpeciesReport;
