import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import WeddingsPage from "./pages/WeddingsPage";
import WeddingDetailPage from "./pages/WeddingDetailPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<WeddingsPage />} />
          <Route path="/weddings/:weddingId" element={<WeddingDetailPage />} />
          <Route path="/weddings/:weddingId/programs/:programId" element={<ProgramDetailPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
