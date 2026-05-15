import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet } from "../api";

export default function WeddingsPage() {
  const [weddings, setWeddings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet("/api/weddings")
      .then(setWeddings)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Our Family Wedding Memories</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {weddings.map((w) => (
          <Link key={w._id} to={`/weddings/${w._id}`} className="card">
            <img src={w.profile_image} alt={w.couple_names} />
            <h3>{w.couple_names}</h3>
            <p>{w.wedding_date}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
