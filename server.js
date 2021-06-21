require("rootpath")();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("_helpers/jwt");
const errorHandler = require("_helpers/error-handler");
const WebsocketClient = require("poloniex-node-api").WebsocketClient;
const PublicClient = require("poloniex-node-api").PublicClient;
const client = new PublicClient();
const User = require("./users/user.model");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.use(jwt());

app.use("/users", require("./users/users.controller"));

app.use(errorHandler);

const WebSocket = require("ws");

const key = "60cf67446e34a5000692bd24";
const secret = "cab66125-c26e-4a29-80b4-cec64cb57aa6";
const channels = ["USDT_ETH", "USDT_BTC"];

// start server

const wss = new WebSocket.Server({ port: 8080 });
const websocket = new WebsocketClient({ key, secret, channels });

wss.on("connection", function open(ws) {
  websocket.subscribe("USDT_ETH");
  websocket.subscribe("USDT_BTC");
  websocket.connect();

  websocket.on("close", () => console.log("close"));
  websocket.on("error", (error) => console.error(error));
  websocket.on("message", (message) => {
    ws.send(JSON.stringify(message));
  });
});

let hourValues;
let halfHourValues;
const requestReturnTicker = async () => {
  const tickers = await client.getTickers();
  if (!halfHourValues) {
    halfHourValues = tickers;
    return;
  }

  User.find({}, (err, users) => {
    users.forEach((user) => {
      if (!user.currency) return;
      if (user.timer === 30) {
        if (
          Number(tickers[user.currency].last) ==
          Number(halfHourValues[user.currency].last)
        )
          return;
        user.notification = (user.notification || []).concat({
          price: Number(tickers[user.currency].last),
          oldPrice: Number(halfHourValues[user.currency].last),
        });
      } else {
        if (hourValues) {
          if (
            Number(tickers[user.currency].last) ==
            Number(hourValues[user.currency].last)
          )
            return;
          user.notification = (user.notification || []).concat({
            price: Number(tickers[user.currency].last),
            oldPrice: Number(hourValues[user.currency].last),
          });
        }
      }
      user.save();
    });

    if (halfHourValues) {
      hourValues = halfHourValues;
    }
    halfHourValues = tickers;
  });
};

requestReturnTicker();

// setInterval(requestReturnTicker, 10000);
setInterval(requestReturnTicker, 30*60*10004);
process.setMaxListeners(5);
const port =
  process.env.NODE_ENV === "production" ? process.env.PORT || 80 : 4000;

