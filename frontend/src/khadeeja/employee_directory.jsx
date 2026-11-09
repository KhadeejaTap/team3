import { useState } from 'react';
import '.././App.css';
import MgrView from './manager_view';
import AdminView from './admin_view';
import EmpView from './employee_view';
import PayrollReport from './PayrollReport';

function ReturnDir({ role, userEmail, userDept, isDeptHead }) {
	const [currentTab, setCurrentTab] = useState('directory');

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
						onClick={() => setCurrentTab('directory')}
					>
						{currentTab === 'directory' ? <strong>Staff Directory</strong> : 'Staff Directory'}
					</button>
					&nbsp;&nbsp;
					<button
						type="button"
						onClick={() => setCurrentTab('report')}
					>
						{currentTab === 'report' ? <strong>Payroll & Headcount Report</strong> : 'Payroll & Headcount Report'}
					</button>
				</div>
				<hr />

				{currentTab === 'report' ? (
					<PayrollReport role={role} userEmail={userEmail} />
				) : (
					<AdminView isDirector={isDirector} />
				)}
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
