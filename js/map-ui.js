/**
 * @module map-ui
 * @description Marker rendering, sidebar list, and map-viewport helpers
 * extracted from the core map module. These functions manage Google Maps
 * markers, the results sidebar, and map status updates.
 */
import { CATEGORY_META } from "./map-search.js";

/* ── Magic-number constants ─────────────────────────────────────── */

/** Zoom level used when the map focuses on a single spot. */
const SINGLE_SPOT_ZOOM = 14;

/** Padding in pixels applied when fitting bounds around multiple spots. */
const FIT_BOUNDS_PADDING_PX = 64;

/* ── State shared with map.js via setter ────────────────────────── */

/** @type {HTMLElement|null} */
const listNode = document.querySelector("[data-map-list]");

/** @type {HTMLElement|null} */
const statusNode = document.querySelector("[data-map-status]");

/* ── Status ─────────────────────────────────────────────────────── */

/**
 * Updates the map status text element.
 * @param {string} message - Status text to display.
 */
export function setStatus(message) {
  if (statusNode) statusNode.textContent = message;
}

/* ── Sidebar results list ───────────────────────────────────────── */

/**
 * Renders the sidebar list of visible green spots, filtered by active categories.
 * @param {object[]}     renderedSpots    - All spots currently on the map.
 * @param {Set<string>}  activeCategories - Currently active category keys.
 */
export function renderList(renderedSpots, activeCategories) {
  if (!listNode) return;
  listNode.replaceChildren();
  const visible = renderedSpots.filter(
    (spot) => activeCategories.has(spot.category),
  );
  if (!visible.length) {
    const item = document.createElement("li");
    item.className = "map-result";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "No matching green spots yet";
    const text = document.createElement("p");
    text.textContent =
      "Try a broader search term or enable more marker filters.";
    body.append(title, text);
    item.append(body);
    listNode.append(item);
    return;
  }
  visible.forEach((spot) => {
    const item = document.createElement("li");
    item.className = "map-result";
    const icon = document.createElement("span");
    icon.className = "map-result-icon";
    icon.textContent = CATEGORY_META[spot.category]?.icon || "•";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = spot.name;
    const address = document.createElement("p");
    address.textContent =
      `${spot.address || "Address available on map"}` +
      ` • ${spot.distanceKm.toFixed(1)} km away`;
    body.append(title, address);
    item.append(icon, body);
    listNode.append(item);
  });
}

/* ── Marker management ──────────────────────────────────────────── */

/**
 * Removes all green-spot markers from the map and returns an empty array.
 * @param {{ marker: google.maps.Marker, category: string }[]} markers - Current marker array.
 * @returns {Array} Empty array (assign back to your markers variable).
 */
export function clearSpotMarkers(markers) {
  markers.forEach(({ marker }) => marker.setMap(null));
  return [];
}

/**
 * Creates a Google Maps marker for a single green spot and registers a
 * click handler that opens an info-window.
 * @param {object}                 spot      - The green-spot data object.
 * @param {google.maps.Map}        map       - The Google Maps instance.
 * @param {google.maps.InfoWindow} infoWindow - Shared info-window instance.
 * @param {{ marker: google.maps.Marker, category: string }[]} markers - Array to push the new marker into.
 */
export function addMarker(spot, map, infoWindow, markers) {
  if (!map || !window.google?.maps) return;
  const marker = new google.maps.Marker({
    map,
    position: { lat: spot.lat, lng: spot.lng },
    title: spot.name,
    label: CATEGORY_META[spot.category]?.icon,
  });
  marker.addListener("click", () => {
    infoWindow.setContent(
      `<strong>${spot.name}</strong><br>` +
      `${spot.address || "Address unavailable"}<br>` +
      `${spot.distanceKm.toFixed(1)} km away`,
    );
    infoWindow.open({ map, anchor: marker });
  });
  markers.push({ marker, category: spot.category });
}

/* ── Map viewport ───────────────────────────────────────────────── */

/**
 * Adjusts the map viewport to contain all provided spots.
 * @param {google.maps.Map|undefined} map   - The Google Maps instance.
 * @param {object[]}                  spots - Array of spot objects with `lat` and `lng`.
 */
export function fitMapToSpots(map, spots) {
  if (!map || !window.google?.maps || !spots.length) return;
  if (spots.length === 1) {
    map.setCenter({ lat: spots[0].lat, lng: spots[0].lng });
    map.setZoom(SINGLE_SPOT_ZOOM);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  spots.forEach((spot) => bounds.extend({ lat: spot.lat, lng: spot.lng }));
  map.fitBounds(bounds, FIT_BOUNDS_PADDING_PX);
}

/* ── Marker visibility sync ─────────────────────────────────────── */

/**
 * Shows or hides map markers based on the current `activeCategories` set,
 * then refreshes the sidebar list.
 * @param {google.maps.Map|undefined}                          map              - The map instance.
 * @param {{ marker: google.maps.Marker, category: string }[]} markers          - All current markers.
 * @param {object[]}                                           renderedSpots    - All current spots.
 * @param {Set<string>}                                        activeCategories - Active category keys.
 */
export function syncMarkerVisibility(map, markers, renderedSpots, activeCategories) {
  markers.forEach(({ marker, category }) => {
    marker.setMap(map && activeCategories.has(category) ? map : null);
  });
  renderList(renderedSpots, activeCategories);
}

/* ── Composite render ───────────────────────────────────────────── */

/**
 * Replaces the current map spots with a new set, sorts by distance, adds
 * markers, fits the viewport, and updates the status text.
 * @param {object}  ctx            - Map context object.
 * @param {google.maps.Map|undefined} ctx.map - The Google Maps instance.
 * @param {google.maps.InfoWindow|undefined} ctx.infoWindow - Shared info-window.
 * @param {{ marker: google.maps.Marker, category: string }[]} ctx.markers - Marker array (mutated).
 * @param {Set<string>} ctx.activeCategories - Active category keys.
 * @param {object[]}    spots      - New spot data.
 * @param {string}      statusText - Status message to display.
 * @returns {object[]} The sorted renderedSpots array.
 */
export function renderSpotResults(ctx, spots, statusText) {
  ctx.markers = clearSpotMarkers(ctx.markers);
  const renderedSpots = spots.sort((a, b) => a.distanceKm - b.distanceKm);
  renderedSpots.forEach((spot) => addMarker(spot, ctx.map, ctx.infoWindow, ctx.markers));
  fitMapToSpots(ctx.map, renderedSpots);
  syncMarkerVisibility(ctx.map, ctx.markers, renderedSpots, ctx.activeCategories);
  setStatus(statusText);
  return renderedSpots;
}
