import '.././App.css';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const initialFormData = {
	first_name: '',
	minit: '',
	ssn: '',
	last_name: '',
	sex: 'M',
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
	is_dept_head: false,
	attr_ID: '',
	user_role: 'employee'
};

function formatDate(value) {
	if (!value) return '—';
	const [year, month, day] = String(value).slice(0, 10).split('-');
	return `${month}/${day}/${year}`;
}

function AdminView({ isDirector, isFinHR }) {
	const userDept = Number(localStorage.getItem('user_dept'));
	const isDeptHead = localStorage.getItem('is_dept_head') === 'true';
	const canDelete = isDirector !== undefined ? isDirector : (userDept === 1 && isDeptHead);

	const [employees, setEmployees] = useState([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedDept, setSelectedDept] = useState('all');
	const [error, setError] = useState('');
	const [successMsg, setSuccessMsg] = useState('');
	const [showForm, setShowForm] = useState(false);
	const [editingEmployeeId, setEditingEmployeeId] = useState(null);
	const [formData, setFormData] = useState(initialFormData);
	const [attractionsList, setAttractionsList] = useState([]);
	const [paycheckEmployee, setPaycheckEmployee] = useState(null);
	const [paycheckStartDate, setPaycheckStartDate] = useState('');
	const [paycheckEndDate, setPaycheckEndDate] = useState('');
	const [paycheckRows, setPaycheckRows] = useState([]);
	const [paycheckError, setPaycheckError] = useState('');
	const [loadingPaychecks, setLoadingPaychecks] = useState(false);

	const handlePrintPaychecks = async (event, employee) => {
		event.preventDefault();
		setLoadingPaychecks(true);
		setPaycheckError('');

		try {
			const params = new URLSearchParams({
				startDate: paycheckStartDate,
				endDate: paycheckEndDate
			});
			const response = await apiFetch(
				`/api/paychecks/${employee.employee_ID}?${params.toString()}`
			);
			const data = await response.json().catch(() => []);
			if (!response.ok) {
				throw new Error(data.error || 'Could not load paycheck records.');
			}
			setPaycheckEmployee(employee);
			setPaycheckRows(data);
			setTimeout(() => window.print(), 0);
		} catch (err) {
			setPaycheckError(err.message);
		} finally {
			setLoadingPaychecks(false);
		}
	};

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
		const { name, value, type, checked } = e.target;
		const updated = {
			...formData,
			[name]: type === 'checkbox' ? checked : value
		};

		if (name === 'is_dept_head' && checked) {
			updated.manager_ID = '';
		}

		// Auto-populate email as first.last@gmail.com when adding a new employee
		if (!editingEmployeeId && (name === 'first_name' || name === 'last_name')) {
			const first = (name === 'first_name' ? value : formData.first_name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			const last = (name === 'last_name' ? value : formData.last_name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			if (first && last) {
				updated.email = `${first}.${last}@gmail.com`;
			}
		}

		setFormData(updated);
	};

	const handleStartEdit = (emp) => {
		setEditingEmployeeId(emp.employee_ID);
		setShowForm(true);
		setFormData({
			first_name: emp.first_name || '',
			minit: emp.minit || '',
			ssn: emp.ssn || '',
			last_name: emp.last_name || '',
			sex: emp.sex || 'Other',
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
			is_dept_head: Boolean(emp.is_dept_head),
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
		const payload = {
			...formData,
			manager_ID: formData.manager_ID && Number(formData.manager_ID) > 0 ? Number(formData.manager_ID) : null,
			hours: formData.hours !== '' && formData.hours !== null ? Number(formData.hours) : null
		};

		try {
			const res = await fetch(endpoint, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
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
				setTimeout(() => setSuccessMsg(''), 8000);
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
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'x-user-email': localStorage.getItem('user_email') || '',
					'Authorization': `Bearer ${localStorage.getItem('user_token') || ''}`
				}
			});
			const data = await res.json().catch(() => ({}));

			if (res.status === 200) {
				fetchAdminData();
				setSuccessMsg(data.message || `Successfully terminated ${employeeName}. Status updated to past.`);
				setError('');
				setTimeout(() => setSuccessMsg(''), 8000);
			} else {
				setError(`Failed to delete employee: ${data.error || `Server responded with status ${res.status}`}`);
			}
		} catch (err) {
			console.error('Error deleting employee:', err);
			setError(`Connection error while deleting: ${err.message}. Please check if the server is running.`);
		}
	};

	const handleSetDeptHead = async (employeeID, departmentID, employeeName, departmentName) => {
		const confirmed = window.confirm(`Set ${employeeName} as Department Head of ${departmentName}?`);
		if (!confirmed) return;

		try {
			const res = await fetch(`${API_URL}/api/department/set-head`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ employee_ID: employeeID, department_ID: departmentID })
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok) {
				setSuccessMsg(data.message || `${employeeName} is now Department Head.`);
				fetchAdminData();
				setTimeout(() => setSuccessMsg(''), 6000);
			} else {
				setError(data.error || 'Failed to update department head.');
			}
		} catch (err) {
			setError(`Connection error: ${err.message}`);
		}
	};

	const filteredEmployees = employees.filter((emp) => {
		const matchesDept = selectedDept === 'all' || String(emp.department_ID) === String(selectedDept);
		const term = searchTerm.trim().toLowerCase();
		if (!term) return matchesDept;
		const matchesName = emp.name ? emp.name.toLowerCase().includes(term) : false;
		const matchesID = emp.employee_ID ? emp.employee_ID.toString() === term || emp.employee_ID.toString().includes(term) : false;
		const matchesRole = emp.role ? emp.role.toLowerCase().includes(term) : false;
		return matchesDept && (matchesName || matchesID || matchesRole);
	});

	return (
		<>
			<div>
				{paycheckEmployee && (
					<section className="paycheck-print-view">
						<h2>Paycheck Report</h2>
						<h3>{paycheckEmployee.name}</h3>
						<p>
							{paycheckStartDate} through {paycheckEndDate}
						</p>
						<table>
							<thead>
								<tr>
									<th>Pay Period</th>
									<th>Gross Pay</th>
									<th>Federal Tax</th>
									<th>FICA Tax</th>
									<th>Benefits</th>
									<th>Net Pay</th>
								</tr>
							</thead>
							<tbody>
								{paycheckRows.map((paycheck) => (
									<tr key={paycheck.paycheck_ID}>
										<td>
											{formatDate(paycheck.pay_period_start)} – {formatDate(paycheck.pay_period_end)}
										</td>
										<td>${Number(paycheck.gross_pay).toFixed(2)}</td>
										<td>${Number(paycheck.federal_tax).toFixed(2)}</td>
										<td>${Number(paycheck.fica_tax).toFixed(2)}</td>
										<td>${Number(paycheck.benefits_deduction).toFixed(2)}</td>
										<td>${Number(paycheck.net_pay).toFixed(2)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				)}
				<h2>Executive Administration — Staff Directory</h2>
				<p style={{ color: '#555' }}>
					Manage personnel records, department assignments, compensations, and new staff onboarding across all 4 zoo departments: Financial and HR, Animal Operations, Commercial Operations, and Guest Operations.
				</p>

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
								<label>SSN: </label>
								<input
									type="text"
									name="ssn"
									placeholder="e.g. 123-45-6789"
									maxLength="11"
									value={formData.ssn}
									onChange={handleChange}
									disabled={Boolean(editingEmployeeId)}
									required
								/>
							</div>
							<div>
								<label>Sex: </label>
								<select name="sex" value={formData.sex} onChange={handleChange} required>
									<option value="M">Male (M)</option>
									<option value="F">Female (F)</option>
									<option value="Other">Other</option>
								</select>
							</div>
							<div>
								<label>Email: </label>
								<input
									type="email"
									name="email"
									value={formData.email}
									onChange={handleChange}
									placeholder="e.g. first.last@gmail.com (auto-generated)"
								/>
								<small style={{ marginLeft: '8px', color: '#666' }}>
									(Auto-generated as @gmail.com from name, or enter custom)
								</small>
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
									<option value="1">1 - Financial and HR</option>
									<option value="2">2 - Animal Operations</option>
									<option value="3">3 - Commercial Operations</option>
									<option value="4">4 - Guest Operations</option>
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
									required
								/>
							</div>
							<div>
								<label>Weekly Hours: </label>
								<input type="number" name="hours" placeholder="e.g. 40" value={formData.hours} onChange={handleChange} />
							</div>
							<div>
								<label>Manager ID: </label>
								<input
									type="number"
									name="manager_ID"
									placeholder={formData.is_dept_head ? 'None (Dept Head)' : 'Optional (leave blank if unassigned)'}
									value={formData.is_dept_head ? '' : formData.manager_ID}
									onChange={handleChange}
									disabled={formData.is_dept_head}
								/>
								<small style={{ display: 'block', color: '#666', marginTop: '2px', fontSize: '0.82rem' }}>
									{formData.is_dept_head
										? 'Department Heads report to no manager.'
										: 'Leave blank if this employee does not have an assigned manager.'}
								</small>
							</div>
							<div style={{ margin: '8px 0 12px 0' }}>
								<label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
									<input
										type="checkbox"
										name="is_dept_head"
										checked={Boolean(formData.is_dept_head)}
										onChange={handleChange}
									/>
									Designate as Department Head
								</label>
								<small style={{ display: 'block', color: '#666', marginTop: '2px', fontSize: '0.82rem' }}>
									Check this to make this employee the official head of their department (clears manager ID).
								</small>
							</div>
							{!editingEmployeeId && (
								<>
									{['2', '4'].includes(String(formData.department_ID)) ? (
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
									) : (
										<p style={{ fontSize: '0.88rem', color: '#666', margin: '4px 0 10px 0' }}>
											<em>(Attraction assignment only applies to Guest Operations and Animal Operations staff)</em>
										</p>
									)}

									<div>
										<label>Portal Access Role: </label>
										<select name="user_role" value={formData.user_role || 'employee'} onChange={handleChange}>
											<option value="employee">Employee (Directory only — No Payroll)</option>
											<option value="manager">Manager (Department Lead & Payroll)</option>
										</select>
									</div>

									<p style={{ fontSize: '0.88rem', color: '#555', margin: '6px 0 12px 0' }}>
										<strong>Automatic User Account:</strong> Password will be set to{' '}
										<code>{formData.first_name ? `${formData.first_name.trim().toLowerCase()}123` : '<firstname>123'}</code>
									</p>
								</>
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

				<div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
					<div>
						<label><strong>Department: </strong></label>
						<select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
							<option value="all">All Departments (4)</option>
							<option value="1">1 - Financial and HR</option>
							<option value="2">2 - Animal Operations</option>
							<option value="3">3 - Commercial Operations</option>
							<option value="4">4 - Guest Operations</option>
						</select>
					</div>

					<div>
						<label><strong> Search Employee: </strong></label>
						<input
							type="text"
							placeholder="e.g. Katy, 9, or Keeper..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>
				</div>

				<br />

				<table border="1" cellPadding="8">
					<thead>
						<tr>
							<th>Manager Name</th>
							<th>Department</th>
							<th>Employee Name</th>
							<th>Sex</th>
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
									<td>
										{item.is_dept_head ? (
											<strong style={{ color: '#2e7d32' }}>Department Head</strong>
										) : item.manager_name ? (
											item.manager_name
										) : (
											<span style={{ color: '#888', fontStyle: 'italic' }}>Unassigned</span>
										)}
									</td>
									<td>{item.department_name}</td>
									<td>{item.name}</td>
									<td>{item.sex || '—'}</td>
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
												{!item.is_dept_head && (
													<>
														&nbsp;
														<button
															type="button"
															onClick={() => handleSetDeptHead(item.employee_ID, item.department_ID, item.name, item.department_name)}
															title={`Set ${item.name} as Department Head`}
														>
															Make Head
														</button>
													</>
												)}
												{canDelete && (
													<>
														&nbsp;
														<button
															type="button"
															onClick={() => handleDelete(item.employee_ID, item.name)}
														>
															Delete
														</button>
													</>
												)}
												{isFinHR && (
													<>
														&nbsp;
														<button
															type="button"
															onClick={() => {
																setPaycheckEmployee(item);
																setPaycheckError('');
															}}
														>
															Print Paychecks
														</button>
														{paycheckEmployee?.employee_ID === item.employee_ID && (
															<form onSubmit={(event) => handlePrintPaychecks(event, item)}>
																<label>
																	Start date
																	<input
																		type="date"
																		required
																		value={paycheckStartDate}
																		onChange={(event) => setPaycheckStartDate(event.target.value)}
																	/>
																</label>
																<label>
																	End date
																	<input
																		type="date"
																		required
																		value={paycheckEndDate}
																		onChange={(event) => setPaycheckEndDate(event.target.value)}
																	/>
																</label>
																<button type="submit" disabled={loadingPaychecks}>
																	{loadingPaychecks ? 'Loading...' : 'Print'}
																</button>
																{paycheckError && <p role="alert">{paycheckError}</p>}
															</form>
														)}
													</>
												)}
											</>
										) : (
											<span>Inactive</span>
										)}
									</td>
								</tr>
							))
						) : (
							<tr>
								<td colSpan="13" style={{ textAlign: 'center', padding: '2rem' }}>
									{error ? (
										<span style={{ color: 'red' }}>Could not load directory data: {error}</span>
									) : searchTerm.trim() ? (
										<span>No employees found matching <strong>"{searchTerm}"</strong>. Check the employee name or ID.</span>
									) : (
										<span>No employee records found in the database.</span>
									)}
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
