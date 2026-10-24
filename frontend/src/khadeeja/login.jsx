import '.././App.css';
import { useState } from 'react';

function LoginPage({ onLogin }) {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isSignUp, setIsSignUp] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');

		const endpoint = isSignUp
			? 'http://localhost:5000/api/register'
			: 'http://localhost:5000/api/login';

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await res.json().catch(() => ({}));

			if (res.ok) {
				const userRole = isSignUp ? 'visitor' : data.role;
				if (isSignUp) {
					alert('Visitor account created successfully! You are now logged in.');
				} else {
					alert(`Welcome! Role: ${userRole}`);
				}
				onLogin(userRole);
			} else {
				setError(data.error || (isSignUp ? 'Registration failed' : 'Login failed'));
			}
		} catch (err) {
			console.error('Auth error:', err);
			setError('Cannot connect to server. Please ensure the backend is running.');
		}
	};

	const toggleMode = () => {
		setIsSignUp(!isSignUp);
		setError('');
	};

	return (
		<div className="login-container">
			<h2>{isSignUp ? 'Create Visitor Account' : 'Login to Zoo Portal'}</h2>

			{error && <p style={{ color: 'red' }}><strong>Error: </strong>{error}</p>}

			<form onSubmit={handleSubmit}>
				<div>
					<label>Email: </label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>
				<br />
				<div>
					<label>Password: </label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				<br />
				<button type="submit">{isSignUp ? 'Create Account' : 'Log In'}</button>
			</form>

			<br />
			<p>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</p>
			<button type="button" onClick={toggleMode}>
				{isSignUp ? 'Go to Login' : 'Sign Up as Visitor'}
			</button>
		</div>
	);
}

export default LoginPage;
