import fs from 'fs';
import parser from '@babel/parser';

const code = fs.readFileSync('pages/Litigation.jsx', 'utf8');

try {
    parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log("No syntax errors found.");
} catch (error) {
    console.log(`Syntax error: ${error.message} at line ${error.loc.line}, col ${error.loc.column}`);
}
