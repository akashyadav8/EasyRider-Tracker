// Load environment variables first
require('dotenv').config();

const express = require("express");
const app = express();
const path = require("path");
const http = require("http");
const axios = require("axios");
const socketio = require("socket.io");
const server = http.createServer(app);
const io = socketio(server);
const GroqChatBot = require('./utils/GroqChatBot');

// Add body-parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Store connected users with their locations and share tokens
const connectedUsers = new Map();
const shareTokens = new Map(); // token -> socket.id

// Group Chat: store chat users and messages in memory
let chatUsers = {};
let chatMessages = [
    { username: 'Alex', message: "I'm at the meeting point!", time: '10:00 AM', isOwn: false },
    { username: 'Taylor', message: "Running 5 minutes late, sorry!", time: '10:01 AM', isOwn: false },
    { username: 'Jordan', message: "No problem, we'll wait for you", time: '10:02 AM', isOwn: false }
];

// Initialize the chatbot
const chatbot = new GroqChatBot();

// Generate random token
function generateToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// OSRM route distance
async function getRouteDistance(lon1, lat1, lon2, lat2) {
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const response = await axios.get(url);
    if (response.data.routes && response.data.routes.length > 0) {
      return response.data.routes[0].distance / 1000; // Convert to km
    }
    return null;
  } catch (error) {
    console.error("OSRM API error:", error.message);
    return null;
  }
}

// New endpoint for fetching route details
app.get("/api/route", async function (req, res) {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: "Missing coordinates" });
    }
    
    const url = `http://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await axios.get(url);
    
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return res.json({
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        geometry: route.geometry
      });
    }
    
    return res.status(404).json({ error: "No route found" });
  } catch (error) {
    console.error("Route API error:", error.message);
    return res.status(500).json({ error: "Failed to fetch route" });
  }
});

// New routes for dashboard and authentication
app.get("/dashboard", function (req, res) {
  // Create mock groups for demonstration
  const mockGroups = [
    {
      id: 'demo1',
      name: 'Demo Group 1',
      members: [
        { id: 'user1', name: 'Demo User', role: 'admin' }
      ]
    }
  ];
  
  // Create mock available groups
  const mockAvailableGroups = [
    {
      id: 'public1',
      name: 'City Explorers',
      creatorName: 'Sarah Johnson',
      members: Array(8).fill({}),
      onlineMembers: 3
    },
    {
      id: 'public2',
      name: 'Weekend Hikers',
      creatorName: 'Mike Chen',
      members: Array(12).fill({}),
      onlineMembers: 5
    }
  ];
  
  res.render("dashboard", { 
    username: "User", // This would be fetched from the session in a real app
    groups: mockGroups,
    availableGroups: mockAvailableGroups
  });
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/signup", function (req, res) {
  res.render("signup");
});

// Route for joining groups
app.get("/join-group/:groupId", function (req, res) {
  const groupId = req.params.groupId;
  const groupName = req.query.name || "Group";
  res.render("index", { 
    sharedToken: null,
    joinGroup: {
      id: groupId,
      name: groupName
    }
  });
});

// Route for shared links
app.get("/share/:token", function (req, res) {
  res.render("index", { 
    sharedToken: req.params.token,
    joinGroup: null
  });
});

io.on("connection", function (socket) {
    console.log('User connected:', socket.id);
    
    // Send initial chat messages to new users
    socket.emit('chat-history', chatMessages);
    
    // Handle shared token if present
    const sharedToken = socket.handshake.query.token;
    if (sharedToken && shareTokens.has(sharedToken)) {
        const targetId = shareTokens.get(sharedToken);
        socket.join(`share-${targetId}`);
        socket.emit("shared-target", targetId);
    }
    
    socket.on("share-initial-location", async function (data) {
        connectedUsers.set(socket.id, {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            name: data.name || `User-${socket.id.substring(0, 4)}`
        });
        
        const usersArray = Array.from(connectedUsers.values())
            .filter(user => user.id !== socket.id);
        socket.emit("users-list", usersArray);
        
        socket.broadcast.emit("receive-location", {
            id: socket.id,
            latitude: data.latitude,
            longitude: data.longitude,
            name: data.name || `User-${socket.id.substring(0, 4)}`,
            isOwn: false
        });
        
        io.emit("users-count", connectedUsers.size);
    });
    
    socket.on("update-location", function (data) {
        if (connectedUsers.has(socket.id)) {
            const user = connectedUsers.get(socket.id);
            user.latitude = data.latitude;
            user.longitude = data.longitude;
            
            socket.broadcast.emit("receive-location", {
                id: socket.id,
                latitude: data.latitude,
                longitude: data.longitude,
                name: user.name,
                isOwn: false
            });

            // Send update to shared viewers
            io.to(`share-${socket.id}`).emit("receive-location", {
                id: socket.id,
                latitude: data.latitude,
                longitude: data.longitude,
                name: user.name,
                isOwn: false
            });
        }
    });
    
    socket.on("generate-share-link", function (_, callback) {
        const token = generateToken();
        shareTokens.set(token, socket.id);
        callback({
            url: `${process.env.BASE_URL || 'http://localhost:3000'}/share/${token}`
        });
    });
    
    socket.on("calculate-distance", async function (data, callback) {
        if (!connectedUsers.has(socket.id) || !connectedUsers.has(data.targetId)) {
            return callback({ error: "One or both users not found" });
        }
        
        const user1 = connectedUsers.get(socket.id);
        const user2 = connectedUsers.get(data.targetId);
        
        const straightDistance = calculateDistance(
            user1.latitude, user1.longitude,
            user2.latitude, user2.longitude
        );
        
        let routeDistance = null;
        if (data.withRoute) {
            routeDistance = await getRouteDistance(
                user1.longitude, user1.latitude,
                user2.longitude, user2.latitude
            );
        }
        
        callback({
            straightDistance: straightDistance.toFixed(2),
            routeDistance: routeDistance ? routeDistance.toFixed(2) : null,
            unit: "km"
        });
    });
    
    socket.on("join-group-chat", ({ username }, callback) => {
        const displayName = username || `User-${socket.id.substring(0, 4)}`;
        chatUsers[socket.id] = displayName;
        
        // Notify others
        const systemMessage = {
            username: 'System',
            message: `${displayName} joined the chat.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true
        };
        
        chatMessages.push(systemMessage);
        io.emit('chat-message', systemMessage);
        
        callback({ 
            success: true, 
            username: displayName,
            messages: chatMessages 
        });
    });
    
    socket.on("send-chat-message", (message, callback) => {
        const username = chatUsers[socket.id] || `User-${socket.id.substring(0, 4)}`;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const messageObj = { 
            username, 
            message, 
            time,
            isOwn: false // This will be set to true on the client side for the sender
        };
        
        chatMessages.push(messageObj);
        io.emit('chat-message', messageObj);
        callback && callback();
    });
    
    socket.on("disconnect", function () {
        if (connectedUsers.has(socket.id)) {
            connectedUsers.delete(socket.id);
            io.emit("user-disconnected", socket.id);
            io.emit("users-count", connectedUsers.size);
            
            // Clean up share tokens
            for (let [token, id] of shareTokens) {
                if (id === socket.id) {
                    shareTokens.delete(token);
                }
            }
        }
        if (chatUsers[socket.id]) {
            const systemMessage = {
                username: 'System',
                message: `${chatUsers[socket.id]} left the chat.`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                system: true
            };
            chatMessages.push(systemMessage);
            socket.broadcast.emit('chat-message', systemMessage);
            delete chatUsers[socket.id];
        }
    });
});

