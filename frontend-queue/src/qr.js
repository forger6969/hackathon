import "./style.css";
import QRCode from "qrcode";

const app = document.getElementById("app");
const targetUrl = `${window.location.origin}/`;

app.innerHTML = `
  <div class="card qr-card">
    <div class="salon-name">Navbat</div>
    <div class="eta" style="margin-bottom:20px;">QR'ni skanerlang</div>
    <div class="qr-box"><canvas id="qr-canvas"></canvas></div>
    <div class="eta-sub" style="margin-top:16px;">${targetUrl}</div>
  </div>
`;

QRCode.toCanvas(document.getElementById("qr-canvas"), targetUrl, {
  width: 280,
  margin: 2,
  color: { dark: "#101828", light: "#ffffff" },
}).catch((err) => {
  document.querySelector(".qr-box").textContent = "QR yaratib bo'lmadi: " + err.message;
});
