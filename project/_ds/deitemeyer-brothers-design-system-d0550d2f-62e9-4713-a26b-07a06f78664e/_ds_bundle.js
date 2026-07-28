/* @ds-bundle: {"format":4,"namespace":"DeitemeyerBrothersDesignSystem_d0550d","components":[{"name":"Badge","sourcePath":"components/content/Badge.jsx"},{"name":"Card","sourcePath":"components/content/Card.jsx"},{"name":"ServiceCard","sourcePath":"components/content/ServiceCard.jsx"},{"name":"Stat","sourcePath":"components/content/Stat.jsx"},{"name":"Testimonial","sourcePath":"components/content/Testimonial.jsx"},{"name":"Callout","sourcePath":"components/data/Callout.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"KpiBanner","sourcePath":"components/data/KpiBanner.jsx"},{"name":"MetricStrip","sourcePath":"components/data/MetricStrip.jsx"},{"name":"MonoLabel","sourcePath":"components/data/MonoLabel.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"AppTile","sourcePath":"components/layout/AppTile.jsx"},{"name":"PanelHeader","sourcePath":"components/layout/PanelHeader.jsx"},{"name":"SectionHeader","sourcePath":"components/layout/SectionHeader.jsx"},{"name":"SideNav","sourcePath":"components/layout/SideNav.jsx"},{"name":"TabBar","sourcePath":"components/layout/TabBar.jsx"}],"sourceHashes":{"components/content/Badge.jsx":"5c95fbb0602f","components/content/Card.jsx":"98dcc4c56759","components/content/ServiceCard.jsx":"31cd7e72cc66","components/content/Stat.jsx":"f8c9d30f540a","components/content/Testimonial.jsx":"e87c88c7a0e9","components/data/Callout.jsx":"59dc38e48c2c","components/data/DataTable.jsx":"552751e66fdb","components/data/KpiBanner.jsx":"b0f738edcf42","components/data/MetricStrip.jsx":"5782bcb27e51","components/data/MonoLabel.jsx":"d5cbe1afb739","components/forms/Button.jsx":"a1f05f5a75b8","components/forms/Checkbox.jsx":"dbbdc287b22e","components/forms/IconButton.jsx":"2a207613af52","components/forms/Input.jsx":"c5edde788537","components/forms/Select.jsx":"be53713666c1","components/layout/AppTile.jsx":"ec96ca9ac382","components/layout/PanelHeader.jsx":"11efd87985e7","components/layout/SectionHeader.jsx":"289aa20a87b7","components/layout/SideNav.jsx":"7920b6ea9509","components/layout/TabBar.jsx":"6e8397ce18a0","ui_kits/website/EstimateModal.jsx":"971fe941145c","ui_kits/website/Header.jsx":"d8ee170be39b","ui_kits/website/Hero.jsx":"8f58836b7b7d","ui_kits/website/Reviews.jsx":"6c0198f02473","ui_kits/website/Services.jsx":"4b03ac2b1a45","ui_kits/website/WhyUs.jsx":"62bb02ba5ba7","ui_kits/website/parts.jsx":"565d810d85c3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DeitemeyerBrothersDesignSystem_d0550d = window.DeitemeyerBrothersDesignSystem_d0550d || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/content/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — small uppercase mono tag. The system's status vocabulary:
 * LIVE, IN BUILD, PLANNED, OFFICE, ANNOTATED, +58.9% VS GOAL.
 * Square-ish by default; `pill` for delta chips sitting inside a metric.
 */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  shape = 'square',
  dot = false,
  ...rest
}) {
  const tones = {
    green: {
      soft: ['var(--green-100)', 'var(--green-800)'],
      solid: ['var(--green-500)', 'var(--ink-900)'],
      outline: ['transparent', 'var(--green-700)'],
      'on-dark': ['rgba(60,200,74,0.16)', 'var(--green-300)']
    },
    navy: {
      soft: ['var(--navy-100)', 'var(--navy-800)'],
      solid: ['var(--navy-700)', 'var(--white)'],
      outline: ['transparent', 'var(--navy-700)'],
      'on-dark': ['rgba(123,164,221,0.18)', 'var(--navy-200)']
    },
    neutral: {
      soft: ['var(--slate-100)', 'var(--ink-700)'],
      solid: ['var(--ink-800)', 'var(--white)'],
      outline: ['transparent', 'var(--ink-600)'],
      'on-dark': ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.72)']
    },
    warm: {
      soft: ['var(--warm-100)', 'var(--warm-500)'],
      solid: ['var(--warm-500)', 'var(--white)'],
      outline: ['transparent', 'var(--warm-500)'],
      'on-dark': ['rgba(255,255,255,0.1)', 'var(--warm-300)']
    },
    warning: {
      soft: ['var(--status-warning-soft)', 'var(--status-warning)'],
      solid: ['var(--status-warning)', 'var(--white)'],
      outline: ['transparent', 'var(--status-warning)'],
      'on-dark': ['rgba(181,137,42,0.22)', '#f0cd82']
    },
    danger: {
      soft: ['var(--status-danger-soft)', 'var(--status-danger)'],
      solid: ['var(--status-danger)', 'var(--white)'],
      outline: ['transparent', 'var(--status-danger)'],
      'on-dark': ['rgba(192,57,43,0.24)', '#f3a49b']
    }
  };
  const set = tones[tone] || tones.neutral;
  const [bg, fg] = set[variant] || set.soft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-label)',
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: 'var(--ls-tag)',
      textTransform: 'uppercase',
      lineHeight: 1,
      padding: shape === 'pill' ? '5px 10px' : '4px 8px',
      borderRadius: shape === 'pill' ? 'var(--radius-pill)' : 'var(--radius-xs)',
      background: bg,
      color: fg,
      border: variant === 'outline' ? `1.5px solid ${fg}` : '1.5px solid transparent',
      whiteSpace: 'nowrap'
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor',
      flexShrink: 0
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Badge.jsx", error: String((e && e.message) || e) }); }

// components/content/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Card — clean white surface with hairline border and restrained shadow.
 * The workhorse container. Subtle rounding, never neon glow.
 */
