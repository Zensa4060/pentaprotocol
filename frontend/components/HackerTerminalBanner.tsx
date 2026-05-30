"use client";
import type { CSSProperties } from "react";
import { useBannerCanvas } from "./useBannerCanvas";

const LINES = [
  "$ nmap -sV -p- --open 10.0.0.1",
  "Starting Nmap 7.94 ( https://nmap.org )",
  "PORT      STATE  SERVICE   VERSION",
  "22/tcp    open   ssh       OpenSSH 8.9p1",
  "80/tcp    open   http      nginx 1.18.0",
  "443/tcp   open   ssl/https nginx 1.18.0",
  "3306/tcp  open   mysql     MySQL 8.0.35",
  "8080/tcp  open   http-alt  Apache 2.4.51",
  "9200/tcp  open   wap-wsp?  Elasticsearch",
  "$ python3 exploit.py --target 10.0.0.1",
  "[*] Initializing payload encoder...",
  "[*] Bypassing ASLR stack canary...",
  "[+] Stack pivot successful 0x7fff4a2e",
  "[*] Injecting shellcode 312 bytes...",
  "[+] Reverse shell obtained!",
  "$ id && whoami",
  "uid=0(root) gid=0(root) groups=0(root)",
  "root",
  "$ cat /etc/shadow | head -3",
  "root:$6$rounds=500000$XMr8...:19800:0",
  "$ hashcat -m 1800 hash.txt /wordlist",
  "Status: Running  Speed: 8432.4 kH/s",
  "Progress: 22847/14344391 (0.16%)",
  "$ netstat -tulpn | grep LISTEN",
  "tcp  0.0.0.0:22   LISTEN  1187/sshd",
  "tcp  0.0.0.0:80   LISTEN  2091/nginx",
  "$ grep -r 'password\\|secret' /var/www",
  "config.php:$db_pass = 'Wh1teR4bbit!';",
  "app.env:JWT_SECRET=s3cr3tK3y_d0ntl00k",
  "$ curl -s http://10.0.0.1/api/admin",
  "HTTP/1.1 200 OK",
  "{\"status\":\"ok\",\"admin_token\":\"eyJ...\"}",
  "$ ssh -i id_rsa root@192.168.1.100",
  "Welcome to Ubuntu 22.04.3 LTS",
  "Last login: Fri Jan 12 03:22:11 2024",
  "$ ls /root/.ssh/authorized_keys",
  "-rw------- 1 root root 567 Jan 12 03:22",
  "$ crontab -l | grep root",
  "*/5 * * * * /tmp/.hidden/backdoor.sh",
  "$ find / -suid -type f 2>/dev/null",
  "/usr/bin/sudo   /usr/bin/passwd",
  "/bin/su   /usr/sbin/pppd",
];

