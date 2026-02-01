#!/usr/bin/env tsx
/**
 * Route Extractor - Extracts routes from React Router files and generates routes.json
 * 
 * This script parses the frontend router files to extract all route definitions
 * and generates a JSON file that can be consumed by the backend for schema generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

interface RouteDefinition {
  path: string;
  description: string;
  category: 'main' | 'settings' | 'compliance' | 'authentication' | 'other';
  params?: string[];
  queryParams?: string[];
  examples?: string[];
  tabs?: string[];
}

interface RouteConfig {
  generatedAt: string;
  routes: RouteDefinition[];
}

interface PageTabInfo {
  file: string;
  route: string;
  tabs: string[];
}

// Parse a router file and extract routes
function extractRoutesFromFile(filePath: string): RouteDefinition[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes: RouteDefinition[] = [];

  // Regular expression to match Route components
  // Matches: <Route path="/some/path" element={<Component />} />
  const routeRegex = /<Route\s+path="([^"]+)"\s+element={[^}]+}/g;
  
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const path = match[1];
    
    // Skip wildcard and redirect routes
    if (path === '/*' || path === '/') continue;
    
    // Determine category
    let category: RouteDefinition['category'] = 'other';
    if (path.startsWith('/settings')) category = 'settings';
    else if (path.startsWith('/compliance')) category = 'compliance';
    else if (path.startsWith('/auth')) category = 'authentication';
    else if (!path.includes(':')) category = 'main';
    
    // Extract path parameters (e.g., :id, :pluginId)
    const paramMatches = path.match(/:(\w+)/g);
    const params = paramMatches ? paramMatches.map(p => p.substring(1)) : [];
    
    // Generate description from path
    const description = generateDescription(path);
    
    routes.push({
      path,
      description,
      category,
      params: params.length > 0 ? params : undefined,
    });
    
    // Special handling for /workspace/:id - add sub-routes based on Workspace component tabs
    if (path === '/workspace/:id') {
      const workspaceSubRoutes = [
        { suffix: '/calendar', desc: 'Workspace calendar view' },
        { suffix: '/scheduler', desc: 'Workspace scheduler view' },
        { suffix: '/map', desc: 'Workspace map view' },
        { suffix: '/board', desc: 'Workspace board/kanban view' },
        { suffix: '/statistics', desc: 'Workspace statistics and analytics' },
        { suffix: '/settings', desc: 'Workspace settings and configuration' },
      ];
      
      workspaceSubRoutes.forEach(({ suffix, desc }) => {
        routes.push({
          path: path + suffix,
          description: desc,
          category,
          params: ['id'],
        });
      });
    }
  }
  
  return routes;
}

// Generate a human-readable description from a path
function generateDescription(path: string): string {
  // Remove leading slash and split by '/'
  const segments = path.replace(/^\//, '').split('/');
  
  // Capitalize and format each segment
  const formatted = segments.map(segment => {
    if (segment.startsWith(':')) {
      return 'specific ' + segment.substring(1).replace(/([A-Z])/g, ' $1').toLowerCase();
    }
    return segment.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').trim();
  }).join(' ');
  
  // Capitalize first letter
  return formatted.charAt(0).toUpperCase() + formatted.slice(1) + ' page';
}

// Scan a file for tab usage (searchParams.get('tab') pattern)
function extractTabsFromFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tabs = new Set<string>();
  
  // Find TabsTrigger value attributes: <TabsTrigger value="something">
  const tabTriggerRegex = /<TabsTrigger\s+value="([^"]+)"/g;
  let match;
  while ((match = tabTriggerRegex.exec(content)) !== null) {
    tabs.add(match[1]);
  }
  
  // Also check for default tab values: searchParams.get('tab') || 'default' (quote-agnostic)
  const defaultTabRegex = /searchParams\.get\(["']tab["']\)\s*\|\|\s*["']([^"']+)["']/g;
  while ((match = defaultTabRegex.exec(content)) !== null) {
    tabs.add(match[1]);
  }
  
  return Array.from(tabs);
}

// Map route paths to their corresponding component files
function mapRoutesToComponents(projectRoot: string): Map<string, string> {
  const routeToComponent = new Map<string, string>();
  
  // Hardcoded mappings based on router files (relative paths from project root)
  const mappings: Record<string, string> = {
    '/settings': 'src/pages/settings/Settings.tsx',
    '/settings/forms': 'src/pages/settings/sub_pages/forms/Forms.tsx',
    '/broadcasts': 'src/pages/broadcasts/BroadcastsPage.tsx',
    '/plugins/:pluginId/settings': 'src/pages/PluginSettings.tsx',
    '/settings/gamification': 'src/pages/settings/sub_pages/gamification/GamificationSettings.tsx',
    '/settings/analytics': 'src/pages/settings/sub_pages/analytics/AnalyticsSettings.tsx',
    '/settings/motivation': 'src/pages/settings/sub_pages/motivation/MotivationSettings.tsx',
    '/settings/kpi-cards': 'src/pages/settings/sub_pages/kpi-cards-settings/KpiCardsSettings.tsx',
    '/integrations': 'src/pages/Integrations.tsx',
  };
  
  for (const [route, componentPath] of Object.entries(mappings)) {
    routeToComponent.set(route, componentPath);
  }
  
  return routeToComponent;
}

// Discover all pages that use URL-based tabs
async function discoverTabPages(projectRoot: string): Promise<PageTabInfo[]> {
  const pagesDir = path.join(projectRoot, 'src', 'pages');
  const pageTabInfo: PageTabInfo[] = [];
  
  // Find all files containing searchParams.get('tab')
  const files = await glob('**/*.{tsx,ts}', { 
    cwd: pagesDir,
    absolute: true 
  });
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check if file uses URL-based tabs (quote-agnostic)
      if (content.match(/searchParams\.get\(["']tab["']\)/)) {
        const tabs = extractTabsFromFile(file);
        
        if (tabs.length > 0) {
          // Try to infer the route from the file path
          // Normalize Windows backslashes to forward slashes
          const relativePath = path.relative(pagesDir, file).replace(/\\/g, '/');
          let route = inferRouteFromPath(relativePath);
          
          pageTabInfo.push({
            file: path.relative(projectRoot, file).replace(/\\/g, '/'),
            route,
            tabs,
          });
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  return pageTabInfo;
}

// Infer route path from file path
function inferRouteFromPath(relativePath: string): string {
  // Remove file extension
  let route = relativePath.replace(/\.(tsx|ts)$/, '');
  
  // Handle special cases
  if (route.includes('settings/sub_pages/')) {
    route = route.replace('settings/sub_pages/', 'settings/');
  }
  if (route.endsWith('/index')) {
    route = route.replace('/index', '');
  }
  if (route.match(/[A-Z]/)) {
    // Convert PascalCase to kebab-case
    route = route.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  }
  
  // Ensure leading slash
  if (!route.startsWith('/')) {
    route = '/' + route;
  }
  
  return route;
}

// Hardcoded tabs for pages that use custom tab implementations (UrlTabs, etc.)
const HARDCODED_TABS: Record<string, string[]> = {
  '/settings': ['favorites', 'basics', 'advanced'],
  '/broadcasts': ['all', 'my-broadcasts', 'pending', 'completed'],
  '/settings/forms': ['list', 'builder'],
  '/settings/slas': ['slas', 'alerts', 'policies'],
};

// Add discovered tabs to routes
function enrichRoutesWithTabInfo(
  routes: RouteDefinition[], 
  pageTabInfo: PageTabInfo[],
  routeToComponent: Map<string, string>
): RouteDefinition[] {
  return routes.map(route => {
    // Check for hardcoded tabs first
    if (HARDCODED_TABS[route.path]) {
      return {
        ...route,
        tabs: HARDCODED_TABS[route.path],
        queryParams: ['tab', ...(route.queryParams || [])],
      };
    }
    
    // Check if this route has a component with tabs via exact mapping
    const componentPath = routeToComponent.get(route.path);
    let tabInfo = pageTabInfo.find(info => componentPath && info.file === componentPath);
    
    // Fallback: match by route path inference
    if (!tabInfo) {
      tabInfo = pageTabInfo.find(info => {
        const inferredRoute = info.route;
        return inferredRoute === route.path || 
               route.path.startsWith(inferredRoute + '/');
      });
    }
    
    if (tabInfo && tabInfo.tabs.length > 0) {
      return {
        ...route,
        tabs: tabInfo.tabs,
        queryParams: ['tab', ...(route.queryParams || [])],
      };
    }
    
    return route;
  });
}

// Add usage examples for routes
function addExamples(routes: RouteDefinition[]): RouteDefinition[] {
  return routes.map(route => {
    const examples: string[] = [];
    
    // Add base path example if it has params
    if (route.params) {
      let examplePath = route.path;
      route.params.forEach(param => {
        examplePath = examplePath.replace(`:${param}`, `<${param}>`);
      });
      examples.push(examplePath);
    }
    
    // Add tab examples if route has tabs
    if (route.tabs && route.tabs.length > 0) {
      // Add a few representative tab examples
      const basePath = route.path;
      const exampleTabs = route.tabs.slice(0, 3); // First 3 tabs
      
      exampleTabs.forEach(tab => {
        let examplePath = basePath;
        
        // Replace params with placeholders if needed
        if (route.params) {
          route.params.forEach(param => {
            examplePath = examplePath.replace(`:${param}`, `<${param}>`);
          });
        }
        
        examples.push(`${examplePath}?tab=${tab}`);
      });
      
      // Special case for forms with editing_form parameter
      if (route.path === '/settings/forms' && route.tabs.includes('builder')) {
        examples.push('/settings/forms?tab=builder&editing_form=<form_id>');
      }
    }
    
    return examples.length > 0 ? { ...route, examples } : route;
  });
}

// Main execution
async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..');
  const routerDir = path.join(projectRoot, 'src', 'router');
  
  console.log('🔍 Extracting routes from React Router files...');
  
  // Extract routes from router files
  const homeRouterPath = path.join(routerDir, 'HomeRouter.tsx');
  const appRouterPath = path.join(routerDir, 'AppRouter.tsx');
  
  let allRoutes: RouteDefinition[] = [];
  
  if (fs.existsSync(homeRouterPath)) {
    console.log('  📄 Processing HomeRouter.tsx...');
    allRoutes = allRoutes.concat(extractRoutesFromFile(homeRouterPath));
  }
  
  if (fs.existsSync(appRouterPath)) {
    console.log('  📄 Processing AppRouter.tsx...');
    allRoutes = allRoutes.concat(extractRoutesFromFile(appRouterPath));
  }
  
  // Discover pages with URL-based tabs
  console.log('\n🔎 Scanning for pages with URL-based tabs...');
  const pageTabInfo = await discoverTabPages(projectRoot);
  console.log(`  Found ${pageTabInfo.length} pages with tabs`);
  
  pageTabInfo.forEach(info => {
    console.log(`  - ${info.route}: ${info.tabs.join(', ')}`);
  });
  
  // Map routes to component files
  const routeToComponent = mapRoutesToComponents(projectRoot);
  
  // Enrich with tab info and examples
  allRoutes = enrichRoutesWithTabInfo(allRoutes, pageTabInfo, routeToComponent);
  allRoutes = addExamples(allRoutes);
  
  // Sort by category and path
  allRoutes.sort((a, b) => {
    if (a.category !== b.category) {
      const order = ['main', 'settings', 'compliance', 'authentication', 'other'];
      return order.indexOf(a.category) - order.indexOf(b.category);
    }
    return a.path.localeCompare(b.path);
  });
  
  // Create output config
  const config: RouteConfig = {
    generatedAt: new Date().toISOString(),
    routes: allRoutes,
  };
  
  // Write to JSON file
  const outputPath = path.join(projectRoot, 'routes.json');
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');
  
  console.log(`\n✅ Extracted ${allRoutes.length} routes`);
  console.log(`📝 Written to: ${outputPath}`);
  console.log('\nRoute breakdown:');
  
  const categoryCounts = allRoutes.reduce((acc, route) => {
    acc[route.category] = (acc[route.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(categoryCounts).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} routes`);
  });
  
  // Count routes with tabs
  const routesWithTabs = allRoutes.filter(r => r.tabs && r.tabs.length > 0);
  console.log(`\n📑 Routes with tabs: ${routesWithTabs.length}`);
  routesWithTabs.forEach(route => {
    console.log(`  ${route.path}: ${route.tabs?.length} tabs (${route.tabs?.join(', ')})`);
  });
}

main();