function Card({
  children,
  elevation = 'sm',
  accentTop = false,
  padding = 24,
  style,
  ...rest
}) {
  const shadows = {
    flat: 'none',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderTop: accentTop ? '3px solid var(--navy-700)' : '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: shadows[elevation] || shadows.sm,
      padding,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Card.jsx", error: String((e && e.message) || e) }); }

// components/content/ServiceCard.jsx
try { (() => {
/**
 * ServiceCard — icon + title + description tile for services/offerings.
 * Icon sits in a navy-tinted square. Hover raises the card.
 */
function ServiceCard({
  icon,
  title,
  description,
  href,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    role: onClick || href ? 'button' : undefined,
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      padding: '28px 26px',
      cursor: onClick || href ? 'pointer' : 'default',
      boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transform: hover ? 'translateY(-3px)' : 'none',
      transition: 'transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)'
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--radius-md)',
      background: 'var(--navy-100)',
      color: 'var(--navy-700)',
      display: 'grid',
      placeItems: 'center',
      marginBottom: 18
    }
  }, icon), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: 20,
      fontWeight: 600,
      margin: '0 0 8px',
      color: 'var(--ink-900)',
      letterSpacing: '0.01em'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15.5,
      color: 'var(--text-muted)',
      lineHeight: 1.55
    }
  }, description));
}
Object.assign(__ds_scope, { ServiceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/ServiceCard.jsx", error: String((e && e.message) || e) }); }

// components/content/Stat.jsx
try { (() => {
/**
 * Stat — one metric: big tabular figure, mono caption, optional delta chip.
 * Works on light surfaces and inside a dark MetricStrip (`tone="dark"`).
 */
function Stat({
  value,
  label,
  sublabel,
  delta,
  tone = 'light',
  size = 'md',
  align = 'left'
}) {
  const sizes = {
    sm: 'var(--fs-metric-sm)',
    md: 'var(--fs-metric)',
    lg: 'var(--fs-metric-xl)'
  };
  const onDark = tone === 'dark';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: align,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-figures",
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: sizes[size] || sizes.md,
      lineHeight: 1,
      letterSpacing: 'var(--ls-metric)',
      color: onDark ? 'var(--white)' : 'var(--ink-900)'
    }
  }, value), delta), label && /*#__PURE__*/React.createElement("div", {
    className: onDark ? 'db-label db-label--on-dark' : 'db-label',
    style: {
      fontSize: 'var(--fs-label)',
      marginTop: 10
    }
  }, label), sublabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-body-sm)',
      marginTop: 6,
      color: onDark ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'
    }
  }, sublabel));
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Stat.jsx", error: String((e && e.message) || e) }); }

// components/content/Testimonial.jsx
try { (() => {
/**
 * Testimonial — customer quote with star rating and attribution.
 * Straightforward, trust-building, no hype.
 */
function Testimonial({
  quote,
  name,
  location,
  rating = 5
}) {
  return /*#__PURE__*/React.createElement("figure", {
    style: {
      margin: 0,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline)',
      borderRadius: 'var(--radius-lg)',
      padding: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2,
      marginBottom: 14,
      color: 'var(--green-500)'
    }
  }, Array.from({
    length: 5
  }).map((_, i) => /*#__PURE__*/React.createElement("svg", {
    key: i,
    width: "18",
    height: "18",
    viewBox: "0 0 20 20",
    fill: i < rating ? 'currentColor' : 'var(--warm-200)'
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9L10 1.5z"
  })))), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      fontSize: 18,
      lineHeight: 1.55,
      color: 'var(--ink-800)',
      fontWeight: 500
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      marginTop: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 600,
      fontSize: 15,
      color: 'var(--ink-900)',
      letterSpacing: '0.03em'
    }
  }, name), location && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--text-muted)',
      letterSpacing: '0.04em'
    }
  }, location)));
}
Object.assign(__ds_scope, { Testimonial });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Testimonial.jsx", error: String((e && e.message) || e) }); }

// components/data/Callout.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Callout — the bordered note that explains how a number was derived
 * ("Live · mapping applied: buckets come from JobTread's Project Type…").
 * Amber by default; navy for neutral guidance, green for a live/OK state.
 */
function Callout({
  children,
  lead,
  tone = 'warning',
  style,
  ...rest
}) {
  const tones = {
    warning: {
      bg: 'var(--status-warning-soft)',
      border: '#ecd9a8',
      lead: 'var(--status-warning)',
      text: '#6d5316'
    },
    info: {
      bg: 'var(--navy-050)',
      border: 'var(--navy-100)',
      lead: 'var(--navy-700)',
      text: 'var(--navy-800)'
    },
    live: {
      bg: 'var(--green-100)',
      border: 'var(--green-200)',
      lead: 'var(--green-700)',
      text: 'var(--green-900)'
    },
    neutral: {
      bg: 'var(--slate-050)',
      border: 'var(--border-hairline-app)',
      lead: 'var(--warm-500)',
      text: 'var(--ink-700)'
    }
  };
  const t = tones[tone] || tones.warning;
  return /*#__PURE__*/React.createElement("aside", _extends({
    style: {
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 16px',
      fontSize: 'var(--fs-caption)',
      lineHeight: 'var(--lh-body)',
      color: t.text,
      ...style
    }
  }, rest), lead && /*#__PURE__*/React.createElement("span", {
    className: "db-label",
    style: {
      display: 'inline',
      fontSize: 'var(--fs-label)',
      color: t.lead,
      marginRight: 8
    }
  }, lead), children);
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Callout.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * DataTable — the reporting table: mono uppercase headers, tabular figures,
 * hairline rows, and a green-tinted TOTAL row. Numeric columns right-align.
 */
function DataTable({
  columns = [],
  rows = [],
  total,
  dense = false,
  style,
  ...rest
}) {
  const pad = dense ? '8px 12px' : '11px 14px';
  const cellAlign = c => c.align || (c.numeric ? 'right' : 'left');
  return /*#__PURE__*/React.createElement("table", _extends({
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-hairline-app)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      fontSize: 'var(--fs-body-sm)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    className: "db-label",
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      fontSize: 'var(--fs-label)',
      background: 'var(--slate-050)',
      borderBottom: '1px solid var(--border-hairline-app)',
      width: c.width,
      whiteSpace: 'nowrap',
      fontWeight: 'var(--fw-semibold)'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    className: c.numeric ? 'db-figures' : undefined,
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      borderBottom: '1px solid var(--slate-100)',
      color: ci === 0 ? 'var(--ink-900)' : 'var(--ink-700)',
      fontWeight: ci === 0 ? 'var(--fw-medium)' : 'var(--fw-regular)'
    }
  }, r[c.key]))))), total && /*#__PURE__*/React.createElement("tfoot", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    className: c.numeric ? 'db-figures' : 'db-label',
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      background: 'var(--green-100)',
      color: 'var(--green-800)',
      fontWeight: 'var(--fw-bold)',
      fontSize: c.numeric ? 'var(--fs-body-sm)' : 'var(--fs-label)',
      borderTop: '1px solid var(--green-200)'
    }
  }, total[c.key])))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/KpiBanner.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * KpiBanner — the headline card at the top of a report: navy-to-green
 * gradient, one hero figure with a delta chip, and up to three supporting
 * columns on the right. One per page, never two.
 */
