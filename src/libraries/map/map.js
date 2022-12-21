//global map and geocoder variables
let map;

//stores map information and state of the queue
const markers = new L.featureGroup();

//initializes a map in the element with the given id
const buildMap = (id) => {
  //create the map and set defaults
  map = new L.Map(id, {
    center: new L.LatLng(37.7, -122.4),
    maxZoom: 17,
    zoom: 12,
  });
  //set the tile provider
  L.tileLayer.provider("OpenTopoMap").addTo(map);
};

//add a marker to the array, create a tooltip with the address, and fit the map to include it
const addMarker = (lat, lng, html) => {
  let marker = L.marker([lat, lng]);
  marker.bindTooltip(html, { permanent: true }).openTooltip();
  marker.addTo(markers);
  map.fitBounds(markers.getBounds());
};

//clear markerers and refresh map sizing, needs to be called when a page is loaded or the tiles will not load correctly
const refreshMap = () => {
  markers.clearLayers();
  setTimeout(() => {
    map.invalidateSize();
  }, 1000);
};
