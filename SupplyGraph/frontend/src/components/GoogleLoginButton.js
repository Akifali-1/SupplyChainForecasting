import React from "react";

export default function GoogleLoginButton() {
  const handleLogin = () => {
    // Redirect directly to backend Google OAuth route
    window.location.href = "http://localhost:5000/api/auth/google";
  };

  return (
    <button 
      onClick={handleLogin} 
      style={{ padding: "10px 20px", margin: "20px", cursor: "pointer" }}
    >
      Login with Google
    </button>
  );
}
