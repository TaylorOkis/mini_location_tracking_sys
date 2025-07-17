import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

const usersConnected = new Map();
const driverOrdersMap = new Map();
const orderCustomerMap = new Map();

app.post("/assign_order_to_driver", (req, res) => {
  const { driverId, orderId, customerLocation } = req.body;
  assignOrderToDriver(driverId, orderId, customerLocation);
  res.status(201).json({ status: "success" });
});

app.post("/create_order_for_customer", (req, res) => {
  const { userId, orderId } = req.body;
  createOrderForCustomer(userId, orderId);
  res.status(201).json({ status: "success" });
});

io.on("connection", (socket) => {
  // Register Connection
  socket.on("connect-user", (userId, role) => {
    switch (role) {
      case "admin":
        usersConnected.set(userId, socket.id);
        socket.join("admin-room");
        console.log("Admin connected");
        break;
      case "customer":
        usersConnected.set(userId, socket.id);
        console.log("Customer connected");
        break;
      case "driver":
        usersConnected.set(userId, socket.id);
        console.log("Driver connected");
        break;
      case "default":
        console.log("Invalid role");
        break;
    }
  });

  // Receive driver location
  socket.on("location-update", async ({ driverId, lat, lng }) => {
    console.log(`Location from ${driverId}: ${lat}, ${lng}`);

    // Emit location to admin
    io.to("admin-room").emit("driver-location", { driverId, lat, lng });

    // Emit ETA to customers who are connected (online)
    const orders = driverOrdersMap.get(driverId) || {};
    for (const [orderId, { customerLocation }] of Object.entries(orders)) {
      const existingCustomer = orderCustomerMap.get(orderId);

      if (!customerLocation || !existingCustomer) continue;

      const customerConnected = usersConnected.get(existingCustomer);
      if (customerConnected) {
        const etaData = await calculateETA({ lat, lng }, customerLocation);
        io.to(existingCustomer).emit("eta-update", etaData);
      }
    }
  });

  // Disconnect User
  socket.on("disconnect", async () => {
    for (const [userId, socketId] of usersConnected.entries()) {
      if (socketId === socket.id) {
        usersConnected.delete(userId);
        console.log(`Client ${userId} disconnected`);
        break;
      }
    }
  });
});

async function calculateETA(driverLoc, customerLoc) {
  const origin = `${driverLoc.lat},${driverLoc.lng}`;
  const destination = `${customerLoc.lat},${customerLoc.lng}`;
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_API_KEY}`;

  try {
    const res = await axios.get(url);
    const element = res.data.rows[0].elements[0];

    if (element.status === "OK") {
      return {
        eta: element.duration.text,
        distance: element.distance.text,
      };
    } else {
      return { eta: "N/A", distance: "N/A" };
    }
  } catch (err) {
    console.error("ETA Error: ", err.message);
    return { eta: "Error", distance: "Error" };
  }
}

function assignOrderToDriver(driverId, orderId, customerLocation) {
  const existingOrders = driverOrdersMap.get(driverId) || {};
  existingOrders[orderId] = { customerLocation };
  driverOrdersMap.set(driverId, existingOrders);
}

function createOrderForCustomer(userId, orderId) {
  orderCustomerMap.set(orderId, userId);
}

export default server;
