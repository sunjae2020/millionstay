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
  avatar_url?: string | null;
}

interface AuthState {
  token: string | null;
  guest: GuestInfo | null;
  setAuth: (token: string, guest: GuestInfo) => void;
  setGuest: (guest: GuestInfo) => void;
  logout: () => void;
}

const GUEST_TOKEN_KEY = "ms_guest_token";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

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
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.logout();
        }
      },
    }
  )
);

// Initialize token getter for custom fetch
setAuthTokenGetter(() => {
  const token = localStorage.getItem(GUEST_TOKEN_KEY);
  if (token && isTokenExpired(token)) {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    return null;
  }
  return token;
});
