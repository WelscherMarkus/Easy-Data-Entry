import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Root from "./pages/Root";

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor/:table?" element={ <Root/>} />
      </Routes>
    </Router>
  );
}

export default App;
