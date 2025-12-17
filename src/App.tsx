import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GameBoard } from "./components/GameBoard";
import { AuthModal } from "./components/AuthModal";
import { DisplayNameModal } from "./components/DisplayNameModal";
import { PuzzleCreatorSimple } from "./pages/PuzzleCreatorSimple";
import { BulkPuzzleCreator } from "./pages/bulk/BulkPuzzleCreator";
import { Leaderboard } from "./pages/Leaderboard";
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
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/creator" element={<PuzzleCreatorSimple />} />
        <Route path="/creator/bulk" element={<BulkPuzzleCreator />} />
      </Routes>
      {/* Global Modals */}
      <AuthModal />
      <DisplayNameModal />
    </BrowserRouter>
  );
}

export default App;
