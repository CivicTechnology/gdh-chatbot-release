import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

export const SignOutForm = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async (e: React.FormEvent) => {
    e.preventDefault();
    await logout();
    navigate("/");
  };

  return (
    <form className="w-full" onSubmit={handleSignOut}>
      <button
        className="w-full px-1 py-0.5 text-left text-red-500"
        type="submit"
      >
        Uitloggen
      </button>
    </form>
  );
};