function KpiBanner({
  label,
  value,
  delta,
  caption,
  columns = [],
  footer,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    className: "db-grid-navy",
    style: {
      background: 'var(--surface-kpi)',
      color: 'var(--white)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px 28px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 28,
      alignItems: 'flex-start',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 320px',
      minWidth: 0
    }
  }, label && /*#__PURE__*/React.createElement("div", {
    className: "db-label db-label--on-dark",
    style: {
      fontSize: 'var(--fs-label)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "db-figures",
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-metric-xl)',
      lineHeight: 1,
      letterSpacing: 'var(--ls-metric)'
    }
  }, value), delta), caption && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '12px 0 0',
      fontSize: 'var(--fs-body-sm)',
      color: 'rgba(255,255,255,0.66)',
      maxWidth: 520
    }
  }, caption), footer && /*#__PURE__*/React.createElement("div", {
    className: "db-label db-label--on-dark db-figures",
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 26px',
      marginTop: 18,
      paddingTop: 14,
      borderTop: '1px solid rgba(255,255,255,0.14)',
      fontSize: 'var(--fs-label-xs)'
    }
  }, footer)), columns.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 0,
      flex: '0 1 auto'
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      minWidth: 128,
      paddingInline: i === 0 ? '0 22px' : '22px',
      borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.14)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "db-label db-label--on-dark",
    style: {
      fontSize: 'var(--fs-label-xs)'
    }
  }, c.label), /*#__PURE__*/React.createElement("div", {
    className: "db-figures",
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-metric-sm)',
      lineHeight: 1.1,
      marginTop: 8,
      color: c.tone === 'accent' ? 'var(--green-300)' : 'var(--white)'
    }
  }, c.value), c.caption && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-caption)',
      color: 'rgba(255,255,255,0.6)',
      marginTop: 5
    }
  }, c.caption)))));
}
Object.assign(__ds_scope, { KpiBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/KpiBanner.jsx", error: String((e && e.message) || e) }); }

// components/data/MetricStrip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * MetricStrip — the full-bleed near-black band of headline numbers that
 * opens every tool ("16 ON THE JOB TODAY · 7 JOBS ON SCHEDULE · …").
 * Put <Stat tone="dark"> children inside; hairline rules are added between.
 */
function MetricStrip({
  children,
  title,
  meta,
  tone = 'ink',
  padding = '30px 34px',
  style,
  ...rest
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  const backgrounds = {
    ink: 'var(--surface-band)',
    navy: 'var(--navy-900)'
  };
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      background: backgrounds[tone] || backgrounds.ink,
      color: 'var(--white)',
      padding,
      ...style
    }
  }, rest), (title || meta) && /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 24,
      marginBottom: 22,
      flexWrap: 'wrap'
    }
  }, title && /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-h2)',
      letterSpacing: 'var(--ls-heading)',
      textTransform: 'uppercase',
      color: 'var(--white)'
    }
  }, title), meta && /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, meta)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, items.map((child, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: '1 1 150px',
      minWidth: 0,
      paddingInline: i === 0 ? '0 26px' : '26px',
      borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.13)'
    }
  }, child))));
}
Object.assign(__ds_scope, { MetricStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MetricStrip.jsx", error: String((e && e.message) || e) }); }

// components/data/MonoLabel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * MonoLabel — the loudest device in this system. Uppercase IBM Plex Mono,
 * wide tracking, used for every eyebrow, table header, timestamp and nav
 * number. Wrap one word in <em> to accent it (…ON THE JOB <em>TODAY</em>).
 */
function MonoLabel({
  children,
  tone = 'light',
  size = 'md',
  number,
  as = 'div',
  style,
  ...rest
}) {
  const colors = {
    light: 'var(--text-label)',
    dark: 'var(--text-on-dark-muted)',
    accent: 'var(--green-700)',
    'accent-dark': 'var(--color-accent-on-dark)',
    strong: 'var(--ink-800)'
  };
  const sizes = {
    sm: 'var(--fs-label-xs)',
    md: 'var(--fs-label)',
    lg: 'var(--fs-overline)'
  };
  const onDark = tone === 'dark' || tone === 'accent-dark';
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: onDark ? 'db-label db-label--on-dark' : 'db-label',
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '8px',
      fontSize: sizes[size] || sizes.md,
      letterSpacing: 'var(--ls-label)',
      color: colors[tone] || colors.light,
      ...style
    }
  }, rest), number != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: 'tabular-nums',
      opacity: 0.62,
      fontWeight: 'var(--fw-regular)'
    }
  }, String(number).padStart(2, '0')), /*#__PURE__*/React.createElement("span", null, children));
}
Object.assign(__ds_scope, { MonoLabel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MonoLabel.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Deitemeyer Brothers — Button
 * Navy is the primary action (every button in the live tools). Green is
 * reserved for go/positive actions. `mono` is the outlined toggle used for
 * in-app switches (DEFINITIONS: OFF). Sentence case by default — the tools
 * read as tools; pass `uppercase` for marketing CTAs.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  uppercase = false,
  fullWidth = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  as = 'button',
  ...rest
}) {
  const sizes = {
    sm: {
      padding: '8px 14px',
      font: '13px'
    },
    md: {
      padding: '11px 20px',
      font: '14px'
    },
    lg: {
      padding: '15px 30px',
      font: '16px'
    }
  };
  const s = sizes[size] || sizes.md;
  const isMono = variant === 'mono';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: isMono ? 'var(--font-mono)' : 'var(--font-display)',
    fontWeight: isMono ? 'var(--fw-semibold)' : 'var(--fw-bold)',
    textTransform: uppercase || isMono ? 'uppercase' : 'none',
    letterSpacing: uppercase || isMono ? 'var(--ls-tag)' : '0',
    fontSize: isMono ? 'var(--fs-label)' : s.font,
    lineHeight: 1,
    padding: s.padding,
    width: fullWidth ? '100%' : 'auto',
    border: '1.5px solid transparent',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)',
    textDecoration: 'none',
    whiteSpace: 'nowrap'
  };
  const variants = {
    primary: {
      background: 'var(--navy-700)',
      color: 'var(--white)',
      borderColor: 'var(--navy-700)'
    },
    accent: {
      background: 'var(--green-500)',
      color: 'var(--ink-900)',
      borderColor: 'var(--green-500)'
    },
    outline: {
      background: 'var(--white)',
      color: 'var(--ink-800)',
      borderColor: 'var(--border-hairline-app)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--navy-700)',
      borderColor: 'transparent'
    },
    'on-dark': {
      background: 'rgba(255,255,255,0.1)',
      color: 'var(--white)',
      borderColor: 'var(--border-on-dark)'
    },
    mono: {
      background: 'transparent',
      color: 'var(--navy-200)',
      borderColor: 'var(--border-on-dark)'
    }
  };
  const hovers = {
    primary: {
      background: 'var(--navy-600)',
      borderColor: 'var(--navy-600)'
    },
    accent: {
      background: 'var(--green-400)',
      borderColor: 'var(--green-400)'
    },
    outline: {
      background: 'var(--slate-050)',
      borderColor: 'var(--navy-300)'
    },
    ghost: {
      background: 'var(--navy-100)'
    },
    'on-dark': {
      background: 'rgba(255,255,255,0.18)'
    },
    mono: {
      background: 'rgba(255,255,255,0.08)',
      color: 'var(--white)'
    }
  };
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      ...base,
      ...(variants[variant] || variants.primary)
    },
    disabled: as === 'button' ? disabled : undefined,
    onMouseEnter: e => {
      if (disabled) return;
      Object.assign(e.currentTarget.style, hovers[variant] || hovers.primary);
    },
    onMouseLeave: e => {
      const v = variants[variant] || variants.primary;
      e.currentTarget.style.background = v.background;
      e.currentTarget.style.borderColor = v.borderColor;
      e.currentTarget.style.color = v.color;
    }
  }, rest), iconLeft, children, iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Checkbox — square check with brand-green fill and white tick when selected. */
