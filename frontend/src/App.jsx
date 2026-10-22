
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
                        <Link to="/animals">Animal Query</Link>
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
}

export default App;
