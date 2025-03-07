const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");
const { Client } = require("@googlemaps/google-maps-services-js");
const cors = require("cors");
const morgan = require("morgan");

// Set up express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors({ origin: "*" })); // Allow all origins (update this in production)
app.use(bodyParser.json());
app.use(morgan("dev")); // Log HTTP requests

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://maheshvengala4321:X9W5oKKgvWeMRG6C@cluster0.hukis.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// MongoDB Schema for Bus Locations
const busLocationSchema = new mongoose.Schema({
  busNumber: { type: String, required: true, unique: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
});

const BusLocation = mongoose.model("BusLocation", busLocationSchema);

// Google Maps API Client
const googleMapsClient = new Client({});

// API to update bus location
app.post("/bus-location", async (req, res) => {
  const { busNumber, location } = req.body;

  // Validate location data
  if (
    !location ||
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number"
  ) {
    return res.status(400).send("Invalid location data");
  }

  try {
    let bus = await BusLocation.findOne({ busNumber });
    if (bus) {
      // Update the existing bus location
      bus.location = location;
    } else {
      // Create a new entry if bus doesn't exist
      bus = new BusLocation({ busNumber, location });
    }

    await bus.save();

    // Emit the updated location to all connected clients
    io.emit("busLocationUpdate", { busNumber, location });

    res.status(200).send("Location updated successfully");
  } catch (err) {
    res.status(500).send("Error updating location: " + err);
  }
});

// API to get bus location by bus number
app.get("/bus-location/:busNumber", async (req, res) => {
  const busNumber = req.params.busNumber;

  try {
    const bus = await BusLocation.findOne({ busNumber });
    if (bus) {
      // Use Google Maps API to get address from coordinates
      const response = await googleMapsClient.reverseGeocode({
        params: {
          latlng: `${bus.location.latitude},${bus.location.longitude}`,
          key: process.env.GOOGLE_MAPS_API_KEY, // Use environment variable
        },
        timeout: 1000, // milliseconds
      });

      const address = response.data.results[0].formatted_address;

      res.status(200).json({ location: bus.location, address });
    } else {
      res.status(404).send("Bus not found");
    }
  } catch (err) {
    res.status(500).send("Error fetching location: " + err);
  }
});

// API to get all bus locations
app.get("/bus-location-all", async (req, res) => {
  try {
    console.log("Fetching bus locations...");
    const buses = await BusLocation.find({});
    console.log("Bus locations fetched:", buses);

    if (!buses || buses.length === 0) {
      return res.status(404).json({ message: "No bus locations found" });
    }

    res.status(200).json(buses);
  } catch (err) {
    console.error("Error fetching bus locations:", err);
    res
      .status(500)
      .json({ message: "Error fetching bus locations", error: err.message });
  }
});

// API to get all buses
app.get("/buses", async (req, res) => {
  try {
    const buses = await BusLocation.find();
    res.status(200).json({ success: true, data: buses });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Server Error", error: error.message });
  }
});

// Set up WebSocket for real-time updates
io.on("connection", (socket) => {
  console.log("New client connected");

  // Handle errors
  socket.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  // When a user disconnects, log it
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

// Start the server
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
