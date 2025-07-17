import express from "express";
import http from "http";
import { Server as socketIO } from "socket.io";
import cors from "cors";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const io = new socketIO(server, { cors: { origin: "*" } });
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, `/public/index.html`));
});

let upvote_count = 0;
let stars = 0;
let usersConnected = {};
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("upvote-event", (upvote_flag) => {
    upvote_count += upvote_flag ? 1 : -1;
    let f_str = upvote_count + (upvote_count === 1 ? " Upvote" : " Upvotes");
    io.emit("update-upvotes", f_str);
  });

  socket.on("click-stars", (clickType) => {
    if (clickType) {
      stars += 1;
    } else {
      stars -= 1;
    }

    let currentStars =
      stars + (stars === 1 || stars === 0 ? " Star" : " Stars");
    io.emit("update-stars", currentStars);
  });

  socket.on("user-login", (userId) => {
    usersConnected[userId] = socket.id;
  });

  socket.on("send-message", (recipientUserId, message) => {
    const recipientSocketId = usersConnected[recipientUserId];
    if (recipientSocketId) {
      io.to(recipientSocketId).emit(`private-message`, message);
    } else {
      console.log(`User ${recipientUserId} is not currently online`);
    }
  });

  socket.on("disconnect", () => {
    for (const userId in usersConnected) {
      if (usersConnected[userId] === socket.id) {
        delete usersConnected[userId];
        console.log(`Client ${userId} disconnected`);
        break;
      }
    }
  });
});

export default server;
