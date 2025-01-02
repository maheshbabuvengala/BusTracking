const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const bodyParser = require("body-parser");

// Set up express app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB Connection
mongoose
  .connect("mongodb+srv://maheshvengala4321:X9W5oKKgvWeMRG6C@cluster0.hukis.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
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

// Middleware for parsing JSON bodies
app.use(bodyParser.json());

// API to update bus location
app.post("/bus-location", async (req, res) => {
  const { busNumber, location } = req.body;

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
// app.get("/bus-location/:busNumber", async (req, res) => {
//   const busNumber = req.params.busNumber;

//   try {
//     const bus = await BusLocation.findOne({ busNumber });
//     if (bus) {
//       res.status(200).json(bus.location);
//     } else {
//       res.status(404).send("Bus not found");
//     }
//   } catch (err) {
//     res.status(500).send("Error fetching location: " + err);
//   }
// });

app.get("/bus-location/all", async (req, res) => {
  try {
    const buses = await BusLocation.find({});
    res.status(200).json(buses);
  } catch (err) {
    res.status(500).send("Error fetching bus locations: " + err);
  }
});

// Set up WebSocket for real-time updates
io.on("connection", (socket) => {
  console.log("New client connected");

  // When a user disconnects, log it
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
