/* Noēsis Grid-Viz — view router. Portal-space ⇄ City. */
(function () {
  const portalView = document.getElementById('portal-view');
  const cityView = document.getElementById('city-view');
  const portalCanvas = document.getElementById('portal-canvas');
  const cityCanvas = document.getElementById('city-canvas');
  const backBtn = document.getElementById('back-btn');
  const tip = document.getElementById('tooltip');
  const catalog = document.getElementById('catalog-count');
  const title = document.getElementById('view-title');
  let cityInited = false;

  function showPortal() {
    cityView.style.display = 'none';
    portalView.style.display = 'block';
    backBtn.style.display = 'none';
    title.textContent = 'Portal — Noēsis-space';
    Portal.show();
  }

  function enterCity(grid) {
    Portal.hide();
    portalView.style.display = 'none';
    cityView.style.display = 'block';
    backBtn.style.display = 'inline-flex';
    title.textContent = `${grid.name} · ${grid.polis}`;
    if (!cityInited) {
      City.init(cityCanvas, grid, updateTooltip);
      cityInited = true;
    } else {
      City.show();
    }
    catalog.textContent = City.catalogSize();
  }

  function updateTooltip(info) {
    if (!info) { tip.style.display = 'none'; return; }
    tip.style.display = 'block';
    tip.innerHTML =
      `<span class="t-zone" style="color:${info.color}">${info.zone} <span class="kr">${info.zoneKr}</span></span>` +
      `<div class="t-row"><span>parcel</span><code>${info.coord}</code></div>` +
      `<div class="t-row"><span>owner</span><code>${info.did}</code></div>` +
      `<div class="t-row"><span>audit events</span><code>${info.audits}</code></div>`;
    catalog.textContent = City.catalogSize();
  }

  document.addEventListener('mousemove', (e) => {
    if (tip.style.display === 'block') {
      tip.style.left = Math.min(e.clientX + 16, window.innerWidth - 280) + 'px';
      tip.style.top = (e.clientY + 16) + 'px';
    }
  });

  backBtn.addEventListener('click', showPortal);

  Portal.init(portalCanvas, enterCity);
  showPortal();
})();
