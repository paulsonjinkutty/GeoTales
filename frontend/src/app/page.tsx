import Link from "next/link";
const navigation = [
  { icon: "⌖", label: "Explorer", active: true },
  { icon: "⌁", label: "My journeys", active: false },
  { icon: "◇", label: "Achievements", active: false },
];

const landmarks = [
  {
    number: "01",
    name: "Historic landmarks",
    description: "Discover places with stories to tell",
    color: "amber",
  },
  {
    number: "02",
    name: "Hidden destinations",
    description: "Explore beyond the usual routes",
    color: "green",
  },
  {
    number: "03",
    name: "Cultural experiences",
    description: "Connect with local heritage",
    color: "blue",
  },
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="GeoTales home">
          <span className="brand-mark">G</span>
          <span>
            <strong>GeoTales</strong>
            <small>EXPLORE WITH PURPOSE</small>
          </span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              href="#"
              key={item.label}
              className={`nav-item ${item.active ? "active" : ""}`}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.active && <span className="active-dot" />}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile-avatar">G</div>
          <div className="profile-copy">
            <strong>Guest explorer</strong>
            <span>Discover your world</span>
          </div>
          <span className="status-dot" />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-separator">/</span>
            <strong>Explorer</strong>
          </div>
          <div className="topbar-right">
            <span className="connection-indicator">
              <span className="status-dot" />
              LOCAL PREVIEW
            </span>
            <button className="icon-button" aria-label="Notifications">
              ♧
            </button>
            <div className="topbar-avatar">G</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                YOUR NEXT DISCOVERY STARTS HERE
              </div>
              <h1>Every place has a <span>story.</span></h1>
              <p className="welcome-copy">
                Explore landmarks, uncover local history, and let your
                journey become more than just a destination.
              </p>
            </div>
            <div className="date-chip">
              <span className="date-icon">◷</span>
              Spatial discovery
            </div>
          </section>

          <section className="search-panel">
            <span className="search-icon">⌕</span>
            <div className="search-copy">
              <strong>Where would you like to explore?</strong>
              <span>Search for a landmark or destination</span>
            </div>
            <button className="search-button" disabled>
              Search destinations <span>↗</span>
            </button>
          </section>

          <section className="explorer-grid">
            <div className="map-column">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">YOUR WORLD, REIMAGINED</span>
                  <h2>Explore the map</h2>
                </div>
                <span className="preview-pill">MAP PREVIEW</span>
              </div>

              <div className="map-canvas">
                <div className="map-grid" />
                <div className="map-contour contour-one" />
                <div className="map-contour contour-two" />
                <div className="map-contour contour-three" />

                <div className="map-river" />

                <div className="map-road road-one" />
                <div className="map-road road-two" />
                <div className="map-road road-three" />

                <div className="map-label label-north">N</div>
                <div className="map-label label-park">GREEN DISTRICT</div>
                <div className="map-label label-river">RIVER WALK</div>
                <div className="map-label label-oldtown">OLD TOWN</div>

                <div className="map-pin pin-one"><span>1</span></div>
                <div className="map-pin pin-two"><span>2</span></div>
                <div className="map-pin pin-three"><span>3</span></div>

                <div className="map-legend">
                  <span className="legend-dot" />
                  Interactive map integration is next
                </div>

                <div className="map-controls">
                  <button aria-label="Zoom in" disabled>+</button>
                  <button aria-label="Zoom out" disabled>−</button>
                </div>
              </div>

              <div className="map-footer">
                <span><span className="legend-dot" /> Landmark discovery</span>
                <span>GIS WORKSPACE <span className="footer-coordinates">· 0.0000°, 0.0000°</span></span>
              </div>
            </div>

            <aside className="discovery-column">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">START EXPLORING</span>
                  <h2>Discover more</h2>
                </div>
                <button className="text-button" disabled>View all ↗</button>
              </div>

              <div className="discovery-list">
                {landmarks.map((item) => (
                  <article className="discovery-card" key={item.number}>
                    <div className={`discovery-art ${item.color}`}>
                      <span>{item.number}</span>
                      <div className="art-orbit" />
                      <div className="art-center">✳</div>
                    </div>
                    <div className="discovery-copy">
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                      <span className="coming-soon">Ready to connect</span>
                    </div>
                    <span className="card-arrow">↗</span>
                  </article>
                ))}
              </div>

              <div className="insight-card">
                <div className="insight-icon">✳</div>
                <div>
                  <strong>Travel beyond the map.</strong>
                  <p>Discover the stories behind the places you visit.</p>
                </div>
              </div>
            </aside>
          </section>

          <section className="ai-panel">
            <div className="ai-heading">
              <div className="ai-symbol">✳</div>
              <div>
                <span className="section-kicker">YOUR TRAVEL COMPANION</span>
                <h2>Ask GeoTales AI</h2>
                <p>Curious about a place? Start a conversation.</p>
              </div>
              <span className="ai-status">PROVIDER CONNECTED</span>
            </div>

            <div className="ai-message">
              <span className="ai-message-icon">G</span>
              <div>
                <strong>Your journey, with more meaning.</strong>
                <p>
                  Once connected, I can answer tourism questions and
                  narrate places using the information available to GeoTales.
                </p>
              </div>
            </div>

            <form className="ai-input-row">
              <label className="sr-only" htmlFor="ai-question">
                Ask GeoTales AI a question
              </label>
              <input
                id="ai-question"
                type="text"
                placeholder="Ask about a landmark, its history, or your journey..."
                disabled
              />
              <button type="button" disabled>
                Ask GeoTales <span>↗</span>
              </button>
            </form>
            <p className="ai-note">
              UI PREVIEW · Live AI interaction will be enabled in the API integration step.
            </p>
          </section>

          <footer className="page-footer">
            <span>GEOTALES <span className="footer-muted">· SMART CULTURAL EXPLORATION</span></span>
            <span>Built to discover, designed to understand.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
