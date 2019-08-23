const acorn = require('acorn');
const fs = require('fs');
const { resolve, basename } = require('path');
const meow = require('meow');
const globby = require('globby');

const VARIABLE_DECLARATION = 'VariableDeclaration';
const CLASS_DECLARATION = 'ClassDeclaration';
const EXPRESSION_STATEMENT = 'ExpressionStatement';
const FUNCTION_DECLARATION = 'FunctionDeclaration';
const FUNCTION_EXPRESSION = 'FunctionExpression';
const ARROW_FUNCTION_EXPRESSION = 'ArrowFunctionExpression';
const BAR_LENGTH = 100;
const BAR_TYPE = '_';

const readSourceFile = fileName => {
  try {
    const filePath = resolve(process.cwd(), fileName);
    return fs.readFileSync(filePath, { encoding: 'utf-8' });
  } catch (error) {
    console.log(`${fileName} does not exist.`);
  }
};

const walk = ast => {
  return ast.reduce((a, node) => {
    switch (node.type) {
      case CLASS_DECLARATION:
        a.push({ name: [node.id.name], methods: walk([node.body]) });
        return a;
      case 'ClassBody':
        return walk(node.body);
      case 'MethodDefinition':
        a.push(node.key.name);
        return a;
      case EXPRESSION_STATEMENT:
        if (node.expression.left) {
          a.push(node.expression.left.property.name);
          return a;
        }
        break;
      case 'ExportNamedDeclaration':
        return walk([node.declaration]);
      case 'ExportDefaultDeclaration':
        if (node.declaration.type === 'AssignmentExpression' && node.declaration.right.type === 'FunctionExpression') {
          a.push(node.declaration.left.name);
          return a;
        }
        break;
      case FUNCTION_DECLARATION:
        a.push(node.id.name);
        return a;
      case VARIABLE_DECLARATION:
        const {
          id: { name },
          init: { type }
        } = node.declarations[0];
        if (type === FUNCTION_EXPRESSION || type === ARROW_FUNCTION_EXPRESSION) {
          a.push(name);
          return a;
        }
    }
    return a;
  }, []);
};

const getIdentifiers = file => {
  const fileSource = readSourceFile(file);
  const sourceAst = acorn.parse(fileSource, { sourceType: 'module'}).body;
  return walk(sourceAst);
};
const times = (marker, length) => new Array(length).fill(marker).join('');

const printTable = identifiers => {
  const output = identifiers.map(({ name, body }) => {
    console.log('\n');
    console.log(times('\t', 3), name);
    console.log(times(BAR_TYPE, BAR_LENGTH));
    const formatttedBody = body
      .map(fileIdentifier => {
        if (fileIdentifier.name) {
          let classOutput = ' ' + fileIdentifier.name + '\n';
          classOutput += times(BAR_TYPE, BAR_LENGTH) + '\n';
          classOutput += '    ' + fileIdentifier.methods.join(', ') + '\n';
          classOutput += times(BAR_TYPE, BAR_LENGTH) + '\n';
          return classOutput;
        }
        return fileIdentifier + ' * ';
      })
      .join('');

    console.log(formatttedBody);
  });
};

(function() {
  const {
    input: dir,
    flags: { ext }
  } = meow();
  const fileExtension = ext || 'js';
  const directoryName = Array.isArray(dir) ? dir[0] : dir;
  const identifier = globby
    .sync(resolve(process.cwd(), directoryName, `*.${fileExtension}`))
    .map(file => ({ name: basename(file), body: getIdentifiers(file) }));
  printTable(identifier);
})();
