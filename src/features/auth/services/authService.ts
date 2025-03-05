import whagonsApi, { whagonsWeb } from "../../../api/whagonsApi";

interface LoginResponse {
  token: string;
  user: {
    id: number;
    name: string;
  };
}

interface LoginData {
  username: string;
  password: string;
}

export const authService = {
  login: async (data: LoginData): Promise<LoginResponse> => {

    const { username, password } = data;
    const loginCredentials = {
      email: username,
      password: password,
    };

    try {
      const response = await whagonsApi.post("/login", loginCredentials);
      
      return response.data.data;
    } catch (error) {
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await whagonsApi.post("/auth/logout");
    } catch (error) {
      throw error;
    }
  },

  getSession: async (): Promise<boolean> => {

    try {
      const response = await whagonsWeb.get("/sanctum/csrf-cookie");
      return response.status === 204;
    } catch (error) {
      throw error;
    }
  },
};
