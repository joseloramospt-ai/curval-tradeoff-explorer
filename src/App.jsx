import { useState, useMemo } from 'react';
import {
  ComposedChart, Line, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ReferenceArea, ResponsiveContainer
} from 'recharts';

export default function CurvalTradeoffExplorer() {
  const curvalHist = [
    { year: 2020, DE: 0.4074, WACC: 0.0819, Ke: 0.1071, Kd: 0.0246, EBIT: 220208.62, Equity: 1750315.09, Debt: 713067.24, Cash: 673421.13, tEff: 0.1922, Interest: 17561 },
    { year: 2021, DE: 0.4471, WACC: 0.0671, Ke: 0.0943, Kd: 0.0244, EBIT: 42242.60,  Equity: 1750175.43, Debt: 782448.65, Cash: 454926.93, tEff: 0.7470, Interest: 18270 },
    { year: 2022, DE: 0.3267, WACC: 0.0719, Ke: 0.0933, Kd: 0.0224, EBIT: 36666.12,  Equity: 1756324.10, Debt: 573857.83, Cash: 266274.82, tEff: 0.7051, Interest: 15177 },
    { year: 2023, DE: 0.2612, WACC: 0.0847, Ke: 0.0981, Kd: 0.0486, EBIT: 105060.08, Equity: 1810573.23, Debt: 473003.97, Cash: 514802.95, tEff: 0.3185, Interest: 25456 },
    { year: 2024, DE: 0.1849, WACC: 0.0858, Ke: 0.0953, Kd: 0.0478, EBIT: 117138.28, Equity: 1992125.91, Debt: 368299.50, Cash: 263347.80, tEff: 0.2908, Interest: 20119 },
  ];

  const EBIT_5Y_AVG  = curvalHist.reduce((s, d) => s + d.EBIT, 0) / curvalHist.length;
  const TAX_5Y_AVG   = curvalHist.reduce((s, d) => s + d.tEff, 0) / curvalHist.length;
  const COVERAGE_MIN = 3.0;

  // PME Portugal Continental: Taxa reduzida 17% até threshold + 21% acima + 1.5% Derrama Municipal
  // Threshold: €25.000 até 2022 · €50.000 a partir de 2023 (OE/2023)
  function computeStatutoryIRC(taxableIncome, year) {
    const threshold = year >= 2023 ? 50000 : 25000;
    const reducedRate = 0.17;
    const normalRate  = 0.21;
    const derramaMun  = 0.015;
    const ti = Math.max(taxableIncome, 0);
    if (ti <= 0) return reducedRate + derramaMun; // fallback
    const irc = ti <= threshold
      ? ti * reducedRate
      : threshold * reducedRate + (ti - threshold) * normalRate;
    return (irc + ti * derramaMun) / ti;
  }

  // Year-by-year statutory rate based on actual RAI
  const IRC_BY_YEAR = curvalHist.reduce((acc, d) => {
    const RAI = d.EBIT - d.Interest;
    acc[d.year] = computeStatutoryIRC(RAI, d.year);
    return acc;
  }, {});
  const IRC_AVG = Object.values(IRC_BY_YEAR).reduce((s, v) => s + v, 0) / Object.keys(IRC_BY_YEAR).length;
  const IRC_MARGINAL_HIGH = 0.225; // 21% + 1.5% derrama — taxa marginal na banda normal

  // ═══ DEFAULTS · harmonizados com Excel do trabalho de grupo ═══
  // Rf, ERP: Análise Consolidada!B6:B8 (Damodaran PT, fontes do grupo)
  // βu = 1.23: Análise Consolidada!B7 (sector Industrial Goods Damodaran)
  // Kd total = 4.78%: Cenarios e Escudos Fiscais!B11 (Kd reportado Curval 2024)
  // Distress: parametrização pedagógica · θ ajustado para 0.4 (PME industrial)
  const DEFAULTS = {
    selectedYear: 2024,
    Rf: 2.45,                 // Rf — taxa sem risco (OT 10Y PT, fonte: trabalho)
    Bu: 1.23,                 // β unlevered — Damodaran sector industrial
    ERP: 5.93,                // Equity Risk Premium PT (Damodaran)
    kdBase: 4.78,             // Kd TOTAL a leverage baixo (não é spread)
    distressThreshold: 0.4,   // PME industrial — mais conservador que default académico (0.6)
    distressSteep: 2.2,
    distressMagnitude: 1.0,   // multiplicador do spread Kd (1.0 = baseline 0.18 original)
    taxMode: 'stat',
    ebitMode: 'avg',
    debtMode: 'net',
  };

  const [selectedYear, setSelectedYear] = useState(DEFAULTS.selectedYear);
  const [Rf, setRf] = useState(DEFAULTS.Rf);
  const [Bu, setBu] = useState(DEFAULTS.Bu);
  const [ERP, setERP] = useState(DEFAULTS.ERP);
  const [distressThreshold, setDistressThreshold] = useState(DEFAULTS.distressThreshold);
  const [distressSteep, setDistressSteep] = useState(DEFAULTS.distressSteep);
  const [distressMagnitude, setDistressMagnitude] = useState(DEFAULTS.distressMagnitude);
  const [kdBase, setKdBase] = useState(DEFAULTS.kdBase);
  const [taxMode, setTaxMode] = useState(DEFAULTS.taxMode);
  const [ebitMode, setEbitMode] = useState(DEFAULTS.ebitMode);
  const [debtMode, setDebtMode] = useState(DEFAULTS.debtMode);
  const [activeView, setActiveView] = useState('analysis'); // 'analysis' | 'glossary' | 'stress'

  // Reset all parameters to defaults (NOT activeView or selectedYear)
  function resetDefaults() {
    setRf(DEFAULTS.Rf);
    setBu(DEFAULTS.Bu);
    setERP(DEFAULTS.ERP);
    setKdBase(DEFAULTS.kdBase);
    setDistressThreshold(DEFAULTS.distressThreshold);
    setDistressSteep(DEFAULTS.distressSteep);
    setDistressMagnitude(DEFAULTS.distressMagnitude);
    setTaxMode(DEFAULTS.taxMode);
    setEbitMode(DEFAULTS.ebitMode);
    setDebtMode(DEFAULTS.debtMode);
  }

  // Detect if any parameter has been changed from defaults
  const isModified =
    Rf !== DEFAULTS.Rf || Bu !== DEFAULTS.Bu || ERP !== DEFAULTS.ERP || kdBase !== DEFAULTS.kdBase ||
    distressThreshold !== DEFAULTS.distressThreshold || distressSteep !== DEFAULTS.distressSteep ||
    distressMagnitude !== DEFAULTS.distressMagnitude ||
    taxMode !== DEFAULTS.taxMode || ebitMode !== DEFAULTS.ebitMode || debtMode !== DEFAULTS.debtMode;

  const current = curvalHist.find(d => d.year === selectedYear);
  const isOutlierYear = current.tEff > 0.5;

  const t_used = taxMode === 'decl' ? current.tEff
              : taxMode === 'stat' ? IRC_BY_YEAR[selectedYear]
              : taxMode === 'marg' ? IRC_MARGINAL_HIGH
              : IRC_AVG;
  const EBIT_used = ebitMode === 'year' ? current.EBIT : EBIT_5Y_AVG;
  const currentDebt = debtMode === 'gross' ? current.Debt : Math.max(0, current.Debt - current.Cash);
  const currentDE = currentDebt / current.Equity;

  const { chartData, optimal, validation, maxSafeDE } = useMemo(() => {
    const rf = Rf / 100, erp = ERP / 100, t = t_used;
    const rA = rf + Bu * erp;
    const kd0 = kdBase / 100;
    const data = [];
    let minWacc = Infinity, minWaccDE = 0;
    let maxV = -Infinity, maxVDE = 0;
    let maxSafe = 2.0;
    const Vu = (EBIT_used * (1 - t)) / rA;
    const E = current.Equity;

    for (let i = 0; i <= 200; i++) {
      const de = i / 100;
      const wE = 1 / (1 + de), wD = de / (1 + de);
      const BL = Bu * (1 + (1 - t) * de);
      const ke = rf + BL * erp;
      // Distress spread no Kd — distressMagnitude é multiplicador sobre baseline 0.18
      const distressSpread = de < distressThreshold ? 0 : distressMagnitude * 0.18 * Math.pow(de - distressThreshold, distressSteep);
      const kd = kd0 + distressSpread;
      const wacc = wE * ke + wD * kd * (1 - t);
      const D = de * E;
      const interest = D * kd;
      const coverage = interest > 0 ? EBIT_used / interest : 999;
      // V_TS mantido para referência MM pura (sem distress). V_L derivado de WACC por identidade
      // de perpetuidade: argmax V_L === argmin WACC por construção.
      const vTS = Vu + t * D;
      const vL = (EBIT_used * (1 - t)) / wacc;
      if (wacc < minWacc) { minWacc = wacc; minWaccDE = de; }
      if (vL > maxV) { maxV = vL; maxVDE = de; }
      if (coverage >= COVERAGE_MIN && de > 0.05) maxSafe = de;
      data.push({
        DE: Number(de.toFixed(3)),
        Ke: Number((ke * 100).toFixed(3)),
        Kd: Number((kd * 100).toFixed(3)),
        WACC: Number((wacc * 100).toFixed(3)),
        Vts: Math.round(vTS / 1000),
        VL: Math.round(vL / 1000),
        coverage, interest: Math.round(interest),
      });
    }

    const deCur = currentDE;
    const wE_c = 1 / (1 + deCur), wD_c = deCur / (1 + deCur);
    const BL_c = Bu * (1 + (1 - t) * deCur);
    const ke_c = rf + BL_c * erp;
    const distSpread_c = deCur < distressThreshold ? 0 : distressMagnitude * 0.18 * Math.pow(deCur - distressThreshold, distressSteep);
    const kd_c = kd0 + distSpread_c;
    const wacc_model = wE_c * ke_c + wD_c * kd_c * (1 - t);

    return {
      chartData: data,
      // Óptimo unificado: argmax V_L === argmin WACC. DEwacc/DEv mantidos como aliases de DE.
      optimal: { DE: minWaccDE, DEwacc: minWaccDE, DEv: minWaccDE, waccMin: minWacc, vMax: maxV, Vu, rA },
      validation: { waccActual: current.WACC, waccModel: wacc_model, deltaBps: Math.round((wacc_model - current.WACC) * 10000) },
      maxSafeDE: maxSafe,
    };
  }, [Rf, Bu, ERP, distressThreshold, distressSteep, distressMagnitude, kdBase, current, t_used, EBIT_used, currentDE]);

  // ═══ DESIGN SYSTEM ═══
  const C = {
    paper:       '#FAF7F0',
    surface:     '#FFFFFF',
    ink:         '#0F1827',
    navy:        '#0A1E3F',
    navyTint:    '#E4E8EF',
    muted:       '#5C6370',
    line:        '#E5E1D8',
    lineDark:    '#C9C3B4',
    gold:        '#A8773A',
    goldTint:    '#F5ECD9',
    green:       '#3C6E47',
    greenTint:   '#E7EFE8',
    red:         '#9B2226',
    redTint:     '#F4E0DD',
    blue:        '#1E5A8E',
    blueTint:    '#E4EDF6',
    amber:       '#C08A1E',
    amberTint:   '#FBF0D7',
  };

  const font = {
    serif: 'Georgia, "Times New Roman", serif',
    sans:  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    mono:  '"SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  };

  const tabNums = { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };

  // Formatters
  const fmt = (n, d=2) => Number(n).toLocaleString('pt-PT', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (n) => fmt(n * 100, 2) + '%';
  const fmtK = (n) => Math.round(n / 1000).toLocaleString('pt-PT') + ' k€';

  // Derived
  const currentVL_model = chartData.find(d => Math.abs(d.DE - currentDE) < 0.006)?.VL ?? 0;
  const optimalData = chartData.find(d => Math.abs(d.DE - optimal.DEwacc) < 0.006);
  const coverageAtOptimal = optimalData?.coverage ?? 0;
  const interestAtOptimal = optimalData?.interest ?? 0;
  const valStatus = Math.abs(validation.deltaBps) < 50 ? 'ok' : Math.abs(validation.deltaBps) < 150 ? 'warn' : 'bad';
  const valColor = valStatus === 'ok' ? C.green : valStatus === 'warn' ? C.amber : C.red;

  // ─── Sub-components ───

  const Tag = ({ children, color, tint }) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 10,
      fontFamily: font.sans, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color, background: tint,
      borderRadius: 3,
    }}>{children}</span>
  );

  const CostTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.navy}`, borderRadius: 4, padding: '10px 14px', fontSize: 12, fontFamily: font.sans, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 600, color: C.navy, marginBottom: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 5, ...tabNums }}>
          D/E = {Number(label).toFixed(2)}
        </div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontFamily: font.mono, fontSize: 11, lineHeight: 1.7, ...tabNums }}>
            <span style={{ display: 'inline-block', width: 58 }}>{p.name}</span>
            <strong>{Number(p.value).toFixed(2)}%</strong>
          </div>
        ))}
        {d && d.coverage < 999 && (
          <div style={{ color: d.coverage < COVERAGE_MIN ? C.red : C.green, fontFamily: font.mono, marginTop: 6, paddingTop: 5, borderTop: `1px solid ${C.line}`, fontSize: 11, ...tabNums }}>
            Coverage · <strong>{d.coverage.toFixed(2)}x</strong>
          </div>
        )}
      </div>
    );
  };

  const ValueTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.navy}`, borderRadius: 4, padding: '10px 14px', fontSize: 12, fontFamily: font.sans, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ fontWeight: 600, color: C.navy, marginBottom: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 5, ...tabNums }}>D/E = {Number(label).toFixed(2)}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontFamily: font.mono, fontSize: 11, lineHeight: 1.7, ...tabNums }}>
            <span style={{ display: 'inline-block', width: 70 }}>{p.name}</span>
            <strong>{Number(p.value).toLocaleString('pt-PT')} k€</strong>
          </div>
        ))}
      </div>
    );
  };

  // Custom slider with filled track
  const Slider = ({ label, value, onChange, min, max, step, unit, desc, hint }) => {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <label style={{ fontFamily: font.sans, fontSize: 12, color: C.ink, fontWeight: 500 }}>{label}</label>
          <span style={{ fontFamily: font.mono, fontSize: 13, color: C.navy, fontWeight: 600, ...tabNums }}>
            {value.toFixed(step < 1 ? 2 : 1)}{unit}
          </span>
        </div>
        <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: C.line, borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 3, background: C.navy, borderRadius: 2 }} />
          <input type="range" min={min} max={max} step={step} value={value}
                 onChange={(e) => onChange(parseFloat(e.target.value))}
                 style={{ position: 'absolute', left: 0, right: 0, width: '100%', appearance: 'none', background: 'transparent', cursor: 'pointer', height: 18, margin: 0, accentColor: C.navy }} />
        </div>
        {desc && <div style={{ fontSize: 11, color: C.muted, fontFamily: font.sans, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>}
        {hint && <div style={{ fontSize: 10.5, color: C.gold, fontFamily: font.sans, marginTop: 3, fontStyle: 'italic' }}>{hint}</div>}
      </div>
    );
  };

  // Segmented control (connected buttons)
  const Segmented = ({ value, onChange, options }) => (
    <div style={{ display: 'inline-flex', background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 2, width: '100%' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: '7px 10px',
            border: 'none', background: value === opt.value ? C.navy : 'transparent',
            color: value === opt.value ? 'white' : C.ink,
            fontFamily: font.sans, fontSize: 11, fontWeight: value === opt.value ? 600 : 500,
            cursor: 'pointer', borderRadius: 3, transition: 'all 0.15s',
            letterSpacing: '0.01em',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );

  const ControlGroup = ({ label, children }) => (
    <div>
      <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );

  const StatColumn = ({ tag, tagColor, tagTint, dLabel, dValue, waccLabel, waccValue, note, accent }) => (
    <div style={{ flex: 1, minWidth: 200, paddingLeft: 22, borderLeft: `3px solid ${accent}`, paddingRight: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <Tag color={tagColor} tint={tagTint}>{tag}</Tag>
      </div>
      <div style={{ fontFamily: font.sans, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 500 }}>
        {dLabel}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 34, fontWeight: 600, color: C.ink, lineHeight: 1, ...tabNums, marginBottom: 14 }}>
        {dValue}
      </div>
      <div style={{ fontFamily: font.sans, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontWeight: 500 }}>
        {waccLabel}
      </div>
      <div style={{ fontFamily: font.mono, fontSize: 18, fontWeight: 500, color: C.ink, ...tabNums, marginBottom: 12 }}>
        {waccValue}
      </div>
      <div style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, fontStyle: 'italic', lineHeight: 1.5 }}>
        {note}
      </div>
    </div>
  );

  // Leverage spectrum SVG
  const Spectrum = () => {
    const W = 1000, H = 70, pad = 30;
    const x = (de) => pad + (de / 2) * (W - 2 * pad);
    const safeX1 = x(0.05), safeX2 = x(Math.min(maxSafeDE, 2));
    const redX1 = x(maxSafeDE), redX2 = x(2);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 90 }}>
        {/* Base line */}
        <rect x={pad} y={H/2 - 4} width={W - 2*pad} height={8} fill={C.line} rx={2} />
        {/* Safe zone */}
        <rect x={safeX1} y={H/2 - 4} width={safeX2 - safeX1} height={8} fill={C.green} opacity={0.35} rx={2} />
        {/* Critical zone */}
        <rect x={redX1} y={H/2 - 4} width={redX2 - redX1} height={8} fill={C.red} opacity={0.35} rx={2} />
        {/* Tick marks */}
        {[0, 0.5, 1, 1.5, 2].map(v => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={H/2 + 6} y2={H/2 + 10} stroke={C.muted} strokeWidth="1" />
            <text x={x(v)} y={H/2 + 22} textAnchor="middle" fontSize="10" fontFamily={font.mono} fill={C.muted}>{v.toFixed(1)}</text>
          </g>
        ))}
        {/* Current (blue) */}
        <g transform={`translate(${x(currentDE)}, ${H/2})`}>
          <polygon points="0,-14 8,0 0,14 -8,0" fill={C.blue} stroke="white" strokeWidth="2" />
          <text y="-20" textAnchor="middle" fontSize="10" fontFamily={font.sans} fontWeight="600" fill={C.blue}>CURVAL</text>
        </g>
        {/* Optimal (gold) */}
        <g transform={`translate(${x(optimal.DEwacc)}, ${H/2})`}>
          <circle r="9" fill={C.gold} stroke="white" strokeWidth="2" />
          <text y="-20" textAnchor="middle" fontSize="10" fontFamily={font.sans} fontWeight="600" fill={C.gold}>ÓPTIMO</text>
        </g>
        {/* Max safe (green) */}
        <g transform={`translate(${x(maxSafeDE)}, ${H/2})`}>
          <line x1="0" x2="0" y1="-10" y2="10" stroke={C.green} strokeWidth="3" />
          <text y="-20" textAnchor="middle" fontSize="10" fontFamily={font.sans} fontWeight="600" fill={C.green}>LIMITE</text>
        </g>
      </svg>
    );
  };

  return (
    <div style={{ background: C.paper, minHeight: '100vh', padding: '32px 24px', color: C.ink }}>
      <style>{`
        @media (max-width: 960px) {
          .curval-split { grid-template-columns: 1fr !important; }
          .curval-sidebar { position: static !important; max-height: none !important; }
        }
        .curval-sidebar::-webkit-scrollbar { width: 6px; }
        .curval-sidebar::-webkit-scrollbar-track { background: transparent; }
        .curval-sidebar::-webkit-scrollbar-thumb { background: ${C.lineDark}; border-radius: 3px; }
        details.curval-notes > summary { list-style: none; cursor: pointer; outline: none; }
        details.curval-notes > summary::-webkit-details-marker { display: none; }
        details.curval-notes > summary::marker { display: none; }
        details.curval-notes > summary .chev { transition: transform 0.2s; display: inline-block; }
        details.curval-notes[open] > summary .chev { transform: rotate(180deg); }
      `}</style>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>

        {/* ═══ MASTHEAD ═══ */}
        <header style={{ marginBottom: 28, paddingBottom: 0, borderBottom: `1px solid ${C.lineDark}` }}>
          <div style={{ paddingBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: font.sans, fontSize: 11, color: C.gold, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>
                Corporate Finance · PBS EMBA · CFO Simulation
              </div>
              <h1 style={{ fontFamily: font.serif, fontSize: 40, color: C.navy, margin: 0, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                Curval
              </h1>
              <div style={{ fontFamily: font.serif, fontSize: 19, color: C.muted, marginTop: 6, fontStyle: 'italic', fontWeight: 400 }}>
                Estrutura Óptima de Capital · Trade-off vs. Pecking Order
              </div>
            </div>
          </div>
          {/* Nav tabs */}
          <nav style={{ display: 'flex', gap: 0, marginTop: 8, borderTop: `1px solid ${C.line}`, paddingTop: 0, flexWrap: 'wrap' }}>
            {[
              { key: 'analysis', label: 'Análise', sub: 'Diagnóstico interactivo' },
              { key: 'stress', label: 'Stress Test', sub: 'Robustez sob choques' },
              { key: 'glossary', label: 'Glossário', sub: 'Conceitos e métricas' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveView(tab.key)}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeView === tab.key ? `3px solid ${C.navy}` : '3px solid transparent',
                  marginBottom: -1,
                  cursor: 'pointer',
                  fontFamily: font.sans,
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: activeView === tab.key ? C.navy : C.muted, letterSpacing: '0.02em' }}>
                  {tab.label}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>
                  {tab.sub}
                </div>
              </button>
            ))}
          </nav>
        </header>

        {activeView === 'glossary' ? (
          <Glossary C={C} font={font} tabNums={tabNums} />
        ) : activeView === 'stress' ? (
          <StressTest C={C} font={font} tabNums={tabNums} curvalHist={curvalHist} EBIT_5Y_AVG={EBIT_5Y_AVG} IRC_BY_YEAR={IRC_BY_YEAR} />
        ) : (
        <>
        {/* ═══ ANALYSIS VIEW ═══ */}

        {/* ═══ OUTLIER WARNING ═══ */}
        {isOutlierYear && taxMode === 'decl' && (
          <div style={{ background: C.amberTint, borderLeft: `3px solid ${C.amber}`, padding: '12px 18px', marginBottom: 20, fontSize: 12.5, color: '#5C4300', fontFamily: font.sans, lineHeight: 1.5 }}>
            <strong>Aviso {selectedYear}</strong> · Taxa de imposto efectiva de {(current.tEff*100).toFixed(1)}% é um outlier contabilístico (correcções fiscais ou tributação autónoma elevada). Ative <em>Estatutária</em> ({(IRC_BY_YEAR[selectedYear]*100).toFixed(1)}%) ou <em>Marginal</em> (22.5%) para resultados representativos.
          </div>
        )}

        {/* ═══ HERO DIAGNOSTIC ═══ */}
        <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 28, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatColumn
              tag="Actual"  tagColor={C.blue}  tagTint={C.blueTint}  accent={C.blue}
              dLabel="D/E observado"
              dValue={currentDE.toFixed(3)}
              waccLabel="WACC reportado"
              waccValue={fmtPct(current.WACC)}
              note={`Posição de ${selectedYear} · dívida ${debtMode === 'net' ? 'líquida' : 'bruta'}`}
            />
            <StatColumn
              tag="Teórico" tagColor={C.gold}  tagTint={C.goldTint}  accent={C.gold}
              dLabel="D/E óptimo"
              dValue={optimal.DEwacc < 0.02 ? '≈ 0' : optimal.DEwacc.toFixed(2)}
              waccLabel="WACC mínimo"
              waccValue={fmtPct(optimal.waccMin)}
              note={optimal.DEwacc < 0.02 ? 'Corner solution · não usar dívida' : 'Minimiza WACC · ignora restrições operacionais'}
            />
            <StatColumn
              tag="Sustentável" tagColor={C.green} tagTint={C.greenTint} accent={C.green}
              dLabel="D/E máximo"
              dValue={maxSafeDE.toFixed(2)}
              waccLabel={`Coverage ≥ ${COVERAGE_MIN.toFixed(1)}x`}
              waccValue="viável"
              note={`EBIT ${ebitMode === 'avg' ? 'médio 5Y' : 'do ano'} · ${fmtK(EBIT_used)}`}
            />
          </div>

          {/* Leverage spectrum */}
          <div style={{ paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              Leverage Spectrum · D/E Ratio
            </div>
            <Spectrum />
          </div>

          {/* Validation strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 16, marginTop: 8, borderTop: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: valColor, display: 'inline-block' }} />
              <span style={{ fontFamily: font.sans, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Validação</span>
            </div>
            <div style={{ display: 'flex', gap: 18, fontFamily: font.mono, fontSize: 12, ...tabNums, flex: 1, flexWrap: 'wrap' }}>
              <span><span style={{ color: C.muted }}>Modelo:</span> <strong>{(validation.waccModel*100).toFixed(2)}%</strong></span>
              <span><span style={{ color: C.muted }}>Reportado:</span> <strong>{(validation.waccActual*100).toFixed(2)}%</strong></span>
              <span style={{ color: valColor, fontWeight: 600 }}>Δ {validation.deltaBps > 0 ? '+' : ''}{validation.deltaBps} bps</span>
            </div>
          </div>
        </section>

        {/* ═══ SPLIT LAYOUT: CHARTS + STICKY SIDEBAR ═══ */}
        <div className="curval-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, marginBottom: 28 }}>
          <div style={{ minWidth: 0 }}>
        {/* ═══ CHARTS ROW (2 columns side by side) ═══ */}
        <div className="curval-charts-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
        {/* ═══ CHART 1 — FIRM VALUE ═══ */}
        <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 20, marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ marginBottom: 4 }}><Tag color={C.navy} tint={C.navyTint}>Figure 01</Tag></div>
              <h3 style={{ margin: 0, fontFamily: font.serif, fontSize: 15, fontWeight: 700, color: C.navy }}>Valor da Empresa</h3>
              <div style={{ fontFamily: font.serif, fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>
                V<sub>L</sub> = V<sub>U</sub> + PV(Tax Shield) − PV(Financial Distress)
              </div>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 12, color: C.muted, ...tabNums }}>
              V<sub>U</sub> = {Math.round(optimal.Vu / 1000).toLocaleString('pt-PT')} k€
            </div>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}>
              <CartesianGrid strokeDasharray="1 3" stroke={C.line} />
              <XAxis dataKey="DE" type="number" domain={[0, 2]} ticks={[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
                     tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                     tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                     label={{ value: 'D/E Ratio', position: 'insideBottom', offset: -14, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
              <YAxis tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                     tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                     label={{ value: 'Valor (k€)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }}
                     domain={['auto', 'auto']} />
              <Tooltip content={<ValueTooltip />} />
              <ReferenceLine y={Math.round(optimal.Vu / 1000)} stroke={C.muted} strokeDasharray="3 4" strokeWidth={1} />
              <ReferenceLine x={optimal.DEv} stroke={C.gold} strokeDasharray="2 3" strokeWidth={1.2} />
              <Line type="monotone" dataKey="Vts" name="V_U + PV(TS)" stroke={C.navy} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="VL" name="V_L" stroke={C.red} strokeWidth={2.8} dot={false} />
              <ReferenceDot x={optimal.DEv} y={Math.round(optimal.vMax / 1000)} r={6} fill={C.gold} stroke="white" strokeWidth={2} />
              <ReferenceDot x={currentDE} y={currentVL_model} r={6} fill={C.blue} stroke="white" strokeWidth={2} shape="diamond" />
            </ComposedChart>
          </ResponsiveContainer>
          <details className="curval-notes" style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
            <summary style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span>Legenda e notas</span>
              <span className="chev" style={{ fontSize: 9, color: C.lineDark }}>▾</span>
            </summary>
            <div style={{ marginTop: 10 }}>
<LegendBlock items={[
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 3, background: C.navy }} />, name: 'V_U + PV(Tax Shield)', desc: 'Valor sem custos de distress (MM com impostos). Cresce linearmente: cada €1 de dívida gera t×€1 via escudo fiscal.' },
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 3, background: C.red }} />, name: 'V_L (valor alavancado)', desc: 'Trade-off completa: tax shield menos valor presente esperado dos custos de financial distress.' },
            { swatch: <span style={{ display: 'inline-block', width: 22, borderTop: `2px dashed ${C.muted}` }} />, name: 'V_U (baseline)', desc: 'Valor unlevered: EBIT_normalizado × (1−t) / r_A. Referência teórica.' },
            { swatch: <span style={{ display: 'inline-block', width: 12, height: 12, background: C.gold, borderRadius: '50%', border: '2px solid white', boxShadow: `0 0 0 1px ${C.gold}` }} />, name: 'Óptimo teórico', desc: `D/E* = ${optimal.DE.toFixed(2)} · maximiza V_L (equivalente a minimizar WACC). Não incorpora restrição de coverage.` },
            { swatch: <span style={{ display: 'inline-block', width: 12, height: 12, background: C.blue, transform: 'rotate(45deg)', border: '2px solid white', boxShadow: `0 0 0 1px ${C.blue}` }} />, name: `Curval ${selectedYear}`, desc: `Posição observada: D/E = ${currentDE.toFixed(3)}.` },
          ]} C={C} font={font} />
            </div>
          </details>
        </section>


        {/* ═══ CHART 2 — COST OF CAPITAL ═══ */}
        <section style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ marginBottom: 4 }}><Tag color={C.navy} tint={C.navyTint}>Figure 02</Tag></div>
              <h3 style={{ margin: 0, fontFamily: font.serif, fontSize: 15, fontWeight: 700, color: C.navy }}>
                Custo de Capital <span style={{ color: C.muted, fontWeight: 400, fontSize: 15 }}>— com restrição de coverage</span>
              </h3>
              <div style={{ fontFamily: font.serif, fontSize: 13, color: C.muted, fontStyle: 'italic', marginTop: 2 }}>
                Zona vermelha: EBIT/Juros &lt; {COVERAGE_MIN.toFixed(1)}x (inviável operacionalmente)
              </div>
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 12, color: C.muted, ...tabNums }}>
              r<sub>A</sub> = {(optimal.rA*100).toFixed(2)}%
            </div>
          </div>

          {optimal.DEwacc < 0.02 && (
            <div style={{ background: C.amberTint, borderLeft: `3px solid ${C.amber}`, padding: '10px 14px', marginBottom: 12, borderRadius: 3, fontFamily: font.sans, fontSize: 11.5, color: '#5C4300', lineHeight: 1.55 }}>
              <strong>Solução de canto (corner solution)</strong> · O WACC é monotonamente crescente com estes parâmetros — o "óptimo" matemático é em D/E ≈ 0. Significa que <em>nestas condições</em> a Trade-off Theory recomenda <strong>não usar dívida</strong>: o custo marginal do equity (via Hamada) cresce mais depressa do que o benefício marginal do tax shield. Para obter um óptimo interior, experimenta aumentar β<sub>u</sub> (mais risco de negócio) ou diminuir o threshold θ de distress (impacto mais cedo).
            </div>
          )}

          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}>
              <CartesianGrid strokeDasharray="1 3" stroke={C.line} />
              <XAxis dataKey="DE" type="number" domain={[0, 2]} ticks={[0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
                     tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                     tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                     label={{ value: 'D/E Ratio', position: 'insideBottom', offset: -14, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
              <YAxis tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                     tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                     label={{ value: 'Custo (%)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }}
                     domain={[2, 22]} />
              <Tooltip content={<CostTooltip />} />
              <ReferenceArea x1={maxSafeDE} x2={2} fill={C.red} fillOpacity={0.06} />
              <ReferenceLine x={maxSafeDE} stroke={C.red} strokeDasharray="3 4" strokeWidth={1.2} />
              <ReferenceLine y={Number((optimal.rA*100).toFixed(2))} stroke={C.muted} strokeDasharray="3 4" strokeWidth={1} />
              {optimal.DEwacc >= 0.02 && (
                <ReferenceLine x={optimal.DEwacc} stroke={C.gold} strokeDasharray="2 3" strokeWidth={1.2} />
              )}
              <Line type="monotone" dataKey="Ke" name="K_E" stroke={C.navy} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Kd" name="K_D" stroke={C.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="WACC" name="WACC" stroke={C.red} strokeWidth={2.8} dot={false} />
              {optimal.DEwacc >= 0.02 ? (
                <ReferenceDot x={optimal.DEwacc} y={Number((optimal.waccMin*100).toFixed(2))} r={6} fill={C.gold} stroke="white" strokeWidth={2} />
              ) : (
                <ReferenceDot x={0} y={Number((optimal.waccMin*100).toFixed(2))} r={7} fill={C.amber} stroke="white" strokeWidth={2} label={{ value: 'Corner', position: 'top', offset: 8, fill: C.amber, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
              )}
              <ReferenceDot x={currentDE} y={current.WACC*100} r={6} fill={C.blue} stroke="white" strokeWidth={2} shape="diamond" />
            </ComposedChart>
          </ResponsiveContainer>
          <details className="curval-notes" style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
            <summary style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span>Legenda e notas</span>
              <span className="chev" style={{ fontSize: 9, color: C.lineDark }}>▾</span>
            </summary>
            <div style={{ marginTop: 10 }}>
<LegendBlock items={[
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 3, background: C.navy }} />, name: 'K_E', desc: 'Custo do equity via CAPM com levered beta Hamada: K_E = Rf + β_U·[1+(1−t)·D/E]·ERP.' },
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 3, background: C.green }} />, name: 'K_D', desc: 'Custo da dívida. Rf + spread de crédito; cresce convexo acima do threshold de distress.' },
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 3, background: C.red }} />, name: 'WACC', desc: 'Custo médio ponderado. Forma de U: desce pelo tax shield, sobe pelo distress. Mínimo = óptimo teórico.' },
            { swatch: <span style={{ display: 'inline-block', width: 22, height: 10, background: C.red, opacity: 0.15 }} />, name: 'Zona crítica', desc: `D/E > ${maxSafeDE.toFixed(2)} implica coverage < ${COVERAGE_MIN.toFixed(1)}x — covenants violados.` },
            { swatch: <span style={{ display: 'inline-block', width: 12, height: 12, background: C.gold, borderRadius: '50%', border: '2px solid white', boxShadow: `0 0 0 1px ${C.gold}` }} />, name: 'Óptimo teórico', desc: `D/E* = ${optimal.DE.toFixed(2)} · minimiza WACC (equivalente a maximizar V_L). Se dentro da zona vermelha, é inviável na prática.` },
            { swatch: <span style={{ display: 'inline-block', width: 12, height: 12, background: C.blue, transform: 'rotate(45deg)', border: '2px solid white', boxShadow: `0 0 0 1px ${C.blue}` }} />, name: `Curval ${selectedYear}`, desc: `D/E = ${currentDE.toFixed(3)}, WACC reportado = ${(current.WACC*100).toFixed(2)}%.` },
          ]} C={C} font={font} />
            </div>
          </details>
        </section>


        </div>
        {/* ═══ THEORY vs DATA — parallel insight cards ═══ */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div style={{ background: C.redTint, padding: 24, borderRadius: 6, borderTop: `3px solid ${C.red}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Tag color={C.red} tint="rgba(255,255,255,0.5)">Teoria vs. Realidade</Tag>
              <span style={{ fontFamily: font.mono, fontSize: 10.5, color: C.red, fontWeight: 700, letterSpacing: '0.1em' }}>01</span>
            </div>
            <h4 style={{ fontFamily: font.serif, fontSize: 17, fontWeight: 700, color: C.navy, margin: '0 0 12px 0', lineHeight: 1.3 }}>
              O óptimo teórico é operacionalmente inviável
            </h4>
            <p style={{ fontFamily: font.serif, fontSize: 13, color: C.ink, lineHeight: 1.65, margin: 0 }}>
              No D/E* de <strong style={{ ...tabNums, fontFamily: font.mono }}>{optimal.DEwacc.toFixed(2)}</strong>, os juros seriam <strong style={{ ...tabNums, fontFamily: font.mono }}>{fmtK(interestAtOptimal * 1000)}</strong>. Com EBIT {ebitMode === 'avg' ? 'médio 5Y' : `de ${selectedYear}`} (<strong style={{ ...tabNums, fontFamily: font.mono }}>{fmtK(EBIT_used)}</strong>), coverage = <strong style={{ color: coverageAtOptimal < COVERAGE_MIN ? C.red : C.green, ...tabNums, fontFamily: font.mono }}>{coverageAtOptimal.toFixed(2)}x</strong>.
              {coverageAtOptimal < COVERAGE_MIN && <> Abaixo do threshold bancário. Tecto sustentável: <strong style={{ ...tabNums, fontFamily: font.mono }}>D/E ≤ {maxSafeDE.toFixed(2)}</strong>.</>}
            </p>
          </div>

          <div style={{ background: C.greenTint, padding: 24, borderRadius: 6, borderTop: `3px solid ${C.green}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Tag color={C.green} tint="rgba(255,255,255,0.5)">Evidência Empírica</Tag>
              <span style={{ fontFamily: font.mono, fontSize: 10.5, color: C.green, fontWeight: 700, letterSpacing: '0.1em' }}>02</span>
            </div>
            <h4 style={{ fontFamily: font.serif, fontSize: 17, fontWeight: 700, color: C.navy, margin: '0 0 12px 0', lineHeight: 1.3 }}>
              Comportamento alinha com Pecking Order
            </h4>
            <p style={{ fontFamily: font.serif, fontSize: 13, color: C.ink, lineHeight: 1.65, margin: 0 }}>
              Evolução 2020→2024: dívida <strong style={{ ...tabNums, fontFamily: font.mono }}>713k → 368k</strong> (−48%), equity <strong style={{ ...tabNums, fontFamily: font.mono }}>1.750k → 1.992k</strong> (+14% via retenção). Curval não persegue o óptimo Trade-off — prefere autofinanciamento e reduzir dependência externa. <em>Myers &amp; Majluf, 1984</em>.
            </p>
          </div>
        </section>

          </div>

          {/* ═══ STICKY SIDEBAR (all interactive controls) ═══ */}
          <aside className="curval-sidebar" style={{ position: 'sticky', top: 16, alignSelf: 'start', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', paddingRight: 4 }}>
            {/* Reset defaults button */}
            <button onClick={resetDefaults} disabled={!isModified}
              style={{
                width: '100%',
                padding: '10px 14px',
                marginBottom: 12,
                background: isModified ? C.navy : C.surface,
                color: isModified ? 'white' : C.muted,
                border: `1px solid ${isModified ? C.navy : C.line}`,
                borderRadius: 6,
                cursor: isModified ? 'pointer' : 'not-allowed',
                fontFamily: font.sans,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.15s',
              }}
              title={isModified ? 'Repor todos os parâmetros aos valores default do trabalho' : 'Já estás nos defaults'}
            >
              <span style={{ fontSize: 13 }}>↺</span>
              <span>{isModified ? 'Repor defaults' : 'Defaults activos'}</span>
            </button>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>Ano de referência</div>
              <div style={{ display: 'flex', gap: 2, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 2 }}>
                {curvalHist.map(d => (
                  <button key={d.year} onClick={() => setSelectedYear(d.year)}
                    style={{
                      flex: 1, padding: '6px 0', border: 'none',
                      background: selectedYear === d.year ? C.navy : 'transparent',
                      color: selectedYear === d.year ? 'white' : C.ink,
                      fontFamily: font.mono, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', borderRadius: 3, ...tabNums,
                    }}>
                    {d.year}{d.tEff > 0.5 && <span style={{ marginLeft: 2, color: selectedYear === d.year ? C.amberTint : C.amber }}>·</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: font.serif, fontSize: 13, color: C.navy, fontWeight: 700, marginBottom: 12 }}>
                Normalização <span style={{ color: C.muted, fontWeight: 400, fontSize: 11 }}>— CFO</span>
              </div>
              <div style={{ marginBottom: 14 }}>
                <ControlGroup label="Taxa de imposto">
                  <Segmented value={taxMode} onChange={setTaxMode} options={[
                    { value: 'decl', label: `Decl ${(current.tEff*100).toFixed(0)}%` },
                    { value: 'stat', label: `Estat ${(IRC_BY_YEAR[selectedYear]*100).toFixed(1)}%` },
                    { value: 'marg', label: 'Marg 22.5%' },
                    { value: 'avg',  label: `M5Y ${(IRC_AVG*100).toFixed(1)}%` },
                  ]} />
                </ControlGroup>
              </div>
              <div style={{ marginBottom: 14 }}>
                <ControlGroup label="EBIT base">
                  <Segmented value={ebitMode} onChange={setEbitMode} options={[
                    { value: 'year', label: `Ano · ${fmtK(current.EBIT)}` },
                    { value: 'avg', label: `M5Y · ${fmtK(EBIT_5Y_AVG)}` },
                  ]} />
                </ControlGroup>
              </div>
              <div>
                <ControlGroup label="Dívida">
                  <Segmented value={debtMode} onChange={setDebtMode} options={[
                    { value: 'gross', label: `Bruta · ${fmtK(current.Debt)}` },
                    { value: 'net', label: `Líquida · ${fmtK(Math.max(0, current.Debt - current.Cash))}` },
                  ]} />
                </ControlGroup>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16, marginBottom: 12 }}>
              <div style={{ fontFamily: font.serif, fontSize: 13, color: C.navy, fontWeight: 700, marginBottom: 4 }}>Parâmetros CAPM</div>
              <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, marginBottom: 14 }}>Damodaran · metalomecânica</div>
              <Slider label="Risk-free (Rf)" value={Rf} onChange={setRf} min={0.5} max={6} step={0.1} unit="%" desc="OT 10 anos" />
              <Slider label="Unlevered Beta (βu)" value={Bu} onChange={setBu} min={0.5} max={2} step={0.01} unit="" desc="Default 1.03" />
              <Slider label="Equity Risk Premium" value={ERP} onChange={setERP} min={3} max={10} step={0.1} unit="%" desc="PT · default 5.78%" />
              <Slider label="Kd base" value={kdBase} onChange={setKdBase} min={1} max={10} step={0.1} unit="%" desc="Kd total a leverage baixo (sem distress)" />
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}>
              <div style={{ fontFamily: font.serif, fontSize: 13, color: C.navy, fontWeight: 700, marginBottom: 4 }}>Financial Distress</div>
              <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, marginBottom: 14 }}>Custos esperados</div>
              <Slider label="Threshold D/E (θ)" value={distressThreshold} onChange={setDistressThreshold} min={0.2} max={1.5} step={0.05} unit="" desc="Início do distress"
                      hint="PME industrial · 0.3–0.4" />
              <Slider label="Convexidade (β)" value={distressSteep} onChange={setDistressSteep} min={1.5} max={3.5} step={0.1} unit="" desc="Expoente" />
              <Slider label="Magnitude (α)" value={distressMagnitude} onChange={setDistressMagnitude} min={0.2} max={2} step={0.05} unit="" desc="Severidade do spread de distress" />
            </div>
          </aside>
        </div>

        {/* ═══ FINAL RECOMMENDATION ═══ */}
        <section style={{ background: C.navy, color: 'white', padding: '32px 36px', borderRadius: 6, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: C.gold }} />
          <div style={{ fontFamily: font.sans, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 14, fontWeight: 600 }}>
            Recomendação CFO
          </div>
          <p style={{ fontFamily: font.serif, fontSize: 16, lineHeight: 1.7, margin: 0, color: 'white', fontWeight: 400 }}>
            Em <strong>{selectedYear}</strong>, Curval apresenta D/E de <strong style={{ color: C.goldTint, ...tabNums, fontFamily: font.mono }}>{currentDE.toFixed(3)}</strong> vs. óptimo teórico de <strong style={{ color: C.goldTint, ...tabNums, fontFamily: font.mono }}>{optimal.DEwacc.toFixed(2)}</strong>. A Trade-off Theory diagnosticaria sub-alavancagem — mas este óptimo é operacionalmente <strong>inviável</strong>, gerando coverage de {coverageAtOptimal.toFixed(2)}x (abaixo de covenants). O tecto real é <strong style={{ color: C.goldTint, ...tabNums, fontFamily: font.mono }}>D/E ≤ {maxSafeDE.toFixed(2)}</strong>. O comportamento observado valida <strong>Pecking Order</strong>. Manter política conservadora; reavaliar alavancagem apenas quando EBIT estabilizar acima de <strong style={{ color: C.goldTint, ...tabNums, fontFamily: font.mono }}>200k€</strong>.
          </p>
        </section>
        </>
        )}

        <footer style={{ fontFamily: font.sans, fontSize: 11, color: C.muted, textAlign: 'center', paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          Fonte · SABI / IES · Curval 2020–2024  ·  Modelo calibrado com dados reportados  ·  CAPM · Damodaran  ·  Threshold coverage · prática bancária PT
        </footer>
      </div>
    </div>
  );
}

