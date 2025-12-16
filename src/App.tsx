import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameBoard } from "./components/GameBoard";
import { PuzzleCreatorSimple } from "./pages/PuzzleCreatorSimple";
import { BulkPuzzleCreator } from "./pages/bulk/BulkPuzzleCreator";
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
        <Route path="/creator/bulk" element={<BulkPuzzleCreator />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
