const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const code = fs.readFileSync('app/shop/home.js', 'utf8');
const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
const results = [];
traverse(ast, {
  JSXText(path) {
    const v = path.node.value;
    if (!v.trim()) return;
    let parent = path.parentPath;
    while (parent && parent.type !== 'JSXElement') parent = parent.parentPath;
    let parentName = '(none)';
    if (parent && parent.node && parent.node.openingElement) {
      const n = parent.node.openingElement.name;
      if (n.type === 'JSXIdentifier') parentName = n.name;
      else if (n.type === 'JSXMemberExpression') parentName = (n.object?.name || '') + '.' + (n.property?.name || '');
      else parentName = '(complex)';
    }
    results.push({ text: v.trim(), line: path.node.loc.start.line, parent: parentName });
  }
});
console.log(JSON.stringify(results, null, 2));