app.get("/", function (req, res) {
    res.render("index", { 
        sharedToken: null,
        joinGroup: null
    });
});

app.get('/api/weather', async (req, res) => {
    let { lat, lon } = req.query;
    // Default to Mumbai if not provided
    if (!lat || !lon) {
        lat = 19.0760;
        lon = 72.8777;
    }

    // Check if API key is configured
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
        console.error('OpenWeather API key not configured');
        return res.status(500).json({ error: 'Weather service not configured properly' });
    }

    try {
        console.log('Fetching weather for coordinates:', lat, lon);
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`;
        console.log('Weather API URL:', url.replace(apiKey, 'API_KEY')); // Log URL without exposing API key

        const response = await axios.get(url);
        console.log('Weather API response status:', response.status);

        if (!response.data || !response.data.list) {
            throw new Error('Invalid response from weather API');
        }

        const data = response.data;

        // Parse current weather
        const current = {
            temp: Math.round(data.list[0].main.temp),
            feels_like: Math.round(data.list[0].main.feels_like),
            humidity: data.list[0].main.humidity,
            wind_speed: Math.round(data.list[0].wind.speed),
            main: data.list[0].weather[0].main,
            description: data.list[0].weather[0].description,
            severity: getWeatherSeverity(data.list[0].weather[0].main, data.list[0].wind.speed)
        };

        // Parse 5-day forecast (using 3-hour intervals)
        const forecast = [];
        const today = new Date();
        let currentDay = today.getDate();
        let processedDays = 0;

        for (let item of data.list) {
            const itemDate = new Date(item.dt * 1000);
            if (itemDate.getDate() !== currentDay && processedDays < 5) {
                forecast.push({
                    day: itemDate.toLocaleDateString('en-US', { weekday: 'short' }),
                    temp: Math.round(item.main.temp),
                    main: item.weather[0].main,
                    description: item.weather[0].description
                });
                currentDay = itemDate.getDate();
                processedDays++;
            }
        }

        console.log('Successfully processed weather data');
        res.json({ current, forecast });
    } catch (error) {
        console.error('Weather API error:', error.message);
        if (error.response) {
            console.error('API response error:', {
                status: error.response.status,
                data: error.response.data
            });
        }

        // Return Mumbai weather as fallback
        try {
            console.log('Attempting to fetch Mumbai weather as fallback');
            const mumbaiLat = 19.0760;
            const mumbaiLon = 72.8777;
            const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${mumbaiLat}&lon=${mumbaiLon}&appid=${apiKey}&units=imperial`;
            
            const response = await axios.get(url);
            const data = response.data;

            const current = {
                temp: Math.round(data.list[0].main.temp),
                feels_like: Math.round(data.list[0].main.feels_like),
                humidity: data.list[0].main.humidity,
                wind_speed: Math.round(data.list[0].wind.speed),
                main: data.list[0].weather[0].main,
                description: data.list[0].weather[0].description,
                severity: getWeatherSeverity(data.list[0].weather[0].main, data.list[0].wind.speed)
            };

            const forecast = [];
            const today = new Date();
            let currentDay = today.getDate();
            let processedDays = 0;

            for (let item of data.list) {
                const itemDate = new Date(item.dt * 1000);
                if (itemDate.getDate() !== currentDay && processedDays < 5) {
                    forecast.push({
                        day: itemDate.toLocaleDateString('en-US', { weekday: 'short' }),
                        temp: Math.round(item.main.temp),
                        main: item.weather[0].main,
                        description: item.weather[0].description
                    });
                    currentDay = itemDate.getDate();
                    processedDays++;
                }
            }

            console.log('Successfully fetched Mumbai weather as fallback');
            res.json({ current, forecast, location: 'Mumbai' });
        } catch (fallbackError) {
            console.error('Fallback weather API error:', fallbackError.message);
            if (fallbackError.response) {
                console.error('Fallback API response error:', {
                    status: fallbackError.response.status,
                    data: fallbackError.response.data
                });
            }
            res.status(500).json({ error: 'Failed to fetch weather data' });
        }
    }
});

