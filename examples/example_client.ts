import WS from "../mod.ts";

const client = new WS("ws://localhost:8080");

client.on("message", (data) => {
  console.log(data);
  client.close();
});

client.on("open", () => {
  console.log("Connected.");
  client.send("Hello, world!");
});

client.on("close", (code, reason) => {
  console.log("Disconnected:", code, "|", reason);
});
