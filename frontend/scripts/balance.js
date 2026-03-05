import fs from 'fs';
import parser from '@babel/parser';

const code = fs.readFileSync('pages/Incidents.jsx', 'utf8');

try {
    parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log("No syntax errors found.");
} catch (error) {
    fs.writeFileSync('output-babel.txt', `${error.message}\nLine: ${error.loc.line}, Col: ${error.loc.column}\n`, 'utf8');
    console.log("Syntax error details written to output-babel.txt");
}
