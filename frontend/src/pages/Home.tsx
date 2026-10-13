import { Link } from "react-router-dom";
import { useData } from "../hooks/data";
import { api } from "../services/api";
import { action, State } from "../components/UI";
export default function Home() {
  const { data: s, loading, error } = useData("/public/settings");
  const events = useData("/public/events");
  const ministries = useData("/public/ministries");
  return (
    <State loading={loading} error={error}>
      <section className="hero">
        <div>
          <p className="eyebrow">A PLACE TO BELONG</p>
          <h1>
            Welcome to
            <br />
            The Church of Pentecost Canada
            <br />
            <span className="hero-area">Peel Halton Area</span>
          </h1>
          <p className="hero-sub">Faith. Community. Service.</p>
          <p>
            Come as you are. Find community, grow in faith, and make a
            difference together.
          </p>
          <div className="buttons">
            <a className="button gold" href="#contact">
              Join Us
            </a>
            <a className="button outline" href="#events">
              View Events
            </a>
            <Link className="text-link" to="/login">
              Member Login
            </Link>
          </div>
        </div>
        <div
          className="hero-image"
          role="img"
          aria-label="Warm sunlight through church windows"
        >
          <div className="hero-caption">
            Together in faith.
            <br />
            <strong>Connected in community.</strong>
          </div>
        </div>
      </section>
      <section id="about" className="section">
        <p className="eyebrow">OUR COMMUNITY</p>
        <h2>A faith that brings us together.</h2>
        <div className="grid three">
          {[
            ["Our mission", s?.mission],
            ["Our vision", s?.vision],
            ["Our values", s?.values],
          ].map(([t, v]) => (
            <article className="card" key={t}>
              <h3>{t}</h3>
              <p>{v}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="service-strip">
        <h2>Worship with us</h2>
        {s?.service_times?.map((x: any) => (
          <div key={x.name}>
            <strong>{x.name}</strong>
            <p>{x.time}</p>
          </div>
        ))}
      </section>
      <section id="events" className="section">
        <p className="eyebrow">LIFE TOGETHER</p>
        <h2>What’s coming up</h2>
        <div className="grid three">
          {events.data?.length ? (
            events.data.map((e: any) => (
              <article className="card event" key={e.id}>
                {e.image && <img src={e.image} alt="" loading="lazy" />}
                <span className="badge">{e.date?.slice(0, 10)}</span>
                <h3>{e.name}</h3>
                <p>{e.description}</p>
                <p className="muted">
                  {e.start_time} · {e.location}
                </p>
                <span>
                  {e.registration_required
                    ? "Registration required"
                    : "Everyone welcome"}
                </span>
              </article>
            ))
          ) : (
            <p>New events will be announced here.</p>
          )}
        </div>
      </section>
      <section id="ministries" className="section pale">
        <p className="eyebrow">GROW & SERVE</p>
        <h2>Find your community</h2>
        <div className="grid three">
          {ministries.data?.map((m: any) => (
            <article className="card" key={m.id}>
              <h3>{m.name}</h3>
              <p>{m.description}</p>
              <small>{m.meeting_schedule}</small>
            </article>
          ))}
        </div>
      </section>
      <section id="contact" className="section grid two">
        <div>
          <p className="eyebrow">WE’D LOVE TO HEAR FROM YOU</p>
          <h2>Let’s connect.</h2>
          <p>{s?.address}</p>
          <p>{s?.phone}</p>
          <a href={"mailto:" + s?.email}>{s?.email}</a>
          {s?.social_links?.map((url: string) => (
            <p key={url}>
              <a href={url} rel="noopener noreferrer" target="_blank">
                {new URL(url).hostname}
              </a>
            </p>
          ))}
        </div>
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const d = Object.fromEntries(new FormData(f));
            if (
              await action(
                () => api("/contact", "POST", d),
                "Message received. Thank you!",
              )
            )
              f.reset();
          }}
        >
          <label>
            Your name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <label>
            Message
            <textarea name="message" required minLength={10} maxLength={3000} />
          </label>
          <button>Send Message</button>
        </form>
      </section>
    </State>
  );
}
