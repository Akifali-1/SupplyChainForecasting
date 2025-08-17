import React, { useState } from "react";
import ProjectInfo from "./components/ProjectInfo";
import CompanyRegistration from "./components/CompanyRegistration";
import FileUpload from "./components/FileUpload";
import StatusDisplay from "./components/StatusDisplay";
import ForecastQuery from "./components/ForecastQuery";
import "./App.css";

export default function App() {
  const [company, setCompany] = useState(null);

  return (
    <div>
      <header>Supply Chain Demand Prediction</header>

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
            <h2>Welcome, {company.name}</h2>
            <FileUpload companyId={company._id} />
          </div>

          <div className="section">
            <ForecastQuery companyId={company._id} />
          </div>

          <div className="section">
            {/*Only show this company’s status */}
            <StatusDisplay companyId={company._id} />
          </div>
        </>
      )}
    </div>
  );
}
