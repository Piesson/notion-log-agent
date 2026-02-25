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

async function getAllBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 });
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return blocks;
}

function blockToText(block, indent = '') {
  const type = block.type;
  const data = block[type];
  if (!data) return '';
  const richText = (data.rich_text || []).map(t => t.plain_text).join('');

  switch (type) {
    case 'heading_1': return `${indent}# ${richText}`;
    case 'heading_2': return `${indent}## ${richText}`;
    case 'heading_3': return `${indent}### ${richText}`;
    case 'paragraph': return richText ? `${indent}${richText}` : '';
    case 'bulleted_list_item': return `${indent}- ${richText}`;
    case 'numbered_list_item': return `${indent}1. ${richText}`;
    case 'to_do': return `${indent}- [${data.checked ? 'x' : ' '}] ${richText}`;
    case 'toggle': return `${indent}▶ ${richText}`;
    case 'quote': return `${indent}> ${richText}`;
    case 'callout': return `${indent}💬 ${richText}`;
    case 'code': return `${indent}\`\`\`${data.language || ''}\n${richText}\n\`\`\``;
    case 'divider': return `${indent}---`;
    case 'child_page': return `${indent}[PAGE] ${data.title} (id: ${block.id})`;
    case 'child_database': return `${indent}[DB] ${data.title} (id: ${block.id})`;
    default: return richText ? `${indent}${richText}` : '';
  }
}

async function readPage(pageId, depth = 0) {
  const indent = '  '.repeat(depth);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const title = page.properties?.title?.title?.[0]?.plain_text
      || page.properties?.Name?.title?.[0]?.plain_text
      || 'Untitled';
    const url = 'https://notion.so/' + pageId.replace(/-/g, '');
    console.log(`${indent}${'='.repeat(60 - depth * 2)}`);
    console.log(`${indent}TITLE: ${title}`);
    console.log(`${indent}URL: ${url}`);
    console.log(`${indent}${'='.repeat(60 - depth * 2)}\n`);
  } catch (e) {
    // title fetch failed, continue
  }

  const blocks = await getAllBlocks(pageId);
  const childPageIds = [];

  for (const block of blocks) {
    const line = blockToText(block, indent);
    if (line) console.log(line);

    // Recurse into toggle/column children
    if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      const children = await getAllBlocks(block.id);
      for (const child of children) {
        const childLine = blockToText(child, indent + '  ');
        if (childLine) console.log(childLine);
      }
    }

    if (block.type === 'child_page') {
      childPageIds.push({ id: block.id, title: block.child_page.title });
    }
  }

  if (childPageIds.length > 0) {
    console.log(`\n${indent}--- Child Pages (${childPageIds.length}) ---`);
    for (const cp of childPageIds) {
      console.log(`${indent}  [${cp.title}] id: ${cp.id}`);
    }
  }

  return childPageIds;
}

async function readPageDeep(pageId) {
  console.log('\n📖 Reading page...\n');
  const childPages = await readPage(pageId, 0);

  if (childPages.length > 0) {
    console.log('\n\n📂 Reading child pages...\n');
    for (const cp of childPages) {
      await readPage(cp.id, 1);
    }
  }
}

async function listSubpages(pageId) {
  const blocks = await getAllBlocks(pageId);
  const childPages = blocks.filter(b => b.type === 'child_page');
  console.log(`Found ${childPages.length} subpages:\n`);
  childPages.forEach((b, i) => {
    const url = 'https://notion.so/' + b.id.replace(/-/g, '');
    console.log(`${i + 1}. ${b.child_page.title}`);
    console.log(`   ID: ${b.id}`);
    console.log(`   URL: ${url}\n`);
  });
  return childPages;
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
  node index.js read <pageId>
  node index.js read-deep <pageId>
  node index.js subpages <pageId>
  node index.js append <pageId> "content"
  cat file.md | node index.js append <pageId>

Categories:
  coding     - 코딩로그 (📝 [코딩로그] prefix)
  ai-tech    - AI/Tech newsletter
  startup    - Startup related
  marketing  - Marketing related
  others     - Others
  funding    - Funding/Investment related

Examples:
  node index.js coding "New Feature" "## Details\\nImplemented X"
  node index.js ai-tech "GPT-5 News" "Summary here"
  node index.js search "test"
  node index.js read 286c5c69a2df802fa767c0edeacd68a7
  node index.js read-deep 286c5c69a2df802fa767c0edeacd68a7
  node index.js subpages 286c5c69a2df802fa767c0edeacd68a7
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

  if (args[0] === 'read') {
    const pageId = args[1];
    if (!pageId) {
      console.error('Error: Page ID is required for read');
      showHelp();
      process.exit(1);
    }
    await readPage(pageId);
    return;
  }

  if (args[0] === 'read-deep') {
    const pageId = args[1];
    if (!pageId) {
      console.error('Error: Page ID is required for read-deep');
      showHelp();
      process.exit(1);
    }
    await readPageDeep(pageId);
    return;
  }

  if (args[0] === 'subpages') {
    const pageId = args[1];
    if (!pageId) {
      console.error('Error: Page ID is required for subpages');
      showHelp();
      process.exit(1);
    }
    await listSubpages(pageId);
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