function Checkbox({
  label,
  checked,
  defaultChecked = false,
  onChange,
  id,
  disabled,
  ...rest
}) {
  const isControlled = checked !== undefined;
  const [on, setOn] = React.useState(defaultChecked);
  const active = isControlled ? checked : on;
  const fieldId = id || `db-chk-${Math.random().toString(36).slice(2, 8)}`;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      display: 'inline-flex',
      alignItems: 'flex-start',
      gap: '10px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontSize: '15px',
      color: 'var(--ink-800)',
      lineHeight: 1.45
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      marginTop: 1,
      flexShrink: 0,
      border: `2px solid ${active ? 'var(--navy-700)' : 'var(--warm-300)'}`,
      borderRadius: 'var(--radius-xs)',
      background: active ? 'var(--navy-700)' : 'var(--white)',
      display: 'grid',
      placeItems: 'center',
      transition: 'background var(--dur-fast), border-color var(--dur-fast)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    style: {
      opacity: active ? 1 : 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 6.2 L4.6 9 L10 2.6",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    type: "checkbox",
    checked: isControlled ? checked : undefined,
    defaultChecked: isControlled ? undefined : defaultChecked,
    disabled: disabled,
    onChange: e => {
      if (!isControlled) setOn(e.target.checked);
      onChange && onChange(e);
    },
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }, rest)), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * IconButton — square icon-only action. Pairs with Lucide line icons.
 */
