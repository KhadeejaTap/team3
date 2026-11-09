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
import EnclosureManagement from './animals/EnclosureManagement';
import VisitorAnimalDirectory from './VisitorAnimalDirectory';
import AttractionManagement from './Attractions/attractionManagement';
import VisitorAttractions from './Attractions/VisitorAttractions';
import Tickets from './Tickets/Tickets';
import RevenueDetails from './khadeeja/RevenueDetails';
import SpeciesReport from './animals/SpeciesReport';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation
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

  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState('');

  function handleLogin(newRole, newEmail, newDept) {
    setAuthError('');
    setRole(newRole);
    setUserEmail(newEmail);
    const parsedDept = newDept ? Number(newDept) : null;
    setUserDept(parsedDept);

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
    } else {
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_email');
      localStorage.removeItem('user_dept');
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

  const isStaff = ['manager', 'employee', 'admin'].includes(role);
  const isVisitor = !role || role === 'visitor';

  // Department 1: Financial and HR
  const isFinHR =
    userDept === 1 ||
    userEmail === 'taylor.hemsworth@zoo.com' ||
    userEmail === 'jim.cruise@zoo.com' ||
    userEmail === 'sarah.connor@zoo.com';

  // Department 3: Commercial Operations (Gift Shop, Food, Parking)
  const isCommercialStaff =
    userDept === 3 ||
    userDept === 6 ||
    userDept === 7 ||
    userDept === 8 ||
    userEmail === 'emma.watson@zoo.com' ||
    userEmail === 'gordon.ramsay@zoo.com' ||
    userEmail === 'vin.diesel@zoo.com' ||
    userEmail === 'tom.hardy@zoo.com' ||
    userEmail === 'mia.goth@zoo.com';

  // Department 4: Guest Operations (Attractions, Tours, Educational Shows)
  const isGuestOpsStaff =
    userDept === 4 ||
    userDept === 9 ||
    userEmail === 'rachel.green@zoo.com' ||
    userEmail === 'chris.pratt@zoo.com' ||
    userEmail === 'zendaya.coleman@zoo.com';

  const isGuestOpsHead =
    (userDept === 4 && role === 'manager') ||
    userEmail === 'rachel.green@zoo.com';

  return (
    <>
      <nav className="navbar">
        <ul className="nav-list">
          <li className="nav-item">
            <Link to="/">Home</Link>
          </li>

            {/* Financial / HR: Executive & Financial Oversight */}
            {isFinHR && (
              <>
                <li className="nav-item">
                  <Link to="/directory">Staff & Payroll</Link>
                </li>
                <li className="nav-item">
                  <Link to="/revenue-details">Revenue Details</Link>
                </li>
              </>
            )}

            {/* Commercial Operations Staff (Gift Shop, Dining) */}
            {isCommercialStaff && !isFinHR && (
              <>
                <li className="nav-item">
                  <Link to="/directory">Directory</Link>
                </li>
                <li className="nav-item">
                  <Link to="/gift-shop">Gift Shop Operations</Link>
                </li>
                <li className="nav-item">
                  <Link to="/food">Food Operations</Link>
                </li>
              </>
            )}

            {/* Guest Operations Staff (Tours, Shows, Attractions) */}
            {isGuestOpsStaff && !isFinHR && !isCommercialStaff && (
              <>
                <li className="nav-item">
                  <Link to="/directory">Directory</Link>
                </li>
                {isGuestOpsHead && (
                  <li className="nav-item">
                    <Link to="/attractions">Attraction Management</Link>
                  </li>
                )}
              </>
            )}

            {/* Animal Operations & Other Field Staff */}
            {isStaff &&
              !isFinHR &&
              !isCommercialStaff &&
              !isGuestOpsStaff && (
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

            {/* Public Visitors */}
            {isVisitor && (
              <>
                <li className="nav-item">
                  <Link to="/animal-directory">Meet the Animals</Link>
                </li>
                <li className="nav-item">
                  <Link to="/attractions">Exhibits & Shows</Link>
                </li>
                <li className="nav-item">
                  <Link to="/tickets">Purchase a Ticket</Link>
                </li>
                <li className="nav-item">
                  <Link to="/gift-shop">Gift Shop</Link>
                </li>
                <li className="nav-item">
                  <Link to="/food">Food & Dining</Link>
                </li>
                <li className="nav-item">
                  <Link to="/donations">Donations</Link>
                </li>
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
            element={<Home role={role} userEmail={userEmail} />}
          />

          {/* Public Visitor Animal Directory */}
          <Route
            path="/animal-directory"
            element={<VisitorAnimalDirectory />}
          />

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
            element={<GiftShop role={role} userEmail={userEmail} />}
          />

          <Route
            path="/food"
            element={<Food role={role} />}
          />

          <Route
            path="/parking"
            element={<Parking role={role} />}
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
            path="/attractions"
            element={isStaff ? <AttractionManagement /> : <VisitorAttractions />}
          />
          <Route
            path="/attractions-directory"
            element={<VisitorAttractions />}
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
