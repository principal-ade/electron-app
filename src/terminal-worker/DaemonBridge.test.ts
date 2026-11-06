import { EventEmitter } from 'events';
import { Socket } from 'net';
import { DaemonBridge } from './DaemonBridge';
import { SOCKET_PATH, getDaemonPaths } from '../shared/pty-daemon/constants';

jest.mock('net', () => ({ Socket: jest.fn() }));

test.each([
  undefined,
  getDaemonPaths('development').socketPath,
  getDaemonPaths('production').socketPath,
])('connects only to the selected socket: %s', async (socketPath) => {
  const socket = Object.assign(new EventEmitter(), {
    connect: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  });
  jest.mocked(Socket).mockImplementation(() => socket as unknown as Socket);
  const bridge = new DaemonBridge(socketPath);
  const connected = bridge.connect();
  expect(socket.connect).toHaveBeenCalledTimes(1);
  expect(socket.connect).toHaveBeenCalledWith(socketPath ?? SOCKET_PATH);
  socket.emit('connect');
  socket.emit('data', Buffer.from('{"type":"sessions","sessions":[]}\n'));
  await expect(connected).resolves.toEqual([]);
  bridge.disconnect();
});

test('forwards the request id with a daemon scrollback snapshot', async () => {
  const socket = Object.assign(new EventEmitter(), {
    connect: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  });
  jest.mocked(Socket).mockImplementation(() => socket as unknown as Socket);
  const bridge = new DaemonBridge();
  const connected = bridge.connect();
  socket.emit('connect');
  socket.emit('data', Buffer.from('{"type":"sessions","sessions":[]}\n'));
  await connected;

  const onScrollback = jest.fn();
  bridge.on('scrollback', onScrollback);
  socket.emit(
    'data',
    Buffer.from(
      '{"type":"scrollback","id":"session-1","data":"output","requestId":"request-1"}\n',
    ),
  );

  expect(onScrollback).toHaveBeenCalledWith('session-1', 'output', 'request-1');
  bridge.disconnect();
});
