import "../styles/auth.css";

import { useForm } from "../../../hooks";


const loginFormFields = {
  loginUser: '',
  loginPassword: '',
} 

export const LoginPage = () => {

  const { loginUser, loginPassword, onInputChange } = useForm(loginFormFields);

  const loginSubmit = (e) => {
    e.preventDefault();
    console.log('loginSubmit');
    console.log(`loginUser: ${loginUser} loginPassword: ${loginPassword}`);
    
    // startLogin({ email: loginEmail, password: loginPassword });
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={loginSubmit}>
        <h2>Login</h2>
        <div className="form-group">
          <label htmlFor="username">Usuario:</label>
          <input 
            type="text" 
            name='loginUser'
            value={loginUser}
            onChange={onInputChange} 
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña:</label>
          <input 
            type="password" 
            name='loginPassword'
            value={loginPassword}
            onChange={onInputChange} 
          />
        </div>
        <button type="submit" className="login-button">Login</button>
      </form>
    </div>

  )
}
