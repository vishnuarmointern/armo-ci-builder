/* Armodilo CI core: parse a FedEx commercial-invoice PDF (via pdf.js text items)
   and build the Armodilo-branded .docx (Google Docs compatible). Works in browser and Node. */
(function (root) {
  const L = 14.4;            // left margin (pt)
  const LH = 13.5;           // body line height (pt)
  const SIG = { w: 54, h: 30 };

  // ---------- parsing ----------
  async function extractLines(pdfjs, data) {
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const lines = [];
    let off = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const vp = pg.getViewport({ scale: 1 });
      const tc = await pg.getTextContent();
      const rows = new Map();
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const top = Math.round(vp.height - it.transform[5]) + off;
        const key = [...rows.keys()].find(k => Math.abs(k - top) <= 2) ?? top;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push({ x: it.transform[4], text: it.str.trim() });
      }
      [...rows.keys()].sort((a, b) => a - b).forEach(k => {
        const words = rows.get(k).sort((a, b) => a.x - b.x);
        lines.push({ top: k, words, text: words.map(w => w.text).join(' ') });
      });
      off += vp.height;
    }
    return lines;
  }


  // Fixed-width .txt export from FedEx: same structure as the PDF, columns found by character position.
  function extractTextLines(text) {
    const lines = [];
    text.replace(/\r/g, '').split('\n').forEach((raw, i) => {
      const words = [];
      const re = /\S+(?: \S+)*/g;          // runs separated by 2+ spaces
      let m;
      while ((m = re.exec(raw))) words.push({ x: m.index * 4, text: m[0] });  // ~4pt per character
      if (words.length) lines.push({ top: i * 12, words, text: words.map(w => w.text).join(' ') });
    });
    return lines;
  }

  const fmtZip = z => /^\d{9}$/.test(z) ? `${z.slice(0, 5)}-${z.slice(5)}` : z;
  const split = (line, x = 260) => [
    line.words.filter(w => w.x < x).map(w => w.text).join(' ').trim(),
    line.words.filter(w => w.x >= x).map(w => w.text).join(' ').trim()];

  function parseAddress(lines) {
    lines = lines.filter(Boolean);
    let id = '';
    if (lines.length && lines[lines.length - 1].startsWith('ID/EIN:')) id = lines.pop().slice(7).trim();
    let state = '', zip = '', country = '', phone = '';
    const m = lines.length ? lines[lines.length - 1].match(/^([A-Z]{2})\s+(\S+)\s+([A-Z]{2})\s*(.*)$/) : null;
    if (m) { state = m[1]; zip = fmtZip(m[2]); country = m[3]; phone = m[4].trim(); lines.pop(); }
    const city = lines.length ? lines.pop() : '';
    return { name: lines[0] || '', company: lines[1] || '', street: lines.slice(2), city, state, zip, country, phone, id };
  }

  function parse(ls) {
    const txt = ls.map(l => l.text).join('\n');
    const isRule = l => /^[-_]{5,}$/.test(l.text.replace(/\s/g, ''));
    const idx = re => { const i = ls.findIndex(l => re.test(l.text)); if (i < 0) throw new Error('This does not look like a FedEx commercial invoice (missing "' + re.source + '").'); return i; };
    const d = {};
    let i = idx(/^Invoice Number/);
    let w = ls[i + 1].text.split(/\s+/);
    [d.purpose, d.currency, d.ult_dest] = w;
    i = idx(/^Export Dt/);
    w = ls[i + 1].text.split(/\s+/);
    [d.export_date, d.ci_ref, d.pkgs, d.bill_tc] = w;
    const nxt = ls[i + 2].text.trim();
    d.pkg_type = /^[A-Z]+$/.test(nxt) ? nxt : '';
    const block = re => { const s = idx(re) + 1; let e = s; while (e < ls.length && !isRule(ls[e])) e++; return ls.slice(s, e); };
    d.consignee = parseAddress(block(/^Shipper:/).map(l => split(l)[1]));
    const imp = block(/^Broker:/);
    d.broker = imp.map(l => split(l)[0]).filter(Boolean);
    d.importer = parseAddress(imp.map(l => split(l)[1]));
    d.items = [];
    ls.forEach((l, s) => {
      if (!l.text.startsWith('Part Nbr:')) return;
      let e = s; while (e < ls.length && !isRule(ls[e])) e++;
      const b = ls.slice(s, e).map(x => x.text).join(' ');
      const g = (re, def = '') => { const m = b.match(re); return m ? m[1].trim() : def; };
      d.items.push({
        part: g(/Part Nbr:\s*(\S+)/), marks: g(/Marks\/Nbrs:\s*(.*?)\s*C\/T/), mfr: g(/C\/T MFR:\s*(\S+)/),
        net_wgt: g(/Net\s+Wgt:\s*([\d.]+)/), wgt_unit: g(/Net\s+Wgt:\s*[\d.]+\s*(\w+)/, 'lbs'),
        hs: g(/HS Code:\s*(\S+)/), qty: g(/Unit Qty:\s*([\d.]+)/), uom: g(/Unit Qty:\s*[\d.]+\s*(\w+)/, 'EA'),
        commodity_value: g(/Commodity Value:\s*([\d.,]+)/), unit_value: g(/(?<![\d.])(\d+\.\d{6})(?![\d.])/),
        desc: g(/Desc:\s*(.*)$/)
      });
    });
    const g = (re, def = '') => { const m = txt.match(re); return m ? m[1].trim() : def; };
    d.total_weight = g(/Total Shipment\s+([\d.]+)/);
    d.total_commodity = g(/Total Commodity\s*\n?([\d.,]+)/);
    d.terms = g(/Terms of Sale:\s*\n?(\w+)/);
    d.freight = g(/Freight:\s*\n?([\d.,]+)/);
    d.insurance = g(/Insurance:\s*\n?([\d.,]+)/);
    d.others = g(/Others:\s*\n?([\d.,]+)/);
    d.total_invoice = g(/Total Invoice Value:\s*\n?([\d.,]+)/);
    d.comments = (g(/Comments:\s*\n([\s\S]*?)Tracking Numbers/).match(/^\d\).*$/gm) || []);
    d.tracking = g(/Tracking Numbers:\s*([\d ,]+)/).split(/[\s,]+/).filter(Boolean);
    d.sig_date = g(/Signature of shipper:.*?(\d{1,2}\/\d{1,2}\/\d{4})/);
    return d;
  }


  // part lookup ignores case and spaces ("ALUR - 14" matches "ALUR-14")
  const partKey = s => String(s).toUpperCase().replace(/\s+/g, '');
  function findPart(cfg, part) {
    const k = partKey(part);
    const hit = Object.keys(cfg.parts).find(x => partKey(x) === k);
    return hit ? cfg.parts[hit] : null;
  }
  // split "text (bracketed note)" so the bracketed part can be blue, like the original
  function splitParen(t) { const m = t.match(/^(.*?)( \(.*\))$/); return m ? [m[1], m[2]] : [t, '']; }
  // rows for one metal component, scaled by the line quantity
  function componentRows(c, q) {
    const rows = [];
    if (c.name) rows.push(`Component: ${c.name}${c.note ? ` (${c.note})` : ''}`);
    if (c.hs) rows.push(`H.S. Code: ${c.hs}`);
    if (c.qty != null) rows.push(`Quantity: ${+(c.qty * q).toFixed(4)}`);
    rows.push(`Material: ${c.material}`);
    rows.push(`${c.value_label || 'Total Value'}: US$${(c.value * q).toFixed(2)}`);
    const dec = (String(c.weight).split('.')[1] || '').length;
    const w = q === 1 ? c.weight : (parseFloat(c.weight) * q).toFixed(dec);
    rows.push(`${c.weight_label || 'Total Weight'}: ${w} kg${q === 1 && c.weight_suffix ? ' ' + c.weight_suffix : ''}`);
    c.origin.forEach(([a, b]) => rows.push(`${a}: ${b}`));
    rows.push(`Reference: ${c.reference}`);
    return rows;
  }

  // ---------- docx ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tw = pt => Math.round(pt * 20);
  const emu = pt => Math.round(pt * 12700);

  function run(text, o = {}) {
    let rpr = '';
    if (o.b) rpr += '<w:b/><w:bCs/>';
    if (o.color) rpr += `<w:color w:val="${o.color}"/>`;
    if (o.sz) rpr += `<w:sz w:val="${o.sz * 2}"/><w:szCs w:val="${o.sz * 2}"/>`;
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  const TAB = '<w:r><w:tab/></w:r>';
  let picId = 1;
  function pic(rid, wPt, hPt, name) {
    const id = picId++;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu(wPt)}" cy="${emu(hPt)}"/><wp:docPr id="${id}" name="${name}"/>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
      `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
      `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(wPt)}" cy="${emu(hPt)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
      `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  // segs: [x, text, align?]; opts: center, b, sz, color, rule, line, pageBreak, auto
  function para(segs = [], o = {}) {
    let ppr = '';
    const tabs = [];
    let body = o.pageBreak ? '<w:r><w:br w:type="page"/></w:r>' : '';
    if (o.center !== undefined) body += run(o.center, o);
    for (const [x, text, align] of segs) {
      if (x > L + 0.5) { tabs.push(`<w:tab w:val="${align === 'right' ? 'right' : 'left'}" w:pos="${tw(x - L)}"/>`); body += TAB; }
      body += run(text, o);
    }
    if (o.raw) body += o.raw;
    if (o.rule) ppr += `<w:pBdr><w:bottom w:val="${o.rule}" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>`;
    if (tabs.length || o.tabs) ppr += `<w:tabs>${(o.tabs || []).concat(tabs).join('')}</w:tabs>`;
    if (o.auto) ppr += '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
    else if (o.line) ppr += `<w:spacing w:before="0" w:after="0" w:line="${tw(o.line)}" w:lineRule="exact"/>`;
    if (o.center !== undefined) ppr += '<w:jc w:val="center"/>';
    return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${body}</w:p>`;
  }

  function buildBody(d, cfg, aci, email) {
    picId = 1;
    const RED = 'FF0000', BLUE = '0000FF';
    const P = [];
    const blank = () => P.push(para());
    const hr = (k = 'dashed') => { P.push(para([], { rule: k, line: 7 })); P.push(para([], { line: 6.5 })); };
    const cn = d.consignee, im = d.importer;

    P.push(para([], { center: '', auto: true, raw: pic('rLogo', 161, 36.7, 'Armodilo logo') }));
    P.push(para([], { center: `ACI-${aci}`, b: true, sz: 12, line: 16.8 }));
    P.push(para([], { center: 'Commercial Invoice', b: true, sz: 12, line: 16.8 }));
    P.push(para([], { center: 'Please see Page 2 for Steel/Aluminum Content Breakdown', b: true, sz: 11, color: RED, line: 15.4 }));
    P.push(para([[L, 'Invoice Number'], [95.5, 'Purpose of Shipment'], [302.7, 'Curr'], [355.5, 'Ult Dest.']]));
    P.push(para([[122.4, d.purpose], [300.7, d.currency], [355.1, d.ult_dest]]));
    P.push(para([[L, 'Export Dt'], [81.1, 'C.I. References'], [275.5, 'Pkgs'], [333.8, 'Bill T/C']]));
    P.push(para([[L, d.export_date], [86.6, d.ci_ref], [222.8, d.pkg_type], [291.1, d.pkgs], [332.8, d.bill_tc]]));
    hr();
    P.push(para([[L, 'Shipper:'], [302.4, 'Consignee:']]));
    const left = cfg.shipper.lines;
    const right = [cn.name, cn.company, ...cn.street, `${cn.city},  ${cn.state} ${cn.zip} ${cn.country}`, cn.phone];
    for (let k = 0; k < Math.max(left.length, right.length); k++) {
      const s = []; if (k < left.length) s.push([L, left[k]]); if (k < right.length) s.push([302.4, right[k]]); P.push(para(s));
    }
    P.push(para([[L, `ID/EIN: ${cfg.shipper.id_ein}`], [268.1, 'ID/EIN:']]));       // consignee ID/EIN always blank
    hr();
    P.push(para([[L, 'Broker:'], [266.4, 'Importer:']]));
    const bl = [...d.broker, cfg.broker_extra_line];
    const ir = [im.name, im.company, ...im.street, `${im.city},  ${im.state} ${im.zip} ${im.country}`];
    for (let k = 0; k < Math.max(bl.length, ir.length); k++) {
      const s = []; if (k < bl.length) s.push([L, bl[k]]); if (k < ir.length) s.push([266.4, ir[k]]); P.push(para(s));
    }
    blank();
    const impId = im.id || cn.id || 'n/a';                                          // FedEx consignee ID moves here
    P.push(para([], { center: [`ID/EIN: ${impId}`, email, im.phone || cn.phone].filter(Boolean).join('  '), b: true, sz: 11, line: 15.4 }));
    hr();
    for (const it of d.items) {
      P.push(para([[L, `Part Nbr:${it.part}`], [230.5, 'Marks/Nbrs:' + (it.marks ? ' ' + it.marks : '')], [328.8, `C/T MFR:${it.mfr}`], [413.7, 'Net Wgt:'], [474.8, it.net_wgt], [511.0, it.wgt_unit]]));
      P.push(para([[L, `HS Code: ${it.hs}`], [185.5, `Unit Qty: ${it.qty}`], [252.2, it.uom], [307.2, 'Unit Value:'], [402.6, `Commodity Value: ${it.commodity_value}`]]));
      P.push(para([[302.4, it.unit_value]]));
      P.push(para([[L, `Desc: ${it.desc}`]]));
      hr();
    }
    P.push(para([[194.9, 'Total Shipment'], [297.1, d.total_weight], [363.8, 'Total Commodity'], [468.8, d.total_commodity]]));
    P.push(para([[230.4, 'Weight:'], [308.5, 'lbs'], [410.2, 'Value:']]));
    for (const [lab, val] of [['Terms of Sale:', d.terms], ['Freight:', d.freight], ['Insurance:', d.insurance], ['Others:', d.others]])
      P.push(para([[410, lab, 'right'], [482.4, val]]));
    P.push(para([[410, 'Total Invoice Value:', 'right'], [452, d.currency === 'USD' ? `US$${d.total_invoice}` : d.total_invoice]]));
    blank();
    P.push(para([[L, 'Comments:']]));
    d.comments.forEach(c => P.push(para([[L, c]])));
    P.push(para([[L, 'Tracking Numbers:'], [108, d.tracking.join(', ')]]));
    blank();
    P.push(para([[L, 'I declare all information in this invoice to be true and correct.']]));
    // Signature line: "Signature of shipper:" [signature] "SHIPPING@ARMODILO.COM" [tab] date
    P.push(para([], {
      auto: true, tabs: [`<w:tab w:val="left" w:pos="${tw(348 - L)}"/>`],
      raw: run('Signature of shipper: ') + pic('rSig', SIG.w, SIG.h, 'Signature') + run(' SHIPPING@ARMODILO.COM') + TAB + run(d.sig_date)
    }));
    blank(); hr('single'); blank();
    P.push(para([[L, 'Page 1 of 2']]));

    // page 2
    P.push(para([], { center: 'Metal Content', b: true, sz: 12, color: RED, line: 16.8, pageBreak: true }));
    blank();
    d.items.forEach((it, n) => {
      const p = findPart(cfg, it.part);
      if (!p) { P.push(para([[L, `Line ${n + 1}: ${it.part} ${it.desc} -- METAL CONTENT TO BE ADDED`]], { b: true, color: RED })); blank(); return; }
      const q = parseFloat(it.qty) || 1;
      const [t1, t2] = splitParen(`Line ${n + 1}: ${p.title}`);
      P.push(para([[L, t1]], { b: true, color: RED, raw: t2 ? run(t2, { b: true, color: BLUE }) : '' }));
      blank();
      for (const c of p.components) {
        componentRows(c, q).forEach(r => {
          const [a, b] = r.startsWith('Component:') ? splitParen(r) : [r, ''];
          P.push(para([[50.4, a]], { color: RED, raw: b ? run(b, { color: BLUE }) : '' }));
        });
        blank();
      }
    });
    P.push(para([[L, 'Page 2 of 2']]));
    return P.join('');
  }

  async function buildDocx(JSZip, d, cfg, aci, email, logoB64, sigB64) {
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
      `<w:body>${buildBody(d, cfg, aci, email)}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="320" w:right="288" w:bottom="400" w:left="288" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>` +
      `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault>` +
      `<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="270" w:lineRule="exact"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
    const z = new JSZip();
    z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
    z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `<Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>` +
      `<Relationship Id="rSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>`);
    z.file('word/document.xml', doc);
    z.file('word/styles.xml', styles);
    z.file('word/media/logo.png', logoB64, { base64: true });
    z.file('word/media/signature.png', sigB64, { base64: true });
    return z.generateAsync({ type: typeof window === 'undefined' ? 'nodebuffer' : 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function warnings(d, cfg, email) {
    const w = [];
    if (!email) w.push(`No email on file for ${d.importer.company || 'this importer'}. Add one above if it should appear on the invoice.`);
    d.items.forEach(it => { if (!findPart(cfg, it.part)) w.push(`No metal-content data saved for part ${it.part}. Page 2 will say “METAL CONTENT TO BE ADDED” for it.`); });
    d.items.forEach(it => { if (parseFloat(it.net_wgt) === 0) w.push(`Part ${it.part} shows a net weight of 0.00 ${it.wgt_unit} on the FedEx invoice.`); });
    return w;
  }

  root.ArmodiloCI = { extractLines, extractTextLines, parse, buildDocx, warnings, findPart, componentRows };
  if (typeof module !== 'undefined') module.exports = root.ArmodiloCI;
})(typeof window !== 'undefined' ? window : globalThis);