// Add chat route
app.post('/api/chat', async (req, res) => {
  try {
    const { message, location } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // If location data is provided, include it in the context
    let context = '';
    if (location) {
      context = `The user's current location is: ${location.name} (${location.latitude}, ${location.longitude}). `;
    }

    const response = await chatbot.sendMessage(message, context);
    res.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

// Add endpoint to clear chat history
app.post('/api/chat/clear', (req, res) => {
  try {
    chatbot.clearHistory();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

server.listen(3002, () => {
    console.log("Server running on port 3002");
});

function getAndShowWeather() {
    if (!navigator.geolocation) {
        fetchMumbaiWeather();
        return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
            weatherModalBody.innerHTML = '<div class="weather-loading">Failed to fetch weather.</div>';
            return;
        }
        const data = await res.json();
        weatherModalBody.innerHTML = renderWeather(data);
    }, () => {
        // If user denies or error, show Mumbai weather
        fetchMumbaiWeather();
    });
}

function fetchMumbaiWeather() {
    // Mumbai coordinates
    const mumbaiLat = 19.0760;
    const mumbaiLon = 72.8777;
    weatherModalBody.innerHTML = '<div class="weather-loading">Showing Mumbai weather...</div>';
    fetch(`/api/weather?lat=${mumbaiLat}&lon=${mumbaiLon}`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then(data => {
            weatherModalBody.innerHTML = renderWeather(data);
        })
        .catch(() => {
            weatherModalBody.innerHTML = '<div class="weather-loading">Failed to fetch Mumbai weather.</div>';
        });
}

// Add this function before the weather API endpoint
function getWeatherSeverity(weatherMain, windSpeed) {
    // Define weather conditions and their severity
    const severeConditions = ['Thunderstorm', 'Heavy Rain', 'Snow', 'Blizzard'];
    const moderateConditions = ['Rain', 'Drizzle', 'Shower', 'Light Rain'];
    const normalConditions = ['Clear', 'Sunny', 'Partly cloudy', 'Clouds', 'Cloudy'];
    
    // Check for severe conditions
    if (severeConditions.some(condition => weatherMain.includes(condition))) {
        return 'severe';
    }
    
    // Check for high winds (over 30 mph)
    if (windSpeed > 30) {
        return 'severe';
    }
    
    // Check for moderate conditions
    if (moderateConditions.some(condition => weatherMain.includes(condition))) {
        return 'moderate';
    }
    
    // Default to normal conditions
    return 'normal';
}