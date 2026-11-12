// 검색엔진용 페이지 미리 만들기 (SSG)
// Vercel이 배포할 때 실행해요: 공개 시트를 읽어 dist/ 에 호·상품 페이지, sitemap, robots, rss를 만들어요.
// 화면 디자인과 기능은 그대로예요. 본문을 HTML에 미리 넣어 검색엔진(특히 네이버)이 읽을 수 있게 할 뿐이에요.
//
//   node scripts/build-seo.mjs              → dist/ 만들기 (Vercel 빌드)
//   node scripts/build-seo.mjs --data DIR   → 시트 대신 DIR/호수.csv 등으로 만들기 (점검용)
//   node scripts/build-seo.mjs --hash       → 공개 내용 지문만 seo/sheet-hash.txt 에 쓰기 (GitHub Actions)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dist");
const args = process.argv.slice(2);
const DATA_DIR = args.includes("--data") ? args[args.indexOf("--data") + 1] : "";
const HASH_ONLY = args.includes("--hash");

const configJs = fs.readFileSync(path.join(ROOT, "config.js"), "utf8");
const cfg = (k) => (configJs.match(new RegExp(k + ':\\s*"([^"]*)"')) || [])[1] || "";
const SITE = (cfg("siteUrl") || "https://cn-travel-magazine.vercel.app/").replace(/\/?$/, "/");
const SHEET_ID = cfg("sheetId");
const NAME = "씨앤 트래블 매거진";
const SEO = readJson(path.join(ROOT, "seo", "seo.config.json"));
const TODAY = new Date().toISOString().slice(0, 10);

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; } }

// ---------- 시트 읽기 ----------
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])))
    .filter((o) => Object.values(o).some(Boolean));
}
async function sheet(name) {
  if (DATA_DIR) return parseCSV(fs.readFileSync(path.join(DATA_DIR, name + ".csv"), "utf8"));
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(name + " " + r.status);
  return parseCSV(await r.text());
}

