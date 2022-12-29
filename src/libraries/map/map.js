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
    //38.990498828259746, -76.94361131007392
    center: new L.LatLng(38.99049, -76.943611),
    maxZoom: 8,
    zoom: 2,
  });
  //set the tile provider
  //TODO: add USGS credit
  L.tileLayer("./libraries/map/USGS/{z}/{x}/{y}.jpg", { maxZoom: 16 }).addTo(
    map
  );
  //L.tileLayer.provider("OpenTopoMap").addTo(map);
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
