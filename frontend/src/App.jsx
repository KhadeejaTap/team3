import './App.css';
import { useState } from 'react';
import { apiFetch } from './api';

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
import RevenueDetails from './khadeeja/RevenueDetails';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';

function App() {
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

  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState('');

  function handleLogin(newRole, newEmail) {
    setAuthError('');
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
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_email');
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

  return (
    <Router>
      <nav className="navbar">
        <ul className="nav-list">
          <li className="nav-item">
            <Link to="/">Home</Link>
          </li>

          {['admin', 'manager', 'employee'].includes(role) && (
            <>
              <li className="nav-item">
                <Link to="/directory">Directory</Link>
              </li>
              <li className="nav-item">
                <Link to="/animals">Animal Management</Link>
              </li>
              <li className="nav-item">
                <Link to="/attractions">Attraction Management</Link>
              </li>
            </>
          )}

          {role === 'admin' && (
            <li className="nav-item">
              <Link to="/revenue-details">Revenue Details</Link>
            </li>
          )}

          <li className="nav-item">
            <Link to="/tickets">Purchase a Ticket</Link>
          </li>

          <li className="nav-item">
            <Link to="/donations">Donations</Link>
          </li>

          <li className="nav-item">
            <Link to="/gift-shop">Gift Shop</Link>
          </li>

          <li className="nav-item">
            <Link to="/food">Food</Link>
          </li>

          <li className="nav-item">
            <Link to="/parking">Parking</Link>
          </li>

          {role ? (
            <li className="nav-item">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut
                  ? 'Logging out...'
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
          <Route path="/" element={<Home />} />

          <Route
            path="/directory"
            element={
              <ReturnDir role={role} userEmail={userEmail} />
            }
          />

          <Route
            path="/revenue-details"
            element={<RevenueDetails role={role} />}
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

          <Route
            path="/gift-shop"
            element={<GiftShop role={role} />}
          />

          <Route
            path="/food"
            element={<Food role={role} />}
          />

          <Route
            path="/parking"
            element={<Parking role={role} />}
          />

          <Route
            path="/animals"
            element={<AnimalManagement />}
          />

          <Route
            path="/attractions"
            element={<AttractionManagement />}
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
            element={<Tickets />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;