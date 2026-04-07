"use client";
import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Helpers ───
const fmt = (v, decimals = 0) =>
  v == null || isNaN(v)
    ? "–"
    : v.toLocaleString("de-DE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
const fmtEur = (v) => (v == null || isNaN(v) ? "–" : `${fmt(v)} €`);
const fmtPct = (v, d = 2) =>
  v == null || isNaN(v) ? "–" : `${fmt(v * 100, d)} %`;

const GREST_SAETZE = {
  "Baden-Württemberg": 0.05,
  Bayern: 0.035,
  Berlin: 0.06,
  Brandenburg: 0.065,
  Bremen: 0.05,
  Hamburg: 0.055,
  Hessen: 0.06,
  "Mecklenburg-Vorpommern": 0.06,
  Niedersachsen: 0.05,
  "Nordrhein-Westfalen": 0.065,
  "Rheinland-Pfalz": 0.05,
  Saarland: 0.065,
  Sachsen: 0.055,
  "Sachsen-Anhalt": 0.05,
  "Schleswig-Holstein": 0.065,
  Thüringen: 0.065,
};

const defaultInputs = () => ({
  adresse: "",
  stadt: "",
  bundesland: "Hessen",
  nettoflaeche: 80,
  anteil: 1,
  kaufpreis: 300000,
  moebel: 0,
  instandhaltungsruecklage: 0,
  sanierungskosten: 0,
  sonderumlagen: 0,
  nettomieteMonat: 1000,
  nettomieteOptMonat: 1000,
  hausgeldMonat: 200,
  umlegbareBK: 150,
  grunderwerbsteuersatz: 0.06,
  steuersatz: 0.42,
  gebaeudewertanteil: 0.7,
  afaProzent: 0.02,
  maklerkostenPct: 0,
  notarkostenPct: 0.0238,
  beleihungsgebuehren: 0,
  finanzierungsmakler: 0,
  sonstigeNebenkosten: 300,
  kredithoehe: 240000,
  anfangstilgung: 0.02,
  zinssatz: 0.04,
  ezb: 0.025,
  fixzinsbindung: 10,
  verwaltungMonat: 25,
  leerstandsrisiko: 0.03,
  reparaturMonat: 100,
  mietsteigerung: 0.02,
  wertsteigerung: 0.018,
  haltedauer: 20,
});

// ─── Calculation Engine ───
function berechne(inp) {
  const kaufpreisOhneMoebel = inp.kaufpreis - inp.moebel;
  const grestBasis = kaufpreisOhneMoebel - inp.instandhaltungsruecklage;
  const grunderwerbsteuer = grestBasis * inp.grunderwerbsteuersatz;

  const maklerkosten = inp.kaufpreis * inp.maklerkostenPct;
  const notarkosten = inp.kaufpreis * inp.notarkostenPct;

  const kaufnebenkosten =
    grunderwerbsteuer +
    maklerkosten +
    notarkosten +
    inp.beleihungsgebuehren +
    inp.finanzierungsmakler +
    inp.sonstigeNebenkosten;

  const gesamtinvestment =
    inp.kaufpreis + kaufnebenkosten + inp.sanierungskosten + inp.sonderumlagen;
  const eigenkapital = gesamtinvestment - inp.kredithoehe;

  const nettomietePA = inp.nettomieteMonat * 12;
  const nettomieteOptPA = inp.nettomieteOptMonat * 12;
  const hausgeldPA = inp.hausgeldMonat * 12;
  const bkPA = inp.umlegbareBK * 12;
  const verwaltungPA = inp.verwaltungMonat * 12;
  const reparaturPA = inp.reparaturMonat * 12;

  const bruttomietePA = nettomietePA + bkPA;
  const bruttomieteLeerstand = bruttomietePA * (1 - inp.leerstandsrisiko);
  const mietcashflow = bruttomieteLeerstand - hausgeldPA - verwaltungPA - reparaturPA;

  const mietrenditeMakler = nettomietePA / inp.kaufpreis;
  const faktorMakler = inp.kaufpreis / nettomietePA;
  const mietrenditeReal = nettomietePA / gesamtinvestment;
  const faktorReal = gesamtinvestment / nettomietePA;
  const preisProM2 = inp.kaufpreis / inp.nettoflaeche;
  const mieteProM2 = inp.nettomieteMonat / inp.nettoflaeche;

  // Steuerberechnung
  const gebaeudewert = (inp.kaufpreis + kaufnebenkosten) * inp.gebaeudewertanteil;
  const afaGebaeude = gebaeudewert * inp.afaProzent;
  const afaMoebel = inp.moebel > 0 ? inp.moebel / 5 : 0;
  const zinsenJahr1 = inp.kredithoehe * inp.zinssatz;

  const steuerEinnahmen = nettomietePA * (1 - inp.leerstandsrisiko) + bkPA * (1 - inp.leerstandsrisiko);
  const steuerAusgaben = hausgeldPA + afaMoebel + afaGebaeude + zinsenJahr1 + verwaltungPA + reparaturPA;
  const steuerBemessung = steuerEinnahmen - steuerAusgaben;
  const steuerBelastung = steuerBemessung * inp.steuersatz;

  const steuerBemessungOhneMoebel = steuerEinnahmen - (steuerAusgaben - afaMoebel);
  const steuerBelastungOhneMoebel = steuerBemessungOhneMoebel * inp.steuersatz;

  // Kreditrate
  const kreditrate = inp.kredithoehe * (inp.zinssatz + inp.anfangstilgung);

  // Cashflow
  const cashInflows = nettomietePA * (1 - inp.leerstandsrisiko) + bkPA * (1 - inp.leerstandsrisiko);
  const cashOutflows = hausgeldPA + reparaturPA + verwaltungPA + kreditrate + Math.max(0, steuerBelastungOhneMoebel);
  const nettocashflow = cashInflows - cashOutflows;

  // EK-Rendite
  const ekRendite = eigenkapital > 0 ? mietcashflow / eigenkapital : 0;

  // 30-Jahres-Verlauf
  const jahre = [];
  let kreditsaldo = inp.kredithoehe;

  for (let j = 1; j <= 30; j++) {
    const mietCF =
      mietcashflow * Math.pow(1 + inp.mietsteigerung, j - 1);
    const zins = kreditsaldo * inp.zinssatz;
    const tilgung = Math.min(kreditsaldo, kreditrate - zins);
    const rate = kreditsaldo > 0 ? Math.min(kreditrate, kreditsaldo + zins) : 0;

    const cfVorSteuern = mietCF - rate;

    const afaMoebelJ = j <= 5 ? afaMoebel : 0;
    const zinsAbzug = zins;
    const stBemessung =
      nettomietePA * Math.pow(1 + inp.mietsteigerung, j - 1) * (1 - inp.leerstandsrisiko) -
      hausgeldPA * Math.pow(1 + inp.mietsteigerung, j - 1) * 0 -
      afaGebaeude -
      afaMoebelJ -
      zinsAbzug -
      verwaltungPA * Math.pow(1 + inp.mietsteigerung, j - 1) -
      reparaturPA * Math.pow(1 + inp.mietsteigerung, j - 1);
    const steuern = stBemessung * inp.steuersatz;

    const cfNachSteuern = cfVorSteuern - Math.max(0, steuern);

    const wertWohnung = inp.kaufpreis * Math.pow(1 + inp.wertsteigerung, j);
    const wertzuwachs = j === 1 ? 0 : inp.kaufpreis * Math.pow(1 + inp.wertsteigerung, j) - inp.kaufpreis * Math.pow(1 + inp.wertsteigerung, j - 1);

    const abschreibungKNK = j <= 20 ? -(kaufnebenkosten + inp.sonderumlagen) / 20 : 0;

    const vermoegenszuwachs = cfNachSteuern + tilgung + wertzuwachs + abschreibungKNK;
    const pctEK = eigenkapital > 0 ? vermoegenszuwachs / eigenkapital : 0;

    kreditsaldo = Math.max(0, kreditsaldo - tilgung);

    jahre.push({
      jahr: j,
      mietCF,
      rate,
      cfVorSteuern,
      steuern: Math.max(0, steuern),
      cfNachSteuern,
      tilgung,
      kreditsaldo,
      wertWohnung,
      wertzuwachs,
      vermoegenszuwachs,
      pctEK,
    });
  }

  // Zielkaufpreise bei bestimmten Renditen
  // Gesamtinvestment = KP * (1 + %-NK-Faktor) + fixe Kosten
  // Rendite = Nettomiete / Gesamtinvestment → KP = (Nettomiete / Rendite - fixe) / (1 + %-Faktor)
  const nebenkostenFaktorPct = inp.grunderwerbsteuersatz + inp.maklerkostenPct + inp.notarkostenPct;
  const fixeNK = inp.beleihungsgebuehren + inp.finanzierungsmakler + inp.sonstigeNebenkosten;
  const grestAbzug = (inp.moebel + inp.instandhaltungsruecklage) * inp.grunderwerbsteuersatz;
  const fixeKosten = fixeNK + inp.sanierungskosten + inp.sonderumlagen - grestAbzug;

  const zielKPFn = (miete, rendite) => {
    const raw = miete / rendite - fixeKosten;
    return raw / (1 + nebenkostenFaktorPct);
  };

  const zielKP5Aktuell = zielKPFn(nettomietePA, 0.05);
  const zielKP6Aktuell = zielKPFn(nettomietePA, 0.06);
  const zielKP5Opt = zielKPFn(nettomieteOptPA, 0.05);
  const zielKP6Opt = zielKPFn(nettomieteOptPA, 0.06);

  return {
    grunderwerbsteuer,
    kaufnebenkosten,
    maklerkosten,
    notarkosten,
    gesamtinvestment,
    eigenkapital,
    nettomietePA,
    hausgeldPA,
    mietcashflow,
    mietrenditeMakler,
    faktorMakler,
    mietrenditeReal,
    faktorReal,
    preisProM2,
    mieteProM2,
    ekRendite,
    kreditrate,
    afaGebaeude,
    afaMoebel,
    steuerBemessung,
    steuerBelastung,
    steuerBelastungOhneMoebel,
    nettocashflow,
    cashInflows,
    cashOutflows,
    jahre,
    gebaeudewert,
    grestBasis,
    zielKP5Aktuell,
    zielKP6Aktuell,
    zielKP5Opt,
    zielKP6Opt,
    nettomieteOptPA,
  };
}

// ─── Components ───
const KPICard = ({ label, value, sub, accent }) => (
  <div
    style={{
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "16px 18px",
      borderTop: `3px solid ${accent}`,
      minWidth: 0,
    }}
  >
    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4, letterSpacing: ".03em" }}>
      {label}
    </div>
    <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", fontFeatureSettings: '"tnum"' }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
    )}
  </div>
);

