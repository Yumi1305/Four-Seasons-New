import { useLocation, useNavigate } from "react-router-dom";

export default function HoursLink() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const isHome = location.pathname === "/";
    if (!isHome) {
      navigate("/");
      setTimeout(
        () => document.getElementById("hours")?.scrollIntoView({ behavior: "smooth" }),
        150
      );
    } else {
      document.getElementById("hours")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a href="/#hours" onClick={handleClick}>
      Hours / Info
    </a>
  );
}

