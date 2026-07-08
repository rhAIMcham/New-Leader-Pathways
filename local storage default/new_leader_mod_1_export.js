window.InitUserScripts = function() {
  window.Script1 = function() {
    var n1 = localStorage.getItem("learnerReplyOne") || "(no response saved)";
    var n2 = localStorage.getItem("learnerReplyTwo") || "(no response saved)";
    var m1 = localStorage.getItem("discReplyOne") || "(no response saved)";
    var m2 = localStorage.getItem("discReplyTwo") || "(no response saved)";

    function loadScript(src, onload) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = onload;
      s.onerror = function() { console.error("Failed to load: " + src); };
      document.head.appendChild(s);
    }

    function buildAndDownload() {
      PDFLib.PDFDocument.create().then(function(pdfDoc) {
        Promise.all([
          pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica),
          pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold)
        ]).then(function(fonts) {
          var font     = fonts[0];
          var fontBold = fonts[1];
          var margin   = 50;
          var pageW    = 595;
          var pageH    = 842;
          var maxWidth = pageW - margin * 2;
          var lineH    = 17;

          // ✏️ Brand color, derived from 060732
          var NAVY       = PDFLib.rgb(6 / 255, 7 / 255, 50 / 255);
          var NAVY_TINT  = PDFLib.rgb(0.90, 0.90, 0.95);
          var WHITE      = PDFLib.rgb(1, 1, 1);
          var BODY_GRAY  = PDFLib.rgb(0.20, 0.20, 0.22);
          var MUTED_GRAY = PDFLib.rgb(0.45, 0.45, 0.48);

          var pages = [];

          function addPage() {
            var page = pdfDoc.addPage([pageW, pageH]);
            pages.push(page);
            return page;
          }

          var page = addPage();
          var y = pageH - 60;

          // ── Cover header (page 1 only) ──────────────────────────────
          var today = new Date();
          var dateStr = today.toLocaleDateString("en-GB", {
            day: "2-digit", month: "long", year: "numeric"
          });

          page.drawText("New Leader Session 1 AIM", {
            x: margin, y: y, size: 21, font: fontBold, color: NAVY
          });
          y -= 22;
          page.drawText("New leader programme  ·  Session 1  ·  " + dateStr, {
            x: margin, y: y, size: 11, font: font, color: MUTED_GRAY
          });
          y -= 14;
          page.drawLine({
            start: { x: margin, y: y },
            end:   { x: pageW - margin, y: y },
            thickness: 1.2,
            color: NAVY
          });
          y -= 30;

          // ── Wrapped text helper ──────────────────────────────────────
          function drawWrapped(text, startY, size, fontRef, color, page) {
            var words = text.split(" ");
            var line  = "";
            var curY  = startY;
            for (var i = 0; i < words.length; i++) {
              var test = line ? line + " " + words[i] : words[i];
              if (fontRef.widthOfTextAtSize(test, size) > maxWidth && line) {
                page.drawText(line, { x: margin, y: curY, size: size, font: fontRef, color: color });
                curY -= lineH;
                line = words[i];
              } else {
                line = test;
              }
            }
            if (line) {
              page.drawText(line, { x: margin, y: curY, size: size, font: fontRef, color: color });
              curY -= lineH;
            }
            return curY;
          }

          // ── Section banner helper ───────────────────────────────────
          function drawSectionBanner(title, page, startY) {
            var bannerH = 26;
            page.drawRectangle({
              x: margin,
              y: startY - bannerH + 6,
              width: maxWidth,
              height: bannerH,
              color: NAVY
            });
            page.drawText(title, {
              x: margin + 10,
              y: startY - bannerH + 14,
              size: 12.5,
              font: fontBold,
              color: WHITE
            });
            return startY - bannerH - 12;
          }

          // ✏️ Update titles to match your exercises
          var exercises = [
            { title: "First email to Susan", response: n1 },
            { title: "Aspects that work in my favour", response: m1 },
            { title: "Aspects that might work against me", response: m2 },
            { title: "Second email to Susan", response: n2 }
          ];

          var FOOTER_RESERVE = 70;

          for (var e = 0; e < exercises.length; e++) {
            var ex = exercises[e];

            if (y < FOOTER_RESERVE + 60) {
              page = addPage();
              y = pageH - 60;
            }

            y = drawSectionBanner(ex.title, page, y);
            y = drawWrapped(ex.response, y, 11.5, font, BODY_GRAY, page);
            y -= 26;

            if (y < FOOTER_RESERVE && e < exercises.length - 1) {
              page = addPage();
              y = pageH - 60;
            }
          }

          // ── Footer pass: thin rule + "Page X of Y" on every page ───
          var total = pages.length;
          for (var p = 0; p < total; p++) {
            var pg = pages[p];
            pg.drawLine({
              start: { x: margin, y: 46 },
              end:   { x: pageW - margin, y: 46 },
              thickness: 0.75,
              color: NAVY_TINT
            });
            var label = "Page " + (p + 1) + " of " + total;
            var labelSize = 9;
            var labelWidth = font.widthOfTextAtSize(label, labelSize);
            pg.drawText(label, {
              x: pageW - margin - labelWidth,
              y: 32,
              size: labelSize,
              font: font,
              color: MUTED_GRAY
            });
            pg.drawText("New leader program", {
              x: margin,
              y: 32,
              size: labelSize,
              font: font,
              color: MUTED_GRAY
            });
          }

          pdfDoc.save().then(function(pdfBytes) {
            var blob = new Blob([pdfBytes], { type: "application/pdf" });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement("a");
            a.href     = url;
            a.download = "New Leader Session 1 AIM.pdf";
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            setTimeout(function() {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 5000);
          });
        });
      }).catch(function(err) {
        console.error("PDF build error:", err);
      });
    }

    if (typeof PDFLib !== "undefined") {
      buildAndDownload();
    } else {
      loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.16.0/pdf-lib.min.js",
        function() { buildAndDownload(); }
      );
    }
  };
};
window.InitUserScripts();
window.Script1();
