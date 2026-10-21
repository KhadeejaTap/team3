import './App.css';
import EmpView from './khadeeja/employee_directory';
import LoginPage from './khadeeja/login';
import Home from './Home';
import GiftShop from './GiftShop';
import Food from './Food';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';

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
            <Link to="/gift-shop">Gift Shop</Link>
          </li>
          <li className="nav-item">
            <Link to="/food">Food</Link>
          </li>
        </ul>
      </nav>

      <div className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/employees" element={<EmpView />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/gift-shop" element={<GiftShop />} />
          <Route path="/food" element={<Food />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;