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

	return (
		<div>
			<div>
				<button
					type="button"
					onClick={() => setCurrentTab('directory')}
				>
					{currentTab === 'directory' ? <strong>Employee Directory</strong> : 'Employee Directory'}
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
				<PayrollReport />
			) : role === 'manager' ? (
				<MgrView userEmail={userEmail} />
			) : (
				<AdminView />
			)}
		</div>
	);
}

export default ReturnDir;
