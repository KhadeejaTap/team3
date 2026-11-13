import '.././App.css';
import MgrView from './manager_view';
import AdminView from './admin_view';
import EmpView from './employee_view';

function ReturnDir({ role, userEmail, userDept, isDeptHead }) {
	if (!role) {
		return (
			<div>
				<h2>Please Log In</h2>
				<p>You must be logged in as zoo staff to access the employee directory.</p>
			</div>
		);
	}

	if (role === 'visitor') {
		return (
			<div>
				<h2>Access Denied</h2>
				<p>The employee directory is restricted to zoo staff and administration.</p>
			</div>
		);
	}

	const effectiveDept = userDept ? Number(userDept) : Number(localStorage.getItem('user_dept'));
	const isFinHR = effectiveDept === 1;
	const isDirector = isFinHR && (Boolean(isDeptHead) || localStorage.getItem('is_dept_head') === 'true');

	// Financial and HR personnel (Dept 1) have access to both Staff Management and Payroll Reports
	if (isFinHR) {
		return (
			<div>
				<div>
					<button
						type="button"
					>
						<strong>Staff Directory</strong>
					</button>
				</div>
				<hr />

				<AdminView isDirector={isDirector} isFinHR={isFinHR} />
			</div>
		);
	}

	// Non-HR department heads manage their own department team
	if (role === 'manager') {
		return <MgrView userEmail={userEmail} />;
	}

	return <EmpView />;
}

export default ReturnDir;
