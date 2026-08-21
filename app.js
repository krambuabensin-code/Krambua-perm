// Krambua — Perm for tilsette (open versjon)
// Repoet er offentleg. Innlogginga er ei enkel sperre for kvardagsbruk,
// IKKJE ekte tilgangskontroll — kven som helst med lenka til repoet kan i
// teorien hente filene direkte. Dette er eit bevisst val gjort av eigar.

const KAT = ["HMS", "Reglar", "Rutinar", "Arbeidskontrakt", "Anna"];
const API = "https://api.github.com";
const INDEKS_STI = "dokument-indeks.json";
const KONTOAR_STI = "accounts.json";

let staten = {
  brukarnamn: null,
  namn: null,
  erAdmin: false,
  adminToken: null,
  kontoar: null,
  dokIndeks: [],
  dokIndeksSha: null,
  fane: "dokument",
  filter: "Alle",
  grein: null, // faktisk standard-grein, henta frå GitHub sjølv — ikkje avhengig av config.js
  ventarPaTilgang: null,
};

/* ---------- Grunnleggjande hjelparar ---------- */

// Finn den faktiske standard-greina til repoet (main/master/anna) automatisk,
// slik at ei feil verdi i config.js aldri kan vere årsaka til at innlogging feilar.
async function finnStandardGrein() {
  if (staten.grein) return staten.grein;
  try {
    const res = await fetch(`${API}/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}`);
    if (res.ok) {
      const data = await res.json();
      staten.grein = data.default_branch || KRAMBUA_CONFIG.GREIN || "main";
      return staten.grein;
    }
  } catch (e) {}
  staten.grein = KRAMBUA_CONFIG.GREIN || "main";
  return staten.grein;
}

async function rawUrl(sti) {
  const grein = await finnStandardGrein();
  return `https://raw.githubusercontent.com/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/${grein}/${sti}?t=${Date.now()}`;
}

async function hashText(tekst) {
  const enc = new TextEncoder().encode(tekst);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function b64EncodeUnicodeSafe(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Klarte ikkje å lese fila"));
    r.readAsDataURL(file);
  });
}

function fmtBytes(b) {
  if (!b) return "0 kB";
  const kb = b / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} kB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function visToast(tekst) {
  const rot = document.getElementById("toast-rot");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = tekst;
  rot.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* ---------- GitHub API (berre admin-skriving) ---------- */

async function ghFetch(sti, opts = {}) {
  return fetch(`${API}${sti}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${staten.adminToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
}

/* ---------- Ferske filoppslag (Contents API, ikkje mellomlagra som raw.githubusercontent.com) ---------- */

async function hentFilInnhald(sti) {
  const headers = { Accept: "application/vnd.github+json" };
  if (staten.adminToken) headers.Authorization = `Bearer ${staten.adminToken}`;
  const res = await fetch(
    `${API}/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${sti}`,
    { headers }
  );
  if (!res.ok) {
    const feil = new Error(`HTTP ${res.status}`);
    feil.status = res.status;
    throw feil;
  }
  const data = await res.json();
  const tekst = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
  return { tekst, sha: data.sha };
}

/* ---------- Kontoar (accounts.json) ---------- */

async function lastInnKontoar() {
  try {
    const { tekst } = await hentFilInnhald(KONTOAR_STI);
    return JSON.parse(tekst);
  } catch (e) {
    // Fell tilbake til den (moglegvis nokre minutt gamle) raw-adressa
    // dersom API-oppslaget feilar, t.d. på grunn av rategrense.
    const res = await fetch(await rawUrl(KONTOAR_STI));
    if (!res.ok) {
      throw new Error(`Fann ikkje accounts.json i repoet (HTTP ${res.status}). Sjekk at repoet er offentleg, at OWNER/REPO i config.js er rett, og at accounts.json ligg i rota av repoet.`);
    }
    return res.json();
  }
}

async function lagreKontoar(nyeKontoar, melding) {
  const gjeldande = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${KONTOAR_STI}`);
  const gjeldandeData = gjeldande.ok ? await gjeldande.json() : null;
  const body = {
    message: melding,
    content: b64EncodeUnicodeSafe(JSON.stringify(nyeKontoar, null, 2)),
    branch: await finnStandardGrein(),
  };
  if (gjeldandeData) body.sha = gjeldandeData.sha;
  const res = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${KONTOAR_STI}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Klarte ikkje å lagre kontoane");
  staten.kontoar = nyeKontoar;
}

/* ---------- Dokumentindeks ---------- */

async function lastInnIndeks() {
  try {
    const { tekst } = await hentFilInnhald(INDEKS_STI);
    staten.dokIndeks = JSON.parse(tekst);
  } catch (e) {
    const res = await fetch(await rawUrl(INDEKS_STI));
    staten.dokIndeks = res.ok ? await res.json() : [];
  }
}

async function lagreIndeks(nyIndeks, melding) {
  const gjeldande = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${INDEKS_STI}`);
  const gjeldandeData = gjeldande.ok ? await gjeldande.json() : null;
  const body = {
    message: melding,
    content: b64EncodeUnicodeSafe(JSON.stringify(nyIndeks, null, 2)),
    branch: await finnStandardGrein(),
  };
  if (gjeldandeData) body.sha = gjeldandeData.sha;
  const res = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${INDEKS_STI}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Klarte ikkje å lagre dokumentindeksen");
  staten.dokIndeks = nyIndeks;
}

async function lastNedDokument(doc) {
  const url = await rawUrl(doc.sti);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.filnamn;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function slettDokument(doc) {
  if (!confirm(`Slette «${doc.tittel}»?`)) return;
  const filRes = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${doc.sti}`);
  if (filRes.ok) {
    const filData = await filRes.json();
    await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${doc.sti}`, {
      method: "DELETE",
      body: JSON.stringify({ message: `Slett ${doc.tittel}`, sha: filData.sha, branch: await finnStandardGrein() }),
    });
  }
  const nyIndeks = staten.dokIndeks.filter((d) => d.id !== doc.id);
  await lagreIndeks(nyIndeks, `Slett ${doc.tittel} frå indeksen`);
  visToast("Dokument sletta");
  renderInnhald();
}

async function lastOppDokument({ fil, tittel, kategori, mottakarar, krevSignatur }) {
  const b64 = await fileToBase64(fil);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const trygtFilnamn = fil.name.replace(/[^a-zA-Z0-9æøåÆØÅ_.-]/g, "_");
  const sti = `dokument/${id}-${trygtFilnamn}`;

  const putRes = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}/contents/${sti}`, {
    method: "PUT",
    body: JSON.stringify({ message: `Last opp ${tittel}`, content: b64, branch: await finnStandardGrein() }),
  });
  if (!putRes.ok) throw new Error("Opplasting feila");

  const nyPost = {
    id,
    tittel,
    kategori,
    filnamn: fil.name,
    filtype: fil.type,
    storleik: fil.size,
    sti,
    mottakarar,
    krevSignatur: !!krevSignatur,
    lastOpp: Date.now(),
  };
  await lagreIndeks([...staten.dokIndeks, nyPost], `Legg til ${tittel} i indeksen`);
}

