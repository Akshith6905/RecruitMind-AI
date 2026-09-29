import React, { useState } from 'react';
import { BrainCircuit } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'recruiter' && password === 'password123') {
      onLogin({
        name: 'Recruiter',
        initials: 'R',
        role: 'Talent partner'
      });
    } else {
      setError('Invalid username or password. Use recruiter / password123');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon"><BrainCircuit size={28}/></span>
          <span>recruit<span className="brand-accent">mind</span></span>
        </div>
        <h2>Sign in to Workspace</h2>
        <p>Enter your credentials to access the hiring pipeline.</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          <button type="submit" className="primary login-btn">Sign In</button>
        </form>
      </div>
    </div>
  );
}
