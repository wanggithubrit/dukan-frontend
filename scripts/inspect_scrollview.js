const fs=require('fs');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const code=fs.readFileSync('app/shop/home.js','utf8');
const ast=parser.parse(code,{sourceType:'module',plugins:['jsx']});
let found=false;
traverse(ast,{JSXElement(path){const n=path.node.openingElement.name; if(n.type==='JSXIdentifier'&&n.name==='ScrollView'&&!found){found=true;console.log('ScrollView at',path.node.loc.start.line);path.node.children.forEach((child,i)=>{console.log(i,child.type,child.loc?child.loc.start.line:null,child.type==='JSXExpressionContainer'?child.expression.type:child.type);});}}});
