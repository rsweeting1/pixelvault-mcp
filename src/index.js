#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.PIXELVAULT_API_URL || 'https://asset-registry-api-production.up.railway.app';
const SITE_URL = 'https://pixelvault-ui.vercel.app';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`PixelVault API error ${res.status}: ${text}`);
  }
  return res.json();
}

function briefToFilters(brief = '', overrides = {}) {
  const b = brief.toLowerCase();
  let use_case = overrides.vertical || overrides.license_type || null;
  if (!use_case) {
    if (b.includes('film') || b.includes('tv') || b.includes('broadcast') || b.includes('streaming') || b.includes('b-roll')) {
      use_case = 'Film & TV';
    } else if (b.includes('editorial') || b.includes('news') || b.includes('magazine')) {
      use_case = 'Editorial';
    } else if (b.includes('ecommerce') || b.includes('brand') || b.includes('commercial')) {
      use_case = 'Commercial';
    }
  }
  const filters = {};
  if (use_case) filters.use_case = use_case;
  if (overrides.format) filters.type = overrides.format;
  return filters;
}

function formatAsset(asset, index) {
  const lines = [
    `[${index + 1}] ${asset.title || 'Untitled'} (ID: ${asset.asset_id || asset.id})`,
    `    Platform: ${asset.source_platform || 'Unknown'} | Status: ${asset.compliance_status || 'Cleared'} | Format: ${asset.type || 'Video'}`,
    `    Price: ${asset.price ? `$${asset.price}` : 'See site'}`,
  ];
  if (asset.description) lines.push(`    Description: ${asset.description}`);
  if (asset.emotional_tone) lines.push(`    Tone: ${asset.emotional_tone}`);
  lines.push(`    View: ${SITE_URL}`);
  return lines.join('\n');
}

const TOOLS = [
  {
    name: 'search_assets',
    description: 'Search PixelVault for pre-cleared, commercially licensed AI-generated assets matched to a creative brief. Every asset is sourced from licensed AI platforms (Adobe Firefly, Moonvalley) and carries a compliance-cleared status. Returns a ranked shortlist with compliance status, format, platform, and rationale.',
    inputSchema: {
      type: 'object',
      properties: {
        brief: { type: 'string', description: 'Natural language description of the visual asset needed.' },
        license_type: { type: 'string', enum: ['Film & TV', 'Editorial', 'Commercial'], description: 'License type required. Auto-detected from brief if omitted.' },
        format: { type: 'string', enum: ['video', 'image'], description: 'Asset format filter.' },
        vertical: { type: 'string', description: 'Vertical: post production, editorial, or ecommerce.' },
        territory: { type: 'string', description: 'Distribution territory (e.g. Worldwide, US Only).' },
      },
      required: ['brief'],
    },
  },
  {
    name: 'get_asset_details',
    description: 'Get full metadata and compliance documentation for a specific PixelVault asset by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID returned by search_assets.' },
      },
      required: ['asset_id'],
    },
  },
  {
    name: 'generate_usage_agreement',
    description: 'Generate a usage agreement document for approved PixelVault assets. Call after human approval of a shortlist.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_ids: { type: 'array', items: { type: 'string' }, description: 'Approved asset IDs.' },
        project_title: { type: 'string', description: 'Production or project title.' },
        production_company: { type: 'string', description: 'Production company name.' },
        distribution_platform: { type: 'string', description: 'Distribution platforms (e.g. Netflix, Broadcast).' },
        territory: { type: 'string', description: 'Distribution territory.' },
        air_date: { type: 'string', description: 'Anticipated air date (YYYY-MM-DD).' },
        license_type: { type: 'string', enum: ['Film & TV Commercial', 'Editorial', 'Commercial Digital'], description: 'License type.' },
      },
      required: ['asset_ids', 'project_title', 'production_company', 'distribution_platform', 'territory', 'license_type'],
    },
  },
];

