import WS from "../mod.ts";

const server = new WS.Server();

server.on("connection", (socket) => {
  console.log("Client connected:", socket.uuid);
  socket.on("message", (data) => {
    console.log("Message:", data);
    // Echo back
    socket.send("Echo: " + data);
  });
  socket.on("close", (code, reason) => {
    console.log("Client disconnected:", socket.uuid);
    console.log("Code:", code, "Reason:", reason);
  });
  /*
    Return false to explicitly deny the connection.
    Returning true OR not setting return (undefined) allows the connection.
  */
});
