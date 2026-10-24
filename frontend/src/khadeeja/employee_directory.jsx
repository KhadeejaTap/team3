import '.././App.css';
import MgrView from './manager_view';
import AdminView from './admin_view';
import EmpView from './employee_view';

function ReturnDir({ role }) {
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

	if (role === 'manager') {
		return <MgrView />;
	}

	if (role === 'admin') {
		return <AdminView />;
	}

	if (role === 'employee') {
		return <EmpView />;
	}

	return (
		<div>
			<p>Access Denied: Unrecognized role.</p>
		</div>
	);
}

export default ReturnDir;