/* ---------- Innlogging ---------- */

async function forsokInnlogging() {
  const bn = document.getElementById("bn-felt").value.trim();
  const pw = document.getElementById("pw-felt").value;
  const feilEl = document.getElementById("login-feil");
  feilEl.textContent = "";
  if (!bn || !pw) return;

  let kontoar;
  try {
    kontoar = await lastInnKontoar();
  } catch (e) {
    feilEl.textContent = e.message || "Fekk ikkje kontakt med repoet.";
    return;
  }
  staten.kontoar = kontoar;
  const pwHash = await hashText(pw);

  if (bn === "admin") {
    if (kontoar.admin.passordHash !== pwHash) {
      feilEl.textContent = "Feil passord for admin.";
      return;
    }
    staten.brukarnamn = "admin";
    staten.namn = "Administrator";
    staten.erAdmin = true;
    steg2Token();
    return;
  }

  const t = kontoar.tilsette.find((x) => x.brukarnamn === bn);
  if (!t || t.passordHash !== pwHash) {
    feilEl.textContent = "Feil brukarnamn eller passord.";
    return;
  }
  staten.brukarnamn = t.brukarnamn;
  staten.namn = t.namn;
  staten.erAdmin = false;
  await lastInnIndeks();
  visApp();
}

function steg2Token() {
  document.getElementById("steg-brukar").classList.add("skjult");
  document.getElementById("steg-token").classList.remove("skjult");
  const lagra = localStorage.getItem("krambua-admin-token");
  if (lagra) document.getElementById("token-felt").value = lagra;
}

async function forsokToken() {
  const token = document.getElementById("token-felt").value.trim();
  const feilEl = document.getElementById("token-feil");
  feilEl.textContent = "";
  if (!token) return;
  staten.adminToken = token;

  const res = await ghFetch(`/repos/${KRAMBUA_CONFIG.OWNER}/${KRAMBUA_CONFIG.REPO}`);
  if (!res.ok) {
    feilEl.textContent =
      res.status === 404
        ? "Fann ikkje repoet med dette tokenet. Sjekk at OWNER/REPO i config.js er rett, og at tokenet har tilgang til nettopp dette repoet."
        : `Fekk ikkje kontakt (HTTP ${res.status}). Sjekk at tokenet er gyldig og ikkje utløpt.`;
    return;
  }
  // Merk: fine-grained token gjev ikkje alltid att eit pålitileg
  // permissions-felt her, så vi stolar på at token+repo-tilgang held —
  // ei eventuell mangel på skriveløyve viser seg i klar tekst om admin
  // faktisk prøver å lagre noko.
  if (document.getElementById("hugs-meg").checked) {
    localStorage.setItem("krambua-admin-token", token);
  } else {
    localStorage.removeItem("krambua-admin-token");
  }
  await lastInnIndeks();
  visApp();
}