function IconButton({
  children,
  variant = 'outline',
  size = 'md',
  label,
  disabled = false,
  ...rest
}) {
  const dims = {
    sm: 34,
    md: 42,
    lg: 50
  };
  const d = dims[size] || dims.md;
  const variants = {
    solid: {
      background: 'var(--navy-700)',
      color: 'var(--white)',
      border: '2px solid var(--navy-700)'
    },
    outline: {
      background: 'var(--white)',
      color: 'var(--ink-800)',
      border: '2px solid var(--warm-200)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-700)',
      border: '2px solid transparent'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    title: label,
    disabled: disabled,
    style: {
      width: d,
      height: d,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
      ...(variants[variant] || variants.outline)
    },
    onMouseEnter: e => {
      if (!disabled && variant === 'outline') e.currentTarget.style.borderColor = 'var(--navy-700)';
      if (!disabled && variant === 'ghost') e.currentTarget.style.background = 'var(--warm-100)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = (variants[variant] || variants.outline).border.split(' ').pop();
      e.currentTarget.style.background = (variants[variant] || variants.outline).background;
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Input — labeled text field with optional eyebrow label + helper/error text.
 */
function Input({
  label,
  hint,
  error,
  id,
  type = 'text',
  as = 'input',
  rows = 4,
  ...rest
}) {
  const fieldId = id || `db-inp-${Math.random().toString(36).slice(2, 8)}`;
  const controlStyle = {
    width: '100%',
    fontFamily: 'var(--font-body)',
    fontSize: '16px',
    color: 'var(--ink-900)',
    background: 'var(--white)',
    border: `2px solid ${error ? 'var(--status-danger)' : 'var(--warm-200)'}`,
    borderRadius: 'var(--radius-sm)',
    padding: '12px 14px',
    outline: 'none',
    transition: 'border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)',
    resize: as === 'textarea' ? 'vertical' : undefined,
    fontFamily: 'var(--font-body)'
  };
  const focus = e => {
    e.currentTarget.style.borderColor = error ? 'var(--status-danger)' : 'var(--focus-ring)';
    e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
  };
  const blur = e => {
    e.currentTarget.style.borderColor = error ? 'var(--status-danger)' : 'var(--warm-200)';
    e.currentTarget.style.boxShadow = 'none';
  };
  const Control = as === 'textarea' ? 'textarea' : 'input';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-700)'
    }
  }, label), /*#__PURE__*/React.createElement(Control, _extends({
    id: fieldId,
    type: as === 'textarea' ? undefined : type,
    rows: as === 'textarea' ? rows : undefined,
    style: controlStyle,
    onFocus: focus,
    onBlur: blur
  }, rest)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: error ? 'var(--status-danger)' : 'var(--text-muted)'
    }
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Select — labeled native dropdown styled to match Input. */
function Select({
  label,
  hint,
  id,
  children,
  ...rest
}) {
  const fieldId = id || `db-sel-${Math.random().toString(36).slice(2, 8)}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      width: '100%'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: fieldId,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--ink-700)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId,
    style: {
      width: '100%',
      appearance: 'none',
      WebkitAppearance: 'none',
      fontFamily: 'var(--font-body)',
      fontSize: '16px',
      color: 'var(--ink-900)',
      background: 'var(--white)',
      border: '2px solid var(--warm-200)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 40px 12px 14px',
      cursor: 'pointer',
      outline: 'none',
      transition: 'border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)'
    },
    onFocus: e => {
      e.currentTarget.style.borderColor = 'var(--focus-ring)';
      e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = 'var(--warm-200)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, rest), children), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 14,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--ink-600)',
      fontSize: 12
    }
  }, "\u25BC")), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--text-muted)'
    }
  }, hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/layout/AppTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * AppTile — a tool in the Team Portal launcher grid. Live tiles are clickable
 * with an OPEN link; `in-build` and `planned` tiles are dimmed, carry a status
 * badge, and are not links. The selected tile gets a navy ring.
 */
function AppTile({
  icon,
  title,
  description,
  href,
  status = 'live',
  selected = false,
  openLabel = 'Open',
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const live = status === 'live';
  const statusText = {
    'in-build': 'In build',
    planned: 'Planned'
  }[status];
  const Tag = live && href ? 'a' : 'div';
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: live && href ? href : undefined,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'block',
      textDecoration: 'none',
      position: 'relative',
      background: live ? 'var(--surface-card)' : 'var(--slate-050)',
      border: `1px solid ${selected ? 'var(--navy-700)' : 'var(--border-hairline-app)'}`,
      boxShadow: selected ? 'var(--ring-selected)' : hover && live ? 'var(--shadow-sm)' : 'none',
      borderRadius: 'var(--radius-md)',
      padding: '18px 18px 16px',
      cursor: live && href ? 'pointer' : 'default',
      opacity: live ? 1 : 0.72,
      transition: 'box-shadow var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
      ...style
    }
  }, rest), statusText ? /*#__PURE__*/React.createElement("span", {
    className: "db-label",
    style: {
      display: 'inline-block',
      fontSize: 'var(--fs-label-xs)',
      background: 'var(--warm-100)',
      color: 'var(--warm-500)',
      padding: '3px 7px',
      borderRadius: 'var(--radius-xs)',
      marginBottom: 14
    }
  }, statusText) : icon && /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40,
      marginBottom: 14,
      display: 'flex',
      alignItems: 'center'
    }
  }, icon), /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-title)',
      letterSpacing: 'var(--ls-tag)',
      textTransform: 'uppercase',
      color: live ? 'var(--ink-900)' : 'var(--ink-600)',
      lineHeight: 1.2
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '9px 0 0',
      fontSize: 'var(--fs-body-sm)',
      lineHeight: 'var(--lh-body)',
      color: 'var(--text-muted)'
    }
  }, description), live && /*#__PURE__*/React.createElement("span", {
    className: "db-label",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 16,
      fontSize: 'var(--fs-label)',
      color: 'var(--navy-700)',
      textDecoration: hover ? 'underline' : 'none',
      textUnderlineOffset: 3
    }
  }, openLabel, " ", /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2197")));
}
Object.assign(__ds_scope, { AppTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/AppTile.jsx", error: String((e && e.message) || e) }); }

// components/layout/PanelHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * PanelHeader — opens a section inside a tool: numbered mono badge, bold
 * uppercase title, and a right-hand mono meta line. Sits on a hairline.
 */
function PanelHeader({
  number,
  title,
  meta,
  actions,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexWrap: 'wrap',
      paddingBottom: 14,
      borderBottom: '1px solid var(--border-hairline-app)',
      ...style
    }
  }, rest), number != null && /*#__PURE__*/React.createElement("span", {
    className: "db-figures",
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-label)',
      fontWeight: 'var(--fw-semibold)',
      background: 'var(--green-100)',
      color: 'var(--green-800)',
      padding: '4px 7px',
      borderRadius: 'var(--radius-xs)',
      lineHeight: 1
    }
  }, String(number).padStart(2, '0')), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      flex: '1 1 auto',
      minWidth: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-h4)',
      letterSpacing: 'var(--ls-tag)',
      textTransform: 'uppercase',
      color: 'var(--ink-900)'
    }
  }, title), meta && /*#__PURE__*/React.createElement("span", {
    className: "db-label",
    style: {
      fontSize: 'var(--fs-label)',
      flexShrink: 0
    }
  }, meta), actions);
}
Object.assign(__ds_scope, { PanelHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/PanelHeader.jsx", error: String((e && e.message) || e) }); }

// components/layout/SectionHeader.jsx
try { (() => {
/**
 * SectionHeader — marketing-page section opener: mono eyebrow, uppercase
 * display title, accent rule. For sections inside a tool use PanelHeader.
 */
function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  inverse = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: align,
      maxWidth: align === 'center' ? 640 : 'none',
      marginInline: align === 'center' ? 'auto' : 0
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: inverse ? 'db-label db-label--on-dark' : 'db-label',
    style: {
      fontSize: 'var(--fs-overline)',
      marginBottom: 14,
      justifyContent: align === 'center' ? 'center' : 'flex-start'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--fs-h2)',
      lineHeight: 'var(--lh-heading)',
      letterSpacing: 'var(--ls-heading)',
      margin: 0,
      color: inverse ? 'var(--white)' : 'var(--ink-900)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 3,
      background: 'var(--color-accent)',
      margin: align === 'center' ? '18px auto 0' : '18px 0 0'
    }
  }), description && /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 18,
      fontSize: 'var(--fs-body-lg)',
      lineHeight: 'var(--lh-body)',
      color: inverse ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
      maxWidth: 620,
      marginInline: align === 'center' ? 'auto' : 0
    }
  }, description));
}
Object.assign(__ds_scope, { SectionHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/SectionHeader.jsx", error: String((e && e.message) || e) }); }

// components/layout/SideNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SideNav — the navy tool rail. A white logo plaque up top (the DB wordmark
 * needs a light field to stay legible on navy), mono group headings, numbered
 * items, and a footer slot for the live/build status.
 */
function SideNav({
  logo,
  groups = [],
  value,
  onChange,
  footer,
  width = 232,
  style,
  ...rest
}) {
  let n = 0;
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      width,
      flexShrink: 0,
      alignSelf: 'stretch',
      background: 'var(--surface-nav)',
      color: 'var(--white)',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }
  }, rest), logo && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 16px 18px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--white)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      display: 'inline-flex'
    }
  }, logo)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 auto',
      overflow: 'auto',
      padding: '14px 0'
    }
  }, groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    key: gi,
    style: {
      marginBottom: 18
    }
  }, g.label && /*#__PURE__*/React.createElement("div", {
    className: "db-label db-label--on-dark",
    style: {
      fontSize: 'var(--fs-label-xs)',
      padding: '0 16px 8px',
      opacity: 0.72
    }
  }, g.label), (g.items || []).map(item => {
    n += 1;
    const id = item.id ?? item.label;
    const active = value === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      onClick: onChange ? () => onChange(id) : undefined,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        border: 'none',
        cursor: 'pointer',
        padding: '8px 16px',
        borderLeft: `3px solid ${active ? 'var(--green-400)' : 'transparent'}`,
        background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
        color: active ? 'var(--white)' : 'rgba(255,255,255,0.7)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        letterSpacing: 'var(--ls-tag)',
        fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-regular)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "db-figures",
      style: {
        opacity: 0.55,
        fontSize: 'var(--fs-label-xs)'
      }
    }, String(item.number ?? n).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: '1 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, item.label));
  })))), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      borderTop: '1px solid rgba(255,255,255,0.1)'
    }
  }, footer));
}
Object.assign(__ds_scope, { SideNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/SideNav.jsx", error: String((e && e.message) || e) }); }

// components/layout/TabBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TabBar — the numbered top-level tab row from the dashboard
 * ("01 Call Tracker · 02 Marketing · 03 Sales Report"). Sentence-case
 * labels, mono numbers, active tab underlined in navy.
 */
function TabBar({
  items = [],
  value,
  onChange,
  tone = 'light',
  style,
  ...rest
}) {
  const onDark = tone === 'dark';
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      alignItems: 'stretch',
      borderBottom: `1px solid ${onDark ? 'var(--border-on-dark)' : 'var(--border-hairline-app)'}`,
      ...style
    }
  }, rest), items.map((item, i) => {
    const id = item.id ?? item.label;
    const active = value != null ? value === id : i === 0;
    const color = active ? onDark ? 'var(--white)' : 'var(--ink-900)' : onDark ? 'rgba(255,255,255,0.6)' : 'var(--ink-500)';
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      onClick: onChange ? () => onChange(id) : undefined,
      style: {
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 7,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '10px 12px',
        marginBottom: -1,
        borderBottom: `2px solid ${active ? onDark ? 'var(--green-400)' : 'var(--navy-700)' : 'transparent'}`,
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body-sm)',
        fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-regular)',
        color
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "db-figures",
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label-xs)',
        opacity: 0.6,
        letterSpacing: 'var(--ls-tag)'
      }
    }, String(item.number ?? i + 1).padStart(2, '0')), item.label);
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/layout/TabBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/EstimateModal.jsx
try { (() => {
function EstimateModal({
  open,
  onClose
}) {
  const [sent, setSent] = React.useState(false);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(10,12,13,0.6)',
      backdropFilter: 'blur(3px)',
      display: 'grid',
      placeItems: 'center',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 'min(560px, 100%)',
      maxHeight: '90vh',
      overflow: 'auto',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--ink-900)',
      color: '#fff',
      padding: '24px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--green-400)'
    }
  }, "Free \xB7 No pressure"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: 26,
      fontWeight: 700,
      margin: '6px 0 0',
      color: '#fff'
    }
  }, "Request an estimate")), /*#__PURE__*/React.createElement(IconButton, {
    label: "Close",
    variant: "ghost",
    onClick: onClose,
    style: {
      color: '#fff'
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28
    }
  }, sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '30px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 999,
      background: 'var(--green-100)',
      color: 'var(--green-700)',
      display: 'grid',
      placeItems: 'center',
      margin: '0 auto 16px'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "check",
    style: {
      width: 28,
      height: 28
    }
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      margin: '0 0 8px'
    }
  }, "Thanks \u2014 we\u2019ll be in touch"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-muted)',
      margin: 0
    }
  }, "A Deitemeyer team member will call within one business day."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    onClick: onClose
  }, "Close"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    placeholder: "Jane Homeowner"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Phone",
    placeholder: "(513) 555-0142"
  })), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    placeholder: "jane@email.com"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Service needed"
  }, /*#__PURE__*/React.createElement("option", null, "Roof replacement"), /*#__PURE__*/React.createElement("option", null, "Storm & hail repair"), /*#__PURE__*/React.createElement("option", null, "Addition or remodel"), /*#__PURE__*/React.createElement("option", null, "Siding & exteriors"), /*#__PURE__*/React.createElement("option", null, "Gutters & drainage")), /*#__PURE__*/React.createElement(Input, {
    label: "Project details",
    as: "textarea",
    rows: 4,
    placeholder: "Tell us about the project, timeline, and any storm damage\u2026"
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "I\u2019d like a free on-site inspection scheduled.",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    fullWidth: true,
    onClick: () => setSent(true)
  }, "Send request")))));
}
Object.assign(window, {
  EstimateModal
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/EstimateModal.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Header.jsx
try { (() => {
const {
  useState: useStateH
} = React;
function Header({
  onNav
}) {
  const [open, setOpen] = useStateH(false);
  const links = ['Roofing', 'Construction', 'Our Work', 'About', 'Reviews'];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement(Container, {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 74
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#top",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/db-logo-wordmark.png",
    alt: "Deitemeyer Brothers",
    style: {
      height: 36
    }
  })), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 28
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: '0.04em',
      color: 'var(--ink-800)'
    }
  }, l))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "tel:5135550142",
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--ink-900)',
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "phone",
    style: {
      width: 15,
      height: 15,
      color: 'var(--green-600)'
    }
  }), "(513) 555-0142"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    onClick: onNav
  }, "Free Estimate"))));
}
Object.assign(window, {
  Header
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Hero.jsx
try { (() => {
function Hero({
  onEstimate
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: "top",
    style: {
      position: 'relative',
      background: 'var(--ink-900)',
      color: '#fff',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(115deg, #101315 0%, #1c2124 55%, #23292c 100%)'
    }
  }), /*#__PURE__*/React.createElement(Container, {
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1.05fr 0.95fr',
      gap: 56,
      alignItems: 'center',
      padding: '84px 24px 90px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--green-400)',
      marginBottom: 18
    }
  }, "Roofing & Construction \xB7 Est. 1994"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: 66,
      lineHeight: 0.98,
      letterSpacing: '-0.01em',
      margin: 0,
      color: '#fff'
    }
  }, "The pros", /*#__PURE__*/React.createElement("br", null), "homeowners", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green-500)'
    }
  }, "trust"), " for the big jobs"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 19,
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.78)',
      maxWidth: 500,
      marginTop: 22
    }
  }, "Family-owned design-build. We plan carefully, explain the why behind every recommendation, and build it to outlast the warranty."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 30,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onEstimate,
    iconRight: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "arrow-right",
      style: {
        width: 18,
        height: 18
      }
    })
  }, "Get a free estimate"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg",
    style: {
      color: '#fff',
      borderColor: 'rgba(255,255,255,0.4)'
    }
  }, "View our work")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28,
      marginTop: 40
    }
  }, /*#__PURE__*/React.createElement(Trust, {
    icon: "shield-check",
    text: "Licensed & insured"
  }), /*#__PURE__*/React.createElement(Trust, {
    icon: "badge-check",
    text: "25-yr workmanship"
  }), /*#__PURE__*/React.createElement(Trust, {
    icon: "star",
    text: "4.9\u2605 \xB7 600+ reviews"
  }))), /*#__PURE__*/React.createElement(Photo, {
    label: "Hero project photo",
    h: 440,
    tone: "light"
  })));
}
function Trust({
  icon,
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      fontSize: 13.5,
      color: 'rgba(255,255,255,0.85)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 17,
      height: 17,
      color: 'var(--green-400)'
    }
  }), text);
}
Object.assign(window, {
  Hero
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Reviews.jsx
try { (() => {
function Reviews() {
  const items = [['They explained every decision and finished on schedule. No surprises, no upsell.', 'The Hallorans', 'Cincinnati, OH'], ['After the hailstorm they handled the whole insurance claim and the roof looks better than new.', 'Marcus D.', 'Mason, OH'], ['We got three bids. Deitemeyer was the only one who walked us through the why. Worth every penny.', 'Priya & Sam', 'West Chester, OH']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-page)',
      padding: '90px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement(SectionHeader, {
    eyebrow: "Reviews",
    title: "Neighbors who\u2019d hire us again",
    align: "center"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20,
      marginTop: 44
    }
  }, items.map(([q, n, l]) => /*#__PURE__*/React.createElement(Testimonial, {
    key: n,
    quote: q,
    name: n,
    location: l,
    rating: 5
  })))));
}
function CTA({
  onEstimate
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--ink-900)',
      color: '#fff',
      padding: '76px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 40,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: 40,
      lineHeight: 1.02,
      margin: 0,
      color: '#fff'
    }
  }, "Planning a project?", /*#__PURE__*/React.createElement("br", null), "Let\u2019s talk it through."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 14,
      maxWidth: 460
    }
  }, "Free, no-pressure estimate. We\u2019ll inspect, explain your options, and put it in writing.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onEstimate,
    iconRight: /*#__PURE__*/React.createElement("i", {
      "data-lucide": "arrow-right",
      style: {
        width: 18,
        height: 18
      }
    })
  }, "Get a free estimate"))));
}
function Footer() {
  const cols = [['Services', ['Roof Replacement', 'Storm Repair', 'Additions', 'Siding', 'Gutters']], ['Company', ['About', 'Our Work', 'Reviews', 'Careers', 'Contact']], ['Service Area', ['Cincinnati', 'Mason', 'West Chester', 'Loveland', 'Blue Ash']]];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: '#0a0c0d',
      color: 'rgba(255,255,255,0.7)',
      padding: '56px 0 32px'
    }
  }, /*#__PURE__*/React.createElement(Container, {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr repeat(3,1fr)',
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/db-logo-wordmark.png",
    alt: "Deitemeyer Brothers",
    style: {
      height: 40,
      marginBottom: 16
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      lineHeight: 1.6,
      maxWidth: 260,
      margin: 0
    }
  }, "Family-owned roofing & construction. Licensed, insured, and building trust one project at a time."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      color: 'var(--green-400)',
      marginTop: 16
    }
  }, "(513) 555-0142")), cols.map(([h, links]) => /*#__PURE__*/React.createElement("div", {
    key: h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.08em',
      color: '#fff',
      marginBottom: 14
    }
  }, h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.7)'
    }
  }, l)))))), /*#__PURE__*/React.createElement(Container, {
    style: {
      marginTop: 40,
      paddingTop: 20,
      borderTop: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: 'var(--font-mono)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Deitemeyer Brothers Roofing & Construction"), /*#__PURE__*/React.createElement("span", null, "OH Lic. #CO-00000 \xB7 Fully Insured")));
}
Object.assign(window, {
  Reviews,
  CTA,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Reviews.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Services.jsx
try { (() => {
function Services() {
  const items = [['home', 'Roof Replacement', 'Full tear-off and install with premium architectural shingles, flashing, and ventilation done to spec.'], ['cloud-lightning', 'Storm & Hail Repair', 'Free inspections, honest damage assessments, and direct help navigating your insurance claim.'], ['hammer', 'Additions & Remodels', 'Design-build additions, dormers, and full remodels engineered for how your family actually lives.'], ['layout-grid', 'Siding & Exteriors', 'Fiber cement, vinyl, and trim that seals the envelope and lifts curb appeal for decades.'], ['droplets', 'Gutters & Drainage', 'Seamless gutters and grading that move water away from your foundation, not toward it.'], ['ruler', 'Design & Planning', 'Engineering-minded planning up front, so the build has no surprises and no shortcuts.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-page)',
      padding: '90px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, null, /*#__PURE__*/React.createElement(SectionHeader, {
    eyebrow: "What we do",
    title: "Built to last, not to sell",
    description: "Every recommendation starts with the reasoning behind it \u2014 so you can make a confident call on a major investment.",
    align: "center"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 20,
      marginTop: 44
    }
  }, items.map(([icon, title, desc]) => /*#__PURE__*/React.createElement(ServiceCard, {
    key: title,
    icon: /*#__PURE__*/React.createElement("i", {
      "data-lucide": icon,
      style: {
        width: 24,
        height: 24
      }
    }),
    title: title,
    description: desc,
    onClick: () => {}
  })))));
}
Object.assign(window, {
  Services
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Services.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WhyUs.jsx
try { (() => {
function WhyUs() {
  const steps = [['clipboard-list', 'We listen & inspect', 'A real inspection and a straight conversation about what you need — and what you don’t.'], ['pencil-ruler', 'We plan the why', 'You get the engineering reasoning behind every recommendation, in plain language.'], ['hard-hat', 'We build it right', 'Our own crews, quality materials, and a jobsite kept clean and respectful.'], ['badge-check', 'We stand behind it', 'A written 25-year workmanship warranty and a team that answers the phone after.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: 'var(--surface-blue)',
      color: '#fff',
      padding: '90px 0'
    }
  }, /*#__PURE__*/React.createElement(Container, {
    style: {
      display: 'grid',
      gridTemplateColumns: '0.9fr 1.1fr',
      gap: 60,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: 'var(--green-400)',
      marginBottom: 14
    }
  }, "Our process"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontWeight: 700,
      fontSize: 44,
      lineHeight: 1.05,
      margin: 0,
      color: '#fff'
    }
  }, "Planning first.", /*#__PURE__*/React.createElement("br", null), "Then a build with", /*#__PURE__*/React.createElement("br", null), "no surprises."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 20,
      maxWidth: 420
    }
  }, "We\u2019re a family business. That means we treat your home like it\u2019s down the street from ours \u2014 because it usually is."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 36,
      marginTop: 34
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    value: "30+",
    label: "Years in business"
  }), /*#__PURE__*/React.createElement(Stat, {
    value: "4,000",
    label: "Projects completed"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, steps.map(([icon, title, desc], i) => /*#__PURE__*/React.createElement("div", {
    key: title,
    style: {
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 'var(--radius-lg)',
      padding: '22px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--green-400)',
      fontWeight: 600
    }
  }, "0", i + 1), /*#__PURE__*/React.createElement("i", {
    "data-lucide": icon,
    style: {
      width: 22,
      height: 22,
      color: '#fff'
    }
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--font-display)',
      textTransform: 'uppercase',
      fontSize: 17,
      fontWeight: 600,
      margin: '0 0 6px',
      color: '#fff'
    }
  }, title), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      lineHeight: 1.5,
      color: 'rgba(255,255,255,0.72)'
    }
  }, desc))))));
}
Object.assign(window, {
  WhyUs
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WhyUs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/parts.jsx
try { (() => {
const {
  useState
} = React;
function Photo({
  label,
  h = 320,
  tone = 'dark'
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: h,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: tone === 'dark' ? 'linear-gradient(135deg, #23282b 0%, #171a1c 100%)' : 'linear-gradient(135deg, #e7e1d6 0%, #d4ccbe 100%)',
      display: 'grid',
      placeItems: 'center',
      border: '1px solid var(--border-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      color: tone === 'dark' ? 'rgba(255,255,255,0.5)' : 'var(--warm-500)'
    }
  }, /*#__PURE__*/React.createElement("i", {
    "data-lucide": "camera",
    style: {
      width: 26,
      height: 26
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      letterSpacing: '0.1em',
      textTransform: 'uppercase'
    }
  }, label)));
}
function Container({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '0 24px',
      ...style
    }
  }, children);
}
Object.assign(window, {
  Photo,
  Container
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/parts.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ServiceCard = __ds_scope.ServiceCard;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Testimonial = __ds_scope.Testimonial;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.KpiBanner = __ds_scope.KpiBanner;

__ds_ns.MetricStrip = __ds_scope.MetricStrip;

__ds_ns.MonoLabel = __ds_scope.MonoLabel;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.AppTile = __ds_scope.AppTile;

__ds_ns.PanelHeader = __ds_scope.PanelHeader;

__ds_ns.SectionHeader = __ds_scope.SectionHeader;

__ds_ns.SideNav = __ds_scope.SideNav;

__ds_ns.TabBar = __ds_scope.TabBar;

})();
