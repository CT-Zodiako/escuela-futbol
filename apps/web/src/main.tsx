import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "dayjs/locale/es";
import "./print.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { App } from "./App";
import { theme } from "./theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light" forceColorScheme="light">
      <DatesProvider settings={{ locale: "es" }}>
        <Notifications position="top-right" />
        <App />
      </DatesProvider>
    </MantineProvider>
  </React.StrictMode>,
);