function loggUt() {
  staten = { ...staten, brukarnamn: null, namn: null, erAdmin: false, adminToken: null };
  document.getElementById("app").classList.add("skjult");
  document.getElementById("steg-token").classList.add("skjult");
  document.getElementById("steg-brukar").classList.remove("skjult");
  document.getElementById("innlogging").classList.remove("skjult");
  document.getElementById("bn-felt").value = "";
  document.getElementById("pw-felt").value = "";
}

/* ---------- Rendering ---------- */

function visApp() {
  document.getElementById("innlogging").classList.add("skjult");
  document.getElementById("app").classList.remove("skjult");
  document.getElementById("brukar-namn").textContent = staten.namn + (staten.erAdmin ? " · Admin" : "");
  renderInnhald();
}

function renderInnhald() {
  const rot = document.getElementById("innhald");
  rot.innerHTML = "";
  if (staten.erAdmin) renderAdmin(rot);
  else renderTilsett(rot);
}

function renderTilsett(rot) {
  const mine = staten.dokIndeks.filter(
    (d) => d.mottakarar.length === 0 || d.mottakarar.includes(staten.brukarnamn)
  );

  const header = document.createElement("div");
  header.className = "hei-header";
  header.innerHTML = `<h1>Hei, ${escapeHtml(staten.namn)}</h1><p>Her finn du dokument som gjeld deg — HMS, reglar, rutinar og kontraktar.</p>`;
  rot.appendChild(header);

  if (mine.length === 0) {
    rot.appendChild(lagTomKort("Ingen dokument er delt med deg enno."));
    return;
  }

  KAT.forEach((k) => {
    const gruppe = mine.filter((d) => d.kategori === k);
    if (gruppe.length === 0) return;
    const header = document.createElement("div");
    header.className = "kategori-header";
    header.innerHTML = `<span class="prikk"></span><h2>${k}</h2>`;
    rot.appendChild(header);
    gruppe.sort((a, b) => b.lastOpp - a.lastOpp).forEach((d) => rot.appendChild(lagDokRad(d, false)));
  });
}

const KAT_IKON = { HMS: "🦺", Reglar: "📋", Rutinar: "🔁", Arbeidskontrakt: "📄", Anna: "🗂" };

function signertNokkel(dokId) {
  return `krambua-signert-${staten.brukarnamn}-${dokId}`;
}

function harSignert(dokId) {
  return localStorage.getItem(signertNokkel(dokId)) === "1";
}

function apnSigneringModal(d) {
  const bakgrunn = document.createElement("div");
  bakgrunn.className = "modal-bakgrunn";
  bakgrunn.innerHTML = `
    <div class="modal">
      <div class="modal-topp">
        <h2 style="font-size:17px;">Signer dokument</h2>
        <button id="lukk-sign-modal">✕</button>
      </div>
      <p style="font-size:13.5px;color:#5a594e;line-height:1.5;margin:0 0 16px;">
        Du signerer «${escapeHtml(d.tittel)}». Ei stadfesting blir sendt til administrator på e-post — hugs å lasta ned og lesa dokumentet først.
      </p>
      <div class="felt">
        <label>Fullt namn (signatur)</label>
        <input id="sign-namn" class="tekstfelt" value="${escapeHtml(staten.namn)}" />
      </div>
      <label style="display:flex;align-items:flex-start;gap:9px;font-size:13.5px;margin-bottom:16px;line-height:1.4;">
        <input type="checkbox" id="sign-stadfest" style="margin-top:2px;accent-color:#D6222A;" />
        Eg stadfestar at eg har lese og forstått innhaldet i dette dokumentet.
      </label>
      <div id="sign-feil" class="login-feil"></div>
      <button id="sign-knapp" class="knapp-raud" style="width:100%;">Signer og send</button>
    </div>
  `;
  document.body.appendChild(bakgrunn);
  document.getElementById("lukk-sign-modal").onclick = () => bakgrunn.remove();
  document.getElementById("sign-knapp").onclick = () => {
    const namn = document.getElementById("sign-namn").value.trim();
    const stadfest = document.getElementById("sign-stadfest").checked;
    const feilEl = document.getElementById("sign-feil");
    if (!namn) return (feilEl.textContent = "Skriv namnet ditt.");
    if (!stadfest) return (feilEl.textContent = "Du må krysse av for stadfesting.");

    const no = new Date().toLocaleString("nb-NO");
    const emne = encodeURIComponent(`Signatur: ${d.tittel}`);
    const kropp = encodeURIComponent(
      `${namn} (brukarnamn: ${staten.brukarnamn}) stadfestar å ha lese og forstått «${d.tittel}».\n\nTidspunkt: ${no}`
    );
    window.location.href = `mailto:${KRAMBUA_CONFIG.ADMIN_EPOST}?subject=${emne}&body=${kropp}`;

    localStorage.setItem(signertNokkel(d.id), "1");
    bakgrunn.remove();
    visToast("Signatur klargjort — fullfør sendinga i e-postappen din");
    renderInnhald();
  };
}

