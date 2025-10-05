import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ExamplePage from "./pages/ExamplePage";
import Root from "./pages/Root";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={ <Root/>} />
        <Route path="/example" element={<ExamplePage />} />
      </Routes>
    </Router>
  );
}

export default App;
