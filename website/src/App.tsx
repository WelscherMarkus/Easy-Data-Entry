import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Root from "./pages/Root";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={ <Root/>} />
      </Routes>
    </Router>
  );
}

export default App;
