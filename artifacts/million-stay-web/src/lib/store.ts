import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface GuestInfo {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  account_id: number | null;
}

interface AuthState {
  token: string | null;
  guest: GuestInfo | null;
  setAuth: (token: string, guest: GuestInfo) => void;
  setGuest: (guest: GuestInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      guest: null,
      setAuth: (token, guest) => {
        set({ token, guest });
        localStorage.setItem("ms_auth_token", token);
      },
      setGuest: (guest) => set({ guest }),
      logout: () => {
        set({ token: null, guest: null });
        localStorage.removeItem("ms_auth_token");
      },
    }),
    {
      name: "ms-auth-storage",
    }
  )
);

// Initialize token getter for custom fetch
setAuthTokenGetter(() => {
  return localStorage.getItem("ms_auth_token") || null;
});
