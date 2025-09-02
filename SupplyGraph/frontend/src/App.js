import React, { useState, useEffect } from "react";
import ProjectInfo from "./components/ProjectInfo";
import CompanyRegistration from "./components/CompanyRegistration";
import FileUpload from "./components/FileUpload";
import StatusDisplay from "./components/StatusDisplay";
import ForecastQuery from "./components/ForecastQuery";
import GoogleLoginButton from "./components/GoogleLoginButton"; 
import { getCurrentUser, logoutUser } from "./services/api";   
import "./App.css";

export default function App() {
  const [company, setCompany] = useState(null);
  const [user, setUser] = useState(null);

  // On mount → check if logged in
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  // Handle logout
  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setCompany(null);
  };

  // If not logged in → show Google login
  if (!user) {
    return (
      <div>
        <h1>Supply Chain Demand Prediction</h1>
        <GoogleLoginButton onLogin={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div>
      <header>
        Supply Chain Demand Prediction | Logged in as {user.email}
        <button onClick={handleLogout} style={{ marginLeft: "20px" }}>
          Logout
        </button>
      </header>

      <div className="section">
        <ProjectInfo />
      </div>

      {!company ? (
        <div className="section">
          <CompanyRegistration onRegister={setCompany} />
        </div>
      ) : (
        <>
          <div className="section">
            <h2>Company: {company.name}</h2>
            <FileUpload companyId={company._id} />
          </div>

          <div className="section">
            <ForecastQuery companyId={company._id} />
          </div>

          <div className="section">
            <StatusDisplay companyId={company._id} />
          </div>
        </>
      )}
    </div>
  );
}