// ---------- 글자 도우미 ----------
const num = (v) => { const n = parseInt(String(v || "").replace(/[^0-9]/g, ""), 10); return isNaN(n) ? 0 : n; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; };
const price = (v) => (num(v) > 0 ? num(v).toLocaleString("ko-KR") + "원부터" : "가격은 문의해 주세요");
const list = (v) => String(v || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
const isoDate = (v) => { const m = String(v || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; };
// 발행일이 미래면 오늘로 (검색엔진은 미래 날짜를 믿지 않아요)
const pubDate = (v) => { const d = isoDate(v); return d && d <= TODAY ? d : TODAY; };
const korDate = (v) => { const d = isoDate(v); return d ? `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일` : ""; };
const decode = (s) => String(s).replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const strip = (html) => decode(String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
function imgUrl(u, w) {
  u = String(u || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = SITE + "images/" + u.replace(/^\.?\/*(images\/)?/, "");
  if (w && /googleusercontent\.com\/d\//.test(u)) u = u.replace(/=[^/]*$/, "") + "=w" + w;
  if (w && /images\.(pexels|unsplash)\.com/.test(u)) u = /[?&]w=\d+/.test(u) ? u.replace(/([?&])w=\d+/, "$1w=" + w) : u + (u.includes("?") ? "&" : "?") + "w=" + w;
  return u;
}
function linkOf(v) {
  v = String(v || "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "mailto:" + v;
  return "";
}

// 상세설명(블록 문서 또는 그냥 글) → 검색엔진이 읽을 HTML / 글자
function parseDoc(raw) {
  const s = String(raw || "").trim();
  if (s[0] !== "{") return null;
  try { const d = JSON.parse(s); return Array.isArray(d.blocks) ? d : null; } catch { return null; }
}
function detail(raw, alt) {
  const d = parseDoc(raw);
  if (!d) {
    const t = String(raw || "").trim();
    return { html: t ? t.split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join("") : "", text: t, images: [] };
  }
  const html = [], text = [], images = [];
  // 화면과 같은 순서: 사진 먼저, 글은 아래
  const pics = d.blocks.filter((b) => b.t === "img" || b.t === "img2");
  const rest = d.blocks.filter((b) => b.t !== "img" && b.t !== "img2");
  for (const b of pics) {
    for (const u of [].concat(b.src || [])) {
      const src = imgUrl(u, 1200); if (!src || /^upload:/.test(u)) continue;
      images.push(src);
      html.push(`<figure><img src="${esc(src)}" alt="${esc(b.cap || alt)}" loading="lazy" decoding="async">${b.cap ? `<figcaption>${esc(b.cap)}</figcaption>` : ""}</figure>`);
      if (b.cap) text.push(b.cap);
    }
  }
  for (const b of rest) {
    if (b.t === "p" || b.t === "note") { const t = strip(b.html).trim(); if (!t) continue; text.push(t); html.push(`<p>${esc(t).replace(/\n/g, "<br>")}</p>`); }
    else if (b.t === "h") { if (!b.text) continue; text.push(b.text); html.push(`<h3>${esc(b.text)}</h3>`); }
    else if (b.t === "list") { const it = (b.items || []).map(strip).map((x) => x.trim()).filter(Boolean); if (!it.length) continue; text.push(it.join(" · ")); html.push(`<ul>${it.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`); }
    else if (b.t === "btn") { const h = linkOf(b.url); if (b.label && h) html.push(`<p><a href="${esc(h)}">${esc(b.label)}</a></p>`); }
  }
  return { html: html.join(""), text: text.join(" "), images };
}

// ---------- 머리말(메타·OG·canonical·JSON-LD) ----------
const ORG = { "@type": "Organization", name: "주식회사 씨앤", url: "https://home.cncorp.kr/", logo: { "@type": "ImageObject", url: SITE + "images/cn-symbol.png" } };
function head(m) {
  const img = m.image || SITE + "images/og.jpg";
  const v = [];
  if (SEO.googleVerification) v.push(`<meta name="google-site-verification" content="${esc(SEO.googleVerification)}">`);
  if (SEO.naverVerification) v.push(`<meta name="naver-site-verification" content="${esc(SEO.naverVerification)}">`);
  return [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.desc)}">`,
    `<link rel="canonical" href="${esc(m.url)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    ...v,
    `<meta property="og:type" content="${m.type || "website"}">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:title" content="${esc(m.ogTitle || m.title)}">`,
    `<meta property="og:description" content="${esc(m.desc)}">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    ...(m.image ? [] : [`<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`]),
    `<meta property="og:image:alt" content="${esc(m.imageAlt || m.ogTitle || m.title)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    ...(m.published ? [`<meta property="article:published_time" content="${m.published}">`] : []),
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(m.ogTitle || m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${NAME}" href="${SITE}rss.xml">`,
    `<link rel="apple-touch-icon" href="/images/cn-symbol.png">`,
    `<link rel="icon" href="/images/cn-symbol.png">`,
    ...(m.ld || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`)
  ].join("\n") + "\n";
}
function crumbs(items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) };
}

// ---------- 페이지 ----------
let TEMPLATE = "";
function page(m, body) {
  let h = TEMPLATE.replace(/<!--SEO-HEAD-->[\s\S]*?<!--\/SEO-HEAD-->/, `<!--SEO-HEAD-->\n${head(m)}<!--/SEO-HEAD-->`);
  h = h.replace(/<!--SEO-BODY-->[\s\S]*?<!--\/SEO-BODY-->/, `<!--SEO-BODY--><div class="seo wrap">${body}</div><!--/SEO-BODY-->`);
  return h;
}
function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
const issueUrl = (no) => `${SITE}issues/${no}/`;
const productUrl = (id) => `${SITE}products/${encodeURIComponent(id)}/`;

function productCard(p) {
  const href = p.id ? productUrl(p.id) : "";
  const name = esc(p["상품명"]);
  return `<li>${href ? `<h3><a href="${href}">${name}</a></h3>` : `<h3>${name}</h3>`}` +
    (p["한줄설명"] ? `<p>${esc(p["한줄설명"])}</p>` : "") +
    `<p>${esc(p["카테고리"] || "")}${p["카테고리"] ? " · " : ""}${esc(price(p["가격"]))}${p["마감일"] ? " · " + esc(korDate(p["마감일"])) + " 마감" : ""}</p></li>`;
}

async function main() {
  const [issuesAll, productsAll, tipsAll, newsAll] = await Promise.all(["호수", "상품", "팁", "소식"].map(sheet));
  const issues = issuesAll.filter((r) => num(r["호수"]) > 0 && r["공개"] === "Y").sort((a, b) => num(b["호수"]) - num(a["호수"]));
  const pub = new Set(issues.map((r) => num(r["호수"])));
  const byOrder = (a, b) => num(a["순서"] || 999) - num(b["순서"] || 999);
  const products = productsAll.filter((p) => pub.has(num(p["호수"])) && p["상품명"]).sort(byOrder);
  const tips = tipsAll.filter((t) => pub.has(num(t["호수"]))).sort(byOrder);
  const news = newsAll.filter((t) => pub.has(num(t["호수"]))).sort(byOrder);

  if (HASH_ONLY) {
    const h = crypto.createHash("sha256").update(JSON.stringify([issues, products, tips, news])).digest("hex");
    fs.mkdirSync(path.join(ROOT, "seo"), { recursive: true });
    fs.writeFileSync(path.join(ROOT, "seo", "sheet-hash.txt"), h + "\n");
    console.log("hash", h, "issues", issues.length, "products", products.length);
    return;
  }

  const sitemap = [], rss = [];
  const latest = issues[0];

  // 호 페이지
  for (const it of issues) {
    const no = num(it["호수"]);
    const ps = products.filter((p) => num(p["호수"]) === no);
    const ts = tips.filter((t) => num(t["호수"]) === no);
    const ns = news.filter((t) => num(t["호수"]) === no);
    const title = it["커버제목"] || `${no}호`;
    const desc = clip(it["커버소개"] || `${NAME} ${no}호${ps.length ? " · " + ps.map((p) => p["상품명"]).join(", ") : ""}`, 150);
    const cover = imgUrl(list(it["커버사진"])[0], 1200);
    const date = pubDate(it["발행일"]);
    const url = issueUrl(no);
    const body =
      `<nav aria-label="경로"><a href="${SITE}">${NAME}</a> › ${no}호</nav>` +
      `<article><p>${esc(it["주차표기"] || "")} · ${no}호</p><h1>${esc(title)}</h1>` +
      (it["커버소개"] ? `<p>${esc(it["커버소개"])}</p>` : "") +
      (cover ? `<figure><img src="${esc(cover)}" alt="${esc(title)}" width="1200" loading="lazy" decoding="async"></figure>` : "") +
      (ps.length ? `<h2>${esc(it["상품섹션제목"] || "지금 떠나기 좋은 여행이에요")}</h2><ul>${ps.map(productCard).join("")}</ul>` : "") +
      (ts.length ? `<h2>${esc(it["팁섹션제목"] || "떠나기 전에 이것만 챙기세요")}</h2><ol>${ts.map((t) => `<li><h3>${esc(t["제목"])}</h3>${t["내용"] ? `<p>${esc(t["내용"])}</p>` : ""}</li>`).join("")}</ol>` : "") +
      (ns.length ? `<h2>소식</h2><ul>${ns.map((n) => `<li>${esc(n["내용"])}</li>`).join("")}</ul>` : "") +
      `</article>` +
      `<h2>지난 호</h2><ul>${issues.map((x) => `<li><a href="${issueUrl(num(x["호수"]))}">${num(x["호수"])}호 · ${esc(x["커버제목"] || "")}</a></li>`).join("")}</ul>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "Article", headline: clip(title, 110), description: desc,
        image: cover ? [cover] : [SITE + "images/og.jpg"], datePublished: date, dateModified: date,
        author: ORG, publisher: ORG, mainEntityOfPage: url, inLanguage: "ko-KR",
        isPartOf: { "@type": "Periodical", name: NAME, url: SITE } },
      crumbs([[NAME, SITE], [`${no}호`, url]])
    ];
    write(`issues/${no}/index.html`, page({ title: `${title} | ${NAME} ${no}호`, ogTitle: title, desc, url, image: cover, imageAlt: title, type: "article", published: date, ld }, body));
    sitemap.push([url, date]);
    rss.push({ title: `[${no}호] ${title}`, url, desc, date });
  }

  // 상품(기사) 페이지
  for (const p of products) {
    if (!p.id) continue;
    const no = num(p["호수"]);
    const it = issues.find((x) => num(x["호수"]) === no) || {};
    const name = p["상품명"];
    const d = detail(p["상세설명"], name);
    const photos = list(p["사진"]).map((u) => imgUrl(u, 1200)).filter(Boolean);
    const guides = list(p["첨부이미지"]).map((u) => imgUrl(u, 1600)).filter(Boolean);
    const desc = clip([p["한줄설명"], price(p["가격"]), d.text].filter(Boolean).join(" · "), 155);
    const date = pubDate(it["발행일"]);
    const url = productUrl(p.id);
    const link = linkOf(p["링크"]);
    const mail = link.startsWith("mailto:") ? link.slice(7) : "";
    const body =
      `<nav aria-label="경로"><a href="${SITE}">${NAME}</a> › <a href="${issueUrl(no)}">${no}호</a> › ${esc(name)}</nav>` +
      `<article><p>${esc(p["카테고리"] || "")}</p><h1>${esc(name)}</h1>` +
      (p["한줄설명"] ? `<p>${esc(p["한줄설명"])}</p>` : "") +
      `<dl><dt>가격</dt><dd>${esc(price(p["가격"]))}</dd>` +
      (p["마감일"] ? `<dt>신청 마감</dt><dd>${esc(korDate(p["마감일"]))}</dd>` : "") +
      (mail ? `<dt>문의 메일</dt><dd>${esc(mail)}</dd>` : link ? `<dt>예약·문의</dt><dd><a href="${esc(link)}">${esc(link)}</a></dd>` : "") +
      `</dl>` +
      photos.map((u, i) => `<figure><img src="${esc(u)}" alt="${esc(name)}${photos.length > 1 ? " 사진 " + (i + 1) : ""}" loading="lazy" decoding="async"></figure>`).join("") +
      guides.map((u, i) => `<figure><img src="${esc(u)}" alt="${esc(name)} 안내 이미지${guides.length > 1 ? " " + (i + 1) : ""}" loading="lazy" decoding="async"></figure>`).join("") +
      d.html +
      `<p><a href="${issueUrl(no)}">${no}호 전체 보기</a></p></article>`;
    const ld = [
      { "@context": "https://schema.org", "@type": "Article", headline: clip(name, 110), description: desc,
        image: photos.length ? photos : [SITE + "images/og.jpg"], datePublished: date, dateModified: date,
        articleSection: p["카테고리"] || undefined, author: ORG, publisher: ORG, mainEntityOfPage: url, inLanguage: "ko-KR",
        isPartOf: { "@type": "PublicationIssue", issueNumber: String(no), url: issueUrl(no) } },
      crumbs([[NAME, SITE], [`${no}호`, issueUrl(no)], [name, url]])
    ];
    write(`products/${p.id}/index.html`, page({ title: `${name} | ${NAME}`, ogTitle: name, desc, url, image: photos[0], imageAlt: name, type: "article", published: date, ld }, body));
    sitemap.push([url, date]);
    rss.push({ title: name, url, desc, date });
  }

  // 홈 (최신 호)
  {
    const homeDesc = latest ? clip(`${latest["커버제목"] || ""} · ${latest["커버소개"] || ""}`, 150) : "씨앤이 매주 고른 여행지와 여행 상품을 소개해요";
    const ps = latest ? products.filter((p) => num(p["호수"]) === num(latest["호수"])) : [];
    const body =
      `<h1>${NAME} (CTM)</h1><p>씨앤이 매주 고른 여행지와 여행 상품을 소개해요.</p>` +
      (latest ? `<h2><a href="${issueUrl(num(latest["호수"]))}">${num(latest["호수"])}호 · ${esc(latest["커버제목"] || "")}</a></h2>` +
        (latest["커버소개"] ? `<p>${esc(latest["커버소개"])}</p>` : "") +
        (ps.length ? `<ul>${ps.map(productCard).join("")}</ul>` : "") : "") +
      (issues.length ? `<h2>모든 호</h2><ul>${issues.map((x) => `<li><a href="${issueUrl(num(x["호수"]))}">${num(x["호수"])}호 · ${esc(x["커버제목"] || "")}</a></li>`).join("")}</ul>` : "");
    const ld = [
      { "@context": "https://schema.org", "@type": "WebSite", name: NAME, alternateName: "CTM", url: SITE, inLanguage: "ko-KR", publisher: ORG },
      { "@context": "https://schema.org", ...ORG }
    ];
    write("index.html", page({ title: `${NAME} CTM | 씨앤이 고른 여행지와 여행 상품`, ogTitle: `${NAME} CTM`, desc: homeDesc, url: SITE, ld }, body));
    sitemap.unshift([SITE, latest ? pubDate(latest["발행일"]) : TODAY]);
  }

  finish(sitemap, rss);
  console.log(`SEO 페이지: 호 ${issues.length}개, 상품 ${products.filter((p) => p.id).length}개`);
}

function finish(sitemap, rss) {
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemap.map(([u, d]) => `  <url><loc>${esc(u)}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n") + `\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /submit.html\n\nSitemap: ${SITE}sitemap.xml\n`);
  const rfc = (d) => new Date(d + "T09:00:00+09:00").toUTCString();
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>\n` +
    `<title>${NAME}</title><link>${SITE}</link><description>씨앤이 매주 고른 여행지와 여행 상품을 소개해요</description><language>ko</language>\n` +
    `<atom:link href="${SITE}rss.xml" rel="self" type="application/rss+xml"/>\n` +
    rss.map((r) => `<item><title>${esc(r.title)}</title><link>${esc(r.url)}</link><guid>${esc(r.url)}</guid><description>${esc(r.desc)}</description><pubDate>${rfc(r.date)}</pubDate></item>`).join("\n") +
    `\n</channel></rss>\n`);
}

// 사이트 파일을 dist/ 로 복사 (빌드 도구·자동화 파일은 빼고)
function copySite() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const skip = new Set(["dist", "scripts", ".github", ".git", "node_modules", "automation", "seo", "vercel.json", "README.md"]);
  for (const f of fs.readdirSync(ROOT)) {
    if (skip.has(f) || f.startsWith(".")) continue;
    fs.cpSync(path.join(ROOT, f), path.join(OUT, f), { recursive: true });
  }
  TEMPLATE = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
}

if (HASH_ONLY) {
  main().catch((e) => { console.error(e); process.exit(1); });
} else {
  copySite();
  main().catch((e) => {
    // 시트를 못 읽어도 사이트는 그대로 배포돼요 (검색용 페이지만 이번엔 빠져요)
    console.error("시트를 읽지 못해 검색용 페이지는 건너뛰어요:", e.message);
    finish([[SITE, TODAY]], []);
  });
}
