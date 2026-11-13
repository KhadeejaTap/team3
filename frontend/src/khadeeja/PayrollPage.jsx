import { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import './PayrollReport.css';
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip
} from 'recharts';

const genderColors = {
	Female: '#E78AAE',
	Male: '#4A90A4'
};

const departmentColors = [
	'#2E7D32',
	'#7E57C2',
	'#FF8A50',
	'#4A90A4',
	'#E6B94A',
	'#E78AAE'
];

function getDepartmentColor(departmentId) {
	return departmentColors[(Number(departmentId) - 1) % departmentColors.length];
}

function ChartLegend({ data }) {
	return (
		<ul className="pie-legend">
			{data.map((item) => (
				<li key={item.name} style={{ color: item.labelColor || item.color }}>
					{item.name} {item.displayValue}
				</li>
			))}
		</ul>
	);
}

function DepartmentPieChart({ title, description, data }) {
	return (
		<div className="payroll-visuals">
			<div className="donut-card">
				<h4 className="donut-title">{title}</h4>
				{description && <p className="donut-description">{description}</p>}
				<div className="donut-chart-large">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="45%"
								outerRadius={120}
								label={({ name, percent, x, y, textAnchor, fill, payload }) => (
									<text
										x={x}
										y={y}
										textAnchor={textAnchor}
										fill={payload?.labelColor || fill}
										fontSize="13"
										fontWeight="600"
									>
										{name} {(percent * 100).toFixed(0)}%
									</text>
								)}
								labelLine={false}
							>
								{data.map((item) => (
									<Cell
										key={item.name}
										fill={item.color}
										stroke={item.borderColor || '#FFFFFF'}
									/>
								))}
							</Pie>
							<Tooltip />
							<Legend content={<ChartLegend data={data} />} />
						</PieChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}

function formatDate(value) {
	if (!value) return '—';
	const [year, month, day] = String(value).slice(0, 10).split('-');
	return `${month}/${day}/${year}`;
}

function formatMoney(value) {
	return Math.round(Number(value) || 0).toLocaleString();
}

function PayrollPage({ isDeptHead, isFinHR }) {
	const nextFiscalYear = new Date().getFullYear() + 1;
	const [budget, setBudget] = useState('');
	const [latestBudget, setLatestBudget] = useState(450000);
	const [departments, setDepartments] = useState([]);
	const [selectedDepartment, setSelectedDepartment] = useState('all');
	const [timeFrame, setTimeFrame] = useState('yearToDate');
	const [customStartDate, setCustomStartDate] = useState('');
	const [customEndDate, setCustomEndDate] = useState('');
	const [staffType, setStaffType] = useState('all');
	const [sexFilter, setSexFilter] = useState('all');
	const [chartOptions, setChartOptions] = useState({
		gender: false,
		annualSalary: false,
		salaryBudget: false
	});
	const [sortBy, setSortBy] = useState('yearlySalary');
	const [sortDirection, setSortDirection] = useState('ascending');
	const [payrollRows, setPayrollRows] = useState([]);
	const [loadingPayroll, setLoadingPayroll] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!isFinHR) return;

		apiFetch('/api/employees')
			.then(async (response) => {
				const data = await response.json().catch(() => []);
				if (!response.ok) {
					throw new Error(data.error || 'Could not load departments.');
				}
				const names = [...new Set(
					data
						.map((employee) => employee.department_name)
						.filter(Boolean)
				)].sort((a, b) => a.localeCompare(b));
				setDepartments(names);
			})
			.catch((err) => setError(err.message));
	}, [isFinHR]);

	useEffect(() => {
		if (!isDeptHead) return;

		apiFetch('/api/salary-budget/latest')
			.then(async (response) => {
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(data.error || 'Could not load the latest salary budget.');
				}
				setLatestBudget(Number(data.latestBudget));
			})
			.catch((err) => setError(err.message));
	}, [isDeptHead]);

	useEffect(() => {
		if (!isFinHR) return;
		if (timeFrame === 'customDateFrame' && (!customStartDate || !customEndDate)) {
			setPayrollRows([]);
			return;
		}

		const params = new URLSearchParams({
			department: selectedDepartment,
			timeFrame,
			staffType,
			sex: sexFilter,
			sortBy,
			sortDirection
		});

		if (timeFrame === 'customDateFrame') {
			params.set('startDate', customStartDate);
			params.set('endDate', customEndDate);
		}

		setLoadingPayroll(true);
		apiFetch(`/api/payroll?${params.toString()}`)
			.then(async (response) => {
				const data = await response.json().catch(() => []);
				if (!response.ok) {
					throw new Error(data.error || 'Could not load payroll data.');
				}
				setPayrollRows(data);
				setError('');
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoadingPayroll(false));
	}, [
		isFinHR,
		selectedDepartment,
		timeFrame,
		customStartDate,
		customEndDate,
		staffType,
		sexFilter,
		sortBy,
		sortDirection
	]);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setSaving(true);
		setMessage('');
		setError('');

		try {
			const response = await apiFetch('/api/salary-budget', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fiscal_year: nextFiscalYear,
					annual_salary_budget: budget === '' ? null : Number(budget)
				})
			});
			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(data.error || 'Could not save salary budget.');
			}

			setMessage(
				`FY ${nextFiscalYear} salary budget set to $${formatMoney(
					data.annual_salary_budget
				)}.`
			);
		} catch (err) {
			setError(err.message);
		} finally {
			setSaving(false);
		}
	};
	const formatTenure = (totalWeeks) => {
		const WEEKS_PER_YEAR = 52;
		const WEEKS_PER_MONTH = 52 / 12; // ~4.33

		const years = Math.floor(totalWeeks / WEEKS_PER_YEAR);
		const rem = totalWeeks - years * WEEKS_PER_YEAR;
		const months = Math.floor(rem / WEEKS_PER_MONTH);
		const weeks = Math.floor(rem - months * WEEKS_PER_MONTH);

		const parts = [];
		if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
		if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
		if (weeks || parts.length === 0)
			parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);

		return parts.join(', ');
	};
	const payrollByDepartment = payrollRows.reduce((groups, employee) => {
		const department = employee.department_name || 'Unassigned';
		if (!groups[department]) groups[department] = [];
		groups[department].push(employee);
		return groups;
	}, {});
	const getTotals = (employees) => ({
		femaleCount: employees.filter((employee) => employee.sex === 'F').length,
		maleCount: employees.filter((employee) => employee.sex === 'M').length,
		salary: employees.reduce(
			(total, employee) => total + Number(employee.yearly_salary || 0),
			0
		),
		grossPay: employees.reduce(
			(total, employee) => total + Number(employee.gross_pay || 0),
			0
		),
		projectedYearEndCost: employees.reduce(
			(total, employee) => total + Number(employee.projected_year_end_cost || 0),
			0
		)
	});
	const overallTotals = getTotals(payrollRows);
	const genderChartData = [
		{
			name: 'Female',
			value: payrollRows.filter((employee) => employee.sex === 'F').length,
			displayValue: String(payrollRows.filter((employee) => employee.sex === 'F').length),
			color: genderColors.Female
		},
		{
			name: 'Male',
			value: payrollRows.filter((employee) => employee.sex === 'M').length,
			displayValue: String(payrollRows.filter((employee) => employee.sex === 'M').length),
			color: genderColors.Male
		}
	];
	const departmentTotals = payrollRows.reduce((groups, employee) => {
		const key = employee.department_id;
		if (!groups[key]) {
			groups[key] = {
				name: employee.department_name,
				departmentId: key,
				annualSalary: 0,
				grossPay: 0,
				projectedYearEndCost: 0,
				annualSalaryBudget: Number(employee.annual_salary_budget || 0)
			};
		}
		groups[key].annualSalary += Number(employee.yearly_salary || 0);
		groups[key].grossPay += Number(employee.gross_pay || 0);
		groups[key].projectedYearEndCost += Number(
			employee.projected_year_end_cost || 0
		);
		return groups;
	}, {});
	const annualSalaryChartData = Object.values(departmentTotals).map((department) => ({
		name: department.name,
		value: Math.round(department.annualSalary),
		displayValue: `$${formatMoney(department.annualSalary)}`,
		color: getDepartmentColor(department.departmentId)
	}));
	const annualSalaryBudget = Number(payrollRows[0]?.annual_salary_budget || 0);
	const salaryBudgetYear = payrollRows[0]?.salary_budget_year || new Date().getFullYear();
	const departmentBudgetSlices = Object.values(departmentTotals).map((department) => ({
		name: department.name,
		value: Math.round(department.projectedYearEndCost),
		displayValue: `$${formatMoney(department.projectedYearEndCost)}`,
		color: getDepartmentColor(department.departmentId),
		labelColor: getDepartmentColor(department.departmentId)
	}));
	const totalProjectedCost = departmentBudgetSlices.reduce(
		(total, department) => total + department.value,
		0
	);
	const remainingBudget = Math.max(annualSalaryBudget - totalProjectedCost, 0);
	const salaryBudgetChartData = [
		...departmentBudgetSlices,
		{
			name: 'Remaining budget',
			value: remainingBudget,
			displayValue: `$${formatMoney(remainingBudget)}`,
			color: '#FFFFFF',
			labelColor: '#334155',
			borderColor: '#CBD5E1'
		}
	];

	return (
		<div>
			<h2>Payroll</h2>
			{isDeptHead && (
				<form onSubmit={handleSubmit}>
					<h3>Set Next Fiscal Year Salary Budget</h3>
					<label htmlFor="salary-budget">
						Fiscal year {nextFiscalYear} annual salary budget, default is set to current fiscal year's budget:
					</label>
					<input
						id="salary-budget"
						type="number"
						min="0"
						step="1"
						value={budget}
						onChange={(event) => setBudget(event.target.value)}
						placeholder={`Default $${formatMoney(latestBudget)}`}
					/>
					<button type="submit" disabled={saving}>
						{saving ? 'Saving...' : 'Set Budget'}
					</button>
					{message && <p role="status">{message}</p>}
					{error && <p role="alert">{error}</p>}
				</form>
			)}
			{isFinHR && (
				<button
					type="button"
					className="export-button"
					onClick={() => window.print()}
				>
					Export Reports to PDF
				</button>
			)}
			<div className="payroll-report-export">
				{isFinHR && (
					<section className="payroll-chart-section">
						<h3>Charts</h3>
						<h4>
							Salary Budget for {salaryBudgetYear}: ${formatMoney(annualSalaryBudget)}
						</h4>
						<div className="chart-controls">
							<label>
								<input
									type="checkbox"
									checked={chartOptions.gender}
									onChange={() => setChartOptions((current) => ({
										...current,
										gender: !current.gender
									}))}
								/>
								Gender ratio
							</label>
							{selectedDepartment === 'all' && timeFrame === 'yearToDate' && (
								<label>
									<input
										type="checkbox"
										checked={chartOptions.annualSalary}
										onChange={() => setChartOptions((current) => ({
											...current,
											annualSalary: !current.annualSalary
										}))}
									/>
									Annual salary
								</label>
							)}
							{timeFrame === 'yearToDate' && (
								<label>
									<input
										type="checkbox"
										checked={chartOptions.salaryBudget}
										onChange={() => setChartOptions((current) => ({
											...current,
											salaryBudget: !current.salaryBudget
										}))}
									/>
									Salary budget used
								</label>
							)}
						</div>
						{chartOptions.gender && (
							<DepartmentPieChart title="Gender Ratio" data={genderChartData} />
						)}
						{chartOptions.annualSalary && (
							<DepartmentPieChart
								title="Annual Salary by Department"
								data={annualSalaryChartData}
							/>
						)}
						{chartOptions.salaryBudget && (
							<DepartmentPieChart
								title="Projected Year-End Payroll vs Current Fiscal Year's Budget"
								data={salaryBudgetChartData}
								description="This projection calculates each department’s estimated total payroll for the fiscal year by combining gross wages from payroll records already deposited with projected wages for the remaining pay periods. Future payroll is estimated using each employee’s current annual salary and the number of remaining paydays in the fiscal year."
							/>
						)}
					</section>
				)}
				{isFinHR && (
					<section className="payroll-filters">
						<h3>Payroll Filters</h3>
						<label htmlFor="payroll-department">Department: </label>
						<select
							id="payroll-department"
							value={selectedDepartment}
							onChange={(event) => setSelectedDepartment(event.target.value)}
						>
							<option value="all">All</option>
							{departments.map((department) => (
								<option key={department} value={department}>
									{department}
								</option>
							))}
						</select>

						<label htmlFor="payroll-time-frame">Time frame: </label>
						<select
							id="payroll-time-frame"
							value={timeFrame}
							onChange={(event) => setTimeFrame(event.target.value)}
						>
							<option value="customDateFrame">Custom date frame</option>
							<option value="yearToDate">Year to date</option>
							<option value="allTime">All time cumulative</option>
						</select>

						{timeFrame === 'customDateFrame' && (
							<>
								<label htmlFor="payroll-start-date">Start: </label>
								<input
									id="payroll-start-date"
									type="date"
									value={customStartDate}
									onChange={(event) => setCustomStartDate(event.target.value)}
								/>
								<label htmlFor="payroll-end-date">End: </label>
								<input
									id="payroll-end-date"
									type="date"
									value={customEndDate}
									onChange={(event) => setCustomEndDate(event.target.value)}
								/>
							</>
						)}

						<label htmlFor="payroll-staff-type">Staff type: </label>
						<select
							id="payroll-staff-type"
							value={staffType}
							onChange={(event) => setStaffType(event.target.value)}
						>
							<option value="all">All staff</option>
							<option value="fullTime">Full time (&gt;= 35 hours)</option>
							<option value="partTime">Part time (&lt; 35 hours)</option>
						</select>

						<label htmlFor="payroll-sex">Sex: </label>
						<select
							id="payroll-sex"
							value={sexFilter}
							onChange={(event) => setSexFilter(event.target.value)}
						>
							<option value="all">All</option>
							<option value="female">Female</option>
							<option value="male">Male</option>
						</select>

						<label htmlFor="payroll-sort-by">Sort by: </label>
						<select
							id="payroll-sort-by"
							value={sortBy}
							onChange={(event) => setSortBy(event.target.value)}
						>
							<option value="yearlySalary">Yearly salary</option>
							<option value="tenure">Tenure</option>
							<option value="employeeName">Employee name</option>
						</select>

						<label htmlFor="payroll-sort-direction">Order: </label>
						<select
							id="payroll-sort-direction"
							value={sortDirection}
							onChange={(event) => setSortDirection(event.target.value)}
						>
							<option value="ascending">Ascending</option>
							<option value="descending">Descending</option>
						</select>
					</section>
				)}
				{isFinHR && error && <p role="alert">{error}</p>}
				{isFinHR && (
					<table>
						<thead>
							<tr>
								<th>Employee</th>
								<th>Sex</th>
								<th>Department</th>
								<th>Role</th>
								<th>Staff Type</th>
								<th>Hours</th>
								<th>Annual Salary</th>
								<th>Gross Pay</th>
								<th>Hire Date</th>
								<th>Tenure</th>
							</tr>
							<tr className="description">
								<th>Employee's full name, department head names are colored</th>
								<th>Employee's recorded sex</th>
								<th>Department where the employee works</th>
								<th>Employee's job or position</th>
								<th>Full-time or part-time employee</th>
								<th>Weekly Hours</th>
								<th>Employee's yearly salary</th>
								<th>Total pay before deductions during the selected time frame, pulled from payroll logs</th>
								<th>Date the employee was hired</th>
								<th>How long the employee has worked here</th>
							</tr>
						</thead>
						<tbody>
							{loadingPayroll && (
								<tr>
									<td colSpan="10">Loading payroll data...</td>
								</tr>
							)}
							{!loadingPayroll && payrollRows.map((employee) => (
								<tr key={employee.employee_ID}>
									<td className={employee.is_department_head ? 'department-head-name' : ''}>
										{employee.employee_name}
									</td>
									<td>{employee.sex}</td>
									<td>{employee.department_name}</td>
									<td>{employee.role || '—'}</td>
									<td>{employee.staff_type}</td>
									<td>{employee.hours ?? '—'}</td>
									<td>${formatMoney(employee.yearly_salary)}</td>
									<td>${formatMoney(employee.gross_pay)}</td>
									<td>{formatDate(employee.hire_date)}</td>
									<td>{formatTenure(employee.tenure_weeks)}</td>
								</tr>
							))}
							{!loadingPayroll && payrollRows.length === 0 && (
								<tr>
									<td colSpan="10">No payroll records found.</td>
								</tr>
							)}
						</tbody>
						<tfoot>
							<tr>
								<th>Total</th>
								<td>Female:Male {overallTotals.femaleCount}:{overallTotals.maleCount}</td>
								<td></td>
								<td></td>
								<td></td>
								<td></td>
								<th>${formatMoney(overallTotals.salary)}</th>
								<th>${formatMoney(overallTotals.grossPay)}</th>
								<td></td>
								<td></td>
							</tr>
						</tfoot>
					</table>
				)}
				{isFinHR && selectedDepartment === 'all' && (
					<section>
						<h3>Payroll by Department</h3>
						{Object.entries(payrollByDepartment).map(([department, employees]) => (
							<section key={department}>
								<h4>{department}</h4>
								<table>
									<thead>
										<tr>
											<th>Employee</th>
											<th>Sex</th>
											<th>Role</th>
											<th>Staff Type</th>
											<th>Hours</th>
											<th>Annual Salary</th>
											<th>Gross Pay</th>
											<th>Hire Date</th>
											<th>Tenure</th>
										</tr>
									</thead>
									<tbody>
										{employees.map((employee) => (
											<tr key={`${department}-${employee.employee_ID}`}>
												<td className={employee.is_department_head ? 'department-head-name' : ''}>
													{employee.employee_name}
												</td>
												<td>{employee.sex}</td>
												<td>{employee.role || '—'}</td>
												<td>{employee.staff_type}</td>
												<td>{employee.hours ?? '—'}</td>
												<td>${formatMoney(employee.yearly_salary)}</td>
												<td>${formatMoney(employee.gross_pay)}</td>
												<td>{formatDate(employee.hire_date)}</td>
												<td>{formatTenure(employee.tenure_weeks)}</td>
											</tr>
										))}
									</tbody>
									{(() => {
										const totals = getTotals(employees);
										const annualSalaryBudget = Number(
											employees[0]?.annual_salary_budget || 0
										);
										const budgetUsedPercent = annualSalaryBudget
											? (totals.projectedYearEndCost / annualSalaryBudget) * 100
											: 0;
										return (
											<tfoot>
												<tr>
													<th>Total</th>
													<td>Female:Male {totals.femaleCount}:{totals.maleCount}</td>
													<td></td>
													<td></td>
													<td></td>
													<th>${formatMoney(totals.salary)}</th>
													<th>${formatMoney(totals.grossPay)}</th>
													<td></td>
													<td></td>
												</tr>
												<tr>
													<th>Salary budget used</th>
													<td colSpan="8">
														${formatMoney(totals.projectedYearEndCost)} of $
														{formatMoney(annualSalaryBudget)} (
														{budgetUsedPercent.toFixed(1)}%)
													</td>
												</tr>
											</tfoot>
										);
									})()}
								</table>
							</section>
						))}
						{!loadingPayroll && payrollRows.length === 0 && (
							<p>No payroll records found.</p>
						)}
					</section>
				)}
			</div>
		</div>
	);
}

export default PayrollPage;
