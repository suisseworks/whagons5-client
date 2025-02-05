import { useDispatch, useSelector } from "react-redux";
import { checking, OnLoadingError, onLogin, type RootState } from "../../../store";
import { authService } from "../services/authService";
import { useNavigate } from "react-router";
// import { al } from "react-router/dist/development/fog-of-war-DU_DzpDb";

export const useAuthStore = () => {

    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { status, user, errorMessage } = useSelector((state: RootState) => state.auth);

    const startLogin = async (username: string,  password: string) => {

        dispatch( checking() );

        try {
            const { token, user } = await authService.login({ username, password });

            localStorage.setItem('token', token);
            localStorage.setItem('token-init-date', String(new Date().getTime()));
            localStorage.setItem('user', JSON.stringify(user));

            await authService.getSession();

            dispatch( onLogin(user) );
            
            // to do navigate to home
            navigate('/tasks', { replace: true });

        } catch (error) {
            
            dispatch( OnLoadingError("Credenciales incorrectas") );
            alert('Credenciales incorrectas');
        }
    }


    return {
        status,
        user,
        errorMessage,

        startLogin,
    }

}