function draw(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, s: any) {
  const dt = (s._dt as number) ?? 1;

  // ── Init ─────────────────────────────────────────────────────────────────
  if (!s.init || s.W !== W || s.H !== H) {
    s.W = W; s.H = H; s.init = true;
    s.scrollY = 0;
    s.glitchTimer = 0;
    s.glitchActive = 0;
    s.glitchY = 0;
    s.progress = [
      { label: "BREACH",  val: 0.12, speed: 0.0018 },
      { label: "DECRYPT", val: 0.47, speed: 0.0011 },
      { label: "EXFIL",   val: 0.71, speed: 0.0007 },
    ];
    // Hex rain columns — background layer
    const NCOLS = Math.ceil(W / 22);
    s.rain = Array.from({ length: NCOLS }, () => ({
      y:    -(Math.random() * H * 1.2),
      spd:  0.35 + Math.random() * 0.55,
      len:  10 + Math.floor(Math.random() * 14),
      ct:   0,
      cs:   4 + Math.floor(Math.random() * 6),
      chars: Array.from({ length: 26 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
      ),
    }));
  }

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#000c03";
  ctx.fillRect(0, 0, W, H);

  // ── Hex rain (background, very dim) ──────────────────────────────────────
  const CW = 22;
  ctx.font = `${CW * 0.55}px 'Courier New',monospace`;
  ctx.textAlign = "center";
  s.rain.forEach((col: any, i: number) => {
    col.y += col.spd * dt;
    col.ct += dt;
    if (col.ct >= col.cs) {
      col.ct = 0;
      col.chars.shift();
      col.chars.push(
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()
      );
    }
    if (col.y - col.len * CW * 0.62 > H + 20) {
      col.y = -(CW * (2 + Math.random() * 6));
      col.spd = 0.35 + Math.random() * 0.55;
    }
    const x = i * CW + CW / 2;
    col.chars.slice(0, col.len).forEach((ch: string, ci: number) => {
      const cy = col.y - ci * CW * 0.62;
      if (cy < -8 || cy > H + 8) return;
      const fade = Math.max(0, 1 - ci / col.len);
      ctx.fillStyle = `rgba(0,${Math.floor(40 + fade * 60)},${Math.floor(fade * 15)},${fade * 0.28})`;
      ctx.fillText(ch, x, cy);
    });
  });

  // ── Scanlines ─────────────────────────────────────────────────────────────
  for (let y = 0; y < H; y += 2) {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    ctx.fillRect(0, y, W, 1);
  }

  // ── Terminal panel ─────────────────────────────────────────────────────────
  const LH = Math.max(11, Math.min(17, H / 13));
  const PAD = Math.max(10, W * 0.04);
  const pX = PAD;
  const pW = W - PAD * 2;
  const pY = H * 0.05;
  const pBarH = LH * 1.6;
  const pContentH = H * 0.63;
  const pTotalH = pBarH + pContentH;

  // Panel shadow / glow
  ctx.save();
  ctx.shadowColor = "rgba(0,255,80,0.12)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(0,12,4,0.92)";
  ctx.fillRect(pX, pY, pW, pTotalH);
  ctx.restore();
  ctx.strokeStyle = "rgba(0,255,80,0.18)";
  ctx.lineWidth = 1;
  ctx.strokeRect(pX, pY, pW, pTotalH);

  // Title bar
  ctx.fillStyle = "rgba(0,255,80,0.07)";
  ctx.fillRect(pX, pY, pW, pBarH);
  // Divider line under title bar
  ctx.fillStyle = "rgba(0,255,80,0.2)";
  ctx.fillRect(pX, pY + pBarH - 1, pW, 1);

  // Window control dots
  const dotY = pY + pBarH * 0.52;
  [["#ff5f57", 14], ["#febc2e", 30], ["#28c840", 46]].forEach(([col, ox]) => {
    ctx.beginPath();
    ctx.arc(pX + (ox as number), dotY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = col as string;
    ctx.fill();
  });

  // Title text
  const titleFz = Math.max(9, LH * 0.78);
  ctx.font = `${titleFz}px 'Courier New',monospace`;
  ctx.fillStyle = "rgba(0,255,80,0.85)";
  ctx.textAlign = "center";
  ctx.fillText("root@PENTAPROTOCOL — bash — 120×38", pX + pW / 2, pY + pBarH * 0.7);

  // Timestamp top-right
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;
  ctx.fillStyle = "rgba(0,255,80,0.4)";
  ctx.textAlign = "right";
  ctx.fillText(ts, pX + pW - 10, pY + pBarH * 0.7);

  // ── Scrolling command output ───────────────────────────────────────────────
  const contentY = pY + pBarH + 4;
  const contentH = pContentH - 8;
  const visLines = Math.floor(contentH / LH);

  // Clip to content area
  ctx.save();
  ctx.beginPath();
  ctx.rect(pX + 2, contentY, pW - 4, contentH);
  ctx.clip();

  s.scrollY += 0.22 * dt;
  const scrollOff = s.scrollY % LH;
  const startLine = Math.floor(s.scrollY / LH);

  ctx.font = `${LH * 0.8}px 'Courier New',monospace`;
  ctx.textAlign = "left";

  for (let i = 0; i <= visLines + 1; i++) {
    const li = (startLine + i) % LINES.length;
    const line = LINES[li];
    const ly = contentY + i * LH - scrollOff;
    if (ly > contentY + contentH) break;

    // Color-code by content
    let col = "rgba(0,195,55,0.72)";
    if (line.startsWith("$"))                                col = "rgba(0,255,90,0.98)";
    else if (line.startsWith("[+]"))                         col = "rgba(60,255,120,1.0)";
    else if (line.startsWith("[*]"))                         col = "rgba(80,200,255,0.88)";
    else if (line.startsWith("[-]"))                         col = "rgba(255,80,80,0.88)";
    else if (/open|LISTEN/.test(line))                       col = "rgba(255,210,60,0.82)";
    else if (/root|uid=0|password|secret|pass|JWT/.test(line)) col = "rgba(255,100,80,0.92)";
    else if (/HTTP|Status:|Progress|Welcome/.test(line))     col = "rgba(120,220,255,0.80)";
    else if (line.startsWith("PORT") || line.startsWith("tcp")) col = "rgba(180,255,200,0.75)";

    ctx.fillStyle = col;
    ctx.fillText(line, pX + 10, ly);

    // Blinking cursor on the last visible non-empty line
    if (i === visLines - 1 && Math.sin(t * 3.2) > 0) {
      const tw = ctx.measureText(line).width;
      ctx.fillStyle = "rgba(0,255,80,0.88)";
      ctx.fillRect(pX + 10 + tw + 2, ly - LH * 0.78, LH * 0.45, LH * 0.88);
    }
  }
  ctx.restore();

  // ── Progress bars ──────────────────────────────────────────────────────────
  const barSectionY = pY + pTotalH + H * 0.03;
  const barH = Math.max(6, H * 0.035);
  const barSpacing = pW / (s.progress as any[]).length;
  const labelFz = Math.max(8, LH * 0.68);

  ctx.font = `${labelFz}px 'Courier New',monospace`;
  (s.progress as any[]).forEach((p: any, pi: number) => {
    p.val = p.val + p.speed * dt;
    if (p.val > 1) p.val = 0;

    const bx = pX + pi * barSpacing;
    const bw = barSpacing * 0.88;
    const pct = Math.floor(p.val * 100);

    // Label + pct
    ctx.fillStyle = "rgba(0,255,80,0.55)";
    ctx.textAlign = "left";
    ctx.fillText(p.label, bx, barSectionY);
    ctx.fillStyle = "rgba(0,255,80,0.9)";
    ctx.textAlign = "right";
    ctx.fillText(`${pct}%`, bx + bw, barSectionY);

    // Track
    ctx.fillStyle = "rgba(0,40,12,0.9)";
    ctx.strokeStyle = "rgba(0,255,80,0.15)";
    ctx.lineWidth = 1;
    ctx.fillRect(bx, barSectionY + 3, bw, barH);
    ctx.strokeRect(bx, barSectionY + 3, bw, barH);

    // Fill — gradient green
    if (p.val > 0) {
      const fillGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      fillGrad.addColorStop(0,   "rgba(0,160,50,0.9)");
      fillGrad.addColorStop(0.5, "rgba(0,255,90,1.0)");
      fillGrad.addColorStop(1,   "rgba(100,255,160,0.85)");
      ctx.fillStyle = fillGrad;
      ctx.fillRect(bx, barSectionY + 3, bw * p.val, barH);

      // Leading edge glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const gx = ctx.createLinearGradient(bx + bw * p.val - 8, 0, bx + bw * p.val + 4, 0);
      gx.addColorStop(0, "rgba(0,255,100,0)");
      gx.addColorStop(1, "rgba(0,255,100,0.6)");
      ctx.fillStyle = gx;
      ctx.fillRect(bx + bw * p.val - 8, barSectionY + 3, 12, barH);
      ctx.restore();
    }
  });

  // ── Status line ────────────────────────────────────────────────────────────
  const statusY = H * 0.93;
  const sfz = Math.max(7, LH * 0.6);
  ctx.font = `${sfz}px 'Courier New',monospace`;
  ctx.textAlign = "left";

  const statusItems = [
    `CPU:${Math.floor(18 + Math.sin(t * 0.8) * 12 + 12)}%`,
    `MEM:${Math.floor(44 + Math.sin(t * 0.5) * 8)}%`,
    `NET:${Math.floor(55 + Math.sin(t * 1.4) * 35)}KB/s`,
    `PKT:${Math.floor(t * 8.3) % 99999}`,
    `[CONNECTED]`,
  ];
  const itemW2 = pW / statusItems.length;
  statusItems.forEach((item, ii) => {
    const active = item.includes("CONNECTED");
    ctx.fillStyle = active ? "rgba(0,255,80,0.85)" : "rgba(0,180,50,0.42)";
    ctx.fillText(item, pX + ii * itemW2, statusY);
  });

  // ── Glitch effect ─────────────────────────────────────────────────────────
  s.glitchTimer += dt;
  if (s.glitchTimer > 200 + Math.random() * 100) {
    s.glitchTimer = 0;
    s.glitchActive = 6 + Math.random() * 4;
    s.glitchY = H * 0.1 + Math.random() * H * 0.7;
  }
  if (s.glitchActive > 0) {
    s.glitchActive -= dt;
    // Horizontal displacement glitch slice
    const gSliceH = LH * 0.6;
    const imgData = ctx.getImageData(pX, s.glitchY, pW, gSliceH);
    const shift = Math.floor((Math.random() - 0.5) * 24);
    ctx.putImageData(imgData, pX + shift, s.glitchY);
    // Bright flash line
    ctx.fillStyle = `rgba(0,255,80,${0.04 + Math.random() * 0.06})`;
    ctx.fillRect(0, s.glitchY, W, gSliceH * 0.35);
  }

  // ── CRT phosphor glow ─────────────────────────────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const glow2 = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65);
  glow2.addColorStop(0, "rgba(0,50,18,0.09)");
  glow2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ── Edge vignette ──────────────────────────────────────────────────────────
  const vL2 = ctx.createLinearGradient(0, 0, W * 0.06, 0);
  vL2.addColorStop(0, "rgba(0,0,0,0.88)"); vL2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vL2; ctx.fillRect(0, 0, W * 0.06, H);

  const vR2 = ctx.createLinearGradient(W * 0.94, 0, W, 0);
  vR2.addColorStop(0, "rgba(0,0,0,0)"); vR2.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = vR2; ctx.fillRect(W * 0.94, 0, W * 0.06, H);

  const vT2 = ctx.createLinearGradient(0, 0, 0, H * 0.06);
  vT2.addColorStop(0, "rgba(0,0,0,0.75)"); vT2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vT2; ctx.fillRect(0, 0, W, H * 0.06);

  const vB2 = ctx.createLinearGradient(0, H * 0.94, 0, H);
  vB2.addColorStop(0, "rgba(0,0,0,0)"); vB2.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = vB2; ctx.fillRect(0, H * 0.94, W, H * 0.06);
}

export default function HackerTerminalBanner({ style = {}, hideLabels: _h = false }: { style?: CSSProperties; hideLabels?: boolean }) {
  const { wrapRef, cvRef } = useBannerCanvas(draw, 30);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", background: "#000c03", ...style }}>
      <canvas ref={cvRef} style={{ display: "block" }} />
    </div>
  );
}
