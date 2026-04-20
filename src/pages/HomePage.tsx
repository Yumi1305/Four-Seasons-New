import { NavLink } from "react-router-dom";
import HeroCarousel from "../components/HeroCarousel";

export default function HomePage() {
  return (
    <>
      <HeroCarousel />

      <section id="about" className="section section-light">
        <div className="container split">
          <div className="split-text">
            <h2>Our Story</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
              commodo libero id nibh blandit, sit amet pretium arcu sodales.
              Suspendisse vitae porta libero, id dapibus ipsum.
            </p>
            <p>
              Curabitur volutpat, lorem ut aliquet volutpat, purus urna
              tristique eros, nec vulputate ipsum massa sed odio. Aliquam erat
              volutpat.
            </p>
          </div>
          <div className="split-media grid-media">
            <div className="media-tile" />
            <div className="media-tile" />
            <div className="media-tile" />
            <div className="media-tile" />
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="container split reverse">
          <div className="split-media">
            <div className="media-portrait" />
          </div>
          <div className="split-text">
            <h2>The Owner</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
              vehicula varius eros, eget pulvinar magna posuere quis.
              Vestibulum ante ipsum primis in faucibus orci luctus et ultrices
              posuere cubilia curae.
            </p>
          </div>
        </div>
      </section>

      <section id="menu-preview" className="section section-muted">
        <div className="container">
          <h2>Menu Highlights</h2>
          <p className="section-lead">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
          <div className="menu-grid">
            <div className="menu-card">
              <div className="menu-image" />
              <h3>Seasonal Small Plates</h3>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </div>
            <div className="menu-card">
              <div className="menu-image" />
              <h3>Family-Style Classics</h3>
              <p>Curabitur ullamcorper urna ut ex molestie.</p>
            </div>
            <div className="menu-card">
              <div className="menu-image" />
              <h3>Late-Night Favorites</h3>
              <p>Vestibulum ante ipsum primis in faucibus orci luctus.</p>
            </div>
          </div>
          <NavLink to="/menu" className="btn-primary" style={{ marginTop: 24 }}>
            View Full Menu
          </NavLink>
        </div>
      </section>

      <section id="schedule-preview" className="section section-white">
        <div className="container split">
          <div className="split-text">
            <h2>Schedule</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas
              pharetra, erat ac facilisis gravida.
            </p>
            <ul className="schedule-list">
              <li>
                <span className="label">Lunch</span>
                <span className="value">11:30 AM – 3:00 PM</span>
              </li>
              <li>
                <span className="label">Dinner</span>
                <span className="value">5:00 PM – 10:00 PM</span>
              </li>
              <li>
                <span className="label">Late Night</span>
                <span className="value">Fri & Sat until 12:00 AM</span>
              </li>
            </ul>
            <NavLink to="/schedule" className="btn-primary" style={{ marginTop: 20 }}>
              Order School Lunch
            </NavLink>
          </div>
          <div className="split-media">
            <div className="media-block" />
          </div>
        </div>
      </section>

      <section id="hours" className="section section-location">
        <div className="container location-inner">
          <div className="location-card">
            <h2>Location</h2>
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer
              ac nisl et urna hendrerit fermentum sit amet ut eros.
            </p>
            <div className="location-details">
              <p className="label">Address</p>
              <p>13776 US-183, Ste 134, Austin, TX 78750</p>
              <p className="label">Phone</p>
              <p>(512) 284-9910</p>
            </div>
            <a
              className="btn-primary"
              href="https://www.google.com/maps/place/13776+US-183+Ste+134,+Austin,+TX+78750"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
          <iframe
            title="Google Map"
            className="responsive-map"
            frameBorder="0"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3442.5!2d-97.8!3d30.4!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDI0JzAwLjAiTiA5N8KwNDgnMDAuMCJX!5e0!3m2!1sen!2sus!4v1"
            allowFullScreen
          />
        </div>
      </section>
    </>
  );
}

