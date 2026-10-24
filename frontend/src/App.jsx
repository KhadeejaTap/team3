<<<<<<< HEAD
import './App.css';
import LoginPage from './khadeeja/login';
import Home from './Home';
import { useState } from 'react';
import ReturnDir from './khadeeja/employee_directory';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
	const [role, setRole] = useState(() => localStorage.getItem('user_role'));

	const handleLogin = (newRole) => {
		setRole(newRole);
		if (newRole) {
			localStorage.setItem('user_role', newRole);
		} else {
			localStorage.removeItem('user_role');
		}
	};

	const handleLogout = () => {
		handleLogin(null);
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
					<Route path="/directory" element={<ReturnDir role={role} />} />
					<Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
				</Routes>
			</div>
		</Router>
	);
=======

import './App.css';
import EmpView from './khadeeja/employee_directory';
import LoginPage from './khadeeja/login';
import Home from './Home';
import AnimalManagement from './animals/AnimalManagement';

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

function App() {
    return (
        <Router>
            <nav className="navbar">
                <ul className="nav-list">
                    <li className="nav-item">
                        <Link to="/employees">Employee Dir</Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/login">Login or Sign Up</Link>
                    </li>
                    <li className="nav-item">
                        <Link to="/animals">Animal Management</Link>
                    </li>
                </ul>
            </nav>

            <div className="content">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/employees" element={<EmpView />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/animals" element={<AnimalManagement />} />
                </Routes>
            </div>
        </Router>
    );
>>>>>>> origin/main
}

export default App;