// Helper component defined outside for cleaner JSX
function LegendBlock({ items, C, font }) {
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '7px 0', borderBottom: i === items.length - 1 ? 'none' : `1px dotted ${C.line}` }}>
          <div style={{ width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 5, flexShrink: 0 }}>
            {it.swatch}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 600, color: C.navy, marginRight: 10, fontVariantNumeric: 'tabular-nums' }}>{it.name}</span>
            <span style={{ fontFamily: font.serif, fontSize: 12.5, color: '#3A3D45', lineHeight: 1.6 }}>{it.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GLOSSARY VIEW
// ═══════════════════════════════════════════════════════════════════════
function Glossary({ C, font, tabNums }) {
  const sections = [
    {
      id: 'theory',
      title: 'Teoria · Estrutura de Capital',
      icon: '📚',
      items: [
        {
          term: 'Trade-off Theory',
          formula: 'V_L = V_U + PV(Tax Shield) − PV(Distress Costs)',
          short: 'Existe um D/E óptimo onde o benefício fiscal da dívida é maximamente compensado pelos custos esperados de financial distress.',
          long: 'Modigliani-Miller (1963) demonstram que, num mundo com impostos, o valor da empresa cresce linearmente com o endividamento devido ao escudo fiscal dos juros. A Trade-off Theory adiciona que, a partir de certo nível de alavancagem, os custos esperados de falência (directos e indirectos) começam a destruir valor mais depressa do que o tax shield o cria. O óptimo está no ponto onde a derivada marginal do tax shield iguala a derivada marginal dos custos esperados de distress.'
        },
        {
          term: 'Pecking Order Theory',
          formula: 'Lucros retidos > Dívida > Equity',
          short: 'As empresas preferem financiar-se por ordem de assimetria de informação: primeiro autofinanciamento, depois dívida, equity em último recurso.',
          long: 'Myers & Majluf (1984) argumentam que existe assimetria de informação entre gestores e mercado. Emitir equity sinaliza sobre-valorização e penaliza o preço; emitir dívida é menos punitivo. Resultado empírico: empresas com lucros suficientes não emitem nem dívida nem equity — autofinanciam-se. Esta teoria explica melhor o comportamento observado da maioria das PME do que a Trade-off pura.'
        },
        {
          term: 'Modigliani-Miller (sem impostos)',
          formula: 'V_L = V_U  ·  WACC = r_A',
          short: 'Num mundo sem impostos, custos de falência ou assimetria de informação, a estrutura de capital é irrelevante.',
          long: 'Proposições I e II de MM (1958). Servem como ponto de partida teórico: qualquer desvio à irrelevância tem de ser explicado por uma fricção real (impostos, distress, agência, informação). É o "vácuo" do qual partem todas as teorias subsequentes.'
        },
        {
          term: 'Modigliani-Miller (com impostos)',
          formula: 'V_L = V_U + t × D',
          short: 'Com IRC sobre lucros, cada euro de dívida gera um escudo fiscal permanente igual a t × €1 — sugerindo alavancagem máxima.',
          long: 'MM (1963). O conjunto de assunções desta versão é internamente coerente mas leva a uma conclusão absurda (D/E → ∞). Resolução: introduzir custos de financial distress (Trade-off) ou assimetria informacional (Pecking Order).'
        },
      ]
    },
    {
      id: 'metrics',
      title: 'Rácios · Estrutura e Risco',
      icon: '📊',
      items: [
        {
          term: 'D/E (Debt-to-Equity)',
          formula: 'D / E',
          short: 'Rácio entre dívida financeira e capital próprio. Mede a alavancagem financeira.',
          long: 'D pode ser dívida bruta (apenas passivo financeiro) ou líquida (dívida − caixa). Para PME conservadora com caixa significativa, a dívida líquida é mais informativa. Curval 2024: 368k€ bruta vs. 105k€ líquida (após 263k€ de caixa). Quanto maior o D/E, maior o risco financeiro e mais alto o Ke.'
        },
        {
          term: 'WACC',
          formula: 'wE × Ke + wD × Kd × (1 − t)',
          short: 'Custo médio ponderado do capital. É a taxa de desconto a usar em projectos de risco semelhante ao da empresa.',
          long: 'wE e wD são pesos do equity e da dívida sobre o capital total investido (E + D). O factor (1 − t) na parcela da dívida reflecte o tax shield: o custo efectivo da dívida é menor que o juro contratado porque os juros são dedutíveis em IRC. WACC é o objectivo a minimizar na Trade-off Theory: o D/E* é o ponto que minimiza o WACC.'
        },
        {
          term: 'Coverage Ratio',
          formula: 'EBIT / Juros',
          short: 'Quantas vezes o EBIT cobre os encargos financeiros. Threshold bancário típico para PME ≥ 3.0x.',
          long: 'Métrica central da viabilidade da estrutura de capital. Bancos portugueses incluem-na quase sempre como covenant em financiamentos a PME. Abaixo de 3x, o banco vê risco de incumprimento; abaixo de 1.5x, há quebra de covenant e possível aceleração da dívida. Curval 2024: 117k / 20k = 5.8x — folga confortável.'
        },
        {
          term: 'EBITDA Margin',
          formula: 'EBITDA / Vendas',
          short: 'Margem operacional antes de depreciações. Mede a rentabilidade operacional pura.',
          long: 'EBITDA = EBIT + Depreciações + Amortizações. Em sectores de capital intensivo (como metalomecânica), a EBITDA Margin é uma melhor medida de eficiência operacional do que a margem líquida, porque exclui o efeito de políticas contabilísticas de depreciação. Curval: contracção severa de 15.8% (2020) para 6.5% (2024) — sinal de pressão competitiva real.'
        },
      ]
    },
    {
      id: 'capm',
      title: 'CAPM · Custo de Capital Próprio',
      icon: '📈',
      items: [
        {
          term: 'Ke (Cost of Equity)',
          formula: 'Ke = Rf + β_L × ERP',
          short: 'Retorno mínimo exigido pelos accionistas, dado o risco sistemático da empresa.',
          long: 'Modelo CAPM (Sharpe, 1964). O Ke não é o que a empresa "paga" aos accionistas — é o que os accionistas exigem para deter o risco. Se ROE < Ke, a empresa destrói valor económico (mesmo sendo contabilisticamente lucrativa). Curval 2020-2024: ROE entre 3.5% e 9.4% vs. Ke entre 9.4% e 10.7% — destruição persistente de valor.'
        },
        {
          term: 'Rf (Risk-free rate)',
          formula: 'Rf = yield OT 10 anos',
          short: 'Taxa sem risco. Em Portugal, usa-se a yield das Obrigações do Tesouro a 10 anos.',
          long: 'Default no artefacto: 2.8% (yield OT PT 10Y aproximado em 2024). É a base sobre a qual se constrói qualquer custo de capital — representa o retorno por adiar consumo sem risco.'
        },
        {
          term: 'β_U (Unlevered Beta)',
          formula: 'β_U = β_L / [1 + (1 − t) × D/E]',
          short: 'Beta da empresa "como se" não tivesse dívida. Mede só o risco do negócio.',
          long: 'Damodaran publica β_U por sector. Para metalomecânica europeia: ~1.03. É o input correcto para CAPM quando se quer simular diferentes estruturas de capital — depois "alavanca-se" com a equação Hamada para obter β_L específico de cada D/E.'
        },
        {
          term: 'β_L (Levered Beta · Hamada)',
          formula: 'β_L = β_U × [1 + (1 − t) × D/E]',
          short: 'Beta ajustado à alavancagem da empresa. Cresce linearmente com D/E.',
          long: 'Equação de Hamada (1972). Reflecte que accionistas de empresas alavancadas suportam o risco do negócio amplificado pelo risco financeiro. É este β_L que entra no CAPM para obter Ke.'
        },
        {
          term: 'ERP (Equity Risk Premium)',
          formula: 'ERP = E[Rm] − Rf',
          short: 'Prémio que o mercado de acções oferece sobre a taxa sem risco.',
          long: 'Damodaran calcula ERP por país com ajuste por risco soberano. Portugal 2024: ~5.78% (5% maturos + ~0.78% country risk premium). Sensibilidade alta: 1pp de ERP altera Ke em ~1pp para β=1.'
        },
        {
          term: 'r_A (Asset Return)',
          formula: 'r_A = Rf + β_U × ERP',
          short: 'Custo de capital da empresa unlevered. Equivalente ao WACC quando D = 0.',
          long: 'É a referência horizontal nos gráficos: se a Trade-off Theory funcionasse perfeitamente, o WACC mínimo seria abaixo de r_A. Para Curval com defaults: r_A = 2.8% + 1.03 × 5.78% = 8.75%.'
        },
      ]
    },
    {
      id: 'tax',
      title: 'IRC · Fiscalidade PME Portugal',
      icon: '💼',
      items: [
        {
          term: 'IRC PME (Taxa Reduzida)',
          formula: '17% até €25k (2020–22) ou €50k (2023+)',
          short: 'PME beneficiam de taxa reduzida sobre os primeiros €25k ou €50k de matéria colectável (depende do ano).',
          long: 'OE/2023 duplicou o threshold de €25k para €50k. O resto da matéria colectável é tributado à taxa normal de 21%, mais Derrama Municipal até 1.5%. Para Curval, a maior parte da matéria colectável cai na banda reduzida (RAI tipicamente entre 20k e 100k€).'
        },
        {
          term: 'Taxa Estatutária (Year-aware)',
          formula: '(IRC + Derrama) / RAI',
          short: 'Taxa efectiva legal para o RAI específico, usando os thresholds correctos do ano.',
          long: 'Para Curval: 22.0% (2020), 18.5% (2021-22), 20.0% (2023), 20.4% (2024). Esta é a taxa correcta a usar para análise económica retrospectiva — reflecte a fiscalidade real aplicada.'
        },
        {
          term: 'Taxa Marginal',
          formula: '21% + 1.5% Derrama = 22.5%',
          short: 'Taxa sobre €1 adicional de lucro acima do threshold da banda reduzida.',
          long: 'É a taxa correcta para análise marginal de Trade-off: ao avaliar se vale a pena emitir mais €1 de dívida (e gerar t × €1 de tax shield), é a taxa marginal que conta — não a taxa média. Por isso é o default recomendado para o modelo.'
        },
        {
          term: 'Tax Shield (Escudo Fiscal)',
          formula: 'PV(TS) = t × D',
          short: 'Valor presente da poupança fiscal gerada pela dedução fiscal dos juros.',
          long: 'Cada €1 de juros pago reduz a matéria colectável em €1, poupando t × €1 em IRC. Como assumimos dívida perpétua, o valor presente da sequência infinita é simplesmente t × D. É a única vantagem da dívida sobre o equity no modelo Trade-off.'
        },
        {
          term: 'Derrama Municipal',
          formula: 'Até 1.5% × Lucro Tributável',
          short: 'Imposto autárquico sobre o lucro, definido por cada município anualmente.',
          long: 'Tecto legal: 1.5%. Maioria das câmaras aplica o máximo. PME com VN < 150k€ frequentemente isentas. No artefacto assume-se 1.5% para todos os anos.'
        },
        {
          term: 'Derrama Estadual',
          formula: '3% se LT > €1.5M · 5% se > €7.5M · 9% se > €35M',
          short: 'Sobretaxa progressiva sobre lucros tributáveis elevados. Não aplica a Curval.',
          long: 'Apenas relevante para grandes empresas. Curval (RAI < 100k€) está muito abaixo do primeiro escalão.'
        },
      ]
    },
    {
      id: 'distress',
      title: 'Financial Distress',
      icon: '⚠',
      items: [
        {
          term: 'Threshold (θ)',
          formula: 'D/E onde os custos começam',
          short: 'Nível de alavancagem a partir do qual os custos esperados de distress se tornam materiais.',
          long: 'Parametrização sectorial. PME industrial portuguesa: θ ≈ 0.3–0.4 (mais conservador que o default académico de 0.6). Sectores menos cíclicos podem suportar θ mais elevado. Não é directamente observável — é calibrado para que o modelo reproduza o WACC reportado.'
        },
        {
          term: 'Convexidade (β)',
          formula: 'distress ∝ (D/E − θ)^β',
          short: 'Expoente que controla quão abruptamente os custos crescem além do threshold.',
          long: 'β = 2 → crescimento quadrático. β > 2 → crescimento mais abrupto (típico de PME sem acesso a refinanciamento alternativo). β < 2 → empresa tem maior capacidade de absorver stress (mais comum em large-caps).'
        },
        {
          term: 'Magnitude (α)',
          formula: 'Multiplicador dos custos esperados',
          short: 'Calibração da escala dos custos de distress.',
          long: 'Combina probabilidade de distress com perda esperada condicional. α alto significa ou alta probabilidade de distress ou alto custo se ocorrer. Para PME com activos específicos pouco redeployable (como equipamento metalomecânico especializado), α é tipicamente alto.'
        },
        {
          term: 'Custos Directos de Distress',
          formula: 'Honorários, multas, perdas em fire-sale',
          short: 'Custos contabilísticos de uma situação de incumprimento ou falência.',
          long: 'Tipicamente 3-5% do valor da empresa em casos de bancarrota. Inclui honorários de advogados, administradores judiciais, perdas em vendas forçadas de activos.'
        },
        {
          term: 'Custos Indirectos de Distress',
          formula: 'Perda de clientes, fornecedores, talento',
          short: 'Erosão do valor do negócio antes mesmo de a falência ocorrer.',
          long: 'Maiores que os directos: 10-25% do valor da empresa. Clientes preocupam-se com garantias e SAV; fornecedores exigem pré-pagamento; melhores quadros saem; concorrentes aproveitam para captar quota. É o custo que verdadeiramente limita a alavancagem para empresas industriais.'
        },
      ]
    },
    {
      id: 'normalization',
      title: 'Decisões de Normalização',
      icon: '🔧',
      items: [
        {
          term: 'EBIT — Ano vs. Média 5Y',
          formula: 'EBIT_used = EBIT_t  OU  Σ EBIT_i / 5',
          short: 'Escolha entre usar o EBIT do ano específico ou a média dos últimos 5 anos.',
          long: 'EBIT do ano captura realidade actual mas é volátil em PME (Curval: 220k em 2020, 36k em 2022). Média 5Y dá visão de capacidade normalizada (~104k para Curval). Para análise de capital structure, a média é defensável porque a dívida é decisão de longo prazo, não táctica anual.'
        },
        {
          term: 'Dívida Bruta vs. Líquida',
          formula: 'Bruta = Empréstimos  ·  Líquida = Bruta − Caixa',
          short: 'Dívida líquida deduz a caixa disponível, reflectindo melhor o endividamento real.',
          long: 'Para Curval 2024: bruta = 368k€; mas com 263k€ em caixa, a líquida é apenas 105k€. Em rigor económico, dívida líquida é mais correcta — caixa disponível pode ser usada para amortizar. Mas covenants bancários e taxa Kd referem-se à bruta.'
        },
        {
          term: 'Outliers Fiscais (2021/2022)',
          formula: 'tEff > 50% = artefacto contabilístico',
          short: 'Anos com taxa efectiva irrealisticamente alta devido a correcções não-recorrentes.',
          long: 'Em 2021 e 2022, Curval reporta taxa efectiva de 75% e 71% respectivamente. Isto deve-se provavelmente a correcções fiscais de exercícios anteriores ou tributação autónoma elevada (viaturas, representação) com base tributável baixa. Estas taxas não são representativas da fiscalidade marginal — usar Estatutária ou Marginal nestes anos.'
        },
      ]
    },
  ];

  const [openSection, setOpenSection] = useState('theory');

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Intro */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.gold}`, padding: '20px 24px', marginBottom: 24, borderRadius: 4 }}>
        <h2 style={{ fontFamily: font.serif, fontSize: 18, color: C.navy, margin: '0 0 8px 0', fontWeight: 700 }}>
          Glossário de termos · estrutura de capital
        </h2>
        <p style={{ fontFamily: font.serif, fontSize: 13.5, color: C.ink, lineHeight: 1.65, margin: 0 }}>
          Todos os conceitos, fórmulas e parâmetros utilizados na ferramenta de análise. Clica em cada secção para expandir. Cada termo inclui a fórmula matemática, uma definição curta e uma explicação detalhada com contexto aplicado à Curval.
        </p>
      </div>

      {/* Section navigator */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setOpenSection(s.id)}
            style={{
              padding: '12px 14px',
              background: openSection === s.id ? C.navy : C.surface,
              color: openSection === s.id ? 'white' : C.ink,
              border: openSection === s.id ? `1px solid ${C.navy}` : `1px solid ${C.line}`,
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: font.sans,
              fontSize: 11,
              fontWeight: 600,
              textAlign: 'left',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.3 }}>{s.title}</span>
          </button>
        ))}
      </div>

      {/* Active section content */}
      {sections.filter(s => s.id === openSection).map(section => (
        <div key={section.id}>
          <h3 style={{ fontFamily: font.serif, fontSize: 22, color: C.navy, margin: '0 0 18px 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{section.icon}</span>
            <span>{section.title}</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
            {section.items.map((item, i) => (
              <div key={i} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 5, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
                {/* Term name */}
                <div style={{ fontFamily: font.serif, fontSize: 15, color: C.navy, fontWeight: 700, marginBottom: 6 }}>
                  {item.term}
                </div>

                {/* Formula */}
                <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 3, padding: '8px 12px', marginBottom: 10, fontFamily: font.mono, fontSize: 11.5, color: C.gold, ...tabNums, fontWeight: 600 }}>
                  {item.formula}
                </div>

                {/* Short definition */}
                <p style={{ fontFamily: font.serif, fontSize: 12.5, color: C.ink, lineHeight: 1.55, margin: '0 0 10px 0', fontWeight: 500 }}>
                  {item.short}
                </p>

                {/* Long explanation */}
                <p style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                  {item.long}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Footer note */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: C.paper, border: `1px dashed ${C.lineDark}`, borderRadius: 4, fontFamily: font.sans, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        <strong style={{ color: C.ink }}>Bibliografia essencial</strong> · Modigliani &amp; Miller (1958, 1963) · Myers &amp; Majluf (1984) · Hamada (1972) · Damodaran <em>Investment Valuation</em> · Brealey, Myers &amp; Allen <em>Principles of Corporate Finance</em>.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STRESS TEST VIEW
// Replicates the Excel "Stress Test TRABALHO" sheet logic with charts
// ═══════════════════════════════════════════════════════════════════════
function StressTest({ C, font, tabNums, curvalHist, EBIT_5Y_AVG, IRC_BY_YEAR }) {
  // Curval 2024 baseline (from Excel "Cenarios e Escudos Fiscais")
  const baseline = {
    EBITDA: 269858,
    DA: 152720,           // D&A 2024
    EBIT: 117138,
    juros2024: 20119,
    Equity: 1992126,
    DebtTotal: 368300,
    Cash: 263348,
    NetDebt: 104952,
    V: 2360425,           // Total financing
    CFO_3Y: 192100,       // CFO normalizado 2022-2024
    Kd_atual: 0.0478,
    t: 0.291,             // efectivo 2024
    sensCFO: 0.75,        // sensibilidade CFO a EBITDA (input do Excel)
  };

  // Coverage / leverage thresholds
  const T = {
    coverHealthy: 5.0,
    coverWarn:    3.0,
    NDEBITDAhealthy: 2.0,
    NDEBITDAwarn:    3.5,
    CFODebtHealthy: 0.50,
    CFODebtWarn:    0.25,
  };

  // [Stress slider] EBITDA shock and interest rate shock
  const [ebitdaShock, setEbitdaShock] = useState(0); // 0 = base, -10, -20, -30
  const [rateShock, setRateShock] = useState(0);     // 0, +100bps, +200bps, +300bps
  const [showLevels, setShowLevels] = useState('both'); // 'actual' | 'optimal' | 'both' | 'all'

  // ═══ Run all scenarios across multiple D/V levels ═══
  const dvLevels = [
    { dv: 0.156, label: '15.6% (Actual)', isActual: true },
    { dv: 0.20,  label: '20% (Conservador)', isOptimal: true },
    { dv: 0.30,  label: '30% (Alargado)' },
    { dv: 0.40,  label: '40% (Transição)' },
    { dv: 0.50,  label: '50% (Distress)' },
    { dv: 0.60,  label: '60% (Perigo)' },
  ];

  // Kd progressive curve (matches Excel: 4.78% < 20%, 5.5% < 30%, 6.5% < 40%, 8% < 50%, 10% > 50%)
  function getKd(dv) {
    if (dv <= 0.20) return 0.0478;
    if (dv <= 0.30) return 0.055;
    if (dv <= 0.40) return 0.065;
    if (dv <= 0.50) return 0.08;
    return 0.10;
  }

  // ═══ Compute scenario results ═══
  const scenarios = useMemo(() => {
    return dvLevels.map(level => {
      const D = baseline.V * level.dv;
      const Kd_base = getKd(level.dv);
      const Kd_eff = Kd_base + rateShock / 10000; // bps to decimal
      const EBITDA_eff = baseline.EBITDA * (1 + ebitdaShock / 100);
      const juros = D * Kd_eff;
      const RAI = EBITDA_eff - baseline.DA - juros;
      // CFO scales with EBITDA via sensitivity factor (consistent with Excel B16 logic)
      const CFO = baseline.CFO_3Y * (1 + (ebitdaShock / 100) * baseline.sensCFO);
      const coverEBITDAjuros = EBITDA_eff / juros;
      const NDovEBITDA = (D - baseline.Cash) / EBITDA_eff;
      const CFOoverDebt = CFO / D;
      const taxShieldUtil = RAI > 0;

      // Classification (replicates Excel L-column logic)
      let status;
      if (coverEBITDAjuros >= T.coverHealthy && NDovEBITDA <= T.NDEBITDAhealthy
          && CFOoverDebt >= T.CFODebtHealthy && RAI > 0) {
        status = 'SAUDAVEL';
      } else if (coverEBITDAjuros >= T.coverWarn && NDovEBITDA <= T.NDEBITDAwarn
          && CFOoverDebt >= T.CFODebtWarn && RAI >= 0) {
        status = 'ATENCAO';
      } else {
        status = 'DISTRESS';
      }

      return {
        ...level,
        D, Kd_eff, EBITDA: EBITDA_eff, juros, RAI, CFO,
        coverEBITDAjuros, NDovEBITDA, CFOoverDebt, taxShieldUtil, status,
      };
    });
  }, [ebitdaShock, rateShock]);

  // Filter scenarios for chart display
  const displayScenarios = useMemo(() => {
    if (showLevels === 'actual') return scenarios.filter(s => s.isActual);
    if (showLevels === 'optimal') return scenarios.filter(s => s.isActual || s.isOptimal);
    if (showLevels === 'both') return scenarios.slice(0, 4);
    return scenarios;
  }, [scenarios, showLevels]);

  // ═══ Color map for status ═══
  const statusColor = {
    'SAUDAVEL': C.green,
    'ATENCAO':  C.amber,
    'DISTRESS': C.red,
  };
  const statusBg = {
    'SAUDAVEL': C.greenTint,
    'ATENCAO':  C.amberTint,
    'DISTRESS': C.redTint,
  };

  // Format helpers
  const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
  const fmtX = (v) => `${v.toFixed(2)}x`;
  const fmtK = (v) => `${(v / 1000).toFixed(0)}k€`;

  // Robust scenario for actual position (track to highlight)
  const actualScenario = scenarios.find(s => s.isActual);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* ═══ Intro ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.red}`, padding: '20px 24px', marginBottom: 24, borderRadius: 4 }}>
        <h2 style={{ fontFamily: font.serif, fontSize: 18, color: C.navy, margin: '0 0 8px 0', fontWeight: 700 }}>
          Stress Test · resistência da estrutura de capital
        </h2>
        <p style={{ fontFamily: font.serif, fontSize: 13.5, color: C.ink, lineHeight: 1.65, margin: 0 }}>
          Avalia como a estrutura de capital da Curval reage a choques económicos: <strong>contracção do EBITDA</strong> (recessão, perda de cliente-chave, pressão competitiva) e <strong>subida das taxas de juro</strong> (aperto monetário). Cada nível de alavancagem é testado contra três métricas de robustez bancária (cobertura de juros, dívida líquida sobre EBITDA, CFO sobre dívida).
        </p>
      </div>

      {/* ═══ Shock controls ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 18, borderRadius: 4, marginBottom: 24 }}>
        <div style={{ fontFamily: font.serif, fontSize: 14, color: C.navy, fontWeight: 700, marginBottom: 14 }}>
          Configurar choques
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
          {/* EBITDA shock */}
          <div>
            <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              Choque ao EBITDA
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 2 }}>
              {[0, -10, -20, -30].map(v => (
                <button key={v} onClick={() => setEbitdaShock(v)}
                  style={{
                    flex: 1, padding: '8px 6px', border: 'none',
                    background: ebitdaShock === v ? C.navy : 'transparent',
                    color: ebitdaShock === v ? 'white' : C.ink,
                    fontFamily: font.mono, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', borderRadius: 3, ...tabNums,
                  }}>
                  {v === 0 ? 'Base' : `${v}%`}
                </button>
              ))}
            </div>
          </div>
          {/* Interest rate shock */}
          <div>
            <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              Choque às taxas de juro
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 2 }}>
              {[0, 100, 200, 300].map(v => (
                <button key={v} onClick={() => setRateShock(v)}
                  style={{
                    flex: 1, padding: '8px 6px', border: 'none',
                    background: rateShock === v ? C.navy : 'transparent',
                    color: rateShock === v ? 'white' : C.ink,
                    fontFamily: font.mono, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', borderRadius: 3, ...tabNums,
                  }}>
                  {v === 0 ? 'Base' : `+${v}bps`}
                </button>
              ))}
            </div>
          </div>
          {/* Levels to display */}
          <div>
            <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600 }}>
              Níveis a comparar
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 2 }}>
              {[
                { v: 'actual',  label: 'Só actual' },
                { v: 'optimal', label: 'Actual + Óptimo' },
                { v: 'both',    label: 'Conservador' },
                { v: 'all',     label: 'Todos' },
              ].map(opt => (
                <button key={opt.v} onClick={() => setShowLevels(opt.v)}
                  style={{
                    flex: 1, padding: '8px 4px', border: 'none',
                    background: showLevels === opt.v ? C.navy : 'transparent',
                    color: showLevels === opt.v ? 'white' : C.ink,
                    fontFamily: font.sans, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', borderRadius: 3,
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Hero KPIs (current scenario at actual leverage) ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: statusBg[actualScenario.status], border: `1px solid ${statusColor[actualScenario.status]}`, borderLeft: `4px solid ${statusColor[actualScenario.status]}`, padding: '14px 16px', borderRadius: 4 }}>
          <div style={{ fontFamily: font.sans, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
            Estado · Curval Actual
          </div>
          <div style={{ fontFamily: font.serif, fontSize: 20, fontWeight: 700, color: statusColor[actualScenario.status] }}>
            {actualScenario.status}
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, fontStyle: 'italic', marginTop: 3 }}>
            D/V = {fmtPct(actualScenario.dv)} · choques aplicados
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${actualScenario.coverEBITDAjuros >= T.coverWarn ? C.green : C.red}`, padding: '14px 16px', borderRadius: 4 }}>
          <div style={{ fontFamily: font.sans, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
            Cobertura juros
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 600, color: C.ink, ...tabNums }}>
            {fmtX(actualScenario.coverEBITDAjuros)}
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, fontStyle: 'italic', marginTop: 3 }}>
            Threshold: ≥ {T.coverWarn.toFixed(1)}x (banco)
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${actualScenario.NDovEBITDA <= T.NDEBITDAwarn ? C.green : C.red}`, padding: '14px 16px', borderRadius: 4 }}>
          <div style={{ fontFamily: font.sans, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
            ND / EBITDA
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 600, color: C.ink, ...tabNums }}>
            {fmtX(actualScenario.NDovEBITDA)}
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, fontStyle: 'italic', marginTop: 3 }}>
            Threshold: ≤ {T.NDEBITDAwarn.toFixed(1)}x
          </div>
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${actualScenario.CFOoverDebt >= T.CFODebtWarn ? C.green : C.red}`, padding: '14px 16px', borderRadius: 4 }}>
          <div style={{ fontFamily: font.sans, fontSize: 9.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 4 }}>
            CFO / Dívida
          </div>
          <div style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 600, color: C.ink, ...tabNums }}>
            {fmtPct(actualScenario.CFOoverDebt)}
          </div>
          <div style={{ fontFamily: font.sans, fontSize: 10.5, color: C.muted, fontStyle: 'italic', marginTop: 3 }}>
            Threshold: ≥ {fmtPct(T.CFODebtWarn)} (CFO 3Y)
          </div>
        </div>
      </div>

      {/* ═══ Chart 1: Coverage ratio across scenarios ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 20, borderRadius: 4, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: font.serif, fontSize: 16, color: C.navy, margin: '0 0 4px 0', fontWeight: 700 }}>
            Cobertura de Juros · EBITDA / Juros
          </h3>
          <div style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
            Verde {'>'}5x · Amarelo 3-5x · Vermelho {'<'}3x (covenant bancário típico)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={displayScenarios.map(s => ({
            label: s.label.split(' ')[0],
            cobertura: Number(s.coverEBITDAjuros.toFixed(2)),
            status: s.status,
          }))} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}>
            <CartesianGrid strokeDasharray="1 3" stroke={C.line} />
            <XAxis dataKey="label" tick={{ fontFamily: font.mono, fontSize: 11, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'Nível D/V', position: 'insideBottom', offset: -14, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <YAxis tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'Cobertura (x)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <Tooltip
              formatter={(value, name) => [`${value}x`, 'Cobertura']}
              contentStyle={{ background: 'white', border: `1px solid ${C.lineDark}`, borderRadius: 4, fontFamily: font.sans, fontSize: 12 }}
            />
            <ReferenceLine y={T.coverHealthy} stroke={C.green} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Saudável ≥ 5x', position: 'right', fill: C.green, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <ReferenceLine y={T.coverWarn} stroke={C.red} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Critico < 3x', position: 'right', fill: C.red, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <Bar dataKey="cobertura" radius={[4, 4, 0, 0]}>
              {displayScenarios.map((s, i) => (
                <Cell key={i} fill={statusColor[s.status]} fillOpacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ Chart 2: ND/EBITDA across scenarios ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 20, borderRadius: 4, marginBottom: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: font.serif, fontSize: 16, color: C.navy, margin: '0 0 4px 0', fontWeight: 700 }}>
            Alavancagem · Dívida Líquida / EBITDA
          </h3>
          <div style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
            Verde {'<'}2x · Amarelo 2-3.5x · Vermelho {'>'}3.5x (limite covenant)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={displayScenarios.map(s => ({
            label: s.label.split(' ')[0],
            ndEbitda: Number(s.NDovEBITDA.toFixed(2)),
            status: s.status,
          }))} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}>
            <CartesianGrid strokeDasharray="1 3" stroke={C.line} />
            <XAxis dataKey="label" tick={{ fontFamily: font.mono, fontSize: 11, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'Nível D/V', position: 'insideBottom', offset: -14, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <YAxis tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'ND/EBITDA (x)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <Tooltip
              formatter={(value) => [`${value}x`, 'ND/EBITDA']}
              contentStyle={{ background: 'white', border: `1px solid ${C.lineDark}`, borderRadius: 4, fontFamily: font.sans, fontSize: 12 }}
            />
            <ReferenceLine y={T.NDEBITDAhealthy} stroke={C.green} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Saudável ≤ 2x', position: 'right', fill: C.green, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <ReferenceLine y={T.NDEBITDAwarn} stroke={C.red} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Critico > 3.5x', position: 'right', fill: C.red, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <Bar dataKey="ndEbitda" radius={[4, 4, 0, 0]}>
              {displayScenarios.map((s, i) => (
                <Cell key={i} fill={statusColor[s.status]} fillOpacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ Chart 3: CFO/Debt ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 20, borderRadius: 4, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: font.serif, fontSize: 16, color: C.navy, margin: '0 0 4px 0', fontWeight: 700 }}>
            Capacidade de Repagamento · CFO / Dívida
          </h3>
          <div style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
            Verde ≥ 50% · Amarelo 25-50% · Vermelho {'<'} 25% (CFO normalizado 3Y)
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={displayScenarios.map(s => ({
            label: s.label.split(' ')[0],
            cfoDebt: Number((s.CFOoverDebt * 100).toFixed(1)),
            status: s.status,
          }))} margin={{ top: 10, right: 20, left: 10, bottom: 28 }}>
            <CartesianGrid strokeDasharray="1 3" stroke={C.line} />
            <XAxis dataKey="label" tick={{ fontFamily: font.mono, fontSize: 11, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'Nível D/V', position: 'insideBottom', offset: -14, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <YAxis tick={{ fontFamily: font.mono, fontSize: 10.5, fill: C.muted }}
                   tickLine={{ stroke: C.line }} axisLine={{ stroke: C.lineDark }}
                   label={{ value: 'CFO / Dívida (%)', angle: -90, position: 'insideLeft', offset: 8, style: { fill: C.ink, fontFamily: font.sans, fontSize: 11, fontWeight: 500 } }} />
            <Tooltip
              formatter={(value) => [`${value}%`, 'CFO/Dívida']}
              contentStyle={{ background: 'white', border: `1px solid ${C.lineDark}`, borderRadius: 4, fontFamily: font.sans, fontSize: 12 }}
            />
            <ReferenceLine y={T.CFODebtHealthy * 100} stroke={C.green} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Saudável ≥ 50%', position: 'right', fill: C.green, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <ReferenceLine y={T.CFODebtWarn * 100} stroke={C.red} strokeDasharray="3 4" strokeWidth={1.2}
                           label={{ value: 'Critico < 25%', position: 'right', fill: C.red, fontSize: 10, fontFamily: 'sans-serif', fontWeight: 600 }} />
            <Bar dataKey="cfoDebt" radius={[4, 4, 0, 0]}>
              {displayScenarios.map((s, i) => (
                <Cell key={i} fill={statusColor[s.status]} fillOpacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ═══ Robustness Matrix Table ═══ */}
      <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 20, borderRadius: 4, marginBottom: 24 }}>
        <h3 style={{ fontFamily: font.serif, fontSize: 16, color: C.navy, margin: '0 0 4px 0', fontWeight: 700 }}>
          Matriz de Robustez · classificação por nível e métrica
        </h3>
        <div style={{ fontFamily: font.serif, fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 14 }}>
          Estado de cada nível D/V sob os choques aplicados (EBITDA {ebitdaShock === 0 ? 'base' : `${ebitdaShock}%`}, taxa {rateShock === 0 ? 'base' : `+${rateShock}bps`})
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.sans, fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.lineDark}` }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nível D/V</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dívida</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Juros</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cobertura</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ND/EBITDA</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>CFO/Div</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>RAI{'>'}0</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', color: C.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => (
                <tr key={i} style={{ borderBottom: `1px dotted ${C.line}`, background: s.isActual ? C.blueTint : 'transparent' }}>
                  <td style={{ padding: '8px', fontWeight: s.isActual ? 700 : 500, color: C.ink }}>
                    {s.label}{s.isActual && <span style={{ color: C.blue, marginLeft: 6, fontSize: 9, fontWeight: 700 }}>← CURVAL</span>}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: font.mono, ...tabNums, color: C.ink }}>{fmtK(s.D)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: font.mono, ...tabNums, color: C.ink }}>{fmtK(s.juros)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: font.mono, ...tabNums, fontWeight: 600, color: s.coverEBITDAjuros >= T.coverWarn ? C.green : C.red }}>{fmtX(s.coverEBITDAjuros)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: font.mono, ...tabNums, fontWeight: 600, color: s.NDovEBITDA <= T.NDEBITDAwarn ? C.green : C.red }}>{fmtX(s.NDovEBITDA)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontFamily: font.mono, ...tabNums, fontWeight: 600, color: s.CFOoverDebt >= T.CFODebtWarn ? C.green : C.red }}>{fmtPct(s.CFOoverDebt)}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: s.RAI > 0 ? C.green : C.red, fontSize: 11 }}>
                    {s.RAI > 0 ? '✓' : '✗'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 3,
                      background: statusBg[s.status], color: statusColor[s.status],
                      fontFamily: font.sans, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Reading & methodology ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.greenTint, padding: 20, borderRadius: 4, borderTop: `3px solid ${C.green}` }}>
          <h4 style={{ fontFamily: font.serif, fontSize: 14, fontWeight: 700, color: C.navy, margin: '0 0 10px 0' }}>
            ✓ Leitura para a Curval
          </h4>
          <p style={{ fontFamily: font.serif, fontSize: 12.5, color: C.ink, lineHeight: 1.6, margin: 0 }}>
            Curval mantém estado <strong style={{ color: statusColor[actualScenario.status] }}>{actualScenario.status}</strong> mesmo com choques aplicados. A posição actual (D/V {fmtPct(actualScenario.dv)}) tem buffer significativo: cobertura de juros {fmtX(actualScenario.coverEBITDAjuros)} (vs. mínimo {T.coverWarn.toFixed(1)}x), ND/EBITDA {fmtX(actualScenario.NDovEBITDA)} (vs. limite {T.NDEBITDAwarn.toFixed(1)}x). A baixa alavancagem actual é o que torna a empresa robusta a choques.
          </p>
        </div>
        <div style={{ background: C.amberTint, padding: 20, borderRadius: 4, borderTop: `3px solid ${C.amber}` }}>
          <h4 style={{ fontFamily: font.serif, fontSize: 14, fontWeight: 700, color: C.navy, margin: '0 0 10px 0' }}>
            ⚠ Onde a estrutura quebra
          </h4>
          <p style={{ fontFamily: font.serif, fontSize: 12.5, color: C.ink, lineHeight: 1.6, margin: 0 }}>
            Acima de D/V = 30%, mesmo no cenário base, a Curval entra em zona ATENCAO ou DISTRESS. O <em>binding constraint</em> é o CFO/Dívida — a empresa gera fluxo de caixa demasiado modesto para suportar dívida significativamente maior. Subir alavancagem para 40%+ implica risco material em caso de recessão moderada.
          </p>
        </div>
      </div>

      {/* ═══ Methodology footer ═══ */}
      <div style={{ background: C.paper, border: `1px dashed ${C.lineDark}`, padding: '14px 18px', borderRadius: 4 }}>
        <div style={{ fontFamily: font.sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 6 }}>
          Metodologia
        </div>
        <div style={{ fontFamily: font.sans, fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
          <strong style={{ color: C.ink }}>Inputs base 2024:</strong> EBITDA {fmtK(baseline.EBITDA)} · D&amp;A {fmtK(baseline.DA)} · CFO 3Y {fmtK(baseline.CFO_3Y)} · Caixa {fmtK(baseline.Cash)} · V {fmtK(baseline.V)} · t = {fmtPct(baseline.t)}.
          <br />
          <strong style={{ color: C.ink }}>Kd progressivo:</strong> 4.78% (D/V ≤ 20%) · 5.5% (≤ 30%) · 6.5% (≤ 40%) · 8% (≤ 50%) · 10% ({'>'}50%) — reflecte spread de crédito por nível de alavancagem.
          <br />
          <strong style={{ color: C.ink }}>CFO sob choque:</strong> sensibilidade de 0.75 (75% do choque ao EBITDA propaga ao CFO), reflectindo working capital absorvendo parte do impacto.
          <br />
          <strong style={{ color: C.ink }}>Classificação:</strong> SAUDÁVEL exige cobertura ≥ 5x AND ND/EBITDA ≤ 2x AND CFO/Dívida ≥ 50% AND RAI {'>'} 0. ATENÇÃO requer thresholds mais frouxos (3x / 3.5x / 25%). Caso contrário: DISTRESS.
        </div>
      </div>
    </div>
  );
}
