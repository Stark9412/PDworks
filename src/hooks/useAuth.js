import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Hook to access auth context
 * Must be used within AuthProvider
 */
export default function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
