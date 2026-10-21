import '.././App.css'
import { useState } from 'react';
function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		try {
			const res = await fetch('http://localhost:5000/api/login', { //options object
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});
			const data = await res.json(); //await so waits for all info to arrive
			if (res.ok) { //meaning within valid codes of 200 and 299
				alert(`Welcome ${data.username}! Role: ${data.role}`);
			} else {
				setError(data.error || 'Login Failed')
			}
		}
		catch (err) {
			setError('Cannot connect to server');
		}
	}
	//still need to add: autocreate account for new employee with random pass, email employee to make new pass?? and a sign up button for visitors (if email exists let them know)
	return (
		<div className="login-container">
			<h2> Login to Zoo Portal </h2>
			<p>{error}</p>
			<form onSubmit={handleSubmit}>
				<div>
					<label>Email:</label>
					<input
						type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
					/>
				</div>
				<div>
					<label>Password:</label>
					<input
						type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
					/>
				</div>
				<button type="submit"> Log In </button>
			</form>
		</div>

	);
}

export default LoginPage;
