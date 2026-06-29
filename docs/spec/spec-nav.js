/* Noēsis Spec — shared navigation.
   Injects a left sidebar (desktop) + top bar with hamburger (mobile)
   into every spec page. Highlights the current page. No dependencies. */
(function () {
  var NAV = [
    {
      t: "Overview", ko: "개요",
      items: [
        { href: "index.html", n: "—", label: "All Specifications" },
        { href: "system-map.html", n: "◈", label: "System Map" },
        { href: "definitions.html", n: "§", label: "Definitions Directory" }
      ]
    },
    {
      t: "Concept Specs", ko: "개념",
      items: [
        { href: "nous-guide.html", n: "★", label: "What a Nous Is & Can Do" },
        { href: "architecture-overview.html", n: "00", label: "Three-Layer Architecture" },
        { href: "portal.html", n: "01", label: "Portal" },
        { href: "portal-surfaces.html", n: "✦", label: "Portal Surfaces & Gaps" },
        { href: "portal-manager.html", n: "T3", label: "Portal Manager (Tier 3)" },
        { href: "steward-console.html", n: "02", label: "Steward Console" },
        { href: "civic-institutions.html", n: "03", label: "Eight Civic Institutions" },
        { href: "civic-map.html", n: "04", label: "Civic Map" },
        { href: "monitoring.html", n: "05", label: "Real-Time Monitoring" },
        { href: "economy.html", n: "06", label: "Economy & Money" }
      ]
    },
    {
      t: "Configuration & Ops", ko: "설정 & 운영",
      items: [
        { href: "config-overview.html", n: "C0", label: "How It All Fits" },
        { href: "config-local-node.html", n: "C1", label: "Local Node (Brain)" },
        { href: "config-nous.html", n: "C2", label: "Nous Settings" },
        { href: "config-grid.html", n: "C3", label: "Grid Configuration" },
        { href: "config-portal.html", n: "C4", label: "Portal Configuration" },
        { href: "config-steward.html", n: "C5", label: "Steward Console" },
        { href: "config-dashboard.html", n: "C6", label: "Dashboard & Onboarding" }
      ]
    }
  ];

  var current = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (current === "") current = "index.html";

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---- sidebar ----
  var sidebar = el("aside", "sidebar");
  sidebar.id = "specSidebar";
  var brand = el("a", "sb-brand");
  brand.href = "index.html";
  brand.innerHTML = '<span class="name">Noēsis</span><span class="tag">System Specifications</span>';
  sidebar.appendChild(brand);

  NAV.forEach(function (group) {
    var g = el("div", "sb-group");
    g.appendChild(el("div", "sb-group-t", group.t + ' <span class="ko">· ' + group.ko + "</span>"));
    group.items.forEach(function (it) {
      var a = el("a", "sb-link");
      a.href = it.href;
      if (it.href.toLowerCase() === current) a.className += " active";
      a.innerHTML = '<span class="n">' + it.n + "</span><span>" + it.label + "</span>";
      g.appendChild(a);
    });
    sidebar.appendChild(g);
  });

  // ---- top bar (mobile) ----
  var topbar = el("div", "topbar");
  var toggle = el("button", "nav-toggle", "☰");
  toggle.setAttribute("aria-label", "Toggle navigation");
  var tbBrand = el("a", "brand");
  tbBrand.href = "index.html";
  tbBrand.innerHTML = 'Noēsis<span class="tag">Specs</span>';
  topbar.appendChild(toggle);
  topbar.appendChild(tbBrand);

  // ---- overlay ----
  var overlay = el("div", "nav-overlay");

  document.body.appendChild(topbar);
  document.body.appendChild(sidebar);
  document.body.appendChild(overlay);

  function open() { sidebar.classList.add("open"); overlay.classList.add("show"); }
  function close() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }
  toggle.addEventListener("click", function () {
    sidebar.classList.contains("open") ? close() : open();
  });
  overlay.addEventListener("click", close);
  sidebar.addEventListener("click", function (e) {
    if (e.target.closest("a")) close();
  });
})();
