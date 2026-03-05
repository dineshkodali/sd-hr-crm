const fs = require('fs');
const parser = require('@babel/parser');
const file = fs.readFileSync('c:/Users/SD Plexal 13/Downloads/sd-hr-crm-master/sd-hr-crm-master/frontend/pages/Incidents.jsx', 'utf8');

try {
    parser.parse(file, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log("No syntax errors found.");
} catch (error) {
    fs.writeFileSync('output2.txt', `${error.message}\n${JSON.stringify(error.loc)}`, 'utf8');
}
