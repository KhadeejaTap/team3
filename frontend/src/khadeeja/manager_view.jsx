import '.././App.css';
import { useState, useEffect } from 'react';

function MgrView() {
	const [employees, setEmployees] = useState([]);
	const [attractionsList, setAttractionsList] = useState([]);
	const [selectedDept, setSelectedDept] = useState('');
	const [selectedAttr, setSelectedAttr] = useState('');
	const [searchTerm, setSearchTerm] = useState('');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');

	const fetchManagerData = () => {
		fetch('http://localhost:5000/api/manager')
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
				console.error('Error fetching manager view:', err);
				if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
					setError('Unable to connect to the backend server at localhost:5000. Please verify the server is running.');
				} else {
					setError(`Failed to load manager view: ${err.message}`);
				}
			});
	};

	const fetchAttractions = () => {
		fetch('http://localhost:5000/api/attractions')
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setAttractionsList(data))
			.catch((err) => console.error('Error loading attractions list:', err));
	};

	useEffect(() => {
		fetchManagerData();
		fetchAttractions();
	}, []);

	const handleDelete = async (employeeID, employeeName) => {
		const confirmed = window.confirm(`Are you sure you want to terminate ${employeeName} (ID: ${employeeID})?`);
		if (!confirmed) return;

		try {
			const res = await fetch(`http://localhost:5000/api/employees/${employeeID}`, {
				method: 'DELETE'
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 200) {
				setEmployees((prev) => prev.filter((emp) => emp.employee_ID !== employeeID));
				setSuccessMsg(data.message || `Successfully terminated ${employeeName}.`);
				setError('');
				setTimeout(() => setSuccessMsg(''), 4000);
			} else {
				setError(`Failed to delete employee: ${data.error || `Server responded with status ${res.status}`}`);
			}
		} catch (err) {
			console.error('Error deleting employee:', err);
			setError(`Connection error while deleting: ${err.message}. Please check if the server is running.`);
		}
	};

	const handleAssign = async (employeeID, attrID) => {
		if (!attrID) return;
		try {
			const res = await fetch('http://localhost:5000/api/staffed-at', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ employee_ID: employeeID, attr_ID: Number(attrID) })
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 201) {
				setSuccessMsg('Attraction assigned successfully.');
				setError('');
				fetchManagerData();
				setTimeout(() => setSuccessMsg(''), 4000);
			} else {
				setError(`Failed to assign: ${data.error || `HTTP ${res.status}`}`);
			}
		} catch (err) {
			console.error('Assign error:', err);
			setError(`Connection error: ${err.message}`);
		}
	};

	const filteredEmployees = employees.filter((emp) => {
		// 1. Department filter
		const matchesDept = selectedDept === '' || emp.department_name === selectedDept;

		// 2. Attraction filter
		let matchesAttr = true;
		if (selectedAttr === 'Unassigned') {
			matchesAttr = !emp.attractions || emp.attractions === 'Unassigned';
		} else if (selectedAttr !== '') {
			matchesAttr = emp.attractions && emp.attractions.includes(selectedAttr);
		}

		// 3. Search filter
		const term = searchTerm.trim().toLowerCase();
		const matchesSearch =
			!term ||
			(emp.name && emp.name.toLowerCase().includes(term)) ||
			(emp.employee_ID && emp.employee_ID.toString().includes(term)) ||
			(emp.role && emp.role.toLowerCase().includes(term));

		return matchesDept && matchesAttr && matchesSearch;
	});

	return (
		<>
			<div>
				<h2> Manager View </h2>

				{error && <p style={{ color: 'red' }}><strong>Error: </strong>{error}</p>}
				{successMsg && <p style={{ color: 'green' }}><strong>Success: </strong>{successMsg}</p>}

				<div>
					<label><strong>Filter by Department: </strong></label>
					<select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
						<option value="">All Departments</option>
						<option value="HR">HR</option>
						<option value="Animal Care">Animal Care</option>
						<option value="Veterinary">Veterinary</option>
						<option value="Maintenance">Maintenance</option>
						<option value="Security">Security</option>
					</select>

					&nbsp;&nbsp;&nbsp;

					<label><strong>Filter by Attraction: </strong></label>
					<select value={selectedAttr} onChange={(e) => setSelectedAttr(e.target.value)}>
						<option value="">All Attractions</option>
						<option value="Unassigned">Unassigned</option>
						{attractionsList.map((a) => (
							<option key={a.attr_ID} value={a.name}>
								{a.name}
							</option>
						))}
					</select>
				</div>

				<br />

				<div>
					<label><strong> Search Employee (by Name, ID, or Role): </strong></label>
					<input
						type="text"
						placeholder="e.g. Katy, 9, or Keeper..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				<br />

				<table border="1" cellPadding="8">
					<thead>
						<tr>
							<th>Dept Head</th>
							<th>Department</th>
							<th>Employee Name</th>
							<th>Role</th>
							<th>Assigned Attractions</th>
							<th>Billing Address</th>
							<th>Email</th>
							<th>Phone</th>
							<th>Salary</th>
							<th>Hire Date</th>
							<th>Weekly Hours</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{filteredEmployees.length > 0 ? (
							filteredEmployees.map((item, index) => (
								<tr key={index}>
									<td>{item.head_of_dept}</td>
									<td>{item.department_name}</td>
									<td>{item.name}</td>
									<td>{item.role}</td>
									<td><strong>{item.attractions}</strong></td>
									<td>{item.address}</td>
									<td>{item.email}</td>
									<td>{item.phone_number}</td>
									<td>${Number(item.salary).toLocaleString()}</td>
									<td>{item.hire_date ? item.hire_date.split('T')[0] : ''}</td>
									<td>{item.hours}</td>
									<td>
										<button onClick={() => handleDelete(item.employee_ID, item.name)}>
											Delete
										</button>
										&nbsp;
										<select
											value=""
											onChange={(e) => handleAssign(item.employee_ID, e.target.value)}
										>
											<option value="" disabled>+ Assign Attraction</option>
											{attractionsList.map((a) => (
												<option key={a.attr_ID} value={a.attr_ID}>
													{a.name}
												</option>
											))}
										</select>
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="12">
									{error
										? 'Could not load data due to an error.'
										: 'No employees found matching the current filters.'}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</>
	);
}

export default MgrView;
