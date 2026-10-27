import '.././App.css';
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function EmpView() {
	const [employees, setEmployees] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		fetch(`${API_URL}/api/employees`)
			.then(async (res) => {
				if (!res.ok) {
					const errBody = await res.json().catch(() => ({}));
					throw new Error(errBody.error || `Server responded with HTTP status ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				setEmployees(data);
				setError('');
			})
			.catch((err) => {
				console.error('Error fetching employees:', err);
				if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
					setError('Unable to connect to the backend server. Please verify the server is running.');
				} else {
					setError(`Failed to load employee directory: ${err.message}`);
				}
			});
	}, []);

	const filteredEmployees = employees.filter((emp) => {
		const term = searchTerm.trim().toLowerCase();
		if (!term) return true;
		const matchesName = emp.name ? emp.name.toLowerCase().includes(term) : false;
		const matchesID = emp.employee_ID ? emp.employee_ID.toString() === term || emp.employee_ID.toString().includes(term) : false;
		return matchesName || matchesID;
	});

	return (
		<>
			<div>
				<h2> Super Cool Employee View </h2>

				{error && (
					<div style={{
						color: '#721c24',
						backgroundColor: '#f8d7da',
						border: '1px solid #f5c6cb',
						padding: '12px',
						borderRadius: '4px',
						marginBottom: '15px'
					}}>
						<strong>Connection Error: </strong>{error}
					</div>
				)}

				<div style={{ marginBottom: '15px' }}>
					<label><strong> Search Employee (by Name or ID): </strong></label>
					<input
						type="text"
						placeholder="e.g. Katy or 9..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				<table border="1" cellPadding="8">
					<thead>
						<tr>
							<th>ID</th>
							<th>Name</th>
							<th>Department</th>
							<th>Role</th>
							<th>Email</th>
							<th>Phone</th>
						</tr>
					</thead>
					<tbody>
						{filteredEmployees.length > 0 ? (
							filteredEmployees.map((emp, index) => (
								<tr key={index}>
									<td>{emp.employee_ID}</td>
									<td>{emp.name}</td>
									<td>{emp.department_name}</td>
									<td>{emp.role}</td>
									<td>{emp.email}</td>
									<td>{emp.phone_number}</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="6" style={{ textAlign: 'center', padding: '15px' }}>
									{error ? 'Could not load data due to an error.' : `No employees found matching "${searchTerm}". Try checking the spelling or entering an ID.`}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</>
	);
}

export default EmpView;
