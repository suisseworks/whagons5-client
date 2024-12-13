import whagonsApi from "../../../api/whagonsApi";

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
    try {
      const response = await whagonsApi.post<LoginResponse>("/login", data);
      return response.data;
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
};
