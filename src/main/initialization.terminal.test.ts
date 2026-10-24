import fs from 'fs';
import path from 'path';
import ts from 'typescript';

test('app initialization never destroys terminal sessions restored by warmup', () => {
  // Inspect the startup boundary without importing Electron or starting services.
  const source = ts.createSourceFile(
    'initialization.ts',
    fs.readFileSync(path.join(__dirname, 'initialization.ts'), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const destructiveCalls: string[] = [];
  let initializesTerminalSettings = false;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        /^destroy(AllSessions(Force)?|Session)$/.test(callee.name.text)
      ) {
        destructiveCalls.push(callee.getText(source));
      }
      if (
        ts.isIdentifier(callee) &&
        callee.text === 'initializeTerminalSettings'
      ) {
        initializesTerminalSettings = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  expect(initializesTerminalSettings).toBe(true);
  expect(destructiveCalls).toEqual([]);
});