function signeringsBlokk(d) {
  if (!d.krevSignatur) return "";
  if (harSignert(d.id)) {
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:#1a7a3c;font-weight:700;margin-top:4px;">✓ Signert</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:${RAUD_TEKST};font-weight:700;margin-top:4px;">● Krev signatur</span>`;
}
const RAUD_TEKST = "#D6222A";

/* ---------- Vis dokument i nettlesar ---------- */

function girVisningsUrl(filnamn, rawFileUrl) {
  const ext = (filnamn.split(".").pop() || "").toLowerCase();
  const officePakke = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"];
  if (officePakke.includes(ext)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(rawFileUrl)}`;
  }
  return rawFileUrl; // PDF, bilete m.m. — nettlesaren viser desse sjølv
}

function kanVisast(filnamn) {
  const ext = (filnamn.split(".").pop() || "").toLowerCase();
  return ["doc", "docx", "ppt", "pptx", "xls", "xlsx", "pdf", "png", "jpg", "jpeg", "gif", "txt"].includes(ext);
}

async function visDokumentModal(d) {
  const raw = await rawUrl(d.sti);
  const visningsUrl = girVisningsUrl(d.filnamn, raw);

  const bakgrunn = document.createElement("div");
  bakgrunn.className = "modal-bakgrunn";
  bakgrunn.innerHTML = `
    <div class="modal" style="max-width:900px;width:96%;height:88dvh;display:flex;flex-direction:column;padding:14px;">
      <div class="modal-topp" style="margin-bottom:8px;">
        <h2 style="font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(d.tittel)}</h2>
        <button id="lukk-vis-modal">✕</button>
      </div>
      <div style="flex:1;min-height:0;border:1px solid #e4e0d4;border-radius:8px;overflow:hidden;background:#f5f4ef;position:relative;">
        <div id="vis-lastar" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:#8a8980;">Opnar dokument …</div>
        <iframe id="vis-iframe" src="${visningsUrl}" style="width:100%;height:100%;border:none;position:relative;z-index:1;" onload="document.getElementById('vis-lastar')?.remove()"></iframe>
      </div>
      <button id="vis-nedlast-knapp" class="knapp-liten" style="margin-top:10px;align-self:flex-start;">Last ned i staden</button>
    </div>
  `;
  document.body.appendChild(bakgrunn);
  document.getElementById("lukk-vis-modal").onclick = () => bakgrunn.remove();
  document.getElementById("vis-nedlast-knapp").onclick = () => lastNedDokument(d);
}

/* ---------- Integrert dokumentside (les i appen, ikkje via filvisar) ---------- */

async function visIntegrertSide(d) {
  const rot = document.getElementById("innhald");
  rot.innerHTML = `
    <button class="side-tilbake" id="side-tilbake-knapp">← Tilbake</button>
    <div class="side-topp">
      <h1>${escapeHtml(d.tittel)}</h1>
      <button id="side-nedlast-knapp" class="knapp-liten">Last ned original</button>
    </div>
    <div class="dok-side" id="side-innhald-rot">Lastar innhald …</div>
  `;
  document.getElementById("side-tilbake-knapp").onclick = () => renderInnhald();
  document.getElementById("side-nedlast-knapp").onclick = () => lastNedDokument(d);

  const målEl = document.getElementById("side-innhald-rot");
  try {
    let html;
    try {
      const r = await hentFilInnhald(d.sideSti);
      html = r.tekst;
    } catch (e) {
      const res = await fetch(await rawUrl(d.sideSti));
      if (!res.ok) throw new Error("Fann ikkje sideinnhaldet");
      html = await res.text();
    }
    målEl.innerHTML = html;
  } catch (e) {
    målEl.innerHTML = `<p style="color:#8a8980;">Klarte ikkje å laste sideinnhaldet. Prøv «Last ned original» i staden.</p>`;
  }
}

function lagDokRad(d, adminModus) {
  const rad = document.createElement("div");
  rad.className = "dok-rad";
  rad.style.alignItems = "flex-start";
  const mottakarTekst = d.mottakarar.length === 0 ? "Felles (alle tilsette)" : `Til: ${d.mottakarar.join(", ")}`;
  rad.innerHTML = `
    <div class="ikon-fil">${KAT_IKON[d.kategori] || "📄"}</div>
    <div class="info">
      <div class="tittel">${escapeHtml(d.tittel)}</div>
      <div class="meta">${adminModus ? `${d.kategori} · ` : ""}${fmtBytes(d.storleik)} · ${new Date(d.lastOpp).toLocaleDateString("nb-NO")}${adminModus ? " · " + mottakarTekst : ""}</div>
      ${!adminModus ? signeringsBlokk(d) : d.krevSignatur ? '<span style="display:inline-block;font-size:11px;color:#8a8980;margin-top:4px;">Krev signatur frå tilsette</span>' : ""}
    </div>
  `;
  const knappar = document.createElement("div");
  knappar.className = "knappar";

  if (kanVisast(d.filnamn) || d.sideSti) {
    const visKnapp = document.createElement("button");
    visKnapp.className = "knapp-liten";
    visKnapp.textContent = d.sideSti ? "Les" : "Vis";
    visKnapp.onclick = () => (d.sideSti ? visIntegrertSide(d) : visDokumentModal(d));
    knappar.appendChild(visKnapp);
  }

  const nedKnapp = document.createElement("button");
  nedKnapp.className = "knapp-liten";
  nedKnapp.textContent = "Last ned";
  nedKnapp.onclick = () => lastNedDokument(d);
  knappar.appendChild(nedKnapp);

  if (!adminModus && d.krevSignatur && !harSignert(d.id)) {
    const signKnapp = document.createElement("button");
    signKnapp.className = "knapp-raud";
    signKnapp.style.padding = "9px 13px";
    signKnapp.style.fontSize = "12.5px";
    signKnapp.textContent = "Signer";
    signKnapp.onclick = () => apnSigneringModal(d);
    knappar.appendChild(signKnapp);
  }

  if (adminModus) {
    const slettKnapp = document.createElement("button");
    slettKnapp.className = "knapp-slett";
    slettKnapp.textContent = "✕";
    slettKnapp.onclick = () => slettDokument(d);
    knappar.appendChild(slettKnapp);
  }
  rad.appendChild(knappar);
  return rad;
}

function lagTomKort(tekst) {
  const div = document.createElement("div");
  div.className = "tom";
  div.textContent = tekst;
  return div;
}

function renderAdmin(rot) {
  const faner = document.createElement("div");
  faner.className = "faner";
  ["dokument", "tilsette"].forEach((f) => {
    const b = document.createElement("button");
    b.className = "fane-knapp" + (staten.fane === f ? " aktiv" : "");
    b.textContent = f === "dokument" ? "Dokument" : "Tilsette";
    b.onclick = () => {
      staten.fane = f;
      renderInnhald();
    };
    faner.appendChild(b);
  });
  rot.appendChild(faner);

  if (staten.fane === "tilsette") {
    renderTilsetteAdmin(rot);
    return;
  }

  const filterDiv = document.createElement("div");
  filterDiv.className = "kategori-filter";
  ["Alle", ...KAT].forEach((k) => {
    const b = document.createElement("button");
    b.className = staten.filter === k ? "aktiv" : "";
    b.textContent = k;
    b.onclick = () => {
      staten.filter = k;
      renderInnhald();
    };
    filterDiv.appendChild(b);
  });
  rot.appendChild(filterDiv);

  const lastOppRad = document.createElement("div");
  lastOppRad.className = "last-opp-rad";
  const lastOppKnapp = document.createElement("button");
  lastOppKnapp.className = "knapp-mork";
  lastOppKnapp.style.width = "100%";
  lastOppKnapp.textContent = "⭱ Last opp dokument";
  lastOppKnapp.onclick = () => visLastOppModal();
  lastOppRad.appendChild(lastOppKnapp);
  rot.appendChild(lastOppRad);

  const filtrerte =
    staten.filter === "Alle" ? staten.dokIndeks : staten.dokIndeks.filter((d) => d.kategori === staten.filter);

  if (filtrerte.length === 0) {
    rot.appendChild(lagTomKort("Ingen dokument her enno. Last opp det første."));
    return;
  }
  filtrerte.sort((a, b) => b.lastOpp - a.lastOpp).forEach((d) => rot.appendChild(lagDokRad(d, true)));
}

function renderTilsetteAdmin(rot) {
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:10px;flex-wrap:wrap;";
  header.innerHTML = `<h2 style="font-size:16px;">Tilsette (${staten.kontoar.tilsette.length})</h2>`;
  const nyKnapp = document.createElement("button");
  nyKnapp.className = "knapp-mork";
  nyKnapp.textContent = "+ Ny tilsett";
  nyKnapp.onclick = () => visNyTilsettSkjema();
  header.appendChild(nyKnapp);
  rot.appendChild(header);

  const skjemaRot = document.createElement("div");
  skjemaRot.id = "ny-tilsett-skjema";
  rot.appendChild(skjemaRot);

  if (staten.kontoar.tilsette.length === 0) {
    rot.appendChild(lagTomKort("Ingen tilsette oppretta enno."));
  } else {
    staten.kontoar.tilsette.forEach((t) => {
      const rad = document.createElement("div");
      rad.className = "tilsett-rad";
      rad.innerHTML = `
        <div class="ikon-fil">👤</div>
        <div class="info">
          <div class="namn">${escapeHtml(t.namn)}</div>
          <div class="meta">Brukarnamn: ${escapeHtml(t.brukarnamn)}</div>
        </div>
      `;
      const slettKnapp = document.createElement("button");
      slettKnapp.className = "knapp-slett";
      slettKnapp.textContent = "✕";
      slettKnapp.onclick = async () => {
        if (!confirm(`Fjerne tilgangen til ${t.namn}?`)) return;
        const nye = { ...staten.kontoar, tilsette: staten.kontoar.tilsette.filter((x) => x.brukarnamn !== t.brukarnamn) };
        await lagreKontoar(nye, `Fjern tilsett ${t.namn}`);
        visToast("Tilsett fjerna");
        renderInnhald();
      };
      rad.appendChild(slettKnapp);
      rot.appendChild(rad);
    });
  }

  const pwKort = document.createElement("div");
  pwKort.className = "dok-rad";
  pwKort.style.display = "block";
  pwKort.style.marginTop = "20px";
  pwKort.innerHTML = `
    <h3 style="font-size:13.5px;margin:0 0 10px;">Endre admin-passord</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <input id="admin-pw-felt" type="password" placeholder="Nytt passord" class="tekstfelt" style="flex:1;min-width:160px;" />
      <button id="admin-pw-lagre" class="knapp-mork">Lagre</button>
    </div>
  `;
  rot.appendChild(pwKort);
  document.getElementById("admin-pw-lagre").onclick = async () => {
    const nyttPw = document.getElementById("admin-pw-felt").value;
    if (!nyttPw.trim()) return;
    const hash = await hashText(nyttPw);
    const nye = { ...staten.kontoar, admin: { passordHash: hash } };
    await lagreKontoar(nye, "Endre admin-passord");
    visToast("Admin-passord endra");
    renderInnhald();
  };
}

function visNyTilsettSkjema() {
  const rot = document.getElementById("ny-tilsett-skjema");
  rot.innerHTML = `
    <div class="dok-rad" style="display:block;margin-bottom:16px;">
      <div class="grid-2">
        <input id="nt-namn" placeholder="Fullt namn" class="tekstfelt" />
        <input id="nt-bn" placeholder="Brukarnamn" autocapitalize="off" class="tekstfelt" />
      </div>
      <input id="nt-pw" placeholder="Passord" class="tekstfelt" style="margin-bottom:10px;" />
      <div id="nt-feil" class="login-feil"></div>
      <button id="nt-lagre" class="knapp-raud" style="width:100%;">Opprett tilgang</button>
    </div>
  `;
  document.getElementById("nt-lagre").onclick = async () => {
    const namn = document.getElementById("nt-namn").value.trim();
    const bn = document.getElementById("nt-bn").value.trim();
    const pw = document.getElementById("nt-pw").value;
    const feilEl = document.getElementById("nt-feil");
    feilEl.textContent = "";
    if (!namn || !bn || !pw) return (feilEl.textContent = "Fyll ut alle felt.");
    if (bn.toLowerCase() === "admin") return (feilEl.textContent = "«admin» er reservert.");
    if (staten.kontoar.tilsette.some((t) => t.brukarnamn === bn)) return (feilEl.textContent = "Brukarnamnet er allereie i bruk.");
    const hash = await hashText(pw);
    const nye = { ...staten.kontoar, tilsette: [...staten.kontoar.tilsette, { namn, brukarnamn: bn, passordHash: hash }] };
    await lagreKontoar(nye, `Legg til tilsett ${namn}`);
    visToast("Tilsett oppretta");
    renderInnhald();
  };
}

async function visLastOppModal() {
  const bakgrunn = document.createElement("div");
  bakgrunn.className = "modal-bakgrunn";
  bakgrunn.innerHTML = `
    <div class="modal">
      <div class="modal-topp">
        <h2 style="font-size:17px;">Last opp dokument</h2>
        <button id="lukk-modal">✕</button>
      </div>
      <div class="felt">
        <label>Tittel</label>
        <input id="felt-tittel" placeholder="t.d. HMS-handbok 2026" />
      </div>
      <div class="felt">
        <label>Kategori</label>
        <select id="felt-kategori">${KAT.map((k) => `<option>${k}</option>`).join("")}</select>
      </div>
      <div class="felt">
        <label>Fil</label>
        <div class="filvel" id="filvel-boks">Trykk for å velje fil (PDF, Word, bilete …)</div>
        <input id="felt-fil" type="file" style="display:none;" />
      </div>
      <div class="felt">
        <label>Mottakar</label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;margin-bottom:6px;">
          <input type="checkbox" id="felt-felles" checked /> Felles — synleg for alle tilsette
        </label>
        <div id="tilsette-liste" class="avkryssliste skjult">
          ${
            staten.kontoar.tilsette.length === 0
              ? '<span style="font-size:12.5px;color:#8a8980;">Ingen tilsette oppretta enno.</span>'
              : staten.kontoar.tilsette
                  .map((t) => `<label><input type="checkbox" value="${t.brukarnamn}" /> ${escapeHtml(t.namn)} (${escapeHtml(t.brukarnamn)})</label>`)
                  .join("")
          }
        </div>
      </div>
      <div class="felt">
        <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:400;">
          <input type="checkbox" id="felt-krev-sign" style="accent-color:#D6222A;" />
          Krev signatur frå tilsette
        </label>
      </div>
      <div id="modal-feil" class="login-feil"></div>
      <button id="last-opp-knapp" class="knapp-raud" style="width:100%;">Last opp</button>
    </div>
  `;
  document.body.appendChild(bakgrunn);

  document.getElementById("lukk-modal").onclick = () => bakgrunn.remove();
  document.getElementById("filvel-boks").onclick = () => document.getElementById("felt-fil").click();
  document.getElementById("felt-fil").onchange = (e) => {
    const f = e.target.files[0];
    if (f) document.getElementById("filvel-boks").textContent = `${f.name} (${fmtBytes(f.size)})`;
  };
  document.getElementById("felt-felles").onchange = (e) => {
    document.getElementById("tilsette-liste").classList.toggle("skjult", e.target.checked);
  };

  document.getElementById("last-opp-knapp").onclick = async () => {
    const feilEl = document.getElementById("modal-feil");
    feilEl.textContent = "";
    const fil = document.getElementById("felt-fil").files[0];
    const tittel = document.getElementById("felt-tittel").value.trim();
    const kategori = document.getElementById("felt-kategori").value;
    const felles = document.getElementById("felt-felles").checked;
    const krevSignatur = document.getElementById("felt-krev-sign").checked;
    const valde = Array.from(document.querySelectorAll("#tilsette-liste input:checked")).map((i) => i.value);

    if (!fil) return (feilEl.textContent = "Vel ein fil.");
    if (!tittel) return (feilEl.textContent = "Skriv ein tittel.");
    if (!felles && valde.length === 0) return (feilEl.textContent = "Vel minst éin tilsett, eller merk «Felles».");
    if (fil.size > 20 * 1024 * 1024) return (feilEl.textContent = "Fila er for stor (maks ca. 20 MB).");

    const knapp = document.getElementById("last-opp-knapp");
    knapp.disabled = true;
    knapp.textContent = "Lastar opp …";
    try {
      await lastOppDokument({ fil, tittel, kategori, mottakarar: felles ? [] : valde, krevSignatur });
      bakgrunn.remove();
      visToast("Dokument lasta opp");
      renderInnhald();
    } catch (e) {
      feilEl.textContent = "Opplasting feila. Sjekk at tokenet har skriveløyve.";
      knapp.disabled = false;
      knapp.textContent = "Last opp";
    }
  };
}

/* ---------- Avviksmeldingar ---------- */
/* Feltoppsett følgjer Krambua sitt eige "Skjema for å registrere avvik". */

function avviksNr() {
  const n = new Date();
  return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, "0")}${String(n.getDate()).padStart(2, "0")}-${String(n.getHours()).padStart(2, "0")}${String(n.getMinutes()).padStart(2, "0")}`;
}

function apnAvviksmeldingModal() {
  const idagIso = new Date().toISOString().slice(0, 10);
  const nr = avviksNr();
  const bakgrunn = document.createElement("div");
  bakgrunn.className = "modal-bakgrunn";
  bakgrunn.innerHTML = `
    <div class="modal">
      <div class="modal-topp">
        <h2 style="font-size:17px;">Meld avvik <span style="color:#8a8980;font-weight:400;font-size:13px;">#${nr}</span></h2>
        <button id="lukk-avvik-modal">✕</button>
      </div>
      <div class="felt">
        <label>Dato</label>
        <input id="avvik-dato" type="date" class="tekstfelt" value="${idagIso}" />
      </div>
      <div class="felt">
        <label>Avviket vurderast som</label>
        <div style="display:flex;gap:8px;">
          <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #ddd9cd;border-radius:8px;padding:10px 6px;font-size:13px;cursor:pointer;">
            <input type="radio" name="avvik-alvor" value="Mindre" checked /> Mindre
          </label>
          <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #ddd9cd;border-radius:8px;padding:10px 6px;font-size:13px;cursor:pointer;">
            <input type="radio" name="avvik-alvor" value="Større" /> Større
          </label>
          <label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #f0d3d0;border-radius:8px;padding:10px 6px;font-size:13px;cursor:pointer;color:#D6222A;font-weight:600;">
            <input type="radio" name="avvik-alvor" value="Kritisk" /> Kritisk
          </label>
        </div>
      </div>
      <div class="felt">
        <label>Kven oppdaga feilen</label>
        <input id="avvik-oppdaga" class="tekstfelt" value="${escapeHtml(staten.namn || "")}" />
      </div>
      <div class="felt">
        <label>Kven skal feilen rapporterast til</label>
        <input id="avvik-rapportert-til" class="tekstfelt" value="Dagleg leiar" />
      </div>
      <div class="felt">
        <label>Beskriv feilen / det som gjekk gale</label>
        <textarea id="avvik-skildring" rows="3" class="tekstfelt" style="resize:vertical;font-family:inherit;" placeholder="Kva skjedde, kor, når …"></textarea>
      </div>
      <div class="felt">
        <label>Avviksbehandling — kva gjorde du umiddelbart</label>
        <textarea id="avvik-umiddelbart" rows="3" class="tekstfelt" style="resize:vertical;font-family:inherit;" placeholder="Kva vart gjort med det same avviket vart oppdaga?"></textarea>
      </div>
      <div class="felt">
        <label>Mogleg årsak (om du veit/trur noko)</label>
        <textarea id="avvik-arsak" rows="2" class="tekstfelt" style="resize:vertical;font-family:inherit;" placeholder="Valfritt — kan òg fyllast ut av leiar i etterkant"></textarea>
      </div>
      <div class="felt">
        <label>Forslag til korrigerande tiltak (for å hindre gjentaking)</label>
        <textarea id="avvik-tiltak" rows="2" class="tekstfelt" style="resize:vertical;font-family:inherit;" placeholder="Valfritt — kan òg fyllast ut av leiar i etterkant"></textarea>
      </div>
      <p style="font-size:11.5px;color:#8a8980;margin:0 0 14px;line-height:1.5;">
        Feltet «korrigerande tiltak er gjennomført» på det trykte skjemaet fyller leiar ut i etterkant, når avviket er lukka.
      </p>
      <div id="avvik-feil" class="login-feil"></div>
      <button id="avvik-send-knapp" class="knapp-raud" style="width:100%;">Send avviksmelding</button>
    </div>
  `;
  document.body.appendChild(bakgrunn);
  document.getElementById("lukk-avvik-modal").onclick = () => bakgrunn.remove();
  document.getElementById("avvik-send-knapp").onclick = () => {
    const dato = document.getElementById("avvik-dato").value;
    const alvor = document.querySelector('input[name="avvik-alvor"]:checked').value;
    const oppdaga = document.getElementById("avvik-oppdaga").value.trim();
    const rapportertTil = document.getElementById("avvik-rapportert-til").value.trim();
    const skildring = document.getElementById("avvik-skildring").value.trim();
    const umiddelbart = document.getElementById("avvik-umiddelbart").value.trim();
    const arsak = document.getElementById("avvik-arsak").value.trim();
    const tiltak = document.getElementById("avvik-tiltak").value.trim();
    const feilEl = document.getElementById("avvik-feil");
    feilEl.textContent = "";
    if (!dato) return (feilEl.textContent = "Vel ein dato.");
    if (!oppdaga) return (feilEl.textContent = "Skriv kven som oppdaga feilen.");
    if (!skildring) return (feilEl.textContent = "Skriv kva som skjedde.");

    const emne = encodeURIComponent(`Avviksmelding #${nr} (${alvor}) — ${dato}`);
    const kropp = encodeURIComponent(
      `AVVIKSSKJEMA — Krambua\n\n` +
        `Avvik nr: ${nr}\n` +
        `Dato: ${dato}\n` +
        `Vurdert som: ${alvor}\n\n` +
        `Kven oppdaga feilen: ${oppdaga} (brukarnamn: ${staten.brukarnamn})\n` +
        `Rapportert til: ${rapportertTil}\n\n` +
        `Beskriving av feilen:\n${skildring}\n\n` +
        `Avviksbehandling (umiddelbart):\n${umiddelbart || "(ikkje fylt ut)"}\n\n` +
        `Mogleg årsak:\n${arsak || "(ikkje fylt ut)"}\n\n` +
        `Forslag til korrigerande tiltak:\n${tiltak || "(ikkje fylt ut)"}\n\n` +
        `— Behandla av / dato / signatur / lukka dato fyllast ut av leiar —`
    );
    window.location.href = `mailto:${KRAMBUA_CONFIG.ADMIN_EPOST}?subject=${emne}&body=${kropp}`;
    bakgrunn.remove();
    visToast("Avviksmelding klargjort — fullfør sendinga i e-postappen din");
  };
}

/* ---------- Oppstart ---------- */

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("login-knapp").onclick = forsokInnlogging;
  document.getElementById("token-knapp").onclick = forsokToken;
  document.getElementById("logg-ut-knapp").onclick = loggUt;
  document.getElementById("avvik-knapp").onclick = apnAvviksmeldingModal;
  document.getElementById("laster").classList.add("skjult");
  document.getElementById("innlogging").classList.remove("skjult");
});
