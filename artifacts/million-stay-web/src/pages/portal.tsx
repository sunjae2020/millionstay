import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/store";

export default function Portal() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) {
      setLocation("/login?redirect=/portal/bookings");
    } else {
      setLocation("/portal/bookings");
    }
  }, [token, setLocation]);

  return null;
}
