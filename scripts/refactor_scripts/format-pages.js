const fs = require('fs');
const path = require('path');

const dir = 'g:/SD Commercial/APPS/sd-hr-crm-master/sd-hr-crm-master/frontend/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx')).map(f => path.join(dir, f));

const routeMap = {
    'Inspections': '/admin/inspections',
    'Incidents': '/admin/incidents',
    'AIRE Tasks': '/admin/aire-tasks',
    'Litigation': '/admin/litigation',
    'Forms': '/admin/forms',
    'Safeguarding Referrals': '/admin/safeguarding-referrals',
    'Safeguarding': '/admin/safeguarding-referrals',
    'Risk Assessments': '/admin/risk-assessments',
    'Vulnerable Users': '/admin/vulnerable-users',
    'Multi Agency': '/admin/multi-agency',
    'Multi-Agency': '/admin/multi-agency',
    'Multi Agency Interventions': '/admin/multi-agency',
    'HSE Incidents': '/admin/hse-incidents',
    'HSE Risk Management': '/admin/hse-risk-management',
    'HSE Training': '/admin/hse-training',
    'HSE Audits': '/admin/hse-audits',
    'HSE': '/admin/hse-incidents',
    'Complaints': '/admin/complaints',
    'VCS Organisations': '/admin/vcs-organisations',
    'Organisations': '/admin/vcs-organisations',
    'Case Management': '/admin/case-management',
    'Emergency Protocols': '/admin/emergency-protocols',
    'HR Management': '/admin/hr-management',
    'HR & Disciplinary': '/admin/hr-management',
    'Performance Management': '/admin/performance-management',
    'Employee Training': '/admin/employee-training',
    'Payroll': '/admin/payroll',
    'Access Management': '/admin/access-management',
    'Settings': '/admin/settings',
    'Bookings': '/admin/bookings',
    'Organization Chart': '/admin/organization-chart',
    'Compliance': '/admin/compliance',
    'Maintenance': '/admin/maintenance',
    'Reports': '/admin/reports',
    'Properties': '/admin/hotels',
    'Property': '/admin/hotels',
    'Hotels': '/admin/hotels',
    'Rooms': '/admin/rooms',
    'Staff': '/admin/users',
    'Service Users': '/admin/service-users'
};

let matchedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Breadcrumbs update
    content = content.replace(/(<Breadcrumbs\s+items=\{\s*\[)([\s\S]*?)(\]\s*\}\s*\/>)/g, (match, prefix, inner, suffix) => {
        let newInner = inner.replace(/\{\s*label:\s*(['"`])([^'"`]+)\1(?:\s*,\s*path:\s*(['"`])(?:[^'"`]*)\3)?\s*\}/g, (objMatch, q1, label) => {
            let exactPath = routeMap[label];
            if (exactPath) {
                return `{ label: '${label}', path: '${exactPath}' }`;
            }
            return `{ label: '${label}' }`;
        });
        return prefix + newInner + suffix;
    });

    // 2. Adjust Page Width
    content = content.replace(/(<(?:div|main)[^>]*min-h-screen[^>]*>\s*)<div[^>]*className=["']([^"']*)["'][^>]*>/i, (match, prefix, classNames) => {
        if (classNames.includes('max-w-') || classNames.includes('mx-auto') || classNames.includes('p-') || classNames.includes('w-')) {
            if (!classNames.includes("w-[90%] max-w-[1800px]")) {
                return prefix + '<div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">';
            }
        }
        return match;
    });

    content = content.replace(/(<div[^>]*h-screen[^>]*overflow-y-auto[^>]*>\s*)<div[^>]*className=["']([^"']*)["'][^>]*>/i, (match, prefix, classNames) => {
        if (classNames.includes('max-w-') || classNames.includes('mx-auto') || classNames.includes('p-')) {
            if (!classNames.includes("w-[90%] max-w-[1800px]")) {
                return prefix + '<div className="p-3 sm:p-4 md:p-6 w-[90%] max-w-[1800px] mx-auto">';
            }
        }
        return match;
    });

    if (original !== content) {
        fs.writeFileSync(file, content);
        matchedFiles++;
    }
});

console.log('Modified files:', matchedFiles);
