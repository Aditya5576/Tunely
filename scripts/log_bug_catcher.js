import fs from 'fs';
import path from 'path';

const API_BASE = 'https://jiosaavn-api.adityapatil2348.workers.dev';
const LOG_DIR = path.resolve('logs');
const REPORT_FILE = path.join(LOG_DIR, 'bug_catcher_report.md');
const AUDIT_JSON = path.join(LOG_DIR, 'bug_catcher_audit.json');
const HISTORY_FILE = path.join(LOG_DIR, 'bug_history_ledger.json');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

console.log('🔍 Running Tunely Background Log & Bug Catcher Audit...');

async function checkWorkerApiHealth() {
  const endpoints = [
    { name: 'Root Edge Endpoint', url: `${API_BASE}/` },
    { name: 'Song Details Stream API', url: `${API_BASE}/api/songs/rjkrTnma` },
    { name: 'Global Song Search API', url: `${API_BASE}/api/search/songs?query=Kesariya` }
  ];

  const results = [];
  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(ep.url);
      const duration = Date.now() - start;
      if (res.ok) {
        results.push({ name: ep.name, url: ep.url, status: 'HEALTHY (200 OK)', latency: `${duration}ms` });
      } else {
        results.push({ name: ep.name, url: ep.url, status: `WARNING (HTTP ${res.status})`, latency: `${duration}ms` });
      }
    } catch (err) {
      results.push({ name: ep.name, url: ep.url, status: `CRITICAL (${err.message})`, latency: 'TIMEOUT/FAILED' });
    }
  }
  return results;
}

function checkFrontendIntegrity() {
  const issues = [];
  
  // 1. Check AudioContext.jsx for call recovery & audio interruption handlers
  const audioContextPath = path.resolve('src/context/AudioContext.jsx');
  if (fs.existsSync(audioContextPath)) {
    const content = fs.readFileSync(audioContextPath, 'utf8');
    if (!content.includes('wasPlayingBeforeInterruptionRef')) {
      issues.push({ id: 'BUG-101', severity: 'High', area: 'Audio Interruption', detail: 'Phone call auto-resume tracker ref missing in AudioContext.' });
    }
    if (!content.includes('audioContextRef.current.resume()')) {
      issues.push({ id: 'BUG-102', severity: 'Medium', area: 'Web Audio', detail: 'Web Audio context auto-resumption missing after OS pause.' });
    }
  }

  // 2. Check GitHub Action workflow configuration
  const workflowPath = path.resolve('.github/workflows/ai-issue-agent.yml');
  if (fs.existsSync(workflowPath)) {
    const content = fs.readFileSync(workflowPath, 'utf8');
    if (!content.includes('secrets.GEMINI_API_KEY || secrets.ANTIGRAVITY_GITHUB_CONTROLLER')) {
      issues.push({ id: 'BUG-103', severity: 'Medium', area: 'GitHub Action', detail: 'Workflow does not fallback to ANTIGRAVITY_GITHUB_CONTROLLER secret.' });
    }
  }

  return issues;
}

async function runBugCatcher() {
  const timestamp = new Date().toISOString();
  console.log(`⏱️ Audit Timestamp: ${timestamp}`);

  const apiStatus = await checkWorkerApiHealth();
  const codeIssues = checkFrontendIntegrity();

  let history = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    } catch {
      history = [];
    }
  }

  // Record historical audit entry
  const currentRecord = {
    timestamp,
    apiStatus,
    codeIssues,
    overallStatus: codeIssues.length === 0 && apiStatus.every(s => s.status.includes('200')) ? 'STABLE 🟢' : 'ATTENTION REQUIRED ⚠️'
  };

  history.unshift(currentRecord);
  history = history.slice(0, 50); // Keep last 50 audit logs
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  fs.writeFileSync(AUDIT_JSON, JSON.stringify(currentRecord, null, 2));

  const markdownReport = `# 🛡️ Tunely Background Bug & Log Catcher Master Report

*Last Audit Timestamp:* \`${timestamp}\`  
*Overall System Health:* **${currentRecord.overallStatus}**

---

## 🌐 1. Edge API & Worker Services Health
| Endpoint Name | URL | Status | Response Time |
| :--- | :--- | :--- | :--- |
${apiStatus.map(s => `| **${s.name}** | \`${s.url}\` | ${s.status.includes('200') ? '🟢 ' + s.status : '⚠️ ' + s.status} | \`${s.latency}\` |`).join('\n')}

---

## 🔍 2. Codebase & Runtime Integrity Checks
${codeIssues.length === 0 ? '✅ **100% System Health.** Zero runtime or codebase integrity bugs detected.' : codeIssues.map(i => `- **[${i.severity}]** *${i.area}*: ${i.detail}`).join('\n')}

---

## 📋 3. Historical Bug & Log Summary (Last 5 Entries)
${history.slice(0, 5).map(h => `- **${h.timestamp}**: Status = \`${h.overallStatus}\` (APIs: ${h.apiStatus.filter(a => a.status.includes('200')).length}/${h.apiStatus.length} healthy)`).join('\n')}

---
*Report maintained continuously by Tunely Log & Bug Catcher Daemon.*
`;

  fs.writeFileSync(REPORT_FILE, markdownReport);
  console.log('✅ Log Catcher Audit Complete! Master report written to logs/bug_catcher_report.md');
}

runBugCatcher();
