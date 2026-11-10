/* 웹진·업로드·관리자 페이지가 함께 쓰는 도구 */
(function () {
  "use strict";
  var CFG = window.WEBZINE_CONFIG || {};

  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); });
      return o;
    }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
  }

  function loadSheet(name) {
    var url = "https://docs.google.com/spreadsheets/d/" + CFG.sheetId +
      "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(name) + "&_=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(name); return r.text(); })
      .then(function (t) { return toObjects(parseCSV(t)); });
  }

  // Apps Script 호출 (text/plain 으로 보내 사전 요청 없이 동작)
  function api(action, data) {
    if (!CFG.apiUrl) return Promise.reject(new Error("NO_API"));
    var body = Object.assign({ action: action }, data || {});
    return fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          var err = new Error((res && res.error) || "요청을 처리하지 못했어요");
          err.code = res && res.code;
          throw err;
        }
        return res;
      });
  }

  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function safeUrl(u) {
    u = (u || "").trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
    return "";
  }
  function imgSrc(v) {
    v = (v || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    return (CFG.imageFolder || "images/") + v.replace(/^\/+/, "");
  }
  function price(v) {
    var n = num(v);
    return n > 0 ? n.toLocaleString("ko-KR") + "원부터" : "가격은 문의해 주세요";
  }
  function parseDate(v) {
    var m = String(v || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  // 마감 표시: { text, state } state = soon | open | closed
  function deadline(v) {
    var d = parseDate(v);
    if (!d) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var left = Math.round((d - today) / 86400000);
    var md = (d.getMonth() + 1) + "월 " + d.getDate() + "일";
    if (left < 0) return { text: "마감됐어요", state: "closed", date: md };
    if (left === 0) return { text: "오늘 마감", state: "soon", date: md };
    if (left <= 7) return { text: "D-" + left, state: "soon", date: md };
    return { text: md + " 마감", state: "open", date: md };
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function media(box, src, alt) {
    box.textContent = "";
    var ph = el("div", "ph");
    if (!src) { box.appendChild(ph); return; }
    var img = el("img");
    img.src = src; img.alt = alt || ""; img.loading = "lazy";
    img.onerror = function () { box.textContent = ""; box.appendChild(ph); };
    box.appendChild(img);
  }
  function list(v) {
    return String(v || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // 사진을 가로 최대 maxW 로 줄여 JPEG base64 로 변환 (업로드 용량 절약)
  function resizeImage(file, maxW) {
    maxW = maxW || 1600;
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) { reject(new Error("사진 파일만 올릴 수 있어요")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("사진을 읽지 못했어요")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("사진을 열지 못했어요")); };
        img.onload = function () {
          var s = Math.min(1, maxW / img.width);
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var data = c.toDataURL("image/jpeg", 0.85);
          resolve({ name: file.name.replace(/\.[^.]+$/, "") + ".jpg", data: data.split(",")[1], preview: data });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.WZ = {
    CFG: CFG, loadSheet: loadSheet, api: api, num: num, safeUrl: safeUrl, imgSrc: imgSrc,
    price: price, deadline: deadline, el: el, media: media, list: list, resizeImage: resizeImage
  };
})();
