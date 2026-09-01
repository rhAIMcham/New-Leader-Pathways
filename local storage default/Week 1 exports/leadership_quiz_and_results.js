window.InitUserScripts = function() {
  window.Script1 = function() {
    var ls1 = localStorage.getItem("leadershipQuiz") || "(no response saved)";
    var ls2 = localStorage.getItem("leadershipQuizReflection") || "(no response saved)";

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
          var FOOTER_RESERVE = 70;

          // ✏️ Brand color, derived from 060732
          var NAVY       = PDFLib.rgb(6 / 255, 7 / 255, 50 / 255);
          var NAVY_TINT  = PDFLib.rgb(0.90, 0.90, 0.95);
          var WHITE      = PDFLib.rgb(1, 1, 1);
          var BODY_GRAY  = PDFLib.rgb(0.20, 0.20, 0.22);
          var MUTED_GRAY = PDFLib.rgb(0.45, 0.45, 0.48);

          // ── Form, for the fillable reflection fields ────────────────
          var form = pdfDoc.getForm();
          var fieldCounter = 0;

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

          page.drawText("New Leader Session 1 1/5 AIM", {
            x: margin, y: y, size: 21, font: fontBold, color: NAVY
          });
          y -= 22;
          page.drawText("New leader programme  ·  Session 1  · 1/5  " + dateStr, {
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

          // ── Wrapped text helper (page-break safe, supports **bold**) ──
          function drawWrapped(text, startY, size, fontRef, color, page) {
            var paragraphs = text.split("\n");
            var curY = startY;
            var spaceWidth = fontRef.widthOfTextAtSize(" ", size);

            function ensureRoom() {
              if (curY < FOOTER_RESERVE) {
                page = addPage();
                curY = pageH - 60;
              }
            }

            function drawLine(lineWords) {
              var x = margin;
              for (var i = 0; i < lineWords.length; i++) {
                var wFont = lineWords[i].bold ? fontBold : fontRef;
                page.drawText(lineWords[i].text, { x: x, y: curY, size: size, font: wFont, color: color });
                x += wFont.widthOfTextAtSize(lineWords[i].text, size) + spaceWidth;
              }
              curY -= lineH;
              ensureRoom();
            }

            for (var p = 0; p < paragraphs.length; p++) {
              var paragraph = paragraphs[p];

              if (paragraph === "") {
                curY -= lineH;
                ensureRoom();
                continue;
              }

              // Split on ** markers: even-index segments are normal, odd-index are bold
              var segments = paragraph.split("**");
              var words = [];
              for (var s = 0; s < segments.length; s++) {
                var isBold = (s % 2 === 1);
                var segWords = segments[s].split(" ");
                for (var w = 0; w < segWords.length; w++) {
                  if (segWords[w].length > 0) {
                    words.push({ text: segWords[w], bold: isBold });
                  }
                }
              }

              var lineWords = [];
              var lineWidth = 0;

              for (var i = 0; i < words.length; i++) {
                var wFont = words[i].bold ? fontBold : fontRef;
                var wWidth = wFont.widthOfTextAtSize(words[i].text, size);
                var addWidth = (lineWords.length > 0 ? spaceWidth : 0) + wWidth;

                if (lineWidth + addWidth > maxWidth && lineWords.length > 0) {
                  drawLine(lineWords);
                  lineWords = [];
                  lineWidth = 0;
                  addWidth = wWidth;
                }

                lineWords.push(words[i]);
                lineWidth += addWidth;
              }

              if (lineWords.length > 0) {
                drawLine(lineWords);
              }
            }

            return { page: page, y: curY };
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

          // ── Fillable reflection box helper ──────────────────────────
          // Draws a label + bordered multiline text field the learner can
          // type into once the PDF is open in Acrobat/Preview/etc.
          function drawReflectionField(label, page, startY, boxHeight) {
            boxHeight = boxHeight || 110;
            var labelSize = 11;

            // Page-break check: need room for label + box + a little breathing room
            if (startY - labelSize - 8 - boxHeight < FOOTER_RESERVE) {
              page = addPage();
              startY = pageH - 60;
            }

            page.drawText(label, {
              x: margin, y: startY, size: labelSize, font: fontBold, color: NAVY
            });

            var boxTop = startY - 8;
            var boxY   = boxTop - boxHeight;

            fieldCounter += 1;
            var fieldName = "reflection_" + fieldCounter;
            var textField = form.createTextField(fieldName);
            textField.enableMultiline();
            // addToPage() must run first — it's what creates the field's
            // default appearance (/DA) stream. setFontSize()/setText() edit
            // that stream, so calling them before addToPage throws
            // "No /DA entry found for field".
            textField.addToPage(page, {
              x: margin,
              y: boxY,
              width: maxWidth,
              height: boxHeight,
              borderColor: NAVY_TINT,
              borderWidth: 1,
              backgroundColor: WHITE
            });
            textField.setFontSize(10.5);
            textField.setText("");

            return { page: page, y: boxY - 22 };
          }

          // ✏️ Update titles to match your exercises
          var exercises = [
            { title: "Leadership quiz result", response: ls1 },
            { title: "Leadership quiz reflection", response: ls2 }
          ];

          for (var e = 0; e < exercises.length; e++) {
            var ex = exercises[e];

            if (y < FOOTER_RESERVE + 60) {
              page = addPage();
              y = pageH - 60;
            }

            y = drawSectionBanner(ex.title, page, y);

            var result = drawWrapped(ex.response, y, 11.5, font, BODY_GRAY, page);
            page = result.page;   // pick up whichever page we ended on
            y = result.y;

            y -= 20;

            // Fillable reflection box for the learner, right under their answer
            var reflectionResult = drawReflectionField(
              "Your reflection on this response:", page, y, 110
            );
            page = reflectionResult.page;
            y = reflectionResult.y;

            y -= 14;

            if (y < FOOTER_RESERVE && e < exercises.length - 1) {
              page = addPage();
              y = pageH - 60;
            }
          }

          // Make sure the typed-in text actually renders when viewed,
          // even in readers that don't auto-generate field appearances.
          form.updateFieldAppearances(font);

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
            pg.drawText("New leader program 1/5", {
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
            a.download = "New Leader Session 1 1/5 AIM.pdf";
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