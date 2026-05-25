import { useState } from "react";
import { NavLink } from "react-router-dom";
import { CHOWBUS_URL } from "../constants";
import HoursLink from "./HoursLink";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="logo" onClick={() => setMenuOpen(false)}>
          <span className="logo-mark" style={{cursor: 'pointer'}}>三餐四季</span>
          <span style={{cursor: 'pointer'}}
          className="logo-text">Four Seasons</span>
        </NavLink>

        <button
          className="nav-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`main-nav ${menuOpen ? "open" : ""}`}>
          <NavLink to="/" onClick={() => setMenuOpen(false)} end>
            About
          </NavLink>
          <NavLink to="/menu" onClick={() => setMenuOpen(false)}>
            Menu
          </NavLink>
          <NavLink to="/schedule2" onClick={() => setMenuOpen(false)}>
            Schedule
          </NavLink>
          <a
            href={CHOWBUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            Order (Chowbus)
          </a>
          <span onClick={() => setMenuOpen(false)}>
            <HoursLink />
          </span>
        </nav>
      </div>
    </header>
  );
}

