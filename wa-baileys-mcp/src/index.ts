import { startWhatsApp } from "./wa.js";
import { startApi } from "./api.js";

const port = Number(process.env.PORT) || 3131;

startApi(port);
void startWhatsApp();
