import '../App.css';
import { useState } from 'react';

const API = 'http://localhost:5000/api';

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const endpoint = isSignUp ? '/register' : '/login';

      const response = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          (isSignUp ? 'Registration failed.' : 'Login failed.')
        );
      }

      if (isSignUp) {
        setIsSignUp(false);
        setPassword('');
        setMessage('Account created. Please log in.');
        return;
      }

      if (
        typeof data.token !== 'string' ||
        !data.token ||
        typeof data.role !== 'string'
      ) {
        throw new Error(
          'The server did not return a login token. Restart the updated backend and try again.'
        );
      }

      localStorage.setItem('user_token', data.token);
      onLogin(data.role, data.email);
      setPassword('');
      setMessage(`Logged in as ${data.role}.`);
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
    } finally {
      setSaving(false);
    }
  }

  function toggleMode() {
    setIsSignUp(previous => !previous);
    setPassword('');
    setError('');
    setMessage('');
  }

  return (
    <div className="login-container">
      <h2>
        {isSignUp
          ? 'Create Visitor Account'
          : 'Login to Zoo Portal'}
      </h2>

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      {message && <p role="status">{message}</p>}

      <form onSubmit={handleSubmit}>
        <p>
          <label>
            Email<br />
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="username"
              disabled={saving}
              required
            />
          </label>
        </p>

        <p>
          <label>
            Password<br />
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={
                isSignUp ? 'new-password' : 'current-password'
              }
              disabled={saving}
              required
            />
          </label>
        </p>

        <button type="submit" disabled={saving}>
          {saving
            ? 'Please wait...'
            : isSignUp
              ? 'Create Account'
              : 'Log In'}
        </button>
      </form>

      <p>
        {isSignUp
          ? 'Already have an account?'
          : "Don't have an account?"}
      </p>

      <button
        type="button"
        onClick={toggleMode}
        disabled={saving}
      >
        {isSignUp ? 'Go to Login' : 'Sign Up as Visitor'}
      </button>
    </div>
  );
}

export default LoginPage;
