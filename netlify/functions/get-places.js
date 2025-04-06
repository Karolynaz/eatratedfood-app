// netlify/functions/get-places.js
const axios = require('axios');

// This will securely access the API key set in the Netlify UI
const apiKey = process.env.Maps_API_KEY;

exports.handler = async (event, context) => {
  // Get parameters passed from the frontend (e.g., ?type=textSearch&query=...)
  const { query, type } = event.queryStringParameters;

  if (!apiKey) {
    console.error("API key is not configured in Netlify environment variables.");
    return { statusCode: 500, body: JSON.stringify({ error: 'API key is not configured.' }) };
  }

  let googleApiUrl = '';
  const params = { key: apiKey };

  try {
    if (type === 'textSearch' && query) {
      // Construct URL for Google Places Text Search
      googleApiUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
      params.query = decodeURIComponent(query);
      // Request necessary fields (simplified since no details panel)
      params.fields = 'name,rating,formatted_address,photos,place_id,geometry,website,user_ratings_total';
    } else if (type === 'geocode' && query) {
      // Construct URL for Google Geocoding API
      googleApiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
      params.address = decodeURIComponent(query);
    } else {
      // If required parameters are missing
      return {
        statusCode: 400, // Bad Request
        body: JSON.stringify({ error: 'Missing required parameters (type, query)' }),
      };
    }

    // Make the request to the Google API using axios
    console.log(`Calling Google API: ${googleApiUrl} with query/address: ${params.query || params.address}`); // Log for debugging
    const response = await axios.get(googleApiUrl, { params: params });
    console.log(`Google API Response Status: ${response.data.status}`); // Log for debugging

    // Check if Google API returned an OK status (or ZERO_RESULTS)
    if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" }, // Required header
        body: JSON.stringify(response.data), // Pass Google's response back
      };
    } else {
      // Google API returned an error
      console.error('Google API Error:', response.data.status, response.data.error_message);
      return {
        statusCode: response.data.status === 'REQUEST_DENIED' ? 403 : 500,
        body: JSON.stringify({ error: `Google API Error: ${response.data.status}`, message: response.data.error_message || '' }),
      };
    }

  } catch (error) {
    // Handle network errors or errors in the function itself
    console.error('Netlify Function Error:', error.message);
    // Log more details if available from axios error
    if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
    }
    return {
      statusCode: 500, // Internal Server Error
      body: JSON.stringify({ error: 'Failed to fetch data via proxy function', details: error.message }),
    };
  }
};