const Field = ({ label, value, onChange, suffix, type = "number", step, min, hint, wide }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: wide ? 240 : 140, flex: wide ? "1 1 240px" : "1 1 140px" }}>
    <label style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".02em" }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          {hint?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={type === "number" ? value : value}
          onChange={(e) =>
            onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)
          }
          step={step}
          min={min}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg)",
            color: "var(--text)",
            fontSize: 13,
            fontFeatureSettings: '"tnum"',
            minWidth: 0,
          }}
        />
      )}
      {suffix && (
        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{suffix}</span>
      )}
    </div>
  </div>
);

const Section = ({ title, children, color = "var(--accent)" }) => (
  <div style={{ marginBottom: 20 }}>
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color,
        marginBottom: 10,
        paddingBottom: 5,
        borderBottom: `2px solid ${color}33`,
        letterSpacing: ".04em",
      }}
    >
      {title}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px" }}>{children}</div>
  </div>
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 16px",
      borderRadius: 8,
      border: active ? "1.5px solid var(--accent)" : "1px solid var(--border)",
      background: active ? "var(--accent)11" : "var(--bg)",
      color: active ? "var(--accent)" : "var(--muted)",
      fontWeight: active ? 600 : 400,
      fontSize: 13,
      cursor: "pointer",
      transition: "all .15s",
    }}
  >
    {children}
  </button>
);

