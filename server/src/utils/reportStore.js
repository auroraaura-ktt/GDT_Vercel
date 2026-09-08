import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '..', '..', 'data');
const reportsFile = resolve(dataDir, 'reports.json');

function readReports() {
  if (!existsSync(reportsFile)) return [];

  try {
    const reports = JSON.parse(readFileSync(reportsFile, 'utf8'));
    return Array.isArray(reports) ? reports : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(reportsFile, JSON.stringify(reports, null, 2));
}

export function listReports() {
  return readReports().sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

export function createReport(report = {}) {
  const reports = readReports();
  const existing = reports.find((item) => (
    String(item.postId) === String(report.postId) && String(item.reporterId) === String(report.reporterId)
  ));

  if (existing) return { report: existing, duplicate: true };

  const nextReport = {
    id: report.id || `report-${Date.now()}`,
    postId: report.postId,
    reporterId: report.reporterId,
    reporter: report.reporter || 'MiitVerse member',
    type: report.type || 'Inappropriate content',
    status: 'Open',
    target: report.target || 'Reported post',
    author: report.author || 'Unknown author',
    details: report.details || '',
    createdAt: report.createdAt || new Date().toISOString(),
  };

  writeReports([nextReport, ...reports]);
  return { report: nextReport, duplicate: false };
}

export function updateReportById(reportId, patch = {}) {
  if (!reportId) return null;

  let changed = null;
  const reports = readReports().map((report) => {
    if (String(report.id) !== String(reportId)) return report;
    changed = { ...report, ...patch };
    return changed;
  });

  if (changed) writeReports(reports);
  return changed;
}

export function deleteReportById(reportId) {
  if (!reportId) return false;

  const reports = readReports();
  const nextReports = reports.filter((report) => String(report.id) !== String(reportId));
  if (nextReports.length === reports.length) return false;

  writeReports(nextReports);
  return true;
}
