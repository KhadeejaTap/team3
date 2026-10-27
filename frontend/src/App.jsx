import './App.css';
import { useState } from 'react';
import LoginPage from './khadeeja/login';
import ReturnDir from './khadeeja/employee_directory';
import Donations from './kim/Donations';
import Home from './Home';
import GiftShop from './Daniel/giftshop';
import Food from './Daniel/food';
import Parking from './Daniel/parking';
import AnimalManagement from './animals/AnimalManagement';
import AttractionManagement from './Attractions/attractionManagement';
import Tickets from './Tickets/Tickets';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';

function App() {
  const [role, setRole] = useState(
    () => localStorage.getItem('user_role')
  );

  const [userEmail, setUserEmail] = useState(
    () => localStorage.getItem('user_email')
  );

  const handleLogin = (newRole, newEmail) => {
    setRole(newRole);
    setUserEmail(newEmail);

    if (newRole) {
      localStorage.setItem('user_role', newRole);

      if (newEmail) {
        localStorage.setItem('user_email', newEmail);
      } else {
        localStorage.removeItem('user_email');
      }
    } else {
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_email');
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
            <Link to="/gift-shop">Gift Shop</Link>
          </li>

          <li className="nav-item">
            <Link to="/food">Food</Link>
          </li>

          <li className="nav-item">
            <Link to="/parking">Parking</Link>
          </li>

          <li className="nav-item">
            <Link to="/animals">Animal Management</Link>
          </li>

          <li className="nav-item">
            <Link to="/attractions">Attraction Management</Link>
          </li>

          <li className="nav-item">
            <Link to="/donations">Donations</Link>
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

          <Route
            path="/directory"
            element={
              <ReturnDir role={role} userEmail={userEmail} />
            }
          />

          <Route
            path="/employees"
            element={
              <ReturnDir role={role} userEmail={userEmail} />
            }
          />

          <Route
            path="/login"
            element={<LoginPage onLogin={handleLogin} />}
          />

          <Route path="/gift-shop" element={<GiftShop />} />
          <Route path="/food" element={<Food />} />
          <Route path="/parking" element={<Parking />} />
          <Route path="/animals" element={<AnimalManagement />} />

          <Route
            path="/attractions"
            element={<AttractionManagement />}
          />

          <Route path="/donations" element={<Donations />} />
          <Route path="/tickets" element={<Tickets />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;