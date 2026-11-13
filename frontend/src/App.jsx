import './App.css';
import { useState } from 'react';
import { apiFetch } from './api';
import zooLogo from './images/animals/Marketing/Finished Cougar Zoo logo.png';

import LoginPage from './khadeeja/login';
import ReturnDir from './khadeeja/employee_directory';
import Donations from './kim/Donations';
import Home from './Home';
import GiftShop from './Daniel/giftshop';
import Food from './Daniel/food';
import AnimalManagement from './animals/AnimalManagement';
import EnclosureManagement from './animals/EnclosureManagement';
import VisitorAnimalDirectory from './VisitorAnimalDirectory';
import AttractionManagement from './Attractions/attractionManagement';
import VisitorAttractions from './Attractions/VisitorAttractions';
import Tickets from './Tickets/Tickets';
import SpeciesReport from './animals/SpeciesReport';
import PayrollPage from './khadeeja/PayrollPage';
import ProfitPage from './khadeeja/ProfitPage';
import RevenueDetails from './khadeeja/RevenueDetails';

import {
	BrowserRouter as Router,
	Routes,
	Route,
	Link,
	Navigate
} from 'react-router-dom';

function AppContent() {
	const [role, setRole] = useState(() =>
		localStorage.getItem('user_token')
			? localStorage.getItem('user_role')
			: null
	);

	const [userEmail, setUserEmail] = useState(() =>
		localStorage.getItem('user_token')
			? localStorage.getItem('user_email')
			: null
	);

	const [userDept, setUserDept] = useState(() => {
		const saved = localStorage.getItem('user_dept');
		return saved ? Number(saved) : null;
	});

	const [isDeptHead, setIsDeptHead] = useState(() => {
		return localStorage.getItem('is_dept_head') === 'true';
	});

	const [loggingOut, setLoggingOut] = useState(false);
	const [authError, setAuthError] = useState('');

	function handleLogin(newRole, newEmail, newDept, newIsHead) {
		setAuthError('');
		setRole(newRole);
		setUserEmail(newEmail);
		const parsedDept = newDept ? Number(newDept) : null;
		setUserDept(parsedDept);
		setIsDeptHead(Boolean(newIsHead));

		if (newRole) {
			localStorage.setItem('user_role', newRole);

			if (newEmail) {
				localStorage.setItem('user_email', newEmail);
			} else {
				localStorage.removeItem('user_email');
			}

			if (parsedDept) {
				localStorage.setItem('user_dept', String(parsedDept));
			} else {
				localStorage.removeItem('user_dept');
			}

			localStorage.setItem('is_dept_head', newIsHead ? 'true' : 'false');
		} else {
			localStorage.removeItem('user_token');
			localStorage.removeItem('user_role');
			localStorage.removeItem('user_email');
			localStorage.removeItem('user_dept');
			localStorage.removeItem('is_dept_head');
			localStorage.removeItem('user_first_name');
			localStorage.removeItem('user_last_name');
		}
	}

	async function handleLogout() {
		if (loggingOut) return;

		setLoggingOut(true);
		setAuthError('');

		try {
			if (localStorage.getItem('user_token')) {
				const response = await apiFetch(
					'http://localhost:5000/api/logout',
					{ method: 'POST' }
				);

				if (!response.ok) {
					throw new Error('Could not log out. Please try again.');
				}
			}

			handleLogin(null, null);
		} catch (err) {
			setAuthError(
				err.message || 'Could not reach the server to log out.'
			);
		} finally {
			setLoggingOut(false);
		}
	}

	const isStaff = ['manager', 'employee'].includes(role);

	// Department 1: Financial and HR
	const isFinHR = userDept === 1;

	// Department 3: Commercial Operations (Gift Shop, Food, Parking)
	const isCommercialStaff = userDept === 3;

	// Department 4: Guest Operations (Attractions, Tours, Educational Shows)
	const isGuestOpsStaff = userDept === 4;

	const isGuestOpsHead = userDept === 4 && role === 'manager';

	return (
		<>
			<nav className="navbar">
				<Link to="/" className="navbar-logo">
					<img src={zooLogo} alt="Cougar Zoo" />
				</Link>
				<ul className="nav-list">
					<li className="nav-item">
						<Link to="/">Home</Link>
					</li>
					<li className="nav-item">
						<Link to="/animal-directory">Meet the Animals</Link>
					</li>
					<li className="nav-item">
						<Link to="/attractions">Exhibits & Shows</Link>
					</li>
					<li className="nav-item">
						<Link to="/tickets">Tickets</Link>
					</li>
					<li className="nav-item">
						<Link to="/gift-shop">Gift Shop</Link>
					</li>
					<li className="nav-item">
						<Link to="/food">Food & Dining</Link>
					</li>
					<li className="nav-item">
						<Link to="/donations">Donate</Link>
					</li>

					{/* Staff Workstation Links */}
					{isStaff && (
						<>
							{/* Department 1: Financial and HR */}
							{isFinHR && (
								<>
									<li className="nav-item">
										<Link to="/directory">Staff and Paychecks</Link>
									</li>
									<li className="nav-item">
										<Link to="/payroll">Payroll Reports</Link>
									</li>
									<li className="nav-item">
										<Link to="/profit">Profit Reports</Link>
									</li>
									<li className="nav-item">
										<Link to="/revenue-details">Revenue Details</Link>
									</li>
								</>
							)}

							{/* Department 2: Animal Care & Field Operations */}
							{userDept === 2 && (
								<>
									<li className="nav-item">
										<Link to="/directory">Directory</Link>
									</li>
									<li className="nav-item">
										<Link to="/animals">Animal Management</Link>
									</li>
									<li className="nav-item">
										<Link to="/enclosures">Enclosure Management</Link>
									</li>
								</>
							)}

							{/* Department 3: Commercial Operations */}
							{isCommercialStaff && (
								<>
									<li className="nav-item">
										<Link to="/directory">Directory</Link>
									</li>
								</>
							)}

							{/* Department 4: Guest Operations */}
							{isGuestOpsStaff && (
								<>
									<li className="nav-item">
										<Link to="/directory">Directory</Link>
									</li>
									{isGuestOpsHead && (
										<li className="nav-item">
											<Link to="/attractions-management">Attraction Management</Link>
										</li>
									)}
								</>
							)}

							{/* Fallback for other staff roles or unassigned department */}
							{!isFinHR && userDept !== 2 && !isCommercialStaff && !isGuestOpsStaff && (
								<li className="nav-item">
									<Link to="/directory">Directory</Link>
								</li>
							)}
						</>
					)}

					{role ? (
						<li className="nav-item">
							<button
								type="button"
								onClick={handleLogout}
								disabled={loggingOut}
							>
								{loggingOut
									? 'Logging out...'
									: role === 'visitor'
										? 'Log Out'
										: `Log Out (${role})`}
							</button>
						</li>
					) : (
						<li className="nav-item">
							<Link to="/login">Login or Sign Up</Link>
						</li>
					)}
				</ul>
			</nav>

			{authError && <p role="alert">{authError}</p>}

			<div className="content">
				<Routes>
					<Route
						path="/"
						element={<Home role={role} userEmail={userEmail} userDept={userDept} />}
					/>

					{/* Public Visitor Animal Directory */}
					<Route
						path="/animal-directory"
						element={<VisitorAnimalDirectory />}
					/>

					<Route
						path="/directory"
						element={
							<ReturnDir role={role} userEmail={userEmail} userDept={userDept} isDeptHead={isDeptHead} />
						}
					/>

					<Route
						path="/employees"
						element={
							<ReturnDir role={role} userEmail={userEmail} userDept={userDept} isDeptHead={isDeptHead} />
						}
					/>

					<Route
						path="/payroll"
						element={
							isFinHR
								? <PayrollPage isDeptHead={isDeptHead} isFinHR={isFinHR} />
								: <Navigate to="/" replace />
						}
					/>

					<Route
						path="/profit"
						element={
							isFinHR
								? <ProfitPage />
								: <Navigate to="/" replace />
						}
					/>

					<Route
						path="/revenue-details"
						element={
							isFinHR
								? <RevenueDetails role={role} userDept={userDept} />
								: <Navigate to="/" replace />
						}
					/>

					<Route
						path="/login"
						element={<LoginPage onLogin={handleLogin} />}
					/>

					<Route
						path="/gift-shop"
						element={<GiftShop role={role} userEmail={userEmail} userDept={userDept} />}
					/>

					<Route
						path="/food"
						element={<Food role={role} userDept={userDept} />}
					/>
					<Route
						path="/food/stalls/:stallId"
						element={<Food role={role} userDept={userDept} />}
					/>

					{/* Staff Animal Management */}
					<Route
						path="/animals"
						element={
							isStaff
								? <AnimalManagement role={role} userEmail={userEmail} />
								: <Navigate to="/animal-directory" replace />
						}
					/>

					{/* Staff Enclosure Management */}
					<Route
						path="/enclosures"
						element={
							isStaff
								? <EnclosureManagement />
								: <Navigate to="/" replace />
						}
					/>

					<Route
						path="/species-report"
						element={
							isStaff
								? <SpeciesReport role={role} userEmail={userEmail} />
								: <Navigate to="/animal-directory" replace />
						}
					/>

					<Route
						path="/attractions-management"
						element={
							isGuestOpsHead
								? <AttractionManagement />
								: <Navigate to="/attractions" replace />
						}
					/>

					<Route
						path="/attractions"
						element={<VisitorAttractions canManage={isGuestOpsHead} />}
					/>
					<Route
						path="/attractions-directory"
						element={<VisitorAttractions canManage={isGuestOpsHead} />}
					/>

					<Route
						path="/donations"
						element={
							<Donations
								role={role}
								userEmail={userEmail}
								token={localStorage.getItem('user_token')}
							/>
						}
					/>

					<Route
						path="/tickets"
						element={<Tickets userEmail={userEmail} />}
					/>
				</Routes>
			</div>
		</>
	);
}

function App() {
	return (
		<Router>
			<AppContent />
		</Router>
	);
}

export default App;
