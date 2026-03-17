/**
 * FortiGate Audit HTML Report Generator — React+Vite Pipeline
 *
 * Parses the structured markdown audit report, enriches with reference data,
 * then injects the JSON data into a pre-built React template (report/dist/index.html).
 *
 * The React app is built separately with `npm run build` in the report/ directory.
 * This script only needs Node.js at runtime — no npm/vite required.
 *
 * Usage:
 *   node generate-html-report.js <input.md> <output.html>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node generate-html-report.js <input.md> <output.html>');
  process.exit(1);
}

const md = fs.readFileSync(inputFile, 'utf-8');

// ─── Load reference data from bundled reference files ───

function parseReferenceFile(content) {
  const refs = {};
  let currentId = null;
  let currentRef = {};
  for (const line of content.split('\n')) {
    const headingMatch = line.match(/^#{2,3}\s+([\d.]+|A\.\d+)\s*(?:—|--)\s*(.+?)(?:\s*\[(?:MANUAL|PASS|FAIL|N\/A)\])?\s*$/);
    if (headingMatch) {
      if (currentId) refs[currentId] = currentRef;
      currentId = headingMatch[1].trim();
      currentRef = { title: headingMatch[2].trim() };
      continue;
    }
    if (!currentId) continue;
    const srcMatch = line.match(/^-\s+\*\*Source\*\*\s*:\s*(.+)/);
    if (srcMatch) { currentRef.source = srcMatch[1].trim(); continue; }
    const critMatch = line.match(/^-\s+\*\*Critere\*\*\s*:\s*(.+)/);
    if (critMatch) { currentRef.critere = critMatch[1].trim(); continue; }
    const attenduMatch = line.match(/^-\s+\*\*Attendu\*\*\s*:\s*(.+)/);
    if (attenduMatch) { currentRef.attendu = attenduMatch[1].trim(); continue; }
    const recoMatch = line.match(/^-\s+\*\*Recommandation\*\*\s*:\s*(.+)/);
    if (recoMatch) { currentRef.recommandation = recoMatch[1].trim(); continue; }
    const verifMatch = line.match(/^-\s+\*\*Verification\*\*\s*:\s*(.+)/);
    if (verifMatch) { currentRef.verification = verifMatch[1].trim(); continue; }
    const refAnssiMatch = line.match(/^-\s+\*\*Ref ANSSI\*\*\s*:\s*(.+)/);
    if (refAnssiMatch) { currentRef.refAnssi = refAnssiMatch[1].trim(); continue; }
    const noteMatch = line.match(/^-\s+\*\*Note\*\*\s*:\s*(.+)/);
    if (noteMatch) { currentRef.note = noteMatch[1].trim(); continue; }
    const sevMatch = line.match(/^-\s+\*\*Severite\*\*\s*:\s*(.+)/);
    if (sevMatch) { currentRef.severity = sevMatch[1].trim().toLowerCase(); continue; }
  }
  if (currentId) refs[currentId] = currentRef;
  return refs;
}

let referenceDB = {};
try {
  const refsDir = path.resolve(__dirname, '..', 'references');
  const cisPath = path.join(refsDir, 'cis-checks.md');
  const anssiPath = path.join(refsDir, 'anssi-checks.md');
  if (fs.existsSync(cisPath)) {
    const cisRefs = parseReferenceFile(fs.readFileSync(cisPath, 'utf-8'));
    for (const [id, data] of Object.entries(cisRefs)) {
      data.standard = 'CIS Benchmark FortiGate 7.4.x';
      data.controlId = id;
      referenceDB[id] = data;
    }
  }
  if (fs.existsSync(anssiPath)) {
    const anssiRefs = parseReferenceFile(fs.readFileSync(anssiPath, 'utf-8'));
    for (const [id, data] of Object.entries(anssiRefs)) {
      data.standard = data.refAnssi ? `ANSSI ${data.refAnssi}` : 'ANSSI PA-023 / PA-044';
      data.controlId = id;
      referenceDB[id] = data;
    }
  }
} catch (e) { /* reference files not available */ }

function getControlId(title) {
  const m = title.match(/^([\d.]+|A\.\d+)\s/);
  return m ? m[1] : null;
}

