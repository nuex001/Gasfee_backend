const express = require("express");
const mongoose = require("mongoose");
require('dotenv').config();
const http = require("http"); // Step 2a: Import http module
const socketIo = require("socket.io"); // Step 2a: Import socket.io
const cors = require("cors");

// Middleware
const app = express();
app.use(express.json());
app.use(cors({
    origin: "*"
}));
// initializing port
const PORT = process.env.PORT || 5000;

// Step 2b: Create an HTTP server and integrate it with Express
const server = http.createServer(app);
const dburl = process.env.NODE_ENV === 'production'
  ? process.env.dbURL
  : "mongodb://127.0.0.1:27017/Gasfee";

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
}); // Attach Socket.io to the server
module.exports = { io };
// connecting the db
mongoose
    .connect(dburl)
    .then((result) => {
        server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // Corrected here
        console.log("Connected Successfully");
    })
    .catch((err) => {
        console.log(err);
    });

app.get("/", (req, res) => {
    res.send("gotten successfully");
})

// ROUTES
app.use("/api/tx/", require("./Routes/transactions"));
app.use("/api/wallet/", require("./Routes/wallet"));
app.use("/api", require("./Routes/auth"));

