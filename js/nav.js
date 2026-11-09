// nav.js — adds the same header, nav, and footer to every page.
// Each page only needs: <div id="site-header"></div> ... <div id="site-footer"></div>
// and <script src="js/nav.js" defer></script>

(function () {
  const pages = [
    { href: "tor.html", label: "How Tor works" },
    { href: "cases.html", label: "Case files" },
    { href: "lab.html", label: "Correlation lab" },
    { href: "profile.html", label: "Profile the suspect" },
    { href: "glossary.html", label: "Glossary" },
  ];

  const current = location.pathname.split("/").pop() || "index.html";

  const links = pages
    .map((p) => {
      const isCurrent = p.href === current ? ' aria-current="page"' : "";
      return `<li><a href="${p.href}"${isCurrent}>${p.label}</a></li>`;
    })
    .join("");

  const header = document.getElementById("site-header");
  if (header) {
    header.outerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <header class="site-header">
        <div class="inner">
          <a class="site-title" href="index.html">Unmasking the Onion</a>
          <nav class="site-nav" aria-label="Modules"><ul>${links}</ul></nav>
        </div>
      </header>`;
  }

  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <p>CprE 5300 project by Gabriella Campos, Iowa State University, Fall 2026.
          All case information comes from public court records, government releases, the Tor Project,
          and published research. No dark web sites were visited to build this site.</p>
        </div>
      </footer>`;
  }
})();
