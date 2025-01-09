import "../styles/auth.css";
import { useForm } from "../../../hooks";
import { useAuthStore } from "../hooks/useAuthStore";



const loginFormFields = {
  loginUser: '',
  loginPassword: '',
} 

export const LoginPage = () => {

  const { loginUser, loginPassword, onInputChange } = useForm(loginFormFields);
  const { startLogin } = useAuthStore();

  const loginSubmit = (e: any) => {
    e.preventDefault();
    console.log('loginSubmit');
    console.log(`loginUser: ${loginUser} loginPassword: ${loginPassword}`);

    startLogin(loginUser, loginPassword);
  }


  return (
    <div className="body">
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
    </div>

  )
}
