"use client";

import { useState } from "react";
import { apiUrl } from "./lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: any) => {
    e.preventDefault();

    const response = await fetch(apiUrl("/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.location.href = "/dashboard";
    } else {
      alert(data.error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black">
            TRIANGLE WMS PRO
          </h1>
          <p className="text-gray-500 mt-2">
            Connexion sécurisée au système
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded-xl px-4 py-3 text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            className="w-full border rounded-xl px-4 py-3 text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl"
          >
            Se connecter
          </button>
        </form>

        <p className="text-gray-500 text-sm mt-5 text-center">
          Pas encore de compte ?{" "}
          <a href="/register" className="text-blue-600 font-bold">
            Créer une entreprise
          </a>
        </p>
      </div>
    </div>
  );
}
