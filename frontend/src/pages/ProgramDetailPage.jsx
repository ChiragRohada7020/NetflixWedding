import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet } from "../api";

export default function ProgramDetailPage() {
  const { programId } = useParams();
  const [episodes, setEpisodes] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet(`/api/programs/${programId}/episodes`)
      .then(setEpisodes)
      .catch((e) => setError(e.message));
  }, [programId]);

  return (
    <section>
      <h1>Events</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {episodes.map((e) => (
          <a key={e._id} href={e.youtube_url} target="_blank" rel="noreferrer" className="card">
            <img src={e.thumbnail} alt={e.title} />
            <h3>{e.title}</h3>
            <p>{e.description}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
