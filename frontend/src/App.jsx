import { useState } from 'react'
import './App.css'
import EmpView from './khadeeja/EmpView';
import Home from './Home';

import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

function App() {
	const [count, setCount] = useState(0)

	return (
		<Router>
			<nav className="navbar">
				<ul className="nav-list">
					<li className="nav-item">
						<Link to="/employees">Employee Dir</Link>
					</li>
				</ul>
			</nav>

			<div className="content">
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/employees" element={<EmpView />} />
				</Routes>
			</div>
		</Router>
	);
}

export default App
