import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "../api";

export default function DeveloperLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (ev) => {
    ev.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiPost("/api/developer/login", form);
      if (!result?.is_developer) {
        setError("Developer access required.");
        return;
      }
      localStorage.setItem("wedflix_backend_auth_ok", "1");
      window.dispatchEvent(new Event("wedflix-auth-changed"));
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      await queryClient.invalidateQueries({ queryKey: ["weddings"] });
      await queryClient.invalidateQueries({ queryKey: ["wedding-programs"] });
      navigate("/developer");
    } catch (err) {
      setError(err?.message || "Developer login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="developer-login-page">
      <form className="developer-login-card" onSubmit={submit}>
        <p className="netflix-login-brand">WEDFLIX</p>
        <h1>Developer Login</h1>
        <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Developer email" />
        <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Password" />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Enter Dashboard"}</button>
      </form>
    </section>
  );
}
