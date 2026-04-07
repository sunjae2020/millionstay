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

const GUEST_TOKEN_KEY = "ms_guest_token";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      guest: null,
      setAuth: (token, guest) => {
        set({ token, guest });
        localStorage.setItem(GUEST_TOKEN_KEY, token);
      },
      setGuest: (guest) => set({ guest }),
      logout: () => {
        set({ token: null, guest: null });
        localStorage.removeItem(GUEST_TOKEN_KEY);
      },
    }),
    {
      name: "ms-guest-storage",
    }
  )
);

// Initialize token getter for custom fetch
setAuthTokenGetter(() => {
  return localStorage.getItem(GUEST_TOKEN_KEY) || null;
});
