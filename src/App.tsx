import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameBoard } from "./components/GameBoard";
import { PuzzleCreatorSimple } from "./pages/PuzzleCreatorSimple";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div className="app">
              <GameBoard />
            </div>
          }
        />
        <Route path="/creator" element={<PuzzleCreatorSimple />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