async function handleSearchAssets(args) {
  const { brief, license_type, format, vertical, territory } = args;
  const filters = briefToFilters(brief, { license_type, format, vertical });
  let data;
  try {
    data = await apiFetch('/assets?' + new URLSearchParams(filters).toString());
  } catch (err) {
    return { content: [{ type: 'text', text: `Error querying PixelVault: ${err.message}\n\nVisit ${SITE_URL} directly.` }], isError: true };
  }
  const assets = (data.assets || []).slice(0, 10);
  if (assets.length === 0) {
    return { content: [{ type: 'text', text: `No assets found for: "${brief}"\n\nTry a broader brief or visit ${SITE_URL}` }] };
  }
  const text = [
    `PixelVault — Pre-Cleared Asset Shortlist`,
    `Brief: "${brief}"`,
    territory ? `Territory: ${territory}` : null,
    `License: ${filters.use_case || 'All'} | Status: All Cleared`,
    ``,
    `${assets.length} candidates found:`,
    ``,
    ...assets.map((a, i) => formatAsset(a, i)),
    ``,
    `All assets are pre-cleared. Human approval required. Use generate_usage_agreement after approval.`,
    `Checkout: ${SITE_URL}`,
  ].filter(l => l !== null).join('\n');
  return { content: [{ type: 'text', text }] };
}

async function handleGetAssetDetails(args) {
  const { asset_id } = args;
  let asset;
  try {
    const data = await apiFetch(`/asset/${asset_id}`);
    asset = data.asset || data;
  } catch (err) {
    return { content: [{ type: 'text', text: `Error fetching asset ${asset_id}: ${err.message}` }], isError: true };
  }
  const text = [
    `PixelVault Asset Details`,
    `ID: ${asset.asset_id || asset.id}`,
    `Title: ${asset.title || 'Untitled'}`,
    `Platform: ${asset.source_platform || 'Unknown'}`,
    `Compliance: ${asset.compliance_status || 'Cleared'}`,
    `License: ${asset.license_type || asset.use_case || 'See listing'}`,
    `Format: ${asset.type || 'Video'} | Price: ${asset.price ? `$${asset.price}` : 'See site'}`,
    `Description: ${asset.description || 'N/A'}`,
    `Tone: ${asset.emotional_tone || 'N/A'}`,
    `Approve and license: ${SITE_URL}`,
  ].join('\n');
  return { content: [{ type: 'text', text }] };
}

async function handleGenerateUsageAgreement(args) {
  const { asset_ids, project_title, production_company, distribution_platform, territory, air_date, license_type } = args;
  const today = new Date().toISOString().split('T')[0];
  const agreementId = `PV-${Date.now().toString(36).toUpperCase()}`;
  const text = [
    `PIXELVAULT USAGE AGREEMENT`,
    `Agreement ID: ${agreementId} | Generated: ${today} | Status: DRAFT`,
    ``,
    `Production Company: ${production_company}`,
    `Project: ${project_title}`,
    `License: ${license_type} | Platform: ${distribution_platform} | Territory: ${territory}`,
    air_date ? `Air Date: ${air_date}` : null,
    ``,
    `Approved Assets (${asset_ids.length}):`,
    ...asset_ids.map((id, i) => `  ${i + 1}. Asset ID: ${id}`),
    ``,
    `All assets sourced from licensed AI platforms (Adobe Firefly, Moonvalley).`,
    `Complete payment and execute at: ${SITE_URL}`,
    `Questions: outreach@pixelvaultai.com`,
  ].filter(l => l !== null).join('\n');
  return { content: [{ type: 'text', text }] };
}

const server = new Server({ name: 'pixelvault', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'search_assets': return await handleSearchAssets(args);
      case 'get_asset_details': return await handleGetAssetDetails(args);
      case 'generate_usage_agreement': return await handleGenerateUsageAgreement(args);
      default: throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
