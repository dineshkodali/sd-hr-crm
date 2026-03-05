const fs = require('fs');
const path = require('path');

const dirs = [
    'g:/SD Commercial/APPS/sd-hr-crm-master/sd-hr-crm-master/frontend/pages',
    'g:/SD Commercial/APPS/sd-hr-crm-master/sd-hr-crm-master/frontend/components'
];

let modifiedFiles = 0;

function getFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            getFiles(fullPath, files);
        } else if (fullPath.endsWith('.jsx')) {
            files.push(fullPath);
        }
    }
    return files;
}

let allFiles = [];
dirs.forEach(dir => {
    allFiles = allFiles.concat(getFiles(dir));
});

allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix => corruption
    content = content.replace(/= className="rounded-xl">\s*/g, '=> ');

    // Fix /> corruption (e.g. <input ... / className=\"rounded-xl\"> -> <input ... className=\"rounded-xl\" />)
    // Let's replace the inserted string keeping the slash
    content = content.replace(/\/ className="rounded-xl">/g, '/>');

    // Fix `<button className="rounded-xl">` where there was NO classname before but we messed up the closing tag, wait
    // No, if it was `<button>` it became `<button className="rounded-xl">`. That's fine.

    // The second pass handles the ones that got missed by the bad regex.
    // Instead of complex regex for tags, we can just use simple string manipulation or parse carefully.
    // Actually, since most buttons now have rounded-xl or some other rounded class, 
    // Let's just fix the corruptions first to make sure the app compiles.

    if (original !== content) {
        fs.writeFileSync(file, content);
        modifiedFiles++;
    }
});
console.log('Fixed ' + modifiedFiles + ' files.');
