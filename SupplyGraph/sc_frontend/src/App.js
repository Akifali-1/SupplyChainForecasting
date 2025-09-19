import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Homepage from "./pages/Homepage";
import Registration from "./pages/Registration";
import Login from "./pages/Login";
import Upload from "./pages/Upload";
import Prediction from "./pages/Prediction";
import { Toaster } from "./components/ui/toaster";

// Protected Route component (waits for auth to hydrate from localStorage)
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null; // or a spinner placeholder
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <div className="App min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<Homepage />} />
            <Route path="/register" element={<Registration />} />
            <Route path="/login" element={<Login />} />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } />
            <Route path="/prediction" element={
              <ProtectedRoute>
                <Prediction />
              </ProtectedRoute>
            } />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;