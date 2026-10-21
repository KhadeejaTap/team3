import '.././App.css'
import { useState, useEffect } from 'react';
function HrView() {
	const [employees, setEmployees] = useState([])

	useEffect(() => {
		fetch('http://localhost:5000/api/hr').then((res) => res.json()).then((data) => setEmployees(data)).catch((err) => console.error('Error fetching employees:', err));
	}, []);

	return (
		<>
			<div>
				<h2> Super Cool Employee View </h2>
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
							<th>Employment Status</th>
						</tr>
					</thead>
					<tbody>
						{employees.map((item, index) => (
							<tr key={index}>
								<td>{item.manager_name}</td>
								<td>{item.department_name}</td>
								<td>{item.name}</td>
								<td>{item.address}</td>
								<td>{item.email}</td>
								<td>{item.phone_number}</td>
								<td>{item.role}</td>
								<td>{item.salary}</td>
								<td>{item.hire_date}</td>
								<td>{item.hours}</td>
								<td>{item.employment_status}</td>

							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}
export default HrView;