// ─── Parse markdown into structured data ───

function parseAuditMarkdown(md) {
  const lines = md.split('\n');
  const data = {
    title: '',
    deviceInfo: {},
    sections: [],
    controls: [],
    summary: { pass: 0, fail: 0, manual: 0, na: 0, total: 0, score: 0 },
    priorities: [],
    remediationBlock: ''
  };

  let currentSection = null;
  let currentControl = null;
  let inCodeBlock = false;
  let codeContent = '';
  let inRemediationBlock = false;
  let remediationCode = '';
  let inPriorities = false;
  let currentPriority = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        if (inRemediationBlock) {
          remediationCode += codeContent;
        } else if (currentControl) {
          currentControl.remediation = codeContent.trim();
        }
        codeContent = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeContent += line + '\n'; continue; }

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      data.title = line.slice(2).trim();
      continue;
    }

    if (line.startsWith('>')) {
      const pairs = line.match(/\*\*([^*]+)\*\*\s*:\s*`?([^|`]+)`?/g);
      if (pairs) {
        for (const pair of pairs) {
          const m = pair.match(/\*\*([^*]+)\*\*\s*:\s*`?([^|`]+)`?/);
          if (m) data.deviceInfo[m[1].trim()] = m[2].trim().replace(/\*\*/g, '');
        }
      }
      const scoreMatch = line.match(/\*\*(\d+)%?\*\*/);
      if (line.toLowerCase().includes('score') && scoreMatch) {
        data.summary.score = parseInt(scoreMatch[1]);
      }
      continue;
    }

    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const sectionTitle = line.slice(3).trim();
      inPriorities = false;
      inRemediationBlock = false;
      if (sectionTitle.toLowerCase().includes('synthese') || sectionTitle.toLowerCase().includes('priorite') || sectionTitle.toLowerCase().includes('remediation')) {
        currentSection = null;
        continue;
      }
      currentSection = { name: sectionTitle, id: sectionTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() };
      data.sections.push(currentSection);
      continue;
    }

    if (line.startsWith('### ')) {
      const sub = line.slice(4).trim();
      if (sub.toLowerCase().includes('priorite')) { inPriorities = true; continue; }
      if (sub.toLowerCase().includes('commandes corrective')) { inRemediationBlock = true; continue; }
      continue;
    }

    if (inPriorities) {
      const prioMatch = line.match(/^\d+\.\s+\*\*([^*]+)\*\*\s*:\s*(.+)/);
      if (prioMatch) {
        currentPriority = { level: prioMatch[1].trim(), description: prioMatch[2].trim(), items: [] };
        data.priorities.push(currentPriority);
        continue;
      }
      const itemMatch = line.match(/^\s+-\s+\*\*([^*]+)\*\*\s*:\s*(.+)/);
      if (itemMatch && currentPriority) {
        currentPriority.items.push({ id: itemMatch[1].trim(), text: itemMatch[2].trim() });
        continue;
      }
      const itemMatch2 = line.match(/^\s+-\s+((?:[\d.]+|A\.\d+)(?:\s*\/\s*(?:[\d.]+|A\.\d+))*(?:\s*\([^)]*\))?)\s*(?:—|--)\s*(.+)/);
      if (itemMatch2 && currentPriority) {
        currentPriority.items.push({ id: itemMatch2[1].trim(), text: itemMatch2[2].trim() });
      }
      continue;
    }

    // Tolerant control regex: severity backtick is optional
    const controlMatch = line.match(/^####\s+(.+?)\s*\[(PASS|FAIL|MANUAL|N\/A)\]\s*(?:`([^`]*)`\s*)?$/);
    if (controlMatch) {
      currentControl = {
        title: controlMatch[1].trim().replace(/\s*--\s*/g, ' — '),
        verdict: controlMatch[2],
        severity: controlMatch[3] || null,
        section: currentSection ? currentSection.name : 'Autre',
        expected: '', observed: '', remediation: '', recommendation: ''
      };
      data.controls.push(currentControl);
      continue;
    }

    if (currentControl) {
      const attenduMatch = line.match(/^-\s+\*\*(?:Attendu|Valeur attendue)\*\*\s*:\s*(.+)/);
      if (attenduMatch) { currentControl.expected = attenduMatch[1].trim(); continue; }
      const constateMatch = line.match(/^-\s+\*\*(?:Constate|Constat|Valeur constatee)\*\*\s*:\s*(.+)/);
      if (constateMatch) { currentControl.observed = constateMatch[1].trim(); continue; }
      const recoMatch = line.match(/^-\s+\*\*Recommandation\*\*\s*:\s*(.+)/);
      if (recoMatch) { currentControl.recommendation = recoMatch[1].trim(); continue; }
    }

    const tableMatch = line.match(/^\|\s*(PASS|FAIL|MANUAL|N\/A)\s*\|\s*(\d+)\s*\|/i);
    if (tableMatch) {
      const key = tableMatch[1].toUpperCase();
      const val = parseInt(tableMatch[2]);
      if (key === 'PASS') data.summary.pass = val;
      else if (key === 'FAIL') data.summary.fail = val;
      else if (key === 'MANUAL') data.summary.manual = val;
      else if (key === 'N/A') data.summary.na = val;
      continue;
    }

    const totalMatch = line.match(/^\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|/);
    if (totalMatch) { data.summary.total = parseInt(totalMatch[1]); continue; }

    if (line.includes('Score de conformite') || line.includes('score de conformite')) {
      const sm = line.match(/(\d+)%/);
      if (sm) data.summary.score = parseInt(sm[1]);
      continue;
    }
  }

  if (data.summary.total === 0 && data.controls.length > 0) {
    data.summary.pass = data.controls.filter(c => c.verdict === 'PASS').length;
    data.summary.fail = data.controls.filter(c => c.verdict === 'FAIL').length;
    data.summary.manual = data.controls.filter(c => c.verdict === 'MANUAL').length;
    data.summary.na = data.controls.filter(c => c.verdict === 'N/A').length;
    data.summary.total = data.controls.length;
  }

  if (data.summary.score === 0 && (data.summary.pass + data.summary.fail) > 0) {
    data.summary.score = Math.round(data.summary.pass / (data.summary.pass + data.summary.fail) * 100);
  }

  if (inRemediationBlock) data.remediationBlock = remediationCode.trim();

  if (data.controls.length === 0) {
    console.warn('Warning: no controls parsed from the markdown. Check the format of #### headings.');
  }

  return data;
}

