// script.js - Modified for Secure Netlify Function API Calls

let map;
// We might not need PlacesService client-side anymore for search/details
// let placesService;
// Store markers keyed by place_id for easy access and animation
let currentMarkers = {};
let currentCity = 'Vilnius'; // Default city

// DOM Element References
const mapElement = document.getElementById('map');
const cityInputElement = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const restaurantListElement = document.getElementById('restaurant-list');
const infoPanelElement = document.querySelector('.info-panel'); // Keep if needed for other interactions
const loadingIndicator = document.getElementById('loading-indicator');

// Google Maps Initialization Callback
function initMap() {
    const initialCoords = { lat: 54.6872, lng: 25.2797 }; // Vilnius

    map = new google.maps.Map(mapElement, {
        center: initialCoords,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
    });

    // placesService = new google.maps.places.PlacesService(map); // Initialize if needed elsewhere

    cityInputElement.value = currentCity;
    fetchAndDisplayRestaurants(currentCity); // Call the modified function

    // Event Listeners
    searchButton.addEventListener('click', handleCitySearch);
    cityInputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleCitySearch();
        }
    });
}

// --- City Search ---
function handleCitySearch() {
    const newCity = cityInputElement.value.trim();
    if (newCity && newCity !== currentCity) {
        currentCity = newCity;
        fetchAndDisplayRestaurants(currentCity);
    } else if (!newCity) {
        alert("Please enter a city name.");
    }
}

// --- Fetching Restaurants via Netlify Function ---
async function fetchAndDisplayRestaurants(cityName) { // Make async
    showLoading(loadingIndicator);
    clearRestaurantList();
    clearMarkers();

    try {
        // --- Step 1: Geocode the City Name via Netlify Function ---
        const geocodeUrl = `/.netlify/functions/get-places?type=geocode&query=${encodeURIComponent(cityName)}`;
        console.log("Fetching geocode via Netlify Function:", geocodeUrl);
        const geocodeResponse = await fetch(geocodeUrl);

        // Check if the fetch itself failed (network error, etc.)
        if (!geocodeResponse.ok) {
            const errorText = await geocodeResponse.text(); // Get error details if possible
            throw new Error(`Geocoding request failed: ${geocodeResponse.status} ${geocodeResponse.statusText} - ${errorText}`);
        }
        // Parse the JSON response from the function
        const geocodeData = await geocodeResponse.json();
        console.log("Geocode response data:", geocodeData);

        // Check the status returned *by Google* via our function
        if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
            throw new Error(`Could not geocode city: ${geocodeData.status} - ${geocodeData.error_message || 'Not found'}`);
        }

        // Extract location if geocoding was successful
        const location = geocodeData.results[0].geometry.location; // { lat: ..., lng: ... }
        map.setCenter(location);
        map.setZoom(13); // Reset zoom level

        // --- Step 2: Search for Restaurants via Netlify Function ---
        const searchQuery = `best rated restaurants in ${cityName}`;
        const placesUrl = `/.netlify/functions/get-places?type=textSearch&query=${encodeURIComponent(searchQuery)}`;
        console.log("Fetching places via Netlify Function:", placesUrl);
        const placesResponse = await fetch(placesUrl);

        // Check if the fetch failed
        if (!placesResponse.ok) {
            const errorText = await placesResponse.text();
            throw new Error(`Places search request failed: ${placesResponse.status} ${placesResponse.statusText} - ${errorText}`);
        }
        // Parse the JSON response
        const placesData = await placesResponse.json();
        console.log("Places response data status:", placesData.status);

        // Processing happens after getting response
        hideLoading(loadingIndicator);

        // Check Google's status from the response data
        if (placesData.status === 'OK' && placesData.results) {
            const sortedResults = placesData.results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            displayRestaurantsOnList(sortedResults); // Update the list UI
            addMarkersToMap(sortedResults);       // Add markers to the map
        } else if (placesData.status === 'ZERO_RESULTS') {
            restaurantListElement.innerHTML = '<li class="loading">No restaurants found for this city.</li>';
        } else {
            // Display Google's error message if available
            const message = placesData.error_message ? ` (${placesData.error_message})` : '';
            restaurantListElement.innerHTML = `<li class="loading">Error fetching restaurants: ${placesData.status}${message}. Please try again.</li>`;
            console.error('Places search error from Google:', placesData.status, placesData.error_message);
        }

    } catch (error) {
        // Catch errors from fetch calls or JSON parsing or other logic
        hideLoading(loadingIndicator);
        restaurantListElement.innerHTML = `<li class="loading">An error occurred: ${error.message}. Please check console or try again.</li>`;
        console.error('Error in fetchAndDisplayRestaurants:', error);
    }
}


