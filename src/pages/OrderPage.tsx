import { useEffect } from "react";
import { CHOWBUS_URL } from "../constants";

export default function OrderPage() {
  useEffect(() => {
    window.location.href = CHOWBUS_URL;
  }, []);

  return (
    <main className="page-content">
      <div className="container" style={{ textAlign: "center", padding: "80px 20px" }}>
        <p>Redirecting to online ordering…</p>
        <a href={CHOWBUS_URL} className="btn-primary">
          Go to Chowbus
        </a>
      </div>
    </main>
  );
}

