import '.././App.css';
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const initialFormData = {
	first_name: '',
	minit: '',
	last_name: '',
	street_address: '',
	city: '',
	state: '',
	zip_code: '',
	country: 'USA',
	email: '',
	phone_number: '',
	department_ID: '',
	role: '',
	salary: '',
	hire_date: '',
	hours: '',
	manager_ID: '',
	attr_ID: ''
};

function AdminView() {
	const [employees, setEmployees] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [editingEmployeeId, setEditingEmployeeId] = useState(null);
	const [formData, setFormData] = useState(initialFormData);
	const [attractionsList, setAttractionsList] = useState([]);

	const fetchAdminData = () => {
		fetch(`${API_URL}/api/admin`)
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
				console.error('Error fetching admin view:', err);
				if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
					setError('Unable to connect to the backend server. Please verify the server is running.');
				} else {
					setError(`Failed to load admin view: ${err.message}`);
				}
			});
	};

	useEffect(() => {
		fetchAdminData();
		fetch(`${API_URL}/api/attractions`)
			.then((res) => (res.ok ? res.json() : []))
			.then((data) => setAttractionsList(data))
			.catch((err) => console.error('Error fetching attractions:', err));
	}, []);

	const handleChange = (e) => {
		setFormData({
			...formData,
			[e.target.name]: e.target.value
		});
	};

	const handleStartEdit = (emp) => {
		setEditingEmployeeId(emp.employee_ID);
		setShowForm(true);
		setFormData({
			first_name: emp.first_name || '',
			minit: emp.minit || '',
			last_name: emp.last_name || '',
			email: emp.email || '',
			phone_number: emp.phone_number || '',
			street_address: emp.street_address || '',
			city: emp.city || '',
			state: emp.state || '',
			zip_code: emp.zip_code || '',
			country: emp.country || 'USA',
			department_ID: emp.department_ID || '',
			role: emp.role || '',
			salary: emp.salary !== null && emp.salary !== undefined ? emp.salary : '',
			hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
			hours: emp.hours !== null && emp.hours !== undefined ? emp.hours : '',
			manager_ID: emp.manager_ID || '',
			attr_ID: ''
		});
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleCancelForm = () => {
		setShowForm(false);
		setEditingEmployeeId(null);
		setFormData(initialFormData);
	};

	const handleFormSubmit = async (e) => {
		e.preventDefault();
		setError('');

		const isEditing = Boolean(editingEmployeeId);
		const endpoint = isEditing
			? `${API_URL}/api/employees/${editingEmployeeId}`
			: `${API_URL}/api/employees`;
		const method = isEditing ? 'PUT' : 'POST';

		try {
			const res = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const data = await res.json().catch(() => ({}));

			if (res.status === 200 || res.status === 201) {
				setSuccessMsg(
					data.message ||
						(isEditing
							? `Employee ID ${editingEmployeeId} updated successfully!`
							: `Employee ${formData.first_name} added successfully!`)
				);
				fetchAdminData();
				handleCancelForm();
				setTimeout(() => setSuccessMsg(''), 4000);
			} else {
				setError(`Failed to save employee: ${data.error || `Server responded with status ${res.status}`}`);
			}
		} catch (err) {
			console.error('Error saving employee:', err);
			setError(`Connection error: ${err.message}. Please verify the server is running.`);
		}
	};

	const handleDelete = async (employeeID, employeeName) => {
		const confirmed = window.confirm(`Are you sure you want to terminate ${employeeName} (ID: ${employeeID})?`);
		if (!confirmed) return;

		try {
			const res = await fetch(`${API_URL}/api/employees/${employeeID}`, {
				method: 'DELETE'
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 200) {
				fetchAdminData();
				setSuccessMsg(data.message || `Successfully terminated ${employeeName}. Status updated to past.`);
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
				<h2> Admin View </h2>

				{error && <p style={{ color: 'red' }}><strong>Error: </strong>{error}</p>}
				{successMsg && <p style={{ color: 'green' }}><strong>Success: </strong>{successMsg}</p>}

				<div>
					{showForm ? (
						<button type="button" onClick={handleCancelForm}>
							Cancel {editingEmployeeId ? 'Editing' : 'Form'}
						</button>
					) : (
						<button
							type="button"
							onClick={() => {
								setEditingEmployeeId(null);
								setFormData(initialFormData);
								setShowForm(true);
							}}
						>
							+ Add New Employee
						</button>
					)}
				</div>

				{showForm && (
					<div>
						<h3>{editingEmployeeId ? `Edit Employee (ID: ${editingEmployeeId})` : 'Add New Employee'}</h3>
						<form onSubmit={handleFormSubmit}>
							<div>
								<label>First Name: </label>
								<input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required />
							</div>
							<div>
								<label>Middle Initial: </label>
								<input type="text" name="minit" maxLength="1" value={formData.minit} onChange={handleChange} />
							</div>
							<div>
								<label>Last Name: </label>
								<input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required />
							</div>
							<div>
								<label>Email: </label>
								<input type="email" name="email" value={formData.email} onChange={handleChange} required />
							</div>
							<div>
								<label>Phone: </label>
								<input type="text" name="phone_number" value={formData.phone_number} onChange={handleChange} />
							</div>
							<div>
								<label>Street Address: </label>
								<input type="text" name="street_address" value={formData.street_address} onChange={handleChange} required />
							</div>
							<div>
								<label>City: </label>
								<input type="text" name="city" value={formData.city} onChange={handleChange} required />
							</div>
							<div>
								<label>State: </label>
								<input type="text" name="state" value={formData.state} onChange={handleChange} required />
							</div>
							<div>
								<label>Zip Code: </label>
								<input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange} required />
							</div>
							<div>
								<label>Country: </label>
								<input type="text" name="country" value={formData.country} onChange={handleChange} required />
							</div>
							<div>
								<label>Department: </label>
								<select name="department_ID" value={formData.department_ID} onChange={handleChange} required>
									<option value="">-- Select Department --</option>
									<option value="1">1 - HR</option>
									<option value="2">2 - Animal Care</option>
									<option value="3">3 - Veterinary</option>
									<option value="4">4 - Maintenance</option>
									<option value="5">5 - Security</option>
								</select>
							</div>
							<div>
								<label>Role: </label>
								<input type="text" name="role" placeholder="e.g. Keeper" value={formData.role} onChange={handleChange} required />
							</div>
							<div>
								<label>Salary: </label>
								<input type="number" name="salary" placeholder="e.g. 50000" value={formData.salary} onChange={handleChange} required />
							</div>
							<div>
								<label>Hire Date: </label>
								<input
									type="date"
									name="hire_date"
									value={formData.hire_date}
									onChange={handleChange}
									disabled={Boolean(editingEmployeeId)}
									required
								/>
							</div>
							<div>
								<label>Weekly Hours: </label>
								<input type="number" name="hours" placeholder="e.g. 40" value={formData.hours} onChange={handleChange} />
							</div>
							<div>
								<label>Manager ID: </label>
								<input type="number" name="manager_ID" placeholder="Optional" value={formData.manager_ID} onChange={handleChange} />
							</div>
							{!editingEmployeeId && (
								<div>
									<label>Staffed at Attraction: </label>
									<select name="attr_ID" value={formData.attr_ID} onChange={handleChange}>
										<option value="">-- Unassigned --</option>
										{attractionsList.map((a) => (
											<option key={a.attr_ID} value={a.attr_ID}>
												{a.name}
											</option>
										))}
									</select>
								</div>
							)}
							<br />
							<button type="submit">
								{editingEmployeeId ? 'Save Changes' : 'Submit New Employee'}
							</button>
							&nbsp;
							<button type="button" onClick={handleCancelForm}>
								Cancel
							</button>
						</form>
						<hr />
					</div>
				)}

				<br />

				<div>
					<label><strong> Search Employee (by Name or ID): </strong></label>
					<input
						type="text"
						placeholder="e.g. Katy or 9..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				<br />

				<table border="1" cellPadding="8">
					<thead>
						<tr>
							<th>Manager Name</th>
							<th>Department</th>
							<th>Employee Name</th>
							<th>Address</th>
							<th>Email</th>
							<th>Phone Number</th>
							<th>Role</th>
							<th>Salary</th>
							<th>Hire Date</th>
							<th>Hours</th>
							<th>Status</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>
						{filteredEmployees.length > 0 ? (
							filteredEmployees.map((item, index) => (
								<tr key={index}>
									<td>{item.manager_name || 'None (Dept Head)'}</td>
									<td>{item.department_name}</td>
									<td>{item.name}</td>
									<td>{item.address}</td>
									<td>{item.email}</td>
									<td>{item.phone_number}</td>
									<td>{item.role}</td>
									<td>${Number(item.salary).toLocaleString()}</td>
									<td>{item.hire_date ? item.hire_date.split('T')[0] : ''}</td>
									<td>{item.hours}</td>
									<td>{item.employment_status}</td>
									<td>
										{item.employment_status === 'current' ? (
											<>
												<button
													type="button"
													onClick={() => handleStartEdit(item)}
												>
													Edit
												</button>
												&nbsp;
												<button
													type="button"
													onClick={() => handleDelete(item.employee_ID, item.name)}
												>
													Delete
												</button>
											</>
										) : (
											<span>Inactive</span>
										)}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="12">
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

export default AdminView;
