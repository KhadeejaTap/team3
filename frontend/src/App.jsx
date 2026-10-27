import './App.css';
import LoginPage from './khadeeja/login';
import Donations from './kim/Donations';
import Home from './Home';
import { useState } from 'react';
import ReturnDir from './khadeeja/employee_directory';
import AnimalManagement from './animals/AnimalManagement';
import AttractionManagement from './Attractions/attractionManagement';
import Tickets from './Tickets/Tickets';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
	const [role, setRole] = useState(() => localStorage.getItem('user_role'));
	const [userEmail, setUserEmail] = useState(() => localStorage.getItem('user_email'));
	const [userID, setUserID] = useState(() => localStorage.getItem('user_id'));
	const [token, setToken] = useState(() => localStorage.getItem('auth_token'));

	// changed login with token 
	const handleLogin = (newRole, newEmail, newUserID, newToken) => {
		setRole(newRole);
		setUserEmail(newEmail);
		setUserID(newUserID ? String(newUserID) : null);
		setToken(newToken || null);

		if (newRole) {
			localStorage.setItem('user_role', newRole);

			if (newEmail) {
				localStorage.setItem('user_email', newEmail);
			}

			if (newUserID) {
				localStorage.setItem('user_id', String(newUserID));
			}

			if (newToken) {
				localStorage.setItem('auth_token', newToken);
			} else {
				localStorage.removeItem('auth_token');
			}
		} else {
			localStorage.removeItem('user_role');
			localStorage.removeItem('user_email');
			localStorage.removeItem('user_id');
			localStorage.removeItem('auth_token');
		}
	};

	const handleLogout = () => {
		handleLogin(null, null);
	};

	return (
		<Router>
			<nav className="navbar">
				<ul className="nav-list">
					<li className="nav-item">
						<Link to="/">Home</Link>
					</li>
					{['admin', 'manager', 'employee'].includes(role) && (
						<li className="nav-item">
							<Link to="/directory">Directory</Link>
						</li>
					)}
					<li className="nav-item">
						<Link to="/animals">Animal Management</Link>
					</li>
					<li className="nav-item">
						<Link to="/attractions">Attraction Management</Link>
					</li>
					<li className="nav-item">
						<Link to="/donations"> Donations </Link>
          </li>
          <li className="nav-item">
						<Link to="/tickets">Purchase a Ticket</Link>
					</li>
					{role ? (
						<li className="nav-item">
							<button type="button" onClick={handleLogout}>
								Log Out ({role})
							</button>
						</li>
					) : (
						<li className="nav-item">
							<Link to="/login">Login or Sign Up</Link>
						</li>
					)}
				</ul>
			</nav>

			<div className="content">
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/directory" element={<ReturnDir role={role} userEmail={userEmail} />} />
					<Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
					<Route path="/animals" element={<AnimalManagement />} />
					<Route path="/attractions" element={<AttractionManagement />} />
					<Route path="/donations" element={<Donations role={role} userEmail={userEmail} userID={userID} token={token}/>}/>
					<Route path="/tickets" element={<Tickets />} />
				</Routes>
			</div>
		</Router>
	);
}

export default App;
