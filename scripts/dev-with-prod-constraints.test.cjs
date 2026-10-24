const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const { constants } = require('node:os');

const source = fs.readFileSync(
  path.join(__dirname, 'dev-with-prod-constraints.js'),
  'utf8',
);

function launch({
  platform = 'darwin',
  releaseExists = true,
  spawnError,
  env = {},
} = {}) {
  const process = new EventEmitter();
  Object.assign(process, {
    platform,
    env,
    kill: (...args) => kills.push(args),
    exit: (code) => {
      exits.push(code);
      process.emit('exit', code);
    },
  });
  const children = [];
  const kills = [];
  const exits = [];
  const errors = [];
  const treeKills = [];
  vm.runInNewContext(source, {
    __dirname,
    process,
    console: {
      log() {},
      warn() {},
      error: (...args) => errors.push(args.join(' ')),
    },
    require: (name) => {
      if (name === 'child_process') {
        return {
          spawn: (command, args, options) => {
            if (spawnError) throw spawnError;
            const child = new EventEmitter();
            Object.assign(child, {
              pid: 100 + children.length,
              command,
              args,
              options,
            });
            children.push(child);
            return child;
          },
          spawnSync: (...args) => treeKills.push(args),
        };
      }
      if (name === 'fs') {
        return {
          existsSync: () => releaseExists,
          mkdirSync() {},
          readFileSync: () => '{}',
          writeFileSync() {},
        };
      }
      return require(name);
    },
  });
  return { process, children, kills, exits, errors, treeKills };
}

test('signal-terminated DLL build reports the signal and exits unsuccessfully', () => {
  const app = launch();
  app.children[0].emit('exit', null, 'SIGTERM');
  assert.deepEqual(app.exits, [128 + constants.signals.SIGTERM]);
  assert.match(app.errors[0], /DLL build terminated by SIGTERM/);
  assert.equal(app.children.length, 1);
});

test('build stages proceed in order and clean up only owned process groups', () => {
  const app = launch();
  assert.equal(app.kills.length, 0);
  app.children[0].emit('exit', 0, null);
  app.children[1].emit('exit', 0, null);
  assert.deepEqual(
    app.children.map((child) => Array.from(child.args)),
    [
      ['run', 'build:dll'],
      ['run', 'prestart'],
      ['run', 'start:renderer'],
    ],
  );
  assert.ok(app.children.every((child) => child.options.detached));
  assert.ok(app.children.every((child) => child.options.shell === false));
  app.process.emit('SIGINT');
  assert.deepEqual(app.kills, [
    [-100, 'SIGTERM'],
    [-101, 'SIGTERM'],
    [-102, 'SIGTERM'],
  ]);
  assert.deepEqual(app.exits, [128 + constants.signals.SIGINT]);
});

test('renderer signal termination is not reported as success', () => {
  const app = launch();
  app.children[0].emit('exit', 0, null);
  app.children[1].emit('exit', 0, null);
  app.children[2].emit('exit', null, 'SIGKILL');
  assert.deepEqual(app.exits, [128 + constants.signals.SIGKILL]);
});

test('preserves nonzero build codes and stops subsequent stages', () => {
  const app = launch();
  app.children[0].emit('exit', 7, null);
  assert.deepEqual(app.exits, [7]);
  assert.equal(app.children.length, 1);
});

test('handles asynchronous and synchronous spawn errors', () => {
  const app = launch();
  app.children[0].emit('error', new Error('ENOENT'));
  assert.deepEqual(app.exits, [1]);
  assert.match(app.errors[0], /DLL build could not start: ENOENT/);
  const sync = launch({ spawnError: new Error('spawn failed') });
  assert.deepEqual(sync.exits, [1]);
});

test('Windows cleanup uses taskkill only for the owned process tree', () => {
  const app = launch({ platform: 'win32' });
  assert.equal(app.children[0].options.detached, false);
  assert.equal(app.children[0].options.shell, true);
  app.process.emit('SIGTERM');
  assert.equal(app.kills.length, 0);
  assert.equal(app.treeKills[0][0], 'taskkill');
  assert.deepEqual(Array.from(app.treeKills[0][1]), [
    '/pid',
    '100',
    '/T',
    '/F',
  ]);
});

test('first-run install and rebuild failures do not continue startup', () => {
  for (const stage of [0, 1]) {
    const app = launch({ releaseExists: false });
    if (stage === 1) app.children[0].emit('exit', 0, null);
    app.children[stage].emit('exit', null, 'SIGTERM');
    assert.equal(app.children.length, stage + 1);
    assert.deepEqual(app.exits, [128 + constants.signals.SIGTERM]);
  }
});

test('a normal renderer exit ends the launcher successfully', () => {
  const app = launch();
  for (let i = 0; i < 3; i++) app.children[i].emit('exit', 0, null);
  assert.deepEqual(app.exits, [0]);
  assert.equal(app.kills.length, 3);
});

test('removes inherited Electron Node-only mode without mutating the host environment', () => {
  const env = { ELECTRON_RUN_AS_NODE: '1', PATH: '/usr/bin' };
  const app = launch({ env });
  app.children[0].emit('exit', 0, null);
  app.children[1].emit('exit', 0, null);
  for (const child of app.children) {
    assert.equal('ELECTRON_RUN_AS_NODE' in child.options.env, false);
    assert.equal(child.options.env.PATH, env.PATH);
  }
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
});
