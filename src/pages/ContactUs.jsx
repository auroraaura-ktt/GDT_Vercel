import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import '../App.css'

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Simulate form submission
      await new Promise(resolve => setTimeout(resolve, 1000))
      setSubmitted(true)
      setFormData({ name: '', email: '', subject: '', message: '' })
      
      setTimeout(() => setSubmitted(false), 3000)
    } catch (err) {
      console.error('Error submitting form:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home">
      <Navbar />

      <section className="hero">
        <div className="hero-left">
          <h1>
            Contact <span>Us</span>
          </h1>

          <h2>
            We'd Love to Hear
            <br />
            From You
          </h2>

          <p>
            Have questions, feedback, or suggestions? Reach out to us and let's 
            connect. Our team is always ready to help and listen to your ideas.
          </p>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-container">
          <div className="contact-info">
            <div className="info-card">
              <span className="info-icon">📍</span>
              <h4>Location</h4>
              <p>Myanmar Institute of Information Technology</p>
              <p>Mandalay, Myanmar</p>
            </div>

            <div className="info-card">
              <span className="info-icon">📧</span>
              <h4>Email</h4>
              <p><a href="mailto:miitverse.verify@gmail.com">miitverse.verify@gmail.com</a></p>
            </div>

            <div className="info-card">
              <span className="info-icon">📱</span>
              <h4>Phone</h4>
              <p>+95 (0) 770 474 803</p>
              <p>Available: Mon-Fri, 9 AM - 4 PM</p>
            </div>

            <div className="info-card">
              <span className="info-icon">⏰</span>
              <h4>Response Time</h4>
              <p>We typically respond within 24 hours</p>
              <p>Weekend responses may take longer</p>
            </div>
          </div>

          <div className="contact-form-container">
            <h3>Send us a Message</h3>
            
            {submitted && (
              <div className="success-message">
                ✓ Thank you for your message! We'll get back to you soon.
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name" style={{ color: '#ffffff' }}>Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" style={{ color: '#ffffff' }}>Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject" style={{ color: '#ffffff' }}>Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="What is this about?"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message" style={{ color: '#ffffff' }}>Message</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Your message here..."
                  rows="6"
                  required
                ></textarea>
              </div>

              <button type="submit" className="gold-btn" disabled={loading}>
                {loading && <span className="button-spinner" aria-hidden="true" />}
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-container">
          <div className="faq-item">
            <h4>How do I create an account?</h4>
            <p>
              Click on the "Register" button in the navigation bar and fill in your 
              details. You'll need to verify your email before gaining full access.
            </p>
          </div>

          <div className="faq-item">
            <h4>Is MiitVerse only for students?</h4>
            <p>
              MiitVerse is for the entire MIIT community including students, faculty, 
              and staff. Everyone is welcome to join!
            </p>
          </div>

          <div className="faq-item">
            <h4>How can I report inappropriate content?</h4>
            <p>
              You can report any inappropriate content directly through the app. 
              Our moderation team reviews all reports within 24 hours.
            </p>
          </div>

          <div className="faq-item">
            <h4>Can I delete my account?</h4>
            <p>
              Yes, you can delete your account anytime from your account settings. 
              All your data will be permanently removed.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
