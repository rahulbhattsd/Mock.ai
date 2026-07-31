import './AboutPage.css';
import aboutImage from '../assets/about.png';
import candidateImage from '../assets/candidate.png';
import hrImage from '../assets/hr.png';

const SLIDES = [
  { src: candidateImage, alt: 'Candidate practicing interview with mock.ai' },
  { src: hrImage, alt: 'HR reviewing AI-screened candidates' },
];

export default function AboutPage({ onHome, onBrowseJobs }) {
  return (
    <div className="about-page">
      <div className="role-grid-bg" />

      <header className="about-header">
        <button className="about-home" onClick={onHome} type="button">
          Home
        </button>
        <button className="role-badge" onClick={onBrowseJobs} type="button">
          Browse Open Roles
        </button>
      </header>

      <section className="about-hero">
        <h1 className="about-title">
          Interviews are broken
          <br />
          <span className="about-title-accent">on both sides.</span>
        </h1>
        <p className="about-subtitle">
          Candidates practice blind. Companies screen slow. We fixed both.
        </p>
      </section>

      <section className="about-image-wrap">
        <img src={aboutImage} alt="Mock.ai solving interview problems" className="about-image" loading="lazy" />
      </section>

      <section className="about-slider-section" aria-label="Product screenshots">
        <div className="about-slider-track">
          {[...SLIDES, ...SLIDES].map((s, i) => (
            <img key={i} src={s.src} alt={s.alt} className="about-slide-image" loading="lazy" />
          ))}
        </div>
      </section>

      <section className="about-cta">
        <button className="about-cta-btn" onClick={onBrowseJobs} type="button">
          Browse Open Roles <span className="start-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      <footer className="role-footer">Powered by Groq · Built to make you better</footer>
    </div>
  );
}