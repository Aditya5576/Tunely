import fs from 'fs';
import path from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ISSUE_TITLE = process.env.ISSUE_TITLE || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || '';

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY environment variable is missing.');
  fs.writeFileSync('agent_summary.txt', `❌ **Error**: \`GEMINI_API_KEY\` secret is missing in GitHub Repository Secrets.\n\nPlease add \`GEMINI_API_KEY\` to your repo settings: https://github.com/Aditya5576/Tunely/settings/secrets/actions`);
  process.exit(1);
}

if (!ISSUE_TITLE) {
  console.error('❌ Error: ISSUE_TITLE environment variable is empty.');
  fs.writeFileSync('agent_summary.txt', '❌ Error: Issue title was empty.');
  process.exit(1);
}

console.log(`🤖 Starting AI Agent for GitHub Issue #${ISSUE_NUMBER}: "${ISSUE_TITLE}"`);

// Key source files to analyze
const KEY_FILES = [
  'src/App.jsx',
  'src/context/AudioContext.jsx',
  'src/context/AuthContext.jsx',
  'src/components/PlayerBar.jsx',
  'src/components/MainContent.jsx',
  'src/components/Sidebar.jsx',
  'src/components/SongRow.jsx',
  'src/index.css'
];

let codebaseContext = '';
for (const relPath of KEY_FILES) {
  if (fs.existsSync(relPath)) {
    const content = fs.readFileSync(relPath, 'utf8');
    codebaseContext += `\n\n=== FILE: ${relPath} ===\n${content}`;
  }
}

const prompt = `You are Tunely's automated AI Senior Developer.

USER REQUEST (GitHub Issue #${ISSUE_NUMBER}):
Title: ${ISSUE_TITLE}
Description: ${ISSUE_BODY}

Below is the relevant source code of the Tunely application:
${codebaseContext}

TASK:
Analyze the request and codebase. Determine the EXACT code changes needed.
Return your response STRICTLY as a valid JSON object with the following structure (do NOT include any markdown codeblocks or conversational text around the JSON):

{
  "summary": "Short explanation of the fix or feature applied",
  "files": [
    {
      "path": "src/components/PlayerBar.jsx",
      "content": "COMPLETE_FULL_FILE_CONTENT_AFTER_EDITS"
    }
  ]
}

CRITICAL RULES:
1. "content" MUST contain the COMPLETE updated file content (not diffs or snippets).
2. Ensure valid React 19 / JSX / Vanilla CSS syntax.
3. Keep existing imports and functionality intact while solving the user's issue.
4. Output ONLY valid raw JSON.`;

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

async function callGemini() {
  for (const model of MODELS) {
    try {
      console.log(`📡 Trying Gemini API model: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        console.warn(`Model ${model} returned HTTP ${response.status}. Trying next fallback...`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.warn(`Model ${model} failed: ${e.message}`);
    }
  }
  throw new Error("All Gemini model endpoints failed.");
}

async function runAIAgent() {
  try {
    const result = await callGemini();
    console.log(`✅ AI Summary: ${result.summary}`);

    let modifiedCount = 0;
    if (Array.isArray(result.files)) {
      for (const file of result.files) {
        if (file.path && file.content) {
          const fullPath = path.resolve(file.path);
          fs.writeFileSync(fullPath, file.content, 'utf8');
          console.log(`📝 Updated file: ${file.path}`);
          modifiedCount++;
        }
      }
    }

    if (modifiedCount === 0) {
      console.log('⚠️ No code changes were produced by AI.');
      fs.writeFileSync('agent_summary.txt', 'No code modifications were required.');
      return;
    }

    fs.writeFileSync('agent_summary.txt', `### 🤖 Tunely AI Agent Action Summary\n\n**Issue**: #${ISSUE_NUMBER} — *${ISSUE_TITLE}*\n\n**Changes Made**:\n${result.summary}\n\n**Modified Files**:\n${result.files.map(f => `- \`${f.path}\``).join('\n')}\n\n**Live App**: https://tunely.pages.dev`);

    console.log('✨ All file modifications applied successfully!');
  } catch (error) {
    console.error('❌ AI Agent Failed:', error);
    fs.writeFileSync('agent_summary.txt', `❌ **AI Agent Encountered an Error**:\n\`\`\`\n${error.message}\n\`\`\``);
    process.exit(1);
  }
}

runAIAgent();
