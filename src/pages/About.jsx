import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../App.css'

export default function About() {
  return (
    <div className="home">
      <Navbar />

      <section className="hero">
        <div className="hero-left">
          <h1>
            About <span>MiitVerse</span>
          </h1>

          <h2>
            The Official Social Hub
            <br />
            of MIIT Community
          </h2>

          <p>
            MiitVerse is a dedicated social platform designed to connect students, 
            faculty, and staff of the Myanmar Institute of Information Technology. 
            We foster collaboration, share knowledge, and celebrate the achievements 
            of our vibrant community.
          </p>
        </div>
      </section>

      <section className="about-section">
        <div className="about-container">
          <div className="about-card">
            <h3>🎯 Our Mission</h3>
            <p>
              To create a dynamic and inclusive digital space where the MIIT community 
              can connect, collaborate, and grow together. We believe in empowering 
              students through technology and fostering meaningful relationships.
            </p>
          </div>

          <div className="about-card">
            <h3>👥 Our Community</h3>
            <p>
              With over 1,200+ students, 30+ communities, and 80+ events, MiitVerse 
              is the heartbeat of MIIT. From academic discussions to celebration of 
              achievements, we connect every member of our community.
            </p>
          </div>

          <div className="about-card">
            <h3>🚀 What We Offer</h3>
            <p>
              Share updates, discover events, explore communities, connect with peers, 
              and stay informed about the latest news and achievements happening 
              within the MIIT community.
            </p>
          </div>

          <div className="about-card">
            <h3>💡 Innovation & Growth</h3>
            <p>
              We continuously evolve to meet the needs of our community. MiitVerse 
              is built with cutting-edge technology and designed with user experience 
              at its core.
            </p>
          </div>
        </div>
      </section>

      <section className="about-values">
        <h2>Our Core Values</h2>
        <div className="values-grid">
          <div className="value-item">
            <span>🤝</span>
            <h4>Community First</h4>
            <p>Everything we do is centered around building and supporting our community</p>
          </div>
          <div className="value-item">
            <span>🔒</span>
            <h4>Trust & Safety</h4>
            <p>We prioritize the safety and privacy of all our members</p>
          </div>
          <div className="value-item">
            <span>🌟</span>
            <h4>Excellence</h4>
            <p>We strive for excellence in every feature and interaction</p>
          </div>
          <div className="value-item">
            <span>🌍</span>
            <h4>Inclusivity</h4>
            <p>Everyone is welcome to be part of the MiitVerse family</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Join Our Growing Community</h2>
        <p>Become part of the MiitVerse and connect with thousands of MIIT members</p>
        <Link to="/register" className="gold-btn">
          Join Us Today
        </Link>
      </section>

      <Footer />
    </div>
  )
}
