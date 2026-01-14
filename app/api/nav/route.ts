import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/*
 * This API route scans the Next.js app directory to build a menu structure
 * for the sidebar. It ignores dynamic segments and route groups and
 * returns a list of routes grouped by top‑level module. The CRM module
 * children are sorted according to the target‑state specification.
 */

export const runtime = "nodejs";
export const revalidate = 60;

const MODULE_PREFIXES = {
  dashboard: "/dashboard",
  kpi: "/kpi",
  crm: "/crm",
  ticketing: "/ticketing",
  dso: "/dso",
} as const;

type ModuleKey = keyof typeof MODULE_PREFIXES;

const CRM_ORDER = [
  "/crm/lead-inbox",
  "/crm/sales-inbox",
  "/crm/pipeline",
  "/crm/accounts",
  "/crm/targets",
  "/crm/imports",
  "/crm/activities",
];

function crmRank(href: string): number {
  const idx = CRM_ORDER.findIndex(
    (base) => href === base || href.startsWith(`${base}/`),
  );
  return idx === -1 ? 999 : idx;
}

const PAGE_FILES = new Set(["page.tsx", "page.jsx", "page.ts", "page.js"]);

function isSkippableDir(name: string): boolean {
  return (
    !name ||
    name.startsWith(".") ||
    name.startsWith("_") ||
    name.startsWith("@") ||
    name === "api" ||
    name === "components" ||
    name === "component" ||
    name === "lib" ||
    name === "utils"
  );
}

function stripRouteGroups(rel: string): string {
  return rel
    .split(path.sep)
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join(path.sep);
}

function hasPageFile(dirAbs: string): boolean {
  return Array.from(PAGE_FILES).some((file) => fs.existsSync(path.join(dirAbs, file)));
}

function containsDynamicSegment(routePath: string): boolean {
  return routePath.split("/").some((seg) => seg.startsWith("[") && seg.endsWith("]"));
}

function walkPages(appAbs: string): string[] {
  const found: Set<string> = new Set();
  const queue: string[] = [appAbs];
  while (queue.length) {
    const dirAbs = queue.shift()!;
    const relRaw = path.relative(appAbs, dirAbs);
    const rel = stripRouteGroups(relRaw);
    const routePath = rel ? `/${rel.replaceAll(path.sep, "/")}` : "/";
    if (routePath !== "/" && hasPageFile(dirAbs) && !containsDynamicSegment(routePath)) {
      found.add(routePath);
    }
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (isSkippableDir(name)) continue;
      if (name.startsWith("[") && name.endsWith("]")) continue;
      queue.push(path.join(dirAbs, name));
    }
  }
  return Array.from(found);
}

function prettifyLabelFromHref(href: string): string {
  const seg = href.split("/").filter(Boolean).pop() ?? href;
  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupRoutes(routes: string[]) {
  const modules: Record<ModuleKey, { children: { href: string; label: string }[] }> = {
    dashboard: { children: [] },
    kpi: { children: [] },
    crm: { children: [] },
    ticketing: { children: [] },
    dso: { children: [] },
  };
  const filtered = routes.filter((r) => r !== "/");
  for (const href of filtered) {
    const key = (Object.keys(MODULE_PREFIXES) as ModuleKey[]).find((k) => {
      const base = MODULE_PREFIXES[k];
      return href === base || href.startsWith(`${base}/`);
    });
    if (!key) continue;
    if (href === MODULE_PREFIXES[key]) continue;
    const label = prettifyLabelFromHref(href);
    modules[key].children.push({ href, label });
  }
  modules.crm.children.sort((a, b) => {
    const ra = crmRank(a.href);
    const rb = crmRank(b.href);
    if (ra !== rb) return ra - rb;
    return a.href.localeCompare(b.href);
  });
  modules.dashboard.children.sort((a, b) => a.href.localeCompare(b.href));
  modules.kpi.children.sort((a, b) => a.href.localeCompare(b.href));
  modules.ticketing.children.sort((a, b) => a.href.localeCompare(b.href));
  modules.dso.children.sort((a, b) => a.href.localeCompare(b.href));
  return modules;
}

export async function GET() {
  // Locate the app directory relative to the project root
  const root = process.cwd();
  const candidates = ["app", path.join("src", "app")];
  let appDirAbs: string | null = null;
  for (const dir of candidates) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) {
      appDirAbs = abs;
      break;
    }
  }
  if (!appDirAbs) {
    return NextResponse.json({ ok: false, error: "App directory not found" }, { status: 500 });
  }
  const routes = walkPages(appDirAbs);
  const modules = groupRoutes(routes);
  return NextResponse.json({ ok: true, modules });
}