import { useState } from 'react';
import '.././App.css';
import MgrView from './manager_view';
import AdminView from './admin_view';
import EmpView from './employee_view';
import PayrollReport from './PayrollReport';

function ReturnDir({ role, userEmail }) {
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

	if (role === 'employee') {
		return <EmpView />;
	}

	const isFinHR =
		userEmail === 'taylor.hemsworth@zoo.com' ||
		Number(localStorage.getItem('user_dept')) === 1;

	// Non-HR department heads go directly to their team hub without the payroll tab
	if (role === 'manager' && !isFinHR) {
		return <MgrView userEmail={userEmail} />;
	}

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
				<AdminView />
			)}
		</div>
	);
}

export default ReturnDir;
