import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="nav">
      <Link to="/" className="brand">Wedflix</Link>
      <a href="http://127.0.0.1:5000/admin" className="btn">Admin</a>
    </nav>
  );
}
