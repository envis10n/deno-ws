import WS from "../mod.ts";

const server = new WS.Server();

server.on("connection", (socket) => {
  console.log("Client connected:", socket.uuid);
  socket.on("message", (data) => {
    console.log("Message:", data);
  });
  socket.on("close", (code, reason) => {
    console.log("Client disconnected:", socket.uuid);
    console.log("Code:", code, "Reason:", reason);
    setTimeout(() => {
      console.log(server.clients);
    }, 2000);
  });
});

server.on("listening", () => {
  console.log("Listening...");
});
