import '.././App.css';
import { useState, useEffect } from 'react';
import EmpView from './employee_view';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function MgrView({ userEmail }) {
	const [activeTab, setActiveTab] = useState('team');
	const [employees, setEmployees] = useState([]);
	const [attractionsList, setAttractionsList] = useState([]);
	const [selectedDept, setSelectedDept] = useState('');
	const [selectedAttr, setSelectedAttr] = useState('');
	const [searchTerm, setSearchTerm] = useState('');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');
	const [editingId, setEditingId] = useState(null);
	const [editFormData, setEditFormData] = useState({});

	const managerDept = employees.length > 0 ? employees[0].department_name : '';
	const isAttractionsDept = managerDept === 'Events & Attractions' || managerDept === 'Animal Care';

	const fetchManagerData = () => {
		const endpoint = userEmail
			? `${API_URL}/api/manager?email=${encodeURIComponent(userEmail)}`
			: `${API_URL}/api/manager`;

		fetch(endpoint)
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
					setError('Unable to connect to the backend server. Please verify the server is running.');
				} else {
					setError(`Failed to load manager view: ${err.message}`);
				}
			});
	};

	const fetchAttractions = () => {
		fetch(`${API_URL}/api/attractions`)
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setAttractionsList(data))
			.catch((err) => console.error('Error loading attractions list:', err));
	};

	useEffect(() => {
		fetchManagerData();
		fetchAttractions();
	}, [userEmail]);

	const handleDelete = async (employeeID, employeeName) => {
		const confirmed = window.confirm(`Are you sure you want to terminate ${employeeName} (ID: ${employeeID})?`);
		if (!confirmed) return;

		try {
			const res = await fetch(`${API_URL}/api/employees/${employeeID}`, {
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
			const res = await fetch(`${API_URL}/api/staffed-at`, {
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

	const handleStartEdit = (emp) => {
		setEditingId(emp.employee_ID);
		setEditFormData({
			role: emp.role || '',
			phone_number: emp.phone_number || '',
			salary: emp.salary || '',
			hours: emp.hours || ''
		});
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setEditFormData({});
	};

	const handleSaveEdit = async (employeeID) => {
		try {
			const res = await fetch(`${API_URL}/api/employees/${employeeID}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					role: editFormData.role,
					phone_number: editFormData.phone_number,
					salary: editFormData.salary !== '' ? Number(editFormData.salary) : null,
					hours: editFormData.hours !== '' ? Number(editFormData.hours) : null
				})
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 200) {
				setSuccessMsg(data.message || `Employee ID ${employeeID} updated successfully.`);
				setError('');
				setEditingId(null);
				setEditFormData({});
				fetchManagerData();
				setTimeout(() => setSuccessMsg(''), 4000);
			} else {
				setError(`Failed to update employee: ${data.error || `HTTP ${res.status}`}`);
			}
		} catch (err) {
			console.error('Update error:', err);
			setError(`Connection error while updating: ${err.message}`);
		}
	};

	const filteredEmployees = employees.filter((emp) => {
		const matchesDept = !managerDept || emp.department_name === managerDept;

		let matchesAttr = true;
		if (selectedAttr === 'Unassigned') {
			matchesAttr = !emp.attractions || emp.attractions === 'Unassigned';
		} else if (selectedAttr !== '') {
			matchesAttr = emp.attractions && emp.attractions.includes(selectedAttr);
		}

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
				<h2>{managerDept ? `${managerDept} Department Hub` : 'Department Manager Hub'}</h2>
				<p style={{ color: '#555' }}>
					{isAttractionsDept
						? `Overseeing active staff, schedules, and exhibit attraction assignments for ${managerDept || 'your department'}.`
						: `Overseeing active staff, schedules, and operations for ${managerDept || 'your department'}.`}
				</p>

				<div>
					<button type="button" onClick={() => setActiveTab('team')}>
						{activeTab === 'team' ? <strong>My Team</strong> : 'My Team'}
					</button>
					&nbsp;
					<button type="button" onClick={() => setActiveTab('directory')}>
						{activeTab === 'directory' ? <strong>Zoo Directory</strong> : 'Zoo Directory'}
					</button>
				</div>

				<br />

				{activeTab === 'directory' ? (
					<EmpView />
				) : (
					<div>
						{error && <p style={{ color: 'red' }}><strong>Error: </strong>{error}</p>}
						{successMsg && <p style={{ color: 'green' }}><strong>Success: </strong>{successMsg}</p>}

						<div>
							<label><strong>Department: </strong></label>
							<select value={managerDept} disabled>
								<option value={managerDept}>{managerDept || 'Loading department...'}</option>
							</select>
							<span style={{ marginLeft: '8px', fontSize: '0.9em', color: '#666' }}>
								(Locked to your department)
							</span>

							{isAttractionsDept && (
								<>
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
								</>
							)}
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
									{isAttractionsDept && <th>Assigned Attractions</th>}
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
											<td>
												{editingId === item.employee_ID ? (
													<input
														type="text"
														value={editFormData.role}
														onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
													/>
												) : (
													item.role
												)}
											</td>
											{isAttractionsDept && <td><strong>{item.attractions}</strong></td>}
											<td>{item.address}</td>
											<td>{item.email}</td>
											<td>
												{editingId === item.employee_ID ? (
													<input
														type="text"
														value={editFormData.phone_number}
														onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
													/>
												) : (
													item.phone_number
												)}
											</td>
											<td>
												{editingId === item.employee_ID ? (
													<input
														type="number"
														value={editFormData.salary}
														onChange={(e) => setEditFormData({ ...editFormData, salary: e.target.value })}
													/>
												) : (
													`$${Number(item.salary).toLocaleString()}`
												)}
											</td>
											<td>{item.hire_date ? item.hire_date.split('T')[0] : ''}</td>
											<td>
												{editingId === item.employee_ID ? (
													<input
														type="number"
														value={editFormData.hours}
														onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
													/>
												) : (
													item.hours
												)}
											</td>
											<td>
												{editingId === item.employee_ID ? (
													<>
														<button type="button" onClick={() => handleSaveEdit(item.employee_ID)}>
															Save
														</button>
														&nbsp;
														<button type="button" onClick={handleCancelEdit}>
															Cancel
														</button>
													</>
												) : (
													<>
														<button type="button" onClick={() => handleStartEdit(item)}>
															Edit
														</button>
														&nbsp;
														<button type="button" onClick={() => handleDelete(item.employee_ID, item.name)}>
															Delete
														</button>
														{isAttractionsDept && (
															<>
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
															</>
														)}
													</>
												)}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={isAttractionsDept ? 12 : 11} style={{ textAlign: 'center', padding: '2rem' }}>
											{error ? (
												<span style={{ color: 'red' }}>Error loading data: {error}</span>
											) : searchTerm.trim() ? (
												<span>No team members found matching <strong>"{searchTerm}"</strong>. Check the spelling or employee ID.</span>
											) : selectedAttr ? (
												<span>No team members in {managerDept || 'your department'} currently assigned to <strong>"{selectedAttr}"</strong>.</span>
											) : (
												<span>No active employees currently found for {managerDept || 'your department'}.</span>
											)}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</>
	);
}

export default MgrView;
