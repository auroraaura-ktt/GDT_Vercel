export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* LEFT */}
        <div className="footer-col">
          <h2>
            Miit<span>Verse</span>
          </h2>
          <p>Official Social Hub of MIIT</p>
        </div>

        {/* MIDDLE */}
        <div className="footer-col">
          <h3>Quick Links</h3>
          <a href="/">Home</a>
          <a href="/news">News</a>
          <a href="/login">Login</a>
          <a href="/about">About Us</a>
          <a href="/contact">Contact Us</a>
        </div>

        {/* RIGHT */}
        <div className="footer-col">
          <h3>Connect</h3>
          <p><a href="mailto:miitverse.verify@gmail.com">miitverse.verify@gmail.com</a></p>
          <p>📱 +959 770 474 803</p>
          <p>📍 MIIT Campus</p>

          </div>
        </div>

      

      {/* BOTTOM BAR */}
      <div className="footer-bottom">
        © {new Date().getFullYear()} MiitVerse. Built for MIIT Students 🚀
      </div>
    </footer>
  );
}