// Mini bar chart
const MiniChart = ({ data, labelKey, valueKey, height = 200, color = "var(--accent)" }) => {
  const max = Math.max(...data.map((d) => Math.abs(d[valueKey])));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, padding: "0 4px" }}>
      {data.map((d, i) => {
        const v = d[valueKey];
        const h = max > 0 ? (Math.abs(v) / max) * (height - 30) : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 8, color: "var(--muted)", marginBottom: 2, whiteSpace: "nowrap" }}>
              {i % 5 === 0 ? fmtEur(v) : ""}
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 18,
                height: h,
                background: v >= 0 ? color : "#e24b4a",
                borderRadius: "3px 3px 0 0",
                transition: "height .3s",
              }}
            />
            <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 2 }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main App ───
export default function ImmobilienKalkulator() {
  const [inputs, setInputs] = useState(defaultInputs);
  const [tab, setTab] = useState("dashboard");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [savedList, setSavedList] = useState([]); // [{id, name}]
  const [activeId, setActiveId] = useState(null);
  const [saveName, setSaveName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── localStorage helpers ───
  const storeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const storeSet = (key, val) => { try { localStorage.setItem(key, val); } catch {} };
  const storeDel = (key) => { try { localStorage.removeItem(key); } catch {} };

  // Load saved list + last active on mount
  useEffect(() => {
    const listRaw = storeGet("immo-saved-list");
    if (listRaw) setSavedList(JSON.parse(listRaw));

    const savedActiveId = storeGet("immo-active-id");
    if (savedActiveId) {
      setActiveId(savedActiveId);
      const dataRaw = storeGet(`immo-data:${savedActiveId}`);
      if (dataRaw) setInputs(JSON.parse(dataRaw));
    } else {
      const legacy = storeGet("immo-inputs");
      if (legacy) setInputs(JSON.parse(legacy));
    }
  }, []);

  // Auto-save active property on input change
  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => {
      storeSet(`immo-data:${activeId}`, JSON.stringify(inputs));
    }, 500);
    return () => clearTimeout(t);
  }, [inputs, activeId]);

  // Save current as new property
  const saveAsNew = () => {
    const name = saveName.trim() || inputs.adresse || inputs.stadt || `Objekt ${savedList.length + 1}`;
    const id = `obj-${Date.now()}`;
    const newList = [...savedList, { id, name }];
    setSavedList(newList);
    setActiveId(id);
    setSaveName("");
    storeSet("immo-saved-list", JSON.stringify(newList));
    storeSet(`immo-data:${id}`, JSON.stringify(inputs));
    storeSet("immo-active-id", id);
  };

  // Update name of current property
  const renameCurrent = (newName) => {
    if (!activeId) return;
    const newList = savedList.map((s) => (s.id === activeId ? { ...s, name: newName } : s));
    setSavedList(newList);
    storeSet("immo-saved-list", JSON.stringify(newList));
  };

  // Load a saved property
  const loadProperty = (id) => {
    if (activeId) {
      storeSet(`immo-data:${activeId}`, JSON.stringify(inputs));
    }
    const dataRaw = storeGet(`immo-data:${id}`);
    if (dataRaw) {
      setInputs(JSON.parse(dataRaw));
      setActiveId(id);
      storeSet("immo-active-id", id);
    }
  };

  // Delete a saved property
  const deleteProperty = (id) => {
    const newList = savedList.filter((s) => s.id !== id);
    setSavedList(newList);
    storeSet("immo-saved-list", JSON.stringify(newList));
    storeDel(`immo-data:${id}`);
    if (activeId === id) {
      setActiveId(null);
      setInputs(defaultInputs());
      storeDel("immo-active-id");
    }
  };

  // New empty property
  const newProperty = () => {
    setActiveId(null);
    setInputs(defaultInputs());
    setSaveName("");
  };

  const set = useCallback(
    (key) => (val) => setInputs((prev) => {
      const next = { ...prev, [key]: val };
      // Auto-set GrESt when bundesland changes
      if (key === "bundesland" && GREST_SAETZE[val]) {
        next.grunderwerbsteuersatz = GREST_SAETZE[val];
      }
      return next;
    }),
    []
  );

  const result = useMemo(() => berechne(inputs), [inputs]);

  // Exposé upload handler
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus("PDF wird gelesen...");

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Datei konnte nicht gelesen werden"));
        r.readAsDataURL(file);
      });

      setUploadStatus("Daten werden extrahiert...");

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: "application/pdf", data: base64 },
                },
                {
                  type: "text",
                  text: `Extrahiere aus diesem Immobilien-Exposé alle relevanten Daten. Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks) mit folgenden Feldern (lasse Felder weg, die du nicht findest):
{
  "adresse": "Straße Hausnummer",
  "stadt": "Stadt",
  "bundesland": "Bundesland",
  "nettoflaeche": Zahl in m²,
  "kaufpreis": Zahl in Euro,
  "moebel": Zahl in Euro oder 0,
  "nettomieteMonat": monatliche Nettokaltmiete in Euro,
  "hausgeldMonat": monatliches Hausgeld in Euro,
  "umlegbareBK": umlegbare Betriebskosten pro Monat in Euro,
  "sanierungskosten": geschätzte Sanierungskosten in Euro,
  "maklerkosten": Maklerprovision in Euro (oder als Dezimalzahl wenn in Prozent angegeben, z.B. 0.0357 für 3,57%),
  "maklerkostenPct": Maklerprovision als Dezimalzahl z.B. 0.0357 für 3,57%,
  "zimmer": Anzahl Zimmer,
  "baujahr": Baujahr
}
Nur das JSON-Objekt, nichts anderes.`,
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.map((c) => c.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setInputs((prev) => {
        const next = { ...prev };
        if (parsed.adresse) next.adresse = parsed.adresse;
        if (parsed.stadt) next.stadt = parsed.stadt;
        if (parsed.bundesland && GREST_SAETZE[parsed.bundesland]) {
          next.bundesland = parsed.bundesland;
          next.grunderwerbsteuersatz = GREST_SAETZE[parsed.bundesland];
        }
        if (parsed.nettoflaeche) next.nettoflaeche = parsed.nettoflaeche;
        if (parsed.kaufpreis) {
          next.kaufpreis = parsed.kaufpreis;
          next.kredithoehe = Math.round(parsed.kaufpreis * 0.8);
        }
        if (parsed.moebel) next.moebel = parsed.moebel;
        if (parsed.nettomieteMonat) {
          next.nettomieteMonat = parsed.nettomieteMonat;
          next.nettomieteOptMonat = parsed.nettomieteMonat;
        }
        if (parsed.hausgeldMonat) next.hausgeldMonat = parsed.hausgeldMonat;
        if (parsed.umlegbareBK) next.umlegbareBK = parsed.umlegbareBK;
        if (parsed.sanierungskosten) next.sanierungskosten = parsed.sanierungskosten;
        if (parsed.maklerkostenPct) next.maklerkostenPct = parsed.maklerkostenPct;
        else if (parsed.maklerkosten && next.kaufpreis > 0) next.maklerkostenPct = parsed.maklerkosten / next.kaufpreis;
        return next;
      });

      setUploadStatus(`Daten erfolgreich extrahiert!`);
      setTimeout(() => setUploadStatus(""), 3000);
    } catch (err) {
      setUploadStatus("Fehler bei der Extraktion. Bitte manuell eingeben.");
      setTimeout(() => setUploadStatus(""), 4000);
    } finally {
      setUploading(false);
    }
  };

  const styles = {
    "--bg": "var(--color-background-secondary, #f7f6f3)",
    "--bg2": "var(--color-background-primary, #fff)",
    "--text": "var(--color-text-primary, #1a1a18)",
    "--muted": "var(--color-text-secondary, #6b6a65)",
    "--border": "var(--color-border-tertiary, rgba(0,0,0,0.1))",
    "--accent": "#1d6b56",
    "--accent2": "#b8860b",
    "--danger": "#c0392b",
    fontFamily: '"DM Sans", "Anthropic Sans", system-ui, sans-serif',
    color: "var(--text)",
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 8px",
  };

  const halteJahre = result.jahre.slice(0, inputs.haltedauer);
  const activeName = savedList.find((s) => s.id === activeId)?.name;

  return (
    <div style={styles}>
      <div style={{ display: "flex", gap: 12 }}>
        {/* ─── Main content ─── */}
        <div style={{ flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em", color: "var(--text)" }}>
            Immobilien-Kalkulator
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {activeName ? `Aktiv: ${activeName}` : "Bestandshaltung Deutschland"}
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: sidebarOpen ? "var(--accent)" : "var(--bg2)",
            color: sidebarOpen ? "#fff" : "var(--text)",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {sidebarOpen ? "Liste ✕" : `Objekte (${savedList.length})`}
        </button>
      </div>

      {/* Save bar */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap",
      }}>
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder={inputs.adresse || inputs.stadt || "Name für dieses Objekt…"}
          style={{
            flex: 1,
            minWidth: 160,
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg2)",
            color: "var(--text)",
            fontSize: 12,
          }}
        />
        <button
          onClick={saveAsNew}
          style={{
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {activeId ? "Kopie speichern" : "Speichern"}
        </button>
        {activeId && (
          <button
            onClick={newProperty}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg2)",
              color: "var(--text)",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Neues Objekt
          </button>
        )}
      </div>

      {/* Upload */}
      <div
        style={{
          background: "var(--bg2)",
          border: "2px dashed var(--border)",
          borderRadius: 12,
          padding: "16px 20px",
          textAlign: "center",
          marginBottom: 16,
          position: "relative",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
          Exposé hochladen (PDF)
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
          Die AI extrahiert automatisch Kaufpreis, Fläche, Miete und mehr
        </div>
        <input
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          style={{ fontSize: 12 }}
        />
        {uploadStatus && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: uploadStatus.includes("Fehler") ? "var(--danger)" : "var(--accent)",
              fontWeight: 500,
            }}
          >
            {uploading ? "⏳ " : ""}
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</TabBtn>
        <TabBtn active={tab === "eingabe"} onClick={() => setTab("eingabe")}>Eingabefelder</TabBtn>
        <TabBtn active={tab === "detail"} onClick={() => setTab("detail")}>Detailberechnung</TabBtn>
        <TabBtn active={tab === "finanzierung"} onClick={() => setTab("finanzierung")}>Finanzierung</TabBtn>
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {tab === "dashboard" && (
        <div>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
            <KPICard label="Nettomietrendite" value={fmtPct(result.mietrenditeReal)} sub={`Faktor: ${fmt(result.faktorReal, 1)}`} accent="var(--accent)" />
            <KPICard label="EK-Rendite" value={fmtPct(result.ekRendite)} sub={`EK: ${fmtEur(result.eigenkapital)}`} accent="var(--accent2)" />
            <KPICard label="Cashflow / Jahr" value={fmtEur(result.nettocashflow)} sub={`${fmtEur(result.nettocashflow / 12)} / Monat`} accent={result.nettocashflow >= 0 ? "var(--accent)" : "var(--danger)"} />
            <KPICard label="Kaufpreis / m²" value={fmtEur(result.preisProM2)} sub={`Miete: ${fmt(result.mieteProM2, 2)} €/m²`} accent="#5b6abf" />
          </div>

          {/* Kaufpreis-Analyse */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#8e44ad" }}>Kaufpreis-Analyse</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
              Maximaler Kaufpreis für eine Zielrendite — inkl. aller Nebenkosten
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {/* Aktuelle Miete */}
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, fontWeight: 500 }}>
                  Aktuelle Miete ({fmtEur(result.nettomietePA)} p.a.)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: "var(--bg)", borderRadius: 10, padding: "12px 14px",
                    borderLeft: `3px solid ${inputs.kaufpreis <= result.zielKP5Aktuell ? "var(--accent)" : "var(--danger)"}`,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Kaufpreis bei 5% Rendite</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFeatureSettings: '"tnum"', color: "var(--text)" }}>
                      {fmtEur(result.zielKP5Aktuell)}
                    </div>
                    <div style={{ fontSize: 11, color: inputs.kaufpreis <= result.zielKP5Aktuell ? "var(--accent)" : "var(--danger)", marginTop: 2, fontWeight: 500 }}>
                      {inputs.kaufpreis <= result.zielKP5Aktuell
                        ? `✓ ${fmtEur(result.zielKP5Aktuell - inputs.kaufpreis)} Spielraum`
                        : `✗ ${fmtEur(inputs.kaufpreis - result.zielKP5Aktuell)} zu teuer`}
                    </div>
                  </div>
                  <div style={{
                    background: "var(--bg)", borderRadius: 10, padding: "12px 14px",
                    borderLeft: `3px solid ${inputs.kaufpreis <= result.zielKP6Aktuell ? "var(--accent)" : "var(--danger)"}`,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Kaufpreis bei 6% Rendite</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFeatureSettings: '"tnum"', color: "var(--text)" }}>
                      {fmtEur(result.zielKP6Aktuell)}
                    </div>
                    <div style={{ fontSize: 11, color: inputs.kaufpreis <= result.zielKP6Aktuell ? "var(--accent)" : "var(--danger)", marginTop: 2, fontWeight: 500 }}>
                      {inputs.kaufpreis <= result.zielKP6Aktuell
                        ? `✓ ${fmtEur(result.zielKP6Aktuell - inputs.kaufpreis)} Spielraum`
                        : `✗ ${fmtEur(inputs.kaufpreis - result.zielKP6Aktuell)} zu teuer`}
                    </div>
                  </div>
                </div>
              </div>
              {/* Optimierte Miete */}
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, fontWeight: 500 }}>
                  Optimierte Miete ({fmtEur(result.nettomieteOptPA)} p.a.)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: "var(--bg)", borderRadius: 10, padding: "12px 14px",
                    borderLeft: `3px solid ${inputs.kaufpreis <= result.zielKP5Opt ? "var(--accent)" : "var(--danger)"}`,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Kaufpreis bei 5% Rendite</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFeatureSettings: '"tnum"', color: "var(--text)" }}>
                      {fmtEur(result.zielKP5Opt)}
                    </div>
                    <div style={{ fontSize: 11, color: inputs.kaufpreis <= result.zielKP5Opt ? "var(--accent)" : "var(--danger)", marginTop: 2, fontWeight: 500 }}>
                      {inputs.kaufpreis <= result.zielKP5Opt
                        ? `✓ ${fmtEur(result.zielKP5Opt - inputs.kaufpreis)} Spielraum`
                        : `✗ ${fmtEur(inputs.kaufpreis - result.zielKP5Opt)} zu teuer`}
                    </div>
                  </div>
                  <div style={{
                    background: "var(--bg)", borderRadius: 10, padding: "12px 14px",
                    borderLeft: `3px solid ${inputs.kaufpreis <= result.zielKP6Opt ? "var(--accent)" : "var(--danger)"}`,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Kaufpreis bei 6% Rendite</div>
                    <div style={{ fontSize: 18, fontWeight: 600, fontFeatureSettings: '"tnum"', color: "var(--text)" }}>
                      {fmtEur(result.zielKP6Opt)}
                    </div>
                    <div style={{ fontSize: 11, color: inputs.kaufpreis <= result.zielKP6Opt ? "var(--accent)" : "var(--danger)", marginTop: 2, fontWeight: 500 }}>
                      {inputs.kaufpreis <= result.zielKP6Opt
                        ? `✓ ${fmtEur(result.zielKP6Opt - inputs.kaufpreis)} Spielraum`
                        : `✗ ${fmtEur(inputs.kaufpreis - result.zielKP6Opt)} zu teuer`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 10, fontStyle: "italic" }}>
              Aktueller Kaufpreis: {fmtEur(inputs.kaufpreis)} — aktuelle Rendite: {fmtPct(result.mietrenditeReal)}
            </div>
          </div>

          {/* Zusammenfassung */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--accent)" }}>Zusammenfassung</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", fontSize: 13 }}>
              {[
                ["Kaufpreis", fmtEur(inputs.kaufpreis)],
                ["Kaufnebenkosten", fmtEur(result.kaufnebenkosten)],
                ["Gesamtinvestment", fmtEur(result.gesamtinvestment)],
                ["Eigenkapital", fmtEur(result.eigenkapital)],
                ["Kredit", fmtEur(inputs.kredithoehe)],
                ["Kreditrate / Jahr", fmtEur(result.kreditrate)],
                ["Grunderwerbsteuer", fmtEur(result.grunderwerbsteuer)],
                ["AfA Gebäude / Jahr", fmtEur(result.afaGebaeude)],
                ["Steuerl. Belastung", fmtEur(result.steuerBelastungOhneMoebel)],
                ["Mietrendite (Makler)", fmtPct(result.mietrenditeMakler)],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted)" }}>{l}</span>
                  <span style={{ fontWeight: 500, fontFeatureSettings: '"tnum"' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cashflow Chart */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--accent)" }}>
              Cashflow nach Steuern ({inputs.haltedauer} Jahre)
            </div>
            <MiniChart data={halteJahre} labelKey="jahr" valueKey="cfNachSteuern" color="var(--accent)" />
          </div>

          {/* Vermögenszuwachs Chart */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--accent2)" }}>
              Vermögenszuwachs pro Jahr ({inputs.haltedauer} Jahre)
            </div>
            <MiniChart data={halteJahre} labelKey="jahr" valueKey="vermoegenszuwachs" color="var(--accent2)" />
          </div>

          {/* Wert + Kredit */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#5b6abf" }}>
              Wohnungswert vs. Restschuld
            </div>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 180, padding: "0 4px" }}>
              {halteJahre.map((d, i) => {
                const maxV = Math.max(...halteJahre.map((x) => x.wertWohnung));
                const hW = (d.wertWohnung / maxV) * 150;
                const hK = (d.kreditsaldo / maxV) * 150;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
                    <div style={{ width: "80%", maxWidth: 16, height: hW, background: "#5b6abf44", borderRadius: "2px 2px 0 0", position: "relative" }}>
                      <div style={{ position: "absolute", bottom: 0, width: "100%", height: hK, background: "#e24b4a66", borderRadius: "2px 2px 0 0" }} />
                    </div>
                    <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 2 }}>{d.jahr}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#5b6abf44", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Wohnungswert</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#e24b4a66", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Restschuld</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EINGABE ═══ */}
      {tab === "eingabe" && (
        <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16 }}>
          <Section title="Objektdaten" color="var(--accent)">
            <Field label="Adresse" value={inputs.adresse} onChange={set("adresse")} type="text" wide />
            <Field label="Stadt" value={inputs.stadt} onChange={set("stadt")} type="text" />
            <Field label="Bundesland" value={inputs.bundesland} onChange={set("bundesland")} type="select" hint={Object.keys(GREST_SAETZE)} wide />
            <Field label="Nettonutzfläche" value={inputs.nettoflaeche} onChange={set("nettoflaeche")} suffix="m²" />
            <Field label="Anteil an Liegenschaft" value={inputs.anteil} onChange={set("anteil")} step={0.01} min={0} />
          </Section>

          <Section title="Kaufpreis & Kosten" color="var(--accent2)">
            <Field label="Kaufpreis" value={inputs.kaufpreis} onChange={set("kaufpreis")} suffix="€" />
            <Field label="Davon Möbel" value={inputs.moebel} onChange={set("moebel")} suffix="€" />
            <Field label="Instandhaltungsrücklage" value={inputs.instandhaltungsruecklage} onChange={set("instandhaltungsruecklage")} suffix="€" />
            <Field label="Sanierungskosten" value={inputs.sanierungskosten} onChange={set("sanierungskosten")} suffix="€" />
            <Field label="Sonderumlagen" value={inputs.sonderumlagen} onChange={set("sonderumlagen")} suffix="€" />
          </Section>

          <Section title="Mieteinnahmen" color="#2e86de">
            <Field label="Nettomiete / Monat" value={inputs.nettomieteMonat} onChange={set("nettomieteMonat")} suffix="€" />
            <Field label="Opt. Nettomiete / Monat" value={inputs.nettomieteOptMonat} onChange={set("nettomieteOptMonat")} suffix="€" />
            <Field label="Hausgeld / Monat" value={inputs.hausgeldMonat} onChange={set("hausgeldMonat")} suffix="€" />
            <Field label="Umlegbare BK / Monat" value={inputs.umlegbareBK} onChange={set("umlegbareBK")} suffix="€" />
          </Section>

          <Section title="Steuern & Abschreibung" color="#8e44ad">
            <Field label="GrESt-Satz" value={inputs.grunderwerbsteuersatz} onChange={set("grunderwerbsteuersatz")} step={0.005} suffix="%" />
            <Field label="Persönl. Steuersatz" value={inputs.steuersatz} onChange={set("steuersatz")} step={0.01} suffix="%" />
            <Field label="Gebäudewertanteil" value={inputs.gebaeudewertanteil} onChange={set("gebaeudewertanteil")} step={0.05} />
            <Field label="AfA-Satz" value={inputs.afaProzent} onChange={set("afaProzent")} step={0.005} suffix="%" />
          </Section>

          <Section title="Kaufnebenkosten" color="#e67e22">
            <Field label="Maklerkosten inkl. USt" value={inputs.maklerkostenPct} onChange={set("maklerkostenPct")} step={0.005} suffix={`% = ${fmtEur(result.maklerkosten)}`} />
            <Field label="Notarkosten inkl. USt" value={inputs.notarkostenPct} onChange={set("notarkostenPct")} step={0.001} suffix={`% = ${fmtEur(result.notarkosten)}`} />
            <Field label="Beleihungsgebühren" value={inputs.beleihungsgebuehren} onChange={set("beleihungsgebuehren")} suffix="€" />
            <Field label="Finanzierungsmakler" value={inputs.finanzierungsmakler} onChange={set("finanzierungsmakler")} suffix="€" />
            <Field label="Sonstige Nebenkosten" value={inputs.sonstigeNebenkosten} onChange={set("sonstigeNebenkosten")} suffix="€" />
          </Section>

          <Section title="Finanzierung" color="#c0392b">
            <Field label="Kredithöhe" value={inputs.kredithoehe} onChange={set("kredithoehe")} suffix="€" />
            <Field label="Anfangstilgung p.a." value={inputs.anfangstilgung} onChange={set("anfangstilgung")} step={0.005} suffix="%" />
            <Field label="Zinssatz p.a." value={inputs.zinssatz} onChange={set("zinssatz")} step={0.0025} suffix="%" />
            <Field label="EZB Referenzzins" value={inputs.ezb} onChange={set("ezb")} step={0.0025} suffix="%" />
            <Field label="Fixzinsbindung" value={inputs.fixzinsbindung} onChange={set("fixzinsbindung")} suffix="Jahre" />
          </Section>

          <Section title="Verwaltung & Risiko" color="#16a085">
            <Field label="Verwaltung / Monat" value={inputs.verwaltungMonat} onChange={set("verwaltungMonat")} suffix="€" />
            <Field label="Leerstandsrisiko" value={inputs.leerstandsrisiko} onChange={set("leerstandsrisiko")} step={0.01} />
            <Field label="Reparatur / Monat" value={inputs.reparaturMonat} onChange={set("reparaturMonat")} suffix="€" />
          </Section>

          <Section title="Zukunftsaussicht" color="#2c3e50">
            <Field label="Mietsteigerung p.a." value={inputs.mietsteigerung} onChange={set("mietsteigerung")} step={0.005} />
            <Field label="Wertsteigerung p.a." value={inputs.wertsteigerung} onChange={set("wertsteigerung")} step={0.005} />
            <Field label="Haltedauer" value={inputs.haltedauer} onChange={set("haltedauer")} suffix="Jahre" min={1} />
          </Section>

          <button
            onClick={() => setInputs(defaultInputs())}
            style={{
              marginTop: 10,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--danger)",
              background: "transparent",
              color: "var(--danger)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Alle Felder zurücksetzen
          </button>
        </div>
      )}

      {/* ═══ DETAIL ═══ */}
      {tab === "detail" && (
        <div>
          {/* Steuerberechnung */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#8e44ad" }}>Steuerliche Berechnung (Jahr 1)</div>
            <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px" }}>
              {[
                ["Nettomiete p.a. (nach Leerstand)", fmtEur(result.nettomietePA * (1 - inputs.leerstandsrisiko))],
                ["– Hausgeld p.a.", fmtEur(result.hausgeldPA)],
                ["– AfA Gebäude", fmtEur(result.afaGebaeude)],
                ["– AfA Möbel (5 J.)", fmtEur(result.afaMoebel)],
                ["– Zinsen Bank", fmtEur(inputs.kredithoehe * inputs.zinssatz)],
                ["– Verwaltung", fmtEur(inputs.verwaltungMonat * 12)],
                ["– Reparatur", fmtEur(inputs.reparaturMonat * 12)],
                null,
                ["Bemessungsgrundlage", fmtEur(result.steuerBemessung)],
                ["Steuersatz", fmtPct(inputs.steuersatz, 0)],
                ["Steuerbelastung (mit Möbel-AfA)", fmtEur(result.steuerBelastung)],
                ["Steuerbelastung (ohne Möbel-AfA)", fmtEur(result.steuerBelastungOhneMoebel)],
              ].map((row, i) =>
                row ? (
                  <div key={i} style={{ display: "contents" }}>
                    <span style={{ color: "var(--muted)", padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[0]}</span>
                    <span style={{ textAlign: "right", fontWeight: 500, fontFeatureSettings: '"tnum"', padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[1]}</span>
                  </div>
                ) : (
                  <div key={i} style={{ display: "contents" }}><div style={{ height: 8 }} /><div /></div>
                )
              )}
            </div>
          </div>

          {/* Cashflow */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--accent)" }}>Cashflow-Berechnung (Jahr 1)</div>
            <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px" }}>
              {[
                ["Summe Einnahmen", fmtEur(result.cashInflows)],
                ["– Hausgeld", fmtEur(result.hausgeldPA)],
                ["– Reparatur", fmtEur(inputs.reparaturMonat * 12)],
                ["– Verwaltung", fmtEur(inputs.verwaltungMonat * 12)],
                ["– Kreditrate", fmtEur(result.kreditrate)],
                ["– Steuern", fmtEur(Math.max(0, result.steuerBelastungOhneMoebel))],
                null,
                ["Nettocashflow", fmtEur(result.nettocashflow)],
              ].map((row, i) =>
                row ? (
                  <div key={i} style={{ display: "contents" }}>
                    <span style={{ color: "var(--muted)", padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[0]}</span>
                    <span style={{ textAlign: "right", fontWeight: row[0] === "Nettocashflow" ? 700 : 500, color: row[0] === "Nettocashflow" ? (result.nettocashflow >= 0 ? "var(--accent)" : "var(--danger)") : "var(--text)", fontFeatureSettings: '"tnum"', padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[1]}</span>
                  </div>
                ) : (
                  <div key={i} style={{ display: "contents" }}><div style={{ height: 8 }} /><div /></div>
                )
              )}
            </div>
          </div>

          {/* GrESt */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#e67e22" }}>Grunderwerbsteuerberechnung</div>
            <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 16px" }}>
              {[
                ["Kaufpreis", fmtEur(inputs.kaufpreis)],
                ["– Möbel", fmtEur(inputs.moebel)],
                ["– Instandhaltungsrücklage", fmtEur(inputs.instandhaltungsruecklage)],
                ["= Bemessungsgrundlage", fmtEur(result.grestBasis)],
                ["× GrESt-Satz", fmtPct(inputs.grunderwerbsteuersatz, 1)],
                null,
                ["Grunderwerbsteuer", fmtEur(result.grunderwerbsteuer)],
              ].map((row, i) =>
                row ? (
                  <div key={i} style={{ display: "contents" }}>
                    <span style={{ color: "var(--muted)", padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[0]}</span>
                    <span style={{ textAlign: "right", fontWeight: row[0] === "Grunderwerbsteuer" ? 700 : 500, fontFeatureSettings: '"tnum"', padding: "2px 0", borderBottom: "1px solid var(--border)" }}>{row[1]}</span>
                  </div>
                ) : (
                  <div key={i} style={{ display: "contents" }}><div style={{ height: 8 }} /><div /></div>
                )
              )}
            </div>
          </div>

          {/* Rendite Detail Tabelle */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--accent2)" }}>
              Renditeberechnung Detail ({inputs.haltedauer} Jahre)
            </div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Jahr", "Miet-CF", "Rate", "CF v. St.", "Steuern", "CF n. St.", "Tilgung", "Restschuld", "Wert", "Verm.+", "% EK"].map((h) => (
                    <th key={h} style={{ padding: "4px 6px", textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {halteJahre.map((d) => (
                  <tr key={d.jahr} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontWeight: 500 }}>{d.jahr}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.mietCF, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.rate, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.cfVorSteuern, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.steuern, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"', color: d.cfNachSteuern >= 0 ? "var(--accent)" : "var(--danger)" }}>{fmt(d.cfNachSteuern, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.tilgung, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.kreditsaldo, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.wertWohnung, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"', color: "var(--accent2)" }}>{fmt(d.vermoegenszuwachs, 0)}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmtPct(d.pctEK, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ FINANZIERUNG ═══ */}
      {tab === "finanzierung" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
            <KPICard label="Kreditbetrag" value={fmtEur(inputs.kredithoehe)} sub={`LTV: ${fmtPct(inputs.kaufpreis > 0 ? inputs.kredithoehe / inputs.kaufpreis : 0, 1)}`} accent="#c0392b" />
            <KPICard label="Kreditrate / Jahr" value={fmtEur(result.kreditrate)} sub={`${fmtEur(result.kreditrate / 12)} / Monat`} accent="#e67e22" />
            <KPICard label="Restschuld nach 10 J." value={fmtEur(result.jahre[9]?.kreditsaldo || 0)} accent="#8e44ad" />
            <KPICard
              label="Kredit abbezahlt nach"
              value={`${(result.jahre.findIndex((j) => j.kreditsaldo === 0) + 1) || "30+"} Jahren`}
              accent="var(--accent)"
            />
          </div>

          {/* Restschuld-Tabelle */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#c0392b" }}>Restschuld-Übersicht</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, fontSize: 12 }}>
              {[5, 10, 15, 20].map((y) => {
                const d = result.jahre[y - 1];
                return d ? (
                  <div key={y} style={{ textAlign: "center", padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>Nach {y} J.</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4, fontFeatureSettings: '"tnum"' }}>{fmtEur(d.kreditsaldo)}</div>
                    <div style={{ color: "var(--muted)", fontSize: 10 }}>
                      {fmtPct(inputs.kredithoehe > 0 ? d.kreditsaldo / inputs.kredithoehe : 0, 1)} des Kredits
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {/* Finanzierungstabelle */}
          <div style={{ background: "var(--bg2)", borderRadius: 12, border: "1px solid var(--border)", padding: 16, overflowX: "auto" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#c0392b" }}>Finanzierungsverlauf</div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["Jahr", "Saldo Beginn", "Zinsen", "Tilgung", "Rate", "Saldo Ende"].map((h) => (
                    <th key={h} style={{ padding: "4px 6px", textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.jahre
                  .filter((d) => d.jahr <= 30 && (d.kreditsaldo > 0 || d.jahr === 1 || result.jahre[d.jahr - 2]?.kreditsaldo > 0))
                  .map((d) => {
                    const saldoBeginn = d.jahr === 1 ? inputs.kredithoehe : result.jahre[d.jahr - 2].kreditsaldo;
                    const zinsen = saldoBeginn * inputs.zinssatz;
                    return (
                      <tr key={d.jahr} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontWeight: 500 }}>{d.jahr}</td>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(saldoBeginn, 0)}</td>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(zinsen, 0)}</td>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.tilgung, 0)}</td>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"' }}>{fmt(d.rate, 0)}</td>
                        <td style={{ padding: "3px 6px", textAlign: "right", fontFeatureSettings: '"tnum"', fontWeight: 500 }}>{fmt(d.kreditsaldo, 0)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", marginTop: 20, paddingBottom: 16 }}>
        Alle Berechnungen sind Näherungswerte. Keine Anlageberatung.
      </div>
        </div>{/* end main content */}

        {/* ─── Sidebar ─── */}
        {sidebarOpen && (
          <div style={{
            width: 220,
            flexShrink: 0,
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            alignSelf: "flex-start",
            position: "sticky",
            top: 8,
            maxHeight: "calc(100vh - 16px)",
            overflowY: "auto",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
              Gespeicherte Objekte
            </div>
            {savedList.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", padding: "8px 0" }}>
                Noch keine Objekte gespeichert.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {savedList.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: item.id === activeId ? "var(--accent)" : "var(--bg)",
                    border: item.id === activeId ? "none" : "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                  onClick={() => loadProperty(item.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: item.id === activeId ? 600 : 400,
                      color: item.id === activeId ? "#fff" : "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {item.name}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`"${item.name}" löschen?`)) deleteProperty(item.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: item.id === activeId ? "rgba(255,255,255,0.7)" : "var(--muted)",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                      padding: "0 2px",
                      flexShrink: 0,
                    }}
                    title="Löschen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>{/* end flex wrapper */}
    </div>
  );
}
