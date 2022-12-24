//global map and geocoder variables
let map;

//stores map information and state of the queue
const markers = new L.featureGroup();

/**
 *
 * @param {string} id the id of the HTML element for the map
 */
const buildMap = (id) => {
  //create the map and set defaults
  map = new L.Map(id, {
    center: new L.LatLng(37.7, -122.4),
    maxZoom: 17,
    zoom: 12,
  });
  //set the tile provider
  L.tileLayer.provider("OpenTopoMap").addTo(map);
  markers.addTo(map);
};

/**
 *
 * @param {number|string} lat the latitude for the marker
 * @param {number|string} lng the longitude for the marker
 * @param {HTMLElement} html the html for the popup
 */
const updateMarker = (lat, lng, html) => {
  markers.clearLayers();
  let marker = L.marker([lat, lng]);
  marker.bindTooltip(html, { permanent: true }).openTooltip();
  marker.addTo(markers);
  map.fitBounds(markers.getBounds());
  setTimeout(() => {
    map.setZoom(16);
  }, 2000);
};

//clear markerers and refresh map sizing, needs to be called when a page is loaded or the tiles will not load correctly
const refreshMap = () => {
  //markers.clearLayers();
  setTimeout(() => {
    map.invalidateSize();
    map.setZoom(16);
  }, 1000);
};
