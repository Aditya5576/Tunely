import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ISSUE_TITLE = process.env.ISSUE_TITLE || '';
const ISSUE_BODY = process.env.ISSUE_BODY || '';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || '';

if (!GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY environment variable is missing.');
  console.log('Please add GEMINI_API_KEY to your GitHub Repository Secrets.');
  process.exit(1);
}

if (!ISSUE_TITLE) {
  console.error('❌ Error: ISSUE_TITLE environment variable is empty.');
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

async function runAIAgent() {
  try {
    console.log('📡 Calling Google Gemini API...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
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
      const errText = await response.text();
      throw new Error(`Gemini API HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean JSON text if wrapped in markdown block
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

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

    // Write summary for GitHub comment
    fs.writeFileSync('agent_summary.txt', `### 🤖 Tunely AI Agent Action Summary\n\n**Issue**: #${ISSUE_NUMBER} — *${ISSUE_TITLE}*\n\n**Changes Made**:\n${result.summary}\n\n**Modified Files**:\n${result.files.map(f => `- \`${f.path}\``).join('\n')}\n\n**Live App**: https://tunely.pages.dev`);

    console.log('✨ All file modifications applied successfully!');
  } catch (error) {
    console.error('❌ AI Agent Failed:', error);
    fs.writeFileSync('agent_summary.txt', `❌ **AI Agent Encountered an Error**:\n\`\`\`\n${error.message}\n\`\`\``);
    process.exit(1);
  }
}

runAIAgent();