// ─── Enrich controls with reference data ───

function enrichControls(data) {
  for (const control of data.controls) {
    const controlId = getControlId(control.title);
    if (controlId && referenceDB[controlId]) {
      control.ref = referenceDB[controlId];
    }
  }
}

// ─── Generate report by injecting data into React template ───

function generateReport(data) {
  // Add traceability metadata
  const reportTimestamp = new Date().toISOString();
  const sourceHash = crypto.createHash('sha256').update(md).digest('hex');
  const reportId = sourceHash.slice(0, 12).toUpperCase();

  const reportData = {
    ...data,
    reportId,
    timestamp: reportTimestamp,
    sourceHash,
  };

  // Load pre-built React template
  const templatePath = path.resolve(__dirname, '..', 'report', 'dist', 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('Error: React template not found at', templatePath);
    console.error('Run "cd report && npm install && npm run build" first.');
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, 'utf-8');

  // Inject data by replacing the placeholder in the <script> tag
  // The template contains: window.__AUDIT_DATA__={"__PLACEHOLDER__":true}
  const json = JSON.stringify(reportData);
  const html = template.replace(
    'window.__AUDIT_DATA__={"__PLACEHOLDER__":true}',
    'window.__AUDIT_DATA__=' + json
  );

  if (html === template) {
    console.error('Error: placeholder not found in template. Template may be corrupted.');
    process.exit(1);
  }

  return html;
}

// ─── Main ───

const data = parseAuditMarkdown(md);
enrichControls(data);
const html = generateReport(data);
fs.writeFileSync(outputFile, html, 'utf-8');
console.log(`Report generated: ${outputFile} (${data.controls.length} controls, score: ${data.summary.score}%)`);
