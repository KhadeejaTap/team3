import '.././App.css'
import { useState } from 'react';
function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [isSignUp, setIsSignUp] = useState(false);
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
		catch {
			setError('Cannot connect to server');
		}
	}
	//still need to add: autocreate account for new employee with random pass, email employee to make new pass?? and a sign up button for visitors (if email exists let them know)
	return (
		<div className="login-container">
			<h2> {isSignUp ? "Create Visitor Account" : "Login to Zoo Portal"} </h2>
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
				<button type="submit"> {isSignUp ? "Create Account" : "Log In"} </button>
			</form>
			<p>{isSignUp ? "Already have an account?" : "Don't have an account?"}</p>
			<button type="button" onClick={() => setIsSignUp(!isSignUp)}>
				{isSignUp ? "Go to Login" : "Sign Up"}
			</button>
		</div>

	);
}

export default LoginPage;
