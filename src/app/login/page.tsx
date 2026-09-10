"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Email o contraseña incorrectos.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="flex items-center justify-center h-screen" style={{ background: "var(--c-bone)" }}>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg p-8 w-full max-w-sm"
        style={{ border: "1px solid var(--line)" }}
      >
        <h1 className="text-xl heading-title mb-1" style={{ color: "var(--ink)" }}>Tropera</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Marketing OS</p>

        <label className="text-xs" style={{ color: "var(--muted)" }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 mt-1 px-3 py-2 rounded-md text-sm"
          style={{ border: "1px solid var(--line)" }}
        />

        <label className="text-xs" style={{ color: "var(--muted)" }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-4 mt-1 px-3 py-2 rounded-md text-sm"
          style={{ border: "1px solid var(--line)" }}
        />

        {error && <p className="text-xs mb-4" style={{ color: "var(--c-danger)" }}>{error}</p>}

        <button
          type="submit"
          className="w-full py-2 rounded-md text-sm text-white"
          style={{ background: "var(--c-forest)" }}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
