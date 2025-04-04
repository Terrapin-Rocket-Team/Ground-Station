let map;
const markers = new L.featureGroup();

/**
 * @param {string} id the id of the HTML element for the map
 */
const buildMap = (id) => {
  // create the map and set defaults
  map = new L.Map(id, {
    // UMD: 38.987810, -76.942406
    center: new L.LatLng(38.98781, -76.942406),
    maxZoom: 15,
    zoom: 5,
  });

  L.tileLayer.provider("OpenTopoMap").addTo(map);

  markers.addTo(map);

  let marker = L.marker([38.98781, -76.942406]);

  marker.addTo(markers);
  map.fitBounds(markers.getBounds());
  map.setZoom(12);
  markers.clearLayers();

  // create home button
  L.easyButton(
    '<img src="../src/images/home_map.svg" style="width:100%;height;100%;">',
    (btn, map) => {
      map.setView([38.98781, -76.942406]);
      map.setZoom(15);
    }
  ).addTo(map);
};

/**
 * @param {number|string} lat the latitude for the marker
 * @param {number|string} lng the longitude for the marker
 * @param {HTMLElement} html the html for the popup
 */
const updateMarker = (lat, lng, html) => {
  // remove old marker
  markers.clearLayers();
  // create new marker
  let marker = L.popup({
    closeButton: false,
    autoClose: false,
    closeOnClick: false,
    closeOnEscapeKey: false,
  })
    .setLatLng([lat, lng])
    .setContent(html)
    .addTo(map);
  // move map to marker
  marker.addTo(markers);
  map.fitBounds(markers.getBounds());
};

//clear markers and refresh map sizing, needs to be called when a page is loaded or the tiles will not load correctly
const refreshMap = (zoom) => {
  //markers.clearLayers();
  setTimeout(() => {
    map.invalidateSize();
    map.setZoom(zoom == undefined ? 5 : zoom);
  }, 1000);
};
