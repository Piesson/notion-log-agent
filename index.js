#!/usr/bin/env node

const { Client } = require('@notionhq/client');
const { markdownToBlocks } = require('@tryfabric/martian');
const config = require('./config.json');

const notion = new Client({ auth: config.token });

async function createPage(category, title, content = '') {
  const cat = config.categories[category];
  if (!cat) {
    console.error(`Error: Unknown category '${category}'`);
    console.error(`Available: ${Object.keys(config.categories).join(', ')}`);
    process.exit(1);
  }

  const fullTitle = cat.prefix + title;

  let children = [];
  if (content) {
    try {
      children = markdownToBlocks(content);
    } catch (err) {
      children = [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: content.substring(0, 2000) } }]
        }
      }];
    }
  }

  const initialChildren = children.slice(0, 100);
  const remainingChildren = children.slice(100);

  try {
    const response = await notion.pages.create({
      parent: { page_id: cat.pageId },
      properties: {
        title: [{ text: { content: fullTitle } }]
      },
      children: initialChildren
    });

    if (remainingChildren.length > 0) {
      for (let i = 0; i < remainingChildren.length; i += 100) {
        const batch = remainingChildren.slice(i, i + 100);
        await notion.blocks.children.append({
          block_id: response.id,
          children: batch
        });
      }
    }

    const url = 'https://notion.so/' + response.id.replace(/-/g, '');
    console.log(`Created: ${fullTitle}`);
    console.log(`URL: ${url}`);
    return response;
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function searchPages(query) {
  try {
    const response = await notion.search({
      query: query,
      filter: { property: 'object', value: 'page' }
    });

    console.log(`Found ${response.results.length} pages matching "${query}":\n`);
    response.results.forEach((page, index) => {
      const title = page.properties.title?.title?.[0]?.plain_text || 'Untitled';
      console.log(`${index + 1}. ${title}`);
      console.log(`   ID: ${page.id}\n`);
    });
    return response.results;
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

async function appendToPage(pageId, content) {
  if (!content) {
    console.error('Error: Content is required for append');
    process.exit(1);
  }

  let children = [];
  try {
    children = markdownToBlocks(content);
  } catch (err) {
    children = [{
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: content.substring(0, 2000) } }]
      }
    }];
  }

  try {
    // Append in batches of 100
    for (let i = 0; i < children.length; i += 100) {
      const batch = children.slice(i, i + 100);
      await notion.blocks.children.append({
        block_id: pageId,
        children: batch
      });
    }

    const url = 'https://notion.so/' + pageId.replace(/-/g, '');
    console.log(`Appended content to page`);
    console.log(`URL: ${url}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`Usage:
  node index.js <category> "title" ["content"]
  cat file.md | node index.js <category> "title"
  node index.js search "query"
  node index.js append <pageId> "content"
  cat file.md | node index.js append <pageId>

Categories:
  coding     - 코딩로그 (📝 [코딩로그] prefix)
  ai-tech    - AI/Tech newsletter
  startup    - Startup related
  marketing  - Marketing related
  others     - Others

Examples:
  node index.js coding "New Feature" "## Details\\nImplemented X"
  node index.js ai-tech "GPT-5 News" "Summary here"
  node index.js search "test"
  node index.js append 2e6c5c69-xxxx-xxxx "## New Section\\nContent here"
`);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { resolve(data.trim()); });
    if (process.stdin.isTTY) { resolve(''); }
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === 'search') {
    await searchPages(args[1] || '');
    return;
  }

  if (args[0] === 'append') {
    const pageId = args[1];
    if (!pageId) {
      console.error('Error: Page ID is required for append');
      showHelp();
      process.exit(1);
    }
    const stdinContent = await readStdin();
    const content = stdinContent || args[2] || '';
    await appendToPage(pageId, content);
    return;
  }

  const category = args[0];
  const title = args[1];

  if (!title) {
    console.error('Error: Title is required');
    showHelp();
    process.exit(1);
  }

  const stdinContent = await readStdin();
  const content = stdinContent || args[2] || '';

  await createPage(category, title, content);
}

main();
