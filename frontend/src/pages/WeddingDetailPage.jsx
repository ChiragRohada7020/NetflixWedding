import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet } from "../api";

export default function WeddingDetailPage() {
  const { weddingId } = useParams();
  const [wedding, setWedding] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet(`/api/weddings/${weddingId}`),
      apiGet(`/api/weddings/${weddingId}/programs`),
    ])
      .then(([w, p]) => {
        setWedding(w);
        setPrograms(p);
      })
      .catch((e) => setError(e.message));
  }, [weddingId]);

  const filtered = useMemo(() => {
    if (!q.trim()) return programs;
    return programs.filter((p) => (p.title || "").toLowerCase().includes(q.toLowerCase()));
  }, [programs, q]);

  return (
    <section>
      {wedding && (
        <header className="hero">
          <h1>{wedding.couple_names}</h1>
          <p>{wedding.wedding_date}</p>
        </header>
      )}
      <input
        className="search"
        placeholder="Search Programs"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {filtered.map((p) => (
          <Link key={p._id} to={`/weddings/${weddingId}/programs/${p._id}`} className="card">
            <img src={p.thumbnail} alt={p.title} />
            <h3>{p.title}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