// --- Displaying Restaurants in List ---
// (This function remains the same as the previous version that removed the details panel)
function displayRestaurantsOnList(places) {
    clearRestaurantList();
    if (!places || places.length === 0) {
        restaurantListElement.innerHTML = '<li class="loading">No restaurants found.</li>';
        return;
    }

    places.forEach(place => {
        if (!place.name || !place.place_id) return;

        const li = document.createElement('li');
        li.className = 'restaurant-list-item';
        li.setAttribute('data-place-id', place.place_id);

        const img = document.createElement('img');
        img.className = 'restaurant-photo';
        img.alt = place.name;
        if (place.photos && place.photos.length > 0) {
            img.src = place.photos[0].getUrl({ maxWidth: 112, maxHeight: 112 });
        } else {
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='; // Transparent fallback
            img.style.backgroundColor = '#e0e0e0';
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'restaurant-info';

        const nameH3 = document.createElement('h3');
        nameH3.className = 'name';
        nameH3.textContent = place.name;

        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'rating';
        ratingDiv.innerHTML = `<span class="material-icons">star</span> ${place.rating ? place.rating.toFixed(1) : 'N/A'} (${place.user_ratings_total || 0})`;

        const addressP = document.createElement('p');
        addressP.className = 'address';
        addressP.textContent = place.formatted_address || 'Address not available';

        const websiteLink = document.createElement('a');
        websiteLink.className = 'button-text visit-site-button';
        websiteLink.target = '_blank';
        websiteLink.rel = 'noopener noreferrer';
        websiteLink.textContent = 'Visit Site';
        if (place.website) {
            websiteLink.href = place.website;
            websiteLink.style.display = 'inline-block';
            websiteLink.addEventListener('click', (e) => e.stopPropagation()); // Prevent li click
        } else {
            websiteLink.style.display = 'none';
            websiteLink.setAttribute('aria-disabled', 'true');
        }

        infoDiv.appendChild(nameH3);
        infoDiv.appendChild(ratingDiv);
        infoDiv.appendChild(addressP);
        infoDiv.appendChild(websiteLink);

        li.appendChild(img);
        li.appendChild(infoDiv);

        // Updated click listener for li -> Zoom Map
        li.addEventListener('click', () => {
            console.log("LI clicked, zooming to:", place.place_id);
            if (place.geometry && place.geometry.location) {
                map.setCenter(place.geometry.location);
                map.setZoom(18); // Zoom level 18 is approx. block/building level

                // Animate the corresponding marker
                const marker = currentMarkers[place.place_id];
                if (marker) {
                    marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => {
                         // Check marker still exists (e.g., user hasn't searched new city)
                         if (currentMarkers[place.place_id]) {
                              currentMarkers[place.place_id].setAnimation(null);
                         }
                    }, 750); // Bounce duration ms
                }
            }
        });

        restaurantListElement.appendChild(li);
    });
}

function clearRestaurantList() {
    restaurantListElement.innerHTML = '';
}

// --- Map Markers ---
// (This function remains the same as the previous version - uses default markers)
function addMarkersToMap(places) {
    clearMarkers();
    const bounds = new google.maps.LatLngBounds();

    places.forEach(place => {
        if (!place.geometry || !place.geometry.location || !place.place_id) return;

        const marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location,
            title: place.name,
            // Default red marker used (no icon property)
            animation: google.maps.Animation.DROP
        });

        // Updated marker click listener -> Zoom Map
        marker.addListener('click', () => {
             console.log("Marker clicked, zooming to:", place.place_id);
             map.setCenter(marker.getPosition());
             map.setZoom(18);
             marker.setAnimation(google.maps.Animation.BOUNCE);
             setTimeout(() => marker.setAnimation(null), 750);
        });

        // Store marker in object using place_id as key
        currentMarkers[place.place_id] = marker;
        bounds.extend(place.geometry.location);
    });
    // Optional: Fit bounds after adding markers
    // if (Object.keys(currentMarkers).length > 1) { // Avoid fitting for single marker
    //     map.fitBounds(bounds, 50); // 50px padding
    // }
}

function clearMarkers() {
    for (const placeId in currentMarkers) {
        if (currentMarkers.hasOwnProperty(placeId)) {
            currentMarkers[placeId].setMap(null);
        }
    }
    currentMarkers = {}; // Reset the marker object
}

// --- Utility Loading Functions ---
function showLoading(element) {
    if (element) element.classList.remove('hidden');
}

function hideLoading(element) {
    if (element) element.classList.add('hidden');
}

// --- Ensure initMap is called by Google Maps script ---
// The 'callback=initMap' parameter in the script URL in index.html handles this.
// window.initMap = initMap; // Generally not needed