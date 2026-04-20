export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">三餐四季</span>
          <span className="footer-name">Four Seasons</span>
        </div>
        <div className="footer-hours">
          <p>
            <span className="label">Sun – Thu</span>
            <span className="value">11:00 AM – 10:00 PM</span>
          </p>
          <p>
            <span className="label">Fri – Sat</span>
            <span className="value">11:00 AM – 11:00 PM</span>
          </p>
        </div>
        <div className="footer-contact">
          <p>(512) 284-9910</p>
          <p>4seasons@example.com</p>
        </div>
      </div>
    </footer>
  );
}

