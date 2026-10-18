import '.././App.css'
import { useState, useEffect } from 'react';
function GuestView() {
	const [employees, setEmployees] = useState([])

	useEffect(() => {
		fetch('http://localhost:5000/api/employees').then((res) => res.json()).then((data) => setEmployees(data)).catch((err) => console.error('Error fetching employees:', err));
	}, []);

	return (
		<>
			<div>
				<h2> Super Cool Employee View </h2>
				<table border="1" cellPadding="8">
					<thead>
						<tr>
							<th>Name</th>
							<th>Department</th>
							<th>Role</th>
							<th>Email</th>
							<th>Phone</th>
						</tr>
					</thead>
					<tbody>
						{employees.map((emp, index) => (
							<tr key={index}>
								<td>{emp.name}</td>
								<td>{emp.department_name}</td>
								<td>{emp.role}</td>
								<td>{emp.email}</td>
								<td>{emp.phone_number}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
export default EmpView;
