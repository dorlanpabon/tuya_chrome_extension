import { render } from "preact";

import { App } from "./App";
import "../styles/app.css";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Unable to find popup root.");
}

render(<App />, root);
