// ============================================================
// גולה עולמי — מנהל המפה (D3 + TopoJSON)
// ============================================================

const MAP = (() => {
  const WORLD_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

  // Monochromatic palette
  const CLR_LAND    = '#C8D4DC'; // base gray for all countries
  const CLR_UNKNOWN = '#DDE6EB'; // no-data countries
  const CLR_HOVER   = '#A8BECA'; // hover
  const CLR_OCEAN   = '#EAF4FB'; // ocean background

  // Distinct muted shades per continent (for continent-identification game)
  const CONTINENT_CLR = {
    'europe':        '#A8B8CC',
    'asia':          '#C4B0C8',
    'africa':        '#CCBE98',
    'north-america': '#A4C0AC',
    'south-america': '#AED0B0',
    'oceania':       '#94BCC8',
  };

  let svg, g, projection, pathGen, worldTopo;
  let renderedIds = new Set();
  let clickCallback = null;
  let isClickMode = false;
  let zoomBehavior = null;

  async function init(containerId) {
    const container = document.getElementById(containerId);
    const W = container.clientWidth  || window.innerWidth;
    const H = Math.max(container.clientHeight, window.innerHeight * 0.6) || window.innerHeight;

    // remove old svg if exists
    d3.select(`#${containerId} svg`).remove();

    svg = d3.select(`#${containerId}`)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Ocean background
    svg.append('rect')
      .attr('width', W).attr('height', H)
      .attr('fill', CLR_OCEAN);

    g = svg.append('g').attr('class', 'countries');

    // On portrait screens (mobile), fit by height so map fills more of the screen
    const isPortrait = H > W * 1.2;
    const mapScale = isPortrait ? Math.min(W / 6.3, H / 4.2) * 1.8 : W / 6.3;
    // ── DO NOT CHANGE THIS WITHOUT TESTING AUSTRALIA ON MOBILE ──────────────────
    // Portrait translateY must be H/2 - 40 (NOT H/2) to account for the topbar
    // (~56px) and question-bar (~120px) chrome in the continents game.
    // H/2 centers the equator at the screen midpoint, which pushes Oceania/Australia
    // behind the bottom question-bar. Shifting up 40px keeps the southern hemisphere
    // fully visible inside the "safe zone" between the two UI bars.
    // This fix has been applied multiple times — do not revert to plain H/2.
    const translateY = isPortrait ? H / 2 - 40 : H / 2 + 65;

    projection = d3.geoNaturalEarth1()
      .scale(mapScale)
      .translate([W / 2, translateY]);

    pathGen = d3.geoPath().projection(projection);

    // Load TopoJSON
    if (!worldTopo) {
      worldTopo = await d3.json(WORLD_URL);
    }

    // D3 zoom — scroll/pinch/drag to explore
    // translateExtent must be generous enough for southern-hemisphere zoom (Australia at -25°lat
    // needs ty ≈ -1.5H at scale 3.2 — a tight clamp like -H*0.2 cuts it off completely)
    zoomBehavior = d3.zoom()
      .scaleExtent([1, 20])
      .translateExtent([[-W * 1.5, -H * 1.5], [W * 2.5, H * 2.5]])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        if (labelsGroup) {
          const k = event.transform.k;
          labelsGroup.selectAll('text')
            .attr('font-size', 7 / Math.pow(k, 0.7))
            .attr('stroke-width', 1.1 / Math.pow(k, 0.7));
        }
      });
    svg.call(zoomBehavior);

    // Double-click should not zoom (we use it for country click)
    svg.on('dblclick.zoom', null);

    render();
    return renderedIds;
  }

  function zoomIn()    { svg?.transition().duration(300).call(zoomBehavior.scaleBy, 2); }
  function zoomOut()   { svg?.transition().duration(300).call(zoomBehavior.scaleBy, 0.5); }
  function zoomReset() { svg?.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity); }

  function render() {
    const features = topojson.feature(worldTopo, worldTopo.objects.countries).features;

    g.selectAll('path').remove();
    renderedIds.clear();

    g.selectAll('path')
      .data(features)
      .enter()
      .append('path')
      .attr('d', pathGen)
      .attr('id', d => `cp-${Number(d.id)}`)
      .attr('class', 'country-path')
      .attr('fill', d => getCountryById(d.id) ? CLR_LAND : CLR_UNKNOWN)
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'default')
      .on('click', function(event, d) {
        if (isClickMode && clickCallback) {
          clickCallback(Number(d.id), this);
        }
      })
      .on('mouseover', function(event, d) {
        if (isClickMode) {
          const c = getCountryById(d.id);
          if (c) d3.select(this).attr('fill', CLR_HOVER);
        }
      })
      .on('mouseout', function(event, d) {
        if (isClickMode) {
          const el = d3.select(this);
          if (!el.classed('highlighted') && !el.classed('flash-correct') && !el.classed('flash-wrong')) {
            el.attr('fill', getCountryById(d.id) ? CLR_LAND : CLR_UNKNOWN);
          }
        }
      });

    // track which IDs are rendered (store as numbers to match COUNTRIES data)
    features.forEach(f => {
      if (getCountryById(f.id)) renderedIds.add(Number(f.id));
    });

    // graticule (grid lines)
    const graticule = d3.geoGraticule()();
    svg.insert('path', 'g')
      .datum(graticule)
      .attr('d', pathGen)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 0.4);
  }

  function highlight(countryId) {
    // Reset all
    g.selectAll('.country-path')
      .attr('fill', d => getCountryById(d.id) ? CLR_LAND : CLR_UNKNOWN)
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)
      .classed('highlighted', false);

    // Dim all others
    g.selectAll('.country-path')
      .attr('opacity', d => Number(d.id) === countryId ? 1 : 0.55);

    // Highlight target
    const el = g.select(`#cp-${countryId}`);
    if (!el.empty()) {
      el.raise()
        .attr('fill', '#2563EB')
        .attr('stroke', '#93C5FD')
        .attr('stroke-width', 2)
        .attr('opacity', 1)
        .classed('highlighted', true);
    }
  }

  // Highlight exactly N countries (for Mode B), dim everything else
  function highlightChoices(ids) {
    const idSet = new Set(ids.map(Number));
    g.selectAll('.country-path')
      .attr('opacity', d => idSet.has(Number(d.id)) ? 1 : 0.25)
      .attr('stroke', d => idSet.has(Number(d.id)) ? '#1D4ED8' : 'white')
      .attr('stroke-width', d => idSet.has(Number(d.id)) ? 1.5 : 0.5)
      .classed('highlighted', false);
  }

  function resetColors() {
    g.selectAll('.continent-flash').remove();
    g.selectAll('.country-path')
      .attr('fill', d => getCountryById(d.id) ? CLR_LAND : CLR_UNKNOWN)
      .attr('stroke', 'white')
      .attr('stroke-width', 0.5)
      .attr('opacity', 1)
      .classed('highlighted', false)
      .classed('flash-correct', false)
      .classed('flash-wrong', false);
  }

  function flashResult(correctId, wrongId = null) {
    resetColors();

    // Show correct in green
    g.select(`#cp-${correctId}`)
      .raise()
      .attr('fill', '#22C55E')
      .attr('stroke', '#15803D')
      .attr('stroke-width', 2.5)
      .classed('flash-correct', true);

    // Show wrong in red (if different)
    if (wrongId && wrongId !== correctId) {
      g.select(`#cp-${wrongId}`)
        .raise()
        .attr('fill', '#EF4444')
        .attr('stroke', '#B91C1C')
        .attr('stroke-width', 2)
        .classed('flash-wrong', true);
    }
  }

  function enableClick(cb) {
    isClickMode = true;
    clickCallback = cb;
    g.selectAll('.country-path').attr('cursor', 'pointer');
  }

  function disableClick() {
    isClickMode = false;
    clickCallback = null;
    g.selectAll('.country-path').attr('cursor', 'default');
  }

  // Geographic center [lon, lat] and zoom scale per continent
  const CONTINENT_ZOOM = {
    'europe':        { center: [15, 52],   scale: 3.4 },
    'asia':          { center: [90, 30],   scale: 1.9 },
    'africa':        { center: [20, 2],    scale: 2.2 },
    'north-america': { center: [-95, 45],  scale: 2.1 },
    'south-america': { center: [-58, -15], scale: 2.4 },
    'oceania':       { center: [148, -15], scale: 2.5 },
  };

  function zoomToContinent(continent) {
    const cfg = CONTINENT_ZOOM[continent];
    if (!cfg || !svg) return;
    const W = +svg.attr('viewBox').split(' ')[2];
    const H = +svg.attr('viewBox').split(' ')[3];
    const [px, py] = projection(cfg.center);
    const k = cfg.scale;
    const tx = W / 2 - px * k;
    const ty = H / 2 - py * k;
    svg.transition().duration(600)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
  }

  function getRenderedIds() { return renderedIds; }

  /** Returns [px, py] pixel coordinates for a [lon, lat] pair using current projection */
  function projectCoord(lonLat) {
    return projection ? projection(lonLat) : null;
  }

  /**
   * Continent game mode: remove country paths, draw 6 merged continent paths.
   * Each path has id="cont-{key}" and class="continent-path".
   */
  function renderAsContinents() {
    g.selectAll('.country-path').remove();
    g.selectAll('.continent-path').remove();
    if (!worldTopo) return;

    const KEYS = ['europe', 'asia', 'africa', 'north-america', 'south-america', 'oceania'];
    KEYS.forEach(key => {
      const geos = worldTopo.objects.countries.geometries.filter(geo => {
        const c = getCountryById(geo.id);
        return c && c.continent === key;
      });
      if (!geos.length) return;
      const merged = topojson.merge(worldTopo, geos);
      g.append('path')
        .datum(merged)
        .attr('class', 'continent-path')
        .attr('id', `cont-${key}`)
        .attr('d', pathGen)
        .attr('fill', CONTINENT_CLR[key])
        .attr('stroke', 'white')
        .attr('stroke-width', 0.8)
        .attr('cursor', 'pointer');
    });
  }

  /** Enable click on continent paths — callback receives continentKey string */
  function enableContinentClick(cb) {
    g.selectAll('.continent-path')
      .on('mouseover', function() {
        const key = this.id.replace('cont-', '');
        if (!d3.select(this).classed('cont-correct') && !d3.select(this).classed('cont-wrong')) {
          d3.select(this).attr('fill', CLR_HOVER);
        }
      })
      .on('mouseout', function() {
        const key = this.id.replace('cont-', '');
        if (!d3.select(this).classed('cont-correct') && !d3.select(this).classed('cont-wrong')) {
          d3.select(this).attr('fill', CONTINENT_CLR[key] || CLR_LAND);
        }
      })
      .on('click', function() {
        const key = this.id.replace('cont-', '');
        if (cb) cb(key);
      });
  }

  /**
   * Flash feedback for continent game (continent-path mode):
   * continentKey = correct continent (→ green)
   * wrongKey     = clicked wrong continent (→ red), optional
   */
  function flashContinentResult(continentKey, wrongKey = null) {
    d3.select(`#cont-${continentKey}`)
      .attr('fill', '#22C55E')
      .attr('stroke', '#15803D')
      .attr('stroke-width', 1.5)
      .classed('cont-correct', true);

    if (wrongKey && wrongKey !== continentKey) {
      d3.select(`#cont-${wrongKey}`)
        .attr('fill', '#EF4444')
        .attr('stroke', '#B91C1C')
        .attr('stroke-width', 1.5)
        .classed('cont-wrong', true);
    }
  }

  /** Disable all zoom/pan interactions (used for continent drag game) */
  function disableZoom() {
    if (svg && zoomBehavior) {
      svg.on('.zoom', null);
    }
  }

  // ── Explore-mode functions ──────────────────────────────────

  /** Color by continent — works in both explore mode (country-paths) and continent game (continent-paths) */
  function colorByContinents() {
    // Continent game mode: reset merged continent paths
    g.selectAll('.continent-path').each(function() {
      const key = this.id.replace('cont-', '');
      d3.select(this)
        .attr('fill', CONTINENT_CLR[key] || CLR_LAND)
        .attr('stroke', 'white')
        .attr('stroke-width', 0.8)
        .classed('cont-correct', false)
        .classed('cont-wrong', false);
    });
    // Explore mode: color individual country paths by continent
    g.selectAll('.country-path')
      .attr('fill', d => {
        const c = getCountryById(d.id);
        if (!c) return CLR_UNKNOWN;
        return CONTINENT_CLR[c.continent] || CLR_LAND;
      });
  }

  let labelsGroup = null;

  /** Add Hebrew country name labels to the map */
  function addLabels() {
    removeLabels();
    if (!worldTopo) return;
    labelsGroup = g.append('g').attr('class', 'country-labels');

    const features = topojson.feature(worldTopo, worldTopo.objects.countries).features;
    features.forEach(feature => {
      const country = getCountryById(feature.id);
      if (!country) return;
      const centroid = pathGen.centroid(feature);
      if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;

      labelsGroup.append('text')
        .attr('x', centroid[0])
        .attr('y', centroid[1])
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '7')
        .attr('font-family', 'Heebo, sans-serif')
        .attr('fill', 'rgba(0,0,0,0.7)')
        .attr('stroke', 'rgba(255,255,255,0.8)')
        .attr('stroke-width', '1.1')
        .attr('paint-order', 'stroke')
        .attr('pointer-events', 'none')
        .text(country.nameHe);
    });
  }

  /** Remove country name labels */
  function removeLabels() {
    if (labelsGroup) { labelsGroup.remove(); labelsGroup = null; }
    g.selectAll('.country-labels').remove();
  }

  /** Enable hover + click handlers for explore screen */
  function enableExploreInteraction(hoverCb, clickCb) {
    g.selectAll('.country-path')
      .attr('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const c = getCountryById(d.id);
        if (!c) return;
        d3.select(this).attr('fill', CLR_HOVER);
        if (hoverCb) hoverCb(Number(d.id), c);
      })
      .on('mouseout', function(event, d) {
        const c = getCountryById(d.id);
        if (!c) return;
        d3.select(this).attr('fill', CONTINENT_CLR[c.continent] || CLR_LAND);
      })
      .on('click', function(event, d) {
        const c = getCountryById(d.id);
        if (!c) return;
        if (clickCb) clickCb(Number(d.id));
      });
  }

  return { init, resetColors, highlight, highlightChoices, flashResult,
           renderAsContinents, enableContinentClick, flashContinentResult,
           enableClick, disableClick, getRenderedIds,
           zoomIn, zoomOut, zoomReset, zoomToContinent,
           projectCoord, disableZoom,
           colorByContinents, addLabels, removeLabels, enableExploreInteraction };
})();
