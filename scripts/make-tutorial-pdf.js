const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "..", "public", "tutorial.pdf");

function writeFallback() {
  const content = `The Cold Line Tutorial\n----------------------\n\nThis is a temporary PDF for download wiring.\nReplace this file with a designed PDF when ready.\n`;
  fs.writeFileSync(out, content, "utf8");
  console.log("Wrote fallback tutorial.pdf (plain text)");
}

try {
  const PDFDocument = require("pdfkit");
  const doc = new PDFDocument({ size: "LETTER", margin: 54 });
  const brandBg = "#0b1220";
  const brandAccent = "#00e0a4";
  const contentTop = 100; // explicit content start below header band

  function header(title){
    doc.save();
    doc.rect(0, 0, doc.page.width, 72).fill(brandBg);
    doc.fill(brandAccent).rect(0, 60, doc.page.width, 4).fill();
    doc.fill("#ffffff").fontSize(20).text(title, 54, 28);
    doc.restore();
  }
  function footer(){
    doc.fontSize(9).fillColor("#777").text("Cold Line Tutorial", 54, doc.page.height-36);
    doc.fillColor("#000");
  }

  // Page wrapper to avoid accidental double-adds and blank pages
  let started = false;
  function page(title, draw){
    if (started) doc.addPage();
    started = true;
    header(title);
    draw();
    footer();
  }

  doc.pipe(fs.createWriteStream(out));

  // Page 1
  page("Cold Line Tutorial", () => {
    const x = 54, y = contentTop;
    doc.fillColor("#000").fontSize(13).text("Quick start", x, y);
    doc.fontSize(11);
    const bullets = [
      "1. Compare Market to Cold Line. If the favorite is smaller on Cold, edge leans to the dog.",
      "2. Use sliders to reflect real edges you believe. Left gives edge to away. Right gives edge to home.",
      "3. Watch the running total. It shifts the Cold Line live.",
      "4. Read the differential. Then apply the verdict scale.",
      "5. Check weather. Detailed cards show only inside the 8 day window.",
    ];
    let yy = y + 22;
    bullets.forEach(t => { doc.text(t, x, yy, { width: doc.page.width - 108 }); yy += 16; });

    // example card
    const cardY = y + 130;
    doc.roundedRect(54, cardY, doc.page.width-108, 120, 8).fill("#f5f7fb");
    doc.fillColor("#000").fontSize(12).text("Example: Chiefs -3.5  vs  Bears +3.5", 70, cardY+15);
    doc.fontSize(11).text("Cold Line = snapHalf(Market + delta)", 70, cardY+35);
    doc.fontSize(11).text("Cold Line: Chiefs -2.0 (delta +1.5 to Bears)", 70, cardY+50);
    doc.fillColor(brandAccent).fontSize(11).text("Differential |3.5 − 2.0| = 1.5 points toward Bears", 70, cardY+70);
  });

  // Page 2
  page("Sliders", () => {
    const x = 54, y = contentTop;
    doc.fillColor("#000").fontSize(12).text("Move left gives edge to away. Move right gives edge to home.", x, y);
    doc.fontSize(11).text("The running total is the sum of your slider inputs. It shifts the Cold Line.", x, y+18);

    const x0 = 72, y0 = y + 160, w = doc.page.width - 144;
    doc.save().lineWidth(6).strokeColor("#c9cfda").moveTo(x0, y0).lineTo(x0+w, y0).stroke().restore();
    for(let i=0;i<=10;i++){
      const xi = x0 + w*(i/10);
      doc.save().lineWidth(1).strokeColor("#999").moveTo(xi, y0-6).lineTo(xi, y0+6).stroke().restore();
    }
    const thumbX = x0 + w*0.65;
    doc.save().fillColor(brandAccent).circle(thumbX, y0, 8).fill().restore();
    doc.fontSize(11).fillColor("#000").text("Away -", x0, y0+16);
    doc.text("+ Home", x0+w-40, y0+16, { width: 80, align: "right" });
    doc.fillColor("#0b1220").fontSize(12).text("Running total: +1.5 to home", 72, y0+60);
  });

  // Page 3
  page("Differential and verdict", () => {
    const x = 54, y = contentTop;
    doc.fillColor("#000").fontSize(12).text("Compute Market minus Cold. If the favorite shrinks on Cold, edge leans to the dog.", x, y);
    const cardY = y + 140;
    doc.roundedRect(54, cardY, doc.page.width-108, 120, 8).fill("#f5f7fb");
    doc.fillColor("#000").fontSize(11).text("Market: Chiefs -3.5", 70, cardY+15);
    doc.text("Cold:   Chiefs -1.0", 70, cardY+35);
    doc.fillColor(brandAccent).fontSize(12).text("Differential: 2.5 points toward Bears", 70, cardY+55);
    doc.fillColor("#000").fontSize(14).text("Verdict: 🙂 Lean Bears", 70, cardY+75);
  });

  // Page 4
  page("Adjustments", () => {
    const x = 54, y = contentTop;
    doc.fillColor("#000").fontSize(12).text("We show why Cold moved: HFA, Body Clock, Coaching Familiarity, and your other inputs.", x, y);
    const lines = [
      "HFA: baseline 3.0; deltas per venue (Denver +0.25; fortress 0.00; Raiders/Jags/Rams/Chargers -1.00; default -0.50; Neutral -1.50).",
      "Body Clock: PT away teams in early ET/CT get a dock (ET -0.75, CT -0.50).",
      "Coaching Familiarity: +1.0 OC/DC → HC vs opponent; +0.5 other coaches/starters vs former team or explicit revenge/reunion; cap ±1.0.",
      "Other user inputs listed; expand to see all.",
    ];
    let yy = y + 22;
    lines.forEach(t => { doc.fontSize(11).text(t, x, yy, { width: doc.page.width - 108 }); yy += 16; });
  });

  // Page 5
  page("Market context: ML + Total", () => {
    function impliedPct(odds){
      if(typeof odds!=="number") return "—";
      const p = odds>0 ? 100/(odds+100) : (-odds)/((-odds)+100);
      return (p*100).toFixed(1)+"%";
    }
    const mlAway = +135, mlHome = -155, totPts = 45.5;
    const bx1x=54, bx1y=contentTop+140, bx1w=(doc.page.width-108)/2-10, bx1h=120;
    doc.roundedRect(bx1x, bx1y, bx1w, bx1h, 8).fill("#f5f7fb");
    doc.fillColor("#000").fontSize(12).text("Moneyline (median)", bx1x+16, bx1y+12);
    doc.fontSize(11).text(`Away: +${mlAway}  (${impliedPct(mlAway)})`, bx1x+16, bx1y+40);
    doc.text(`Home: ${mlHome}`, bx1x+16, bx1y+60);
    const barx=bx1x+16, bary=bx1y+90, barw=bx1w-32;
    doc.save().lineWidth(6).strokeColor("#c9cfda").moveTo(barx,bary).lineTo(barx+barw,bary).stroke().restore();
    doc.save().fillColor(brandAccent).circle(barx+barw*0.35, bary, 5).fill().restore();

    const bx2x=bx1x+bx1w+20, bx2y=bx1y, bx2w=bx1w, bx2h=120;
    doc.roundedRect(bx2x, bx2y, bx2w, bx2h, 8).fill("#f5f7fb");
    doc.fillColor("#000").fontSize(12).text("Total (O/U, median)", bx2x+16, bx2y+12);
    doc.fontSize(20).fillColor(brandBg).text(String(totPts), bx2x+16, bx2y+40);
    doc.fontSize(10).fillColor("#000").text("Illustrative only; see app for live medians.", bx2x+16, bx2y+70);
  });

  // Page 6
  page("Weather", () => {
    const x = 54, y = contentTop;
    doc.fillColor("#000").fontSize(12).text("Detailed weather cards appear only inside the 8 day window.", x, y);
    doc.fontSize(11).text("Outside that range you will see a simple unavailable note.", x, y+18);
    const cardY = y + 140;
    doc.roundedRect(54, cardY, doc.page.width-108, 110, 8).fill("#f5f7fb");
    doc.fillColor("#000").fontSize(12).text("Chicago 3 PM: 62°F, wind 12 mph, gusts 18 mph, rain 25 percent", 70, cardY+15);
  });

  // Page 7
  page("Legend", () => {
    const x = 54, y = contentTop;
    doc.fontSize(12).fillColor("#000").text("Verdict scale", x, y);
    const items = [
      ["🤝 Pass", "0.00 to 1.49 point diff"],
      ["🙂 Lean", "1.50 to 2.99 point diff"],
      ["🎯 Play", "3.00 to 4.99 point diff"],
      ["🔨 Hammer", "5.00 to 6.99 point diff"],
      ["💪 Pound", "7.00 to 8.99 point diff"],
      ["🚀 Slam", "9.00 to 13.99 point diff"],
      ["🏠 Bet the House", "14.00 plus point diff"],
    ];
    let yy = y + 24;
    items.forEach(([k,v])=>{ doc.fontSize(13).text(`${k} = ${v}`, x, yy); yy += 18; });
    doc.fontSize(11).fillColor("#777").text("Tie handling: 1.50 goes to Lean. 3.00 goes to Play.", x, yy+6);
  });

  doc.end();
  console.log("Wrote tutorial.pdf via pdfkit");
} catch (e) {
  // pdfkit not available; write a simple placeholder file so the link works
  writeFallback();
